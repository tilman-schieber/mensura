import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import { loadSave, writeSave } from '../save';
import type { SkillId } from '../learn/skills';
import { COLORS, FONT, GAME_WIDTH, button, smooth, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Das Rechenwerk“ (schriftlich addieren und subtrahieren, Z12).
// Die Zwergen-Rechenmaschine schiebt seit dem Nebel keine Überträge mehr: Man rechnet
// Spalte für Spalte von rechts nach links, trägt die Ziffer unten ein und schiebt den
// Übertrag selbst.
// Subtraktion in beiden Verfahren, die der Bildungsplan der Grundschule BW zulässt
// (3.2.1.2 (9): „Abziehen oder Ergänzen“): Abziehen mit Entbündeln oder Ergänzen mit
// Übertrag. Beim ersten Mal wählt das Kind, was es kennt (gespeichert im Spielstand).

type Op = '+' | '−';

interface Task {
  op: Op;
  a: number;
  b: number;
}

const digitsOf = (n: number, len: number) => Array.from({ length: len }, (_, i) => Math.floor(n / 10 ** i) % 10);

/** Zahl mit `len` Stellen ohne Nullen (Entbündeln über eine leere Spalte hinweg kommt später). */
function noZeros(len: number, min = 1): number {
  let n = randInt(Math.max(min, 1), 9);
  for (let i = 1; i < len; i++) n = n * 10 + randInt(1, 9);
  return n;
}

function makeTask(level: number): Task {
  const tier = pickByLevel(level, [0, 1, 2, 3, 4]);
  if (tier === 0) return { op: '+', a: randInt(120, 489), b: randInt(110, 399) };
  if (tier === 1) return { op: '+', a: randInt(1_200, 8_999), b: randInt(300, 4_999) };
  if (tier === 2) {
    const a = noZeros(3, 4);
    // oberste Stelle von b mindestens 2 kleiner: keine führende Null im Ergebnis
    return { op: '−', a, b: randInt(111, Math.floor(a / 100) * 100 - 111) };
  }
  if (tier === 3) {
    const a = noZeros(4, 3);
    return { op: '−', a, b: randInt(1_111, Math.floor(a / 1000) * 1000 - 1_111) };
  }
  return randInt(0, 1)
    ? { op: '+', a: randInt(20_000, 69_999), b: randInt(10_000, 29_999) }
    : (() => {
        const a = noZeros(5, 3);
        return { op: '−' as Op, a, b: randInt(11_111, Math.floor(a / 10_000) * 10_000 - 11_111) };
      })();
}

const CW = 58; // Spaltenbreite
const RX = 610; // x der Einerspalte
const Y_A = 178;
const Y_B = 234;
const Y_LINE = 266;
const Y_R = 306;

export class ColumnPuzzle extends PuzzleScene {
  protected title = 'Das Rechenwerk';
  protected skills: SkillId[] = ['Z12'];

  private task!: Task;
  private len = 0;
  private col = 0;
  private da: number[] = [];
  private db: number[] = [];
  private carry: number[] = [];
  private awaitingCarry = false;
  private borrowedFrom: boolean[] = [];
  private borrowedInto: boolean[] = [];
  private result: (number | null)[] = [];
  private layer!: Phaser.GameObjects.Container;
  private prompt!: Phaser.GameObjects.Text;

  constructor() {
    super('ColumnPuzzle');
  }

  /** Verfahren für die Subtraktion */
  private method: 'abziehen' | 'ergaenzen' = 'abziehen';

  protected buildRound(): void {
    const t = (this.task = makeTask(getLevel('Z12')));
    const chosen = loadSave().settings.subtraction;
    if (t.op === '−' && !chosen) {
      this.chooseMethod();
      return;
    }
    this.method = chosen ?? 'abziehen';
    const answer = t.op === '+' ? t.a + t.b : t.a - t.b;
    // Addition: eine Spalte mehr, falls ganz links ein Übertrag entsteht
    this.len = Math.max(String(t.a).length, String(t.b).length);
    const width = t.op === '+' ? Math.max(this.len, String(answer).length) : this.len;
    this.da = digitsOf(t.a, width);
    this.db = digitsOf(t.b, width);
    this.carry = new Array(width + 1).fill(0);
    this.result = new Array(width).fill(null);
    this.borrowedFrom = new Array(width).fill(false);
    this.borrowedInto = new Array(width).fill(false);
    this.len = width;
    this.col = 0;
    this.awaitingCarry = false;

    const r = this.round;
    r.add(text(this, GAME_WIDTH / 2, 88, `Rechne schriftlich: ${formatNumber(t.a)} ${t.op} ${formatNumber(t.b)}`, 22, COLORS.text));
    this.layer = this.add.container(0, 0);
    r.add(this.layer);
    this.prompt = text(this, GAME_WIDTH / 2, 356, '', 18, COLORS.muted);
    r.add(this.prompt);

    // Ziffern 0–9 und die Hebel der Maschine
    for (let d = 0; d <= 9; d++) {
      r.add(button(this, 230 + d * 58, 410, String(d), () => this.digit(d), { width: 52, height: 52, size: 26 }));
    }
    if (t.op === '−' && this.method === 'abziehen') r.add(button(this, 830, 234, 'Entbündeln', () => this.unbundle(), { width: 170, height: 56, size: 19 }));
    else r.add(button(this, 830, 234, 'Übertrag ⟵', () => this.pushCarry(), { width: 170, height: 56, size: 19 }));

    this.hints =
      t.op === '+'
        ? [
            'Rechne von rechts nach links, Spalte für Spalte: erst die Einer, dann die Zehner …',
            'Ergibt eine Spalte 10 oder mehr, kommt die Einerziffer nach unten und die 1 wandert als Übertrag in die Spalte links daneben.',
            'Vergiss nicht, den Übertrag in der nächsten Spalte mitzuzählen.',
          ]
        : this.method === 'abziehen'
          ? [
              'Rechne von rechts nach links, Spalte für Spalte: oben minus unten.',
              'Ist oben weniger als unten, entbündle: Nimm 1 aus der Spalte links. Hier werden daraus 10, die du oben dazuzählst.',
              'Die Spalte links hat danach oben eine Ziffer weniger. Das ist beim Weiterrechnen wichtig.',
            ]
          : [
              'Rechne von rechts nach links und ergänze: Unten plus wie viel ergibt oben?',
              'Ist unten mehr als oben, ergänzt du bis zur Zahl mit einer 1 davor, zum Beispiel bis 12. Dann schiebst du eine 1 als Übertrag in die nächste Spalte.',
              'Den Übertrag zählst du in der nächsten Spalte unten dazu.',
            ];
    this.draw();
  }

  /** Obere Ziffer einer Spalte nach dem Entbündeln */
  private top(i: number): number {
    return this.da[i] - (this.borrowedFrom[i] ? 1 : 0) + (this.borrowedInto[i] ? 10 : 0);
  }

  private digit(d: number): void {
    const t = this.task;
    const i = this.col;
    if (i >= this.len) return;
    if (t.op === '+') {
      if (this.awaitingCarry) {
        this.wrong(`Übertrag vergessen! Die Spalte ergab mehr als 9. Schieb die 1 zuerst nach links.`);
        return;
      }
      const s = this.da[i] + this.db[i] + this.carry[i];
      if (d !== s % 10) {
        const parts = [this.da[i], this.db[i]].join(' + ') + (this.carry[i] ? ' + 1 (Übertrag)' : '');
        this.wrong(`Rechne die Spalte nach: ${parts}. Unten steht nur die Einerziffer.`);
        return;
      }
      this.result[i] = d;
      this.showOwl('');
      if (s >= 10) {
        this.awaitingCarry = true;
        this.prompt.setText(`Die Spalte ergibt ${s}. Wohin mit der ${Math.floor(s / 10)}?`);
      } else this.col += 1;
    } else if (this.method === 'ergaenzen') {
      if (this.awaitingCarry) {
        this.wrong('Übertrag vergessen! Du hast bis über 10 ergänzt. Schieb die 1 zuerst nach links.');
        return;
      }
      const bottom = this.db[i] + this.carry[i];
      const needCarry = bottom > this.da[i];
      const upTo = needCarry ? this.da[i] + 10 : this.da[i];
      if (d !== upTo - bottom) {
        const b = this.carry[i] ? `${this.db[i]} + 1 (Übertrag) = ${bottom}` : String(bottom);
        this.wrong(`Ergänze: ${b} plus wie viel ergibt ${upTo}?`);
        return;
      }
      this.result[i] = d;
      this.showOwl('');
      if (needCarry) {
        this.awaitingCarry = true;
        this.prompt.setText(`Du hast bis ${upTo} ergänzt. Wohin mit der 1?`);
      } else this.col += 1;
    } else {
      const top = this.top(i);
      if (top < this.db[i]) {
        this.wrong(`${top} − ${this.db[i]} geht nicht. Entbündle zuerst: Hol dir 1 aus der Spalte links.`);
        return;
      }
      if (d !== top - this.db[i]) {
        this.wrong(`Rechne die Spalte nach: ${top} − ${this.db[i]}.`);
        return;
      }
      this.result[i] = d;
      this.showOwl('');
      this.col += 1;
    }
    this.draw();
    this.checkDone();
  }

  private pushCarry(): void {
    if (!this.awaitingCarry) {
      const none = this.task.op === '+' ? 'Hier gibt es keinen Übertrag: Die Spalte ist kleiner als 10.' : 'Hier gibt es keinen Übertrag: Unten ist nicht mehr als oben.';
      this.wrong(this.result[this.col] === null ? 'Trag zuerst unten die Ziffer ein. Gibt es dann einen Übertrag, schiebst du ihn.' : none);
      return;
    }
    this.carry[this.col + 1] = 1;
    this.awaitingCarry = false;
    this.showOwl('');
    this.col += 1;
    this.prompt.setText('');
    this.draw();
    this.checkDone();
  }

  private unbundle(): void {
    const i = this.col;
    if (i >= this.len - 1 || this.borrowedInto[i]) {
      this.wrong('Hier gibt es nichts zu entbündeln.');
      return;
    }
    if (this.top(i) >= this.db[i]) {
      this.wrong(`Oben steht ${this.top(i)}, unten ${this.db[i]}. Das reicht, du musst nicht entbündeln.`);
      return;
    }
    this.borrowedFrom[i + 1] = true;
    this.borrowedInto[i] = true;
    this.showOwl('');
    this.draw();
  }

  /** Beim ersten Minus: beide Verfahren an einem Beispiel zeigen, das Kind wählt, was es kennt. */
  private chooseMethod(): void {
    const r = this.round;
    r.add(text(this, GAME_WIDTH / 2, 90, 'Wie rechnest du in der Schule minus?', 24, COLORS.text));
    r.add(text(this, GAME_WIDTH / 2, 122, 'Beide Wege sind richtig. Tipp auf den, den du kennst. Beispiel: 52 − 17', 17, COLORS.muted));
    const examples: [string, string, 'abziehen' | 'ergaenzen'][] = [
      ['Abziehen (entbündeln)', '2 − 7 geht nicht.\nEinen Zehner entbündeln:\n12 − 7 = 5.\nOben bleiben 4 Zehner:\n4 − 1 = 3.\nErgebnis: 35', 'abziehen'],
      ['Ergänzen', '7 plus wie viel ist 12?\n5, und 1 als Übertrag.\n1 + 1 = 2.\n2 plus wie viel ist 5?\n3.\nErgebnis: 35', 'ergaenzen'],
    ];
    examples.forEach(([title, body, m], i) => {
      const x = GAME_WIDTH / 2 + (i ? 200 : -200);
      const g = this.add.graphics();
      g.fillStyle(0x0b1117, 1).fillRoundedRect(x - 180, 150, 360, 230, 10);
      g.lineStyle(2, COLORS.panelEdge, 1).strokeRoundedRect(x - 180, 150, 360, 230, 10);
      r.add(g);
      r.add(text(this, x, 176, title, 21, COLORS.goldText));
      r.add(text(this, x, 280, body, 18, COLORS.text).setAlign('center'));
      r.add(button(this, x, 412, 'So rechne ich!', () => this.pick(m), { width: 220, height: 50, size: 20 }));
    });
    r.add(text(this, GAME_WIDTH / 2, 462, 'Ändern kannst du das später unter Einstellungen.', 15, COLORS.muted));
  }

  private pick(m: 'abziehen' | 'ergaenzen'): void {
    const save = loadSave();
    save.settings.subtraction = m;
    writeSave(save);
    this.round.removeAll(true);
    this.buildRound();
  }

  private checkDone(): void {
    const t = this.task;
    if (this.col < this.len) return;
    const answer = t.op === '+' ? t.a + t.b : t.a - t.b;
    this.prompt.setText('');
    this.solved(`${formatNumber(t.a)} ${t.op} ${formatNumber(t.b)} = ${formatNumber(answer)}. Das Rechenwerk rattert!`);
  }

  private digitText(x: number, y: number, s: string, size: number, color: string): Phaser.GameObjects.Text {
    return smooth(this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2 }).setOrigin(0.5));
  }

  private draw(): void {
    const L = this.layer;
    L.removeAll(true);
    const t = this.task;
    const g = this.add.graphics();
    L.add(g);
    // Messingrahmen der Maschine
    const left = RX - (this.len - 1) * CW - CW / 2 - 50;
    g.fillStyle(0x3a2c14, 1).fillRoundedRect(left, 110, RX + CW / 2 + 20 - left, 226, 10);
    g.lineStyle(3, 0xb88a3a, 1).strokeRoundedRect(left, 110, RX + CW / 2 + 20 - left, 226, 10);
    // aktive Spalte
    if (this.col < this.len) {
      const x = RX - this.col * CW;
      g.fillStyle(0xd9b25f, 0.22).fillRoundedRect(x - CW / 2 + 3, 116, CW - 6, 214, 6);
    }
    g.lineStyle(3, 0xe9e4d8, 1).lineBetween(left + 30, Y_LINE, RX + CW / 2 + 5, Y_LINE);
    L.add(this.digitText(left + 26, Y_B, t.op, 40, COLORS.text));

    const aLen = String(t.a).length;
    const bLen = String(t.b).length;
    for (let i = 0; i < this.len; i++) {
      const x = RX - i * CW;
      if (i < aLen) {
        const changed = this.borrowedFrom[i] || this.borrowedInto[i];
        L.add(this.digitText(x, Y_A, String(this.da[i]), 40, changed ? '#7d8a94' : COLORS.text));
        if (changed) {
          g.lineStyle(3, 0xd96a5a, 1).lineBetween(x - 14, Y_A + 14, x + 14, Y_A - 14);
          L.add(this.digitText(x, Y_A - 38, String(this.top(i)), 22, '#f0a090'));
        }
      }
      if (i < bLen) L.add(this.digitText(x, Y_B, String(this.db[i]), 40, COLORS.text));
      if (this.carry[i]) L.add(this.digitText(x - 16, Y_B - 22, '1', 20, COLORS.goldText));
      const res = this.result[i];
      if (res !== null) L.add(this.digitText(x, Y_R, String(res), 40, COLORS.goldText));
      else if (i === this.col) L.add(this.digitText(x, Y_R, '?', 36, '#5d6b76'));
    }
  }
}
