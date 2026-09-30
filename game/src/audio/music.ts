import { loadPrefs } from '../save';
import { context } from '../ui/audio';

// Musik im Stil alter Konsolen: ein kleiner Sequenzer auf Web Audio mit synthetisierten
// Instrumenten. Lieder sind Notendaten (songs.ts) oder echte MIDI-Dateien: Liegt unter
// public/assets/music/<id>.mid eine Datei, ersetzt sie das eingebaute Lied gleichen Namens.
//
// Der Nebel des Ungefähren wirkt auch auf die Musik: Je dichter er ist, desto verstimmter und
// wackliger klingen die Töne, desto dumpfer der Klang, und Begleitung und Schlagzeug treten zurück.
// Mit dem Splitter wird die Musik wieder genau (setFog).

export type Instrument = 'lead' | 'flute' | 'pluck' | 'bass' | 'pad' | 'bell' | 'drums';
export type Layer = 'melody' | 'bass' | 'harmony' | 'drums';

/** Ein Ton oder Akkord: Beginn und Länge in Achteln, MIDI-Tonhöhen (Schlagzeug: 'k', 's', 'h', 'a', 't') */
export interface NoteEvent {
  at: number;
  len: number;
  notes: (number | string)[];
  vel: number;
}

export interface Track {
  instrument: Instrument;
  layer: Layer;
  volume: number;
  events: NoteEvent[];
}

export interface Song {
  bpm: number;
  /** Länge der Schleife in Achteln */
  length: number;
  tracks: Track[];
  /** einmal abspielen statt schleifen (Fanfare) */
  oneShot?: boolean;
}

const LAYERS: Layer[] = ['melody', 'bass', 'harmony', 'drums'];

// ---------- Notation ----------

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** „C#4“ → 61, „Bb2“ → 46 */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Unbekannte Note: ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/**
 * Kurzschrift wie in einem Tracker: „D5:3 A4:1 | C4+E4+G4:8 | -:2 k+h:1“.
 * Länge in Achteln, ohne Längenangabe gilt die vorige. „-“ ist Pause, „+“ verbindet Akkordtöne,
 * „|“ trennt Takte (wird geprüft, damit jeder Takt aufgeht). Kleinbuchstaben sind Schlagzeug.
 */
export function parseNotes(src: string, barLen: number, name = ''): NoteEvent[] {
  const events: NoteEvent[] = [];
  let at = 0;
  let len = 2;
  src
    .split('|')
    .map((b) => b.trim())
    .filter(Boolean)
    .forEach((bar, bi) => {
      const start = at;
      for (const tok of bar.split(/\s+/)) {
        const [pitch, l] = tok.split(':');
        if (l) len = Number(l);
        if (pitch !== '-') {
          const notes = pitch.split('+').map((p) => (/^[a-z]$/.test(p) ? p : midiOf(p)));
          events.push({ at, len, notes, vel: 1 });
        }
        at += len;
      }
      if (import.meta.env.DEV && at - start !== barLen) console.warn(`[Musik] ${name}: Takt ${bi + 1} hat ${at - start} statt ${barLen} Achtel`);
    });
  return events;
}

// ---------- Instrumente ----------

let noise: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

let pulse: PeriodicWave | null = null;
/** Rechteck mit 25 % Pulsbreite: der typische Klang alter Konsolen */
function pulseWave(ctx: AudioContext): PeriodicWave {
  if (!pulse) {
    const n = 32;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    pulse = ctx.createPeriodicWave(re, im);
  }
  return pulse;
}

function envelope(g: GainNode, t: number, dur: number, peak: number, a: number, d: number, s: number, r: number): number {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(peak * s, t + a, d);
  const end = t + Math.max(dur, a + 0.01);
  g.gain.setValueAtTime(peak * s, end);
  g.gain.setTargetAtTime(0, end, r / 3);
  return end + r;
}

