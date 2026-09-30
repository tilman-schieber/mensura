import { midiOf, music, parseNotes, type Instrument, type Layer, type Song, type Track } from './music';

// Die Lieder von Mensura. Melodien stehen als Noten da (Länge in Achteln, „|“ trennt Takte),
// Begleitung, Bass und Schlagzeug entstehen aus der Akkordfolge.
// Jede Melodie lässt sich durch eine MIDI-Datei ersetzen: public/assets/music/<id>.mid

const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Akkordsymbol → Tonhöhen ab einer Oktave: „Em“ → E, G, B; „D7“ → D, F#, A, C */
function chordNotes(sym: string, octave: number): number[] {
  const m = /^([A-G][#b]?)(m?)(7?)$/.exec(sym);
  if (!m) throw new Error(`Akkord? ${sym}`);
  const root = midiOf(`${m[1]}${octave}`);
  const third = m[2] ? 3 : 4;
  return [root, root + third, root + 7, ...(m[3] ? [root + 10] : [])];
}

const name = (n: number) => `${NOTE[n % 12]}${Math.floor(n / 12) - 1}`;

/**
 * Begleitung aus einer Akkordfolge. Pro Takt ein oder zwei Akkorde („C D“ = halber Takt je Akkord).
 * `pattern` sind Stufen des Akkords pro Achtel (0 = Grundton, 1 = Terz, 2 = Quinte, 3 = Oktave, „-“ = Pause).
 */
function arp(bars: string[], octave: number, pattern: (number | '-')[], barLen = 8): string {
  return bars
    .map((bar) => {
      const chords = bar.split(' ');
      const per = barLen / chords.length;
      return chords
        .map((c) => {
          const notes = chordNotes(c, octave);
          const tones = [notes[0], notes[1], notes[2], notes[0] + 12];
          return pattern
            .slice(0, per)
            .map((st) => (st === '-' ? '-:1' : `${name(tones[st])}:1`))
            .join(' ');
        })
        .join(' ');
    })
    .join(' | ');
}

/** Liegende Akkorde (Flächen), ein Akkord pro Takt oder Halbtakt */
function pads(bars: string[], octave: number, barLen = 8): string {
  return bars
    .map((bar) => {
      const chords = bar.split(' ');
      return chords.map((c) => `${chordNotes(c, octave).slice(0, 3).map(name).join('+')}:${barLen / chords.length}`).join(' ');
    })
    .join(' | ');
}

/** Bass: Grundton und Quinte im gegebenen Rhythmus (r = Grundton, f = Quinte, o = Oktave) */
function bass(bars: string[], octave: number, rhythm: [string, number][], barLen = 8): string {
  return bars
    .map((bar) => {
      const chords = bar.split(' ');
      const per = barLen / chords.length;
      return chords
        .map((c) => {
          const root = chordNotes(c, octave)[0];
          let used = 0;
          const out: string[] = [];
          for (const [step, len] of rhythm) {
            if (used + len > per) break;
            used += len;
            out.push(step === '-' ? `-:${len}` : `${name(step === 'r' ? root : step === 'f' ? root + 7 : root + 12)}:${len}`);
          }
          if (used < per) out.push(`-:${per - used}`);
          return out.join(' ');
        })
        .join(' ');
    })
    .join(' | ');
}

const repeat = (bar: string, n: number) => new Array(n).fill(bar).join(' | ');

/** Melodie rückwärts: Takt für Takt und Ton für Ton gespiegelt (für den Spiegeltempel) */
function mirror(src: string): string {
  return src
    .split('|')
    .map((b) => b.trim().split(/\s+/).reverse().join(' '))
    .reverse()
    .join(' | ');
}

function track(instrument: Instrument, layer: Layer, src: string, barLen: number, volume = 1, id = ''): Track {
  return { instrument, layer, volume, events: parseNotes(src, barLen, `${id}/${instrument}`) };
}

function song(id: string, bpm: number, bars: number, barLen: number, tracks: [Instrument, Layer, string, number?][], oneShot = false): void {
  music.register(id, (): Song => ({
    bpm,
    length: bars * barLen,
    oneShot,
    tracks: tracks.map(([i, l, s, v]) => track(i, l, s, barLen, v ?? 1, id)),
  }));
}

// ---------- Titel: D-Moll, feierlich ----------

const TITLE_CHORDS = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm A', 'Dm'];
const TITLE_MELODY =
  'D5:3 A4:1 D5:2 E5:2 | F5:4 E5:2 D5:2 | C5:3 A4:1 F4:2 A4:2 | G4:4 C5:4 | D5:3 E5:1 F5:2 A5:2 | G5:3 F5:1 D5:4 | Bb4:2 D5:2 C#5:2 E5:2 | D5:6 -:2';
song('title', 92, 8, 8, [
  ['lead', 'melody', TITLE_MELODY, 0.9],
  ['pad', 'harmony', pads(TITLE_CHORDS, 3)],
  ['pluck', 'harmony', arp(TITLE_CHORDS, 4, [0, 1, 2, 3, 2, 1, 2, 1]), 0.7],
  ['bass', 'bass', bass(TITLE_CHORDS, 2, [['r', 4], ['f', 4]])],
  ['drums', 'drums', repeat('k:2 -:2 s:2 k:1 k:1', 8), 0.8],
]);

// Vorspann: dieselbe Melodie langsam auf dem Glockenspiel, nur Flächen darunter
song('prologue', 66, 8, 8, [
  ['bell', 'melody', TITLE_MELODY, 0.8],
  ['pad', 'harmony', pads(TITLE_CHORDS, 3)],
  ['bass', 'bass', bass(TITLE_CHORDS, 2, [['r', 8]]), 0.7],
]);

// ---------- Eichstadt: G-Dur, ländlich, 16 Takte ----------

const VILLAGE_CHORDS = ['G', 'D', 'Em', 'C', 'G', 'D', 'C D', 'G', 'C', 'G', 'Am', 'D', 'Em', 'C', 'D', 'G'];
song('village', 108, 16, 8, [
  [
    'flute',
    'melody',
    'D5:2 B4:1 G4:1 A4:2 B4:2 | A4:3 F#4:1 D4:4 | E4:2 G4:2 B4:2 E5:2 | D5:3 C5:1 B4:2 A4:2 | B4:2 D5:2 G5:3 F#5:1 | E5:2 D5:2 A4:4 | G4:2 A4:2 B4:2 A4:2 | G4:6 -:2 | ' +
      'E5:2 E5:1 D5:1 C5:2 E5:2 | D5:3 B4:1 G4:4 | C5:2 A4:2 E5:2 C5:2 | D5:4 F#4:2 A4:2 | G4:2 B4:2 E5:3 D5:1 | C5:2 E5:2 G5:4 | F#5:2 E5:2 D5:2 A4:2 | G5:6 -:2',
  ],
  ['pluck', 'harmony', arp(VILLAGE_CHORDS, 3, [0, 1, 2, 1, 3, 1, 2, 1]), 0.8],
  ['bass', 'bass', bass(VILLAGE_CHORDS, 2, [['r', 2], ['f', 2], ['r', 2], ['f', 2]])],
  ['drums', 'drums', repeat('k:2 h:1 h:1 s:2 h:2', 16), 0.6],
]);

// ---------- Stellenstollen: A-Moll, Hammerschläge ----------

const MINE_CHORDS = ['Am', 'Am', 'G', 'Am', 'F', 'G', 'E', 'Am'];
song('mine', 116, 8, 8, [
  [
    'lead',
    'melody',
    '-:2 A4:1 C5:1 E5:2 D5:2 | C5:2 B4:2 A4:4 | -:2 G4:1 B4:1 D5:2 C5:2 | B4:2 A4:2 E4:4 | -:2 F4:1 A4:1 C5:2 D5:2 | E5:3 D5:1 B4:4 | G#4:2 B4:2 E5:2 D5:2 | C5:2 B4:2 A4:4',
    0.85,
  ],
  ['bass', 'bass', bass(MINE_CHORDS, 2, [['r', 1], ['r', 1], ['f', 1], ['r', 1], ['o', 1], ['r', 1], ['f', 1], ['r', 1]])],
  ['pad', 'harmony', pads(MINE_CHORDS, 3), 0.8],
  ['drums', 'drums', repeat('k:1 h:1 a:2 k:1 k:1 a:2', 8), 0.8],
]);

// ---------- Rechenwerk: C-Dur, Uhrwerk ----------

const DEEP_CHORDS = ['C', 'G', 'Am', 'F', 'C', 'G', 'F G', 'C'];
song('deep', 126, 8, 8, [
  [
    'lead',
    'melody',
    'C5:1 -:1 E5:1 -:1 G5:1 -:1 E5:1 -:1 | D5:1 -:1 G5:1 -:1 B4:2 D5:2 | C5:1 -:1 E5:1 -:1 A5:2 G5:2 | F5:2 E5:2 C5:4 | E5:1 E5:1 G5:1 -:1 C6:2 G5:2 | F5:1 F5:1 D5:1 -:1 B4:2 G4:2 | A4:2 C5:2 B4:2 D5:2 | C5:4 -:4',
    0.75,
  ],
  ['bell', 'harmony', arp(DEEP_CHORDS, 4, [0, 1, 2, 3, 0, 1, 2, 3]), 0.6],
  ['bass', 'bass', bass(DEEP_CHORDS, 2, [['r', 2], ['r', 2], ['f', 2], ['r', 2]])],
  ['drums', 'drums', repeat('k+t:1 t:1 t:1 t:1 s+t:1 t:1 t:1 t:1', 8), 0.7],
]);

// ---------- Spiegeltempel: E-Moll, die Melodie ist ihr eigenes Spiegelbild ----------

const TEMPLE_HALF = 'E5:2 B4:2 G4:2 B4:2 | C5:3 E5:1 G5:4 | A5:2 E5:2 C5:2 A4:2 | B4:4 D#5:2 F#5:2';
const TEMPLE_CHORDS = ['Em', 'C', 'Am', 'B', 'B', 'Am', 'C', 'Em'];
song('temple', 76, 8, 8, [
  ['bell', 'melody', `${TEMPLE_HALF} | ${mirror(TEMPLE_HALF)}`, 0.9],
  ['pad', 'harmony', pads(TEMPLE_CHORDS, 3)],
  ['bass', 'bass', bass(TEMPLE_CHORDS, 2, [['r', 4], ['f', 4]]), 0.7],
  ['drums', 'drums', repeat('-:4 h:4', 8), 0.3],
]);

// ---------- Riesental: F-Dur, Walzer der Riesen (3/4) ----------

const VALLEY_CHORDS = ['F', 'F', 'C', 'C', 'Bb', 'F', 'C', 'F'];
song('valley', 132, 8, 6, [
  ['flute', 'melody', 'A4:2 C5:2 F5:2 | E5:3 D5:1 C5:2 | G4:2 C5:2 E5:2 | D5:4 C5:2 | D5:2 F5:2 Bb5:2 | A5:3 G5:1 F5:2 | G5:2 E5:2 C5:2 | F5:4 -:2'],
  ['bass', 'bass', bass(VALLEY_CHORDS, 2, [['r', 2], ['-', 4]], 6)],
  ['pluck', 'harmony', VALLEY_CHORDS.map((c) => `-:2 ${chordNotes(c, 3).slice(0, 3).map(name).join('+')}:2 ${chordNotes(c, 3).slice(0, 3).map(name).join('+')}:2`).join(' | '), 0.8],
  ['drums', 'drums', repeat('k:2 h:2 h:2', 8), 0.6],
]);

// ---------- Würfelfestung: D-Moll, Marsch ----------

const FORT_CHORDS = ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Bb A', 'Dm'];
song('fortress', 104, 8, 8, [
  ['lead', 'melody', 'D5:3 D5:1 F5:2 A5:2 | G5:3 F5:1 E5:4 | F5:3 E5:1 D5:2 Bb4:2 | C#5:4 A4:4 | D5:3 E5:1 F5:2 D5:2 | E5:3 F5:1 G5:2 E5:2 | F5:2 D5:2 E5:2 C#5:2 | D5:6 -:2', 0.85],
  ['pad', 'harmony', pads(FORT_CHORDS, 3)],
  ['bass', 'bass', bass(FORT_CHORDS, 2, [['r', 2], ['f', 2], ['r', 2], ['f', 2]])],
  ['drums', 'drums', repeat('k:2 s:1 s:1 k:2 s:2', 8), 0.8],
]);

// ---------- Endgegner: E-Moll, treibend ----------

const BOSS_CHORDS = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'];
song('boss', 144, 8, 8, [
  ['lead', 'melody', 'E5:2 -:1 E5:1 G5:2 E5:2 | B5:3 A5:1 G5:2 F#5:2 | E5:2 -:1 E5:1 G5:2 C6:2 | B5:2 A5:2 F#5:4 | E5:2 -:1 E5:1 G5:2 E5:2 | B5:3 C6:1 B5:2 G5:2 | A5:2 G5:2 E5:2 C5:2 | D#5:4 F#5:4', 0.85],
  ['bass', 'bass', bass(BOSS_CHORDS, 2, [['r', 1], ['r', 1], ['r', 1], ['r', 1], ['r', 1], ['r', 1], ['o', 1], ['r', 1]])],
  ['pad', 'harmony', pads(BOSS_CHORDS, 3), 0.9],
  ['drums', 'drums', repeat('k:1 h:1 s:1 h:1 k:1 k:1 s:1 h:1', 8), 0.9],
]);

// ---------- Fanfare für einen Splitter ----------

song(
  'fanfare',
  120,
  2,
  8,
  [
    ['lead', 'melody', 'G4:1 B4:1 D5:1 G5:5 | F#5:1 G5:1 A5:2 B5:4'],
    ['pad', 'harmony', 'G3+B3+D4:8 | D4+F#4+A4:4 G3+B3+D4:4'],
    ['drums', 'drums', 'k:1 k:1 k:1 s:5 | s:1 s:1 k:2 k:4', 0.8],
  ],
  true,
);
