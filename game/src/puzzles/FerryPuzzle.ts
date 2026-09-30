import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Fährenuhr“ (Zeitspannen, M5 Zeit).
//  - warten:   Jetzt ist es 11:50, die Fähre fährt um 14:35. Wie lange wartest du?
//  - ankunft:  Die Fähre fährt um 9:50 ab und braucht 1 h 40 min. Wann kommt sie an?
// Eingabe über zwei Felder (Stunden, Minuten) und ein kleines Ziffernfeld.

type Mode = 'warten' | 'ankunft';

const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
const dur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
};

interface Task {
  mode: Mode;
  start: number; // Minuten seit Mitternacht
  length: number; // Minuten
}

function makeTask(level: number): Task {
  const tier = pickByLevel(level, [0, 1, 2, 3, 4]);
  if (tier === 0) {
    const s = randInt(7, 14) * 60;
    return { mode: 'warten', start: s, length: randInt(1, 4) * 60 };
  }
  if (tier === 1) {
    const s = randInt(7, 16) * 60 + randInt(0, 6) * 5;
    return { mode: 'warten', start: s, length: randInt(2, 9) * 5 };
  }
  if (tier === 2) {
    const s = randInt(7, 16) * 60 + randInt(8, 11) * 5;
    return { mode: 'warten', start: s, length: randInt(4, 10) * 5 };
  }
  if (tier === 3) {
    const s = randInt(7, 15) * 60 + randInt(6, 11) * 5;
    return { mode: 'ankunft', start: s, length: 60 + randInt(4, 11) * 5 };
  }
  const s = randInt(8, 12) * 60 + randInt(6, 11) * 5;
  return randInt(0, 1)
    ? { mode: 'warten', start: s, length: randInt(2, 3) * 60 + randInt(3, 11) * 5 }
    : { mode: 'ankunft', start: s, length: randInt(100, 170) };
}

export class FerryPuzzle extends PuzzleScene {
  protected title = 'Die Fährenuhr';
  protected skills: SkillId[] = ['M5Z'];