function tone(ctx: AudioContext, out: AudioNode, inst: Instrument, midi: number, t: number, dur: number, vel: number, detune: number): void {
  const f = 440 * 2 ** ((midi - 69) / 12);
  const g = ctx.createGain();
  g.connect(out);
  const osc = (type: OscillatorType | 'pulse', freq: number, cents = 0) => {
    const o = ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(pulseWave(ctx));
    else o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune + cents;
    return o;
  };
  let end: number;
  const oscs: OscillatorNode[] = [];
  if (inst === 'lead') {
    const o = osc('pulse', f);
    o.connect(g);
    oscs.push(o);
    end = envelope(g, t, dur * 0.9, 0.16 * vel, 0.01, 0.08, 0.7, 0.06);
  } else if (inst === 'flute') {
    const o = osc('triangle', f);
    const o2 = osc('sine', f * 2);
    const g2 = ctx.createGain();
    g2.gain.value = 0.15;
    o.connect(g);
    o2.connect(g2).connect(g);
    // leichtes Vibrato
    const lfo = osc('sine', 5.5);
    const lg = ctx.createGain();
    lg.gain.value = 6;
    lfo.connect(lg).connect(o.detune);
    oscs.push(o, o2, lfo);
    end = envelope(g, t, dur * 0.95, 0.3 * vel, 0.04, 0.2, 0.8, 0.12);
  } else if (inst === 'pluck') {
    const o = osc('sawtooth', f);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    o.connect(lp).connect(g);
    oscs.push(o);
    end = envelope(g, t, 0.05, 0.12 * vel, 0.005, 0.25, 0.0, 0.2);
  } else if (inst === 'bass') {
    const o = osc('triangle', f);
    o.connect(g);
    oscs.push(o);
    end = envelope(g, t, dur * 0.85, 0.34 * vel, 0.01, 0.1, 0.8, 0.05);
  } else if (inst === 'pad') {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.connect(g);
    for (const c of [-7, 7]) {
      const o = osc('sawtooth', f, c);
      o.connect(lp);
      oscs.push(o);
    }
    end = envelope(g, t, dur, 0.05 * vel, 0.35, 0.5, 0.8, 0.6);
  } else {
    // bell: Frequenzmodulation, klingt wie Glockenspiel
    const car = osc('sine', f);
    const mod = osc('sine', f * 3.5);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 1);
    mod.connect(mg).connect(car.frequency);
    car.connect(g);
    oscs.push(car, mod);
    end = envelope(g, t, 0.02, 0.2 * vel, 0.003, 0.5, 0.0, 0.8);
  }
  for (const o of oscs) {
    o.start(t);
    o.stop(end + 0.05);
  }
  oscs[0].onended = () => g.disconnect();
}

function drum(ctx: AudioContext, out: AudioNode, kind: string, t: number, vel: number): void {
  const g = ctx.createGain();
  g.connect(out);
  if (kind === 'k') {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.6 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.3);
    o.onended = () => g.disconnect();
    return;
  }
  if (kind === 'a' || kind === 't') {
    // Amboss (Mine) und Uhrwerk-Ticken (Rechenwerk): kurze metallische Töne
    const freqs = kind === 'a' ? [820, 1130, 1670] : [2400];
    const dur = kind === 'a' ? 0.25 : 0.03;
    g.gain.setValueAtTime((kind === 'a' ? 0.08 : 0.06) * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    for (const fr of freqs) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = fr;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.02);
      o.onended = () => g.disconnect();
    }
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = kind === 's' ? 'bandpass' : 'highpass';
  f.frequency.value = kind === 's' ? 1800 : 7000;
  const dur = kind === 's' ? 0.16 : 0.045;
  g.gain.setValueAtTime((kind === 's' ? 0.3 : 0.12) * vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.5, dur + 0.05);
  src.onended = () => g.disconnect();
}

// ---------- MIDI-Dateien ----------

/** General-MIDI-Programm → unser Instrument */
function instrumentFor(program: number, channel: number): Instrument {
  if (channel === 9) return 'drums';
  if (program < 8 || (program >= 24 && program < 32)) return 'pluck';
  if (program < 16) return 'bell';
  if (program >= 32 && program < 40) return 'bass';
  if (program >= 72 && program < 80) return 'flute';
  if (program >= 80 && program < 88) return 'lead';
  if ((program >= 40 && program < 56) || program >= 88) return 'pad';
  return 'lead';
}

const GM_DRUMS: Record<number, string> = { 35: 'k', 36: 'k', 38: 's', 40: 's', 37: 's', 42: 'h', 44: 'h', 46: 'h', 49: 'h', 51: 'h', 56: 'a', 76: 't', 77: 't' };

/** Liest eine Standard-MIDI-Datei (Format 0 oder 1) in unser Lied-Format. */
export function parseMidi(buf: ArrayBuffer): Song {
  const d = new DataView(buf);
  let p = 0;
  const str = (n: number) => String.fromCharCode(...new Uint8Array(buf, p, n));
  const u32 = () => ((p += 4), d.getUint32(p - 4));
  const u16 = () => ((p += 2), d.getUint16(p - 2));
  const vlq = () => {
    let v = 0;
    for (;;) {
      const b = d.getUint8(p++);
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
  };
  if (str(4) !== 'MThd') throw new Error('keine MIDI-Datei');
  p += 4;
  const hlen = u32();
  const start = p;
  u16(); // Format
  const ntracks = u16();
  const division = u16();
  p = start + hlen;
  let tempo = 500_000; // µs pro Viertel
  const perChannel = new Map<number, { program: number; events: NoteEvent[] }>();
  let maxTick = 0;
  for (let tr = 0; tr < ntracks; tr++) {
    const id = str(4);
    p += 4;
    const len = u32();
    const end = p + len;
    if (id !== 'MTrk') {
      p = end;
      continue;
    }
    let tick = 0;
    let status = 0;
    const open = new Map<string, { at: number; vel: number }>();
    while (p < end) {
      tick += vlq();
      let b = d.getUint8(p);
      if (b & 0x80) {
        status = b;
        p++;
      } else b = status;
      const type = status & 0xf0;
      const ch = status & 0x0f;
      if (status === 0xff) {
        const meta = d.getUint8(p++);
        const l = vlq();
        if (meta === 0x51) tempo = (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2);
        p += l;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        p += vlq();
        continue;
      }
      const a1 = d.getUint8(p++);
      const a2 = type === 0xc0 || type === 0xd0 ? 0 : d.getUint8(p++);
      const chan = perChannel.get(ch) ?? { program: 0, events: [] };
      perChannel.set(ch, chan);
      if (type === 0xc0) chan.program = a1;
      else if (type === 0x90 && a2 > 0) open.set(`${ch}:${a1}`, { at: tick, vel: a2 / 127 });
      else if (type === 0x80 || (type === 0x90 && a2 === 0)) {
        const o = open.get(`${ch}:${a1}`);
        if (o) {
          open.delete(`${ch}:${a1}`);
          const toEighth = (t: number) => (t / division) * 2;
          const note = ch === 9 ? GM_DRUMS[a1] : a1;
          if (note !== undefined) chan.events.push({ at: toEighth(o.at), len: Math.max(0.25, toEighth(tick - o.at)), notes: [note], vel: o.vel });
          maxTick = Math.max(maxTick, tick);
        }
      }
    }
    p = end;
  }
  const length = Math.ceil(((maxTick / division) * 2) / 8) * 8;
  const tracks: Track[] = [...perChannel.entries()]
    .filter(([, c]) => c.events.length)
    .map(([ch, c]) => {
      const instrument = instrumentFor(c.program, ch);
      const layer: Layer = instrument === 'drums' ? 'drums' : instrument === 'bass' ? 'bass' : instrument === 'pad' || instrument === 'pluck' ? 'harmony' : 'melody';
      return { instrument, layer, volume: 1, events: c.events.sort((x, y) => x.at - y.at) };
    });
  return { bpm: Math.round(60_000_000 / tempo), length, tracks };
}

// ---------- Abspielen ----------

interface Playing {
  id: string;
  song: Song;
  bus: GainNode;
  layers: Record<Layer, GainNode>;
  start: number;
  next: number[];
  loop: number[];
  done: boolean;
}

const LOOKAHEAD = 0.25;

class MusicPlayer {
  private master?: GainNode;
  private duck?: GainNode;
  private filter?: BiquadFilterNode;
  private current?: Playing;
  private stinger?: Playing;
  private fog = 0;
  private songs = new Map<string, () => Song>();
  private midiCache = new Map<string, Song | null>();
  private wanted: string | null = null;

  register(id: string, make: () => Song): void {
    this.songs.set(id, make);
  }

  private setup(): AudioContext {
    const ctx = context();
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.gain.value = loadPrefs().music;
      this.duck = ctx.createGain();
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 20_000;
      this.filter.connect(this.duck).connect(this.master).connect(ctx.destination);
      window.setInterval(() => this.tick(), 50);
    }
    return ctx;
  }

  /** Nach der ersten Berührung darf der Browser Ton abspielen */
  unlock(): void {
    const ctx = this.setup();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  get fogLevel(): number {
    return this.fog;
  }

  get playing(): string | null {
    return this.current?.id ?? this.wanted;
  }

  setVolume(v: number): void {
    this.setup();
    this.master!.gain.setTargetAtTime(v, context().currentTime, 0.05);
  }

  /** Lied wechseln (mit Überblendung). Ein laufendes Lied mit gleicher id läuft einfach weiter. */
  async play(id: string): Promise<void> {
    if (this.current?.id === id || this.wanted === id) return;
    this.wanted = id;
    const song = await this.load(id);
    if (this.wanted !== id || !song) return;
    this.wanted = null;
    const ctx = this.setup();
    this.fadeOut(this.current, 0.8);
    this.current = this.start(song, id, ctx.currentTime + 0.15, 0.9);
  }

  stop(): void {
    this.wanted = null;
    this.fadeOut(this.current, 0.8);
    this.current = undefined;
  }

  /** Kurzes Stück über der Musik (Fanfare); die Musik wird solange leiser. */
  async sting(id: string): Promise<void> {
    const song = await this.load(id);
    if (!song) return;
    const ctx = this.setup();
    const t = ctx.currentTime + 0.05;
    const secs = (song.length * 30) / song.bpm;
    this.current?.bus.gain.setTargetAtTime(0.2, t, 0.1);
    this.current?.bus.gain.setTargetAtTime(1, t + secs, 0.4);
    this.fadeOut(this.stinger, 0.1);
    this.stinger = this.start({ ...song, oneShot: true }, id, t, 0.02);
  }

  /** Musik leiser, solange jemand Wichtiges spricht (Vagor) */
  hush(on: boolean): void {
    this.setup();
    this.duck!.gain.setTargetAtTime(on ? 0.3 : 1, context().currentTime, 0.3);
  }

  /** Nebel 0–1: verstimmt, wackelig, dumpf; Begleitung und Schlagzeug treten zurück. */
  setFog(value: number, seconds = 0): void {
    this.setup();
    this.fog = value;
    const t = context().currentTime;
    const tc = Math.max(0.01, seconds / 3);
    this.filter!.frequency.setTargetAtTime(1300 * (20_000 / 1300) ** (1 - value), t, tc);
    if (this.current) this.applyLayers(this.current, tc);
  }

  private applyLayers(pl: Playing, tc: number): void {
    const t = context().currentTime;
    const f = this.fog;
    const gains: Record<Layer, number> = { melody: 1, bass: 1 - 0.3 * f, harmony: 1 - 0.75 * f, drums: 1 - f };
    for (const l of LAYERS) pl.layers[l].gain.setTargetAtTime(gains[l], t, tc);
  }

  private async load(id: string): Promise<Song | null> {
    if (!this.midiCache.has(id)) {
      let midi: Song | null = null;
      try {
        const r = await fetch(`assets/music/${id}.mid`);
        const buf = r.ok ? await r.arrayBuffer() : null;
        // Der Entwicklungsserver liefert für fehlende Dateien index.html: am Kopf „MThd“ erkennen
        if (buf && buf.byteLength > 14 && new TextDecoder().decode(buf.slice(0, 4)) === 'MThd') midi = parseMidi(buf);
      } catch {
        midi = null;
      }
      this.midiCache.set(id, midi);
    }
    return this.midiCache.get(id) ?? this.songs.get(id)?.() ?? null;
  }

  private start(song: Song, id: string, t: number, fadeIn: number): Playing {
    const ctx = context();
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + fadeIn);
    bus.connect(this.filter!);
    const layers = Object.fromEntries(
      LAYERS.map((l) => {
        const g = ctx.createGain();
        g.connect(bus);
        return [l, g];
      }),
    ) as Record<Layer, GainNode>;
    const pl: Playing = { id, song, bus, layers, start: t, next: song.tracks.map(() => 0), loop: song.tracks.map(() => 0), done: false };
    this.applyLayers(pl, 0.01);
    return pl;
  }

  private fadeOut(pl: Playing | undefined, secs: number): void {
    if (!pl) return;
    const t = context().currentTime;
    pl.bus.gain.cancelScheduledValues(t);
    pl.bus.gain.setValueAtTime(pl.bus.gain.value, t);
    pl.bus.gain.linearRampToValueAtTime(0, t + secs);
    pl.done = true;
    window.setTimeout(() => pl.bus.disconnect(), (secs + 0.3) * 1000);
  }

  private tick(): void {
    const ctx = context();
    if (ctx.state !== 'running') return;
    for (const pl of [this.current, this.stinger]) if (pl && !pl.done) this.schedule(pl, ctx);
  }

  private schedule(pl: Playing, ctx: AudioContext): void {
    const eighth = 30 / pl.song.bpm;
    const horizon = ctx.currentTime + LOOKAHEAD;
    pl.song.tracks.forEach((tr, ti) => {
      for (;;) {
        if (!tr.events.length) return;
        if (pl.next[ti] >= tr.events.length) {
          if (pl.song.oneShot) return;
          pl.next[ti] = 0;
          pl.loop[ti] += 1;
        }
        const ev = tr.events[pl.next[ti]];
        const t = pl.start + (pl.loop[ti] * pl.song.length + ev.at) * eighth;
        if (t > horizon) return;
        pl.next[ti] += 1;
        if (t < ctx.currentTime - 0.05) continue; // verpasst (Tab war im Hintergrund)
        // Nebel: ungenaue Tonhöhe und wackliger Takt
        const jitter = this.fog * Math.random() * 0.03;
        const out = pl.layers[tr.layer];
        for (const n of ev.notes) {
          if (typeof n === 'string') drum(ctx, out, n, t + jitter, ev.vel * tr.volume);
          else tone(ctx, out, tr.instrument, n, t + jitter, ev.len * eighth, ev.vel * tr.volume, this.fog * (Math.random() * 2 - 1) * 35);
        }
      }
    });
  }
}

export const music = new MusicPlayer();