  private task!: Task;
  private fields: [string, string] = ['', ''];
  private active = 0;
  private fieldTexts: Phaser.GameObjects.Text[] = [];
  private fieldBoxes: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('FerryPuzzle');
  }

  protected buildRound(): void {
    this.task = makeTask(getLevel('M5Z'));
    const t = this.task;
    this.fields = ['', ''];
    this.active = 0;
    this.fieldTexts = [];
    this.fieldBoxes = [];
    const r = this.round;

    this.drawClock(170, 240, t.start);
    if (t.mode === 'warten') {
      r.add(text(this, GAME_WIDTH / 2, 90, `Jetzt ist es ${hm(t.start)} Uhr. Die Fähre fährt um ${hm(t.start + t.length)} Uhr.`, 22, COLORS.text));
      r.add(text(this, GAME_WIDTH / 2, 122, 'Wie lange musst du warten?', 20, COLORS.muted));
    } else {
      r.add(text(this, GAME_WIDTH / 2, 90, `Die Fähre legt um ${hm(t.start)} Uhr ab und braucht ${dur(t.length)}.`, 22, COLORS.text));
      r.add(text(this, GAME_WIDTH / 2, 122, 'Um wie viel Uhr kommt sie an?', 20, COLORS.muted));
    }

    // Zwei Eingabefelder: Stunden und Minuten (bzw. Uhrzeit Stunde : Minute)
    const labels = t.mode === 'warten' ? ['h', 'min'] : ['Uhr', ''];
    [0, 1].forEach((i) => {
      const x = 430 + i * 150;
      const box = this.add.graphics();
      const tx = text(this, x, 200, '', 32, COLORS.text);
      const hit = this.add.zone(x, 200, 110, 64).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => { this.active = i; this.refresh(); });
      r.add([box, tx, hit, text(this, x + 72, 208, labels[i], 18, COLORS.muted).setOrigin(0, 0.5)]);
      this.fieldBoxes.push(box);
      this.fieldTexts.push(tx);
    });
    if (t.mode === 'ankunft') r.add(text(this, 505, 196, ':', 34, COLORS.text));

    // Ziffern
    for (let d = 0; d <= 9; d++) {
      const i = d === 0 ? 9 : d - 1; // Reihe 1: 1–5, Reihe 2: 6–9 und 0
      const x = 430 + (i % 5) * 64;
      const y = 290 + Math.floor(i / 5) * 60;
      r.add(button(this, x, y, String(d), () => this.press(String(d)), { width: 56, height: 50, size: 24 }));
    }
    r.add(button(this, 430, 410, '<', () => this.press('<'), { width: 56, height: 50, size: 24 }));
    r.add(button(this, 620, 410, 'Einsteigen!', () => this.check(), { width: 200, height: 50, size: 20 }));

    this.hints = [
      'Rechne in Schritten: erst bis zur nächsten vollen Stunde, dann die ganzen Stunden, dann die restlichen Minuten.',
      '1 Stunde hat 60 Minuten. Mehr als 59 Minuten gibt es in der Minuten-Spalte nicht.',
      t.mode === 'warten'
        ? `Von ${hm(t.start)} bis ${hm(Math.ceil(t.start / 60) * 60)} sind es ${(60 - (t.start % 60)) % 60} Minuten.`
        : `${hm(t.start)} plus ${dur(t.length)}: Zähle erst die Stunden dazu, dann die Minuten.`,
    ];
    this.refresh();
  }

  private drawClock(cx: number, cy: number, minutes: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xf3ead2, 1).fillCircle(cx, cy, 90);
    g.lineStyle(5, 0x5a3a1e, 1).strokeCircle(cx, cy, 90);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.lineStyle(i % 3 === 0 ? 4 : 2, 0x3a2a18, 1).lineBetween(cx + Math.sin(a) * 76, cy - Math.cos(a) * 76, cx + Math.sin(a) * 86, cy - Math.cos(a) * 86);
    }
    const h = (minutes / 60) % 12;
    const m = minutes % 60;
    const ah = (h / 12) * Math.PI * 2;
    const am = (m / 60) * Math.PI * 2;
    g.lineStyle(6, 0x2a1a08, 1).lineBetween(cx, cy, cx + Math.sin(ah) * 48, cy - Math.cos(ah) * 48);
    g.lineStyle(4, 0x2a1a08, 1).lineBetween(cx, cy, cx + Math.sin(am) * 72, cy - Math.cos(am) * 72);
    g.fillStyle(0xd9b25f, 1).fillCircle(cx, cy, 6);
    this.round.add(g);
    this.round.add(text(this, cx, cy + 116, 'jetzt / Abfahrt', 14, COLORS.muted));
  }

  private press(k: string): void {
    const f = this.fields[this.active];
    if (k === '<') this.fields[this.active] = f.slice(0, -1);
    else if (f.length < 2) {
      this.fields[this.active] = f + k;
      if (this.active === 0 && this.fields[0].length === 2) this.active = 1;
    }
    this.refresh();
  }

  private refresh(): void {
    [0, 1].forEach((i) => {
      const x = 430 + i * 150;
      this.fieldBoxes[i].clear().fillStyle(0x0b1117, 1).fillRoundedRect(x - 55, 168, 110, 64, 8)
        .lineStyle(3, i === this.active ? COLORS.gold : COLORS.panelEdge, 1).strokeRoundedRect(x - 55, 168, 110, 64, 8);
      this.fieldTexts[i].setText(this.fields[i] || (i === this.active ? '_' : ''));
    });
  }

  private check(): void {
    const h = Number(this.fields[0] || '0');
    const m = Number(this.fields[1] || '0');
    const t = this.task;
    if (m > 59) {
      this.wrong('Mehr als 59 Minuten gibt es nicht: 60 Minuten sind schon eine ganze Stunde.');
      return;
    }
    if (t.mode === 'warten') {
      const given = h * 60 + m;
      if (given === t.length) this.solved(`Richtig, du wartest ${dur(t.length)}. Da legt die Fähre schon an!`);
      else this.wrong(`${dur(given)} stimmt nicht. Von ${hm(t.start)} bis ${hm(t.start + t.length)}: rechne in Schritten.`);
    } else {
      const arrival = (t.start + t.length) % (24 * 60);
      if (h * 60 + m === arrival) this.solved(`Richtig! Die Fähre kommt um ${hm(arrival)} Uhr an.`);
      else this.wrong(`${h}:${String(m).padStart(2, '0')} Uhr passt nicht. ${hm(t.start)} plus ${dur(t.length)} …`);
    }
  }
}
