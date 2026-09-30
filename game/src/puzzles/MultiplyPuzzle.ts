import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, FONT, GAME_WIDTH, smooth, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Frachtwaage“ (schriftlich multiplizieren, Z12).
// Kisten mit Erz werden gewogen: a Kilogramm pro Kiste, b Kisten. Bei zweistelligem b
// rechnet man wie in der Schule Zeile für Zeile: erst a mal die Zehnerziffer (eine Stelle
// nach links gerückt), dann a mal die Einerziffer, dann beide Zeilen zusammenzählen.

interface Task {
  a: number;
  b: number;
}

function makeTask(level: number): Task {
  // keine glatten Zehner (40 · 7, 23 · 30): Dann gäbe es nichts zu rechnen
  for (;;) {
    const t = rawTask(level);
    if (t.a % 10 !== 0 && t.b % 10 !== 0) return t;
  }
}

function rawTask(level: number): Task {
  const tier = pickByLevel(level, [0, 1, 2, 3]);
  if (tier === 0) return { a: randInt(12, 98), b: randInt(3, 9) };
  if (tier === 1) return { a: randInt(123, 987), b: randInt(3, 9) };
  if (tier === 2) return { a: randInt(21, 98), b: randInt(12, 49) };
  return { a: randInt(123, 789), b: randInt(13, 68) };
}

interface Step {
  /** Aufforderung */
  ask: string;
  value: number;
  /** Einrückung in Stellen von rechts (Zehnerzeile: 1) */
  shift: number;
  /** Rückmeldung bei falscher Eingabe */
  help: string;
}

const RX = 470;

export class MultiplyPuzzle extends PuzzleScene {
  protected title = 'Die Frachtwaage';
  protected skills: SkillId[] = ['Z12'];

  private steps: Step[] = [];
  private stepIndex = 0;
  private rows: Phaser.GameObjects.Text[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private task!: Task;

  constructor() {
    super('MultiplyPuzzle');
  }

  protected buildRound(): void {
    const t = (this.task = makeTask(getLevel('Z12')));
    const r = this.round;
    r.add(text(this, GAME_WIDTH / 2, 88, `Jede Kiste wiegt ${t.a} kg. Auf der Waage stehen ${t.b} Kisten.`, 22, COLORS.text));

    const tens = Math.floor(t.b / 10);
    const ones = t.b % 10;
    this.steps =
      tens === 0
        ? [{ ask: `${t.a} · ${t.b} = ?`, value: t.a * t.b, shift: 0, help: `Rechne von rechts: erst ${t.b} · ${t.a % 10}, Übertrag merken, dann weiter nach links.` }]
        : [
            {
              ask: `Zeile 1: ${t.a} · ${tens} (die Zehner von ${t.b}) = ?`,
              value: t.a * tens,
              shift: 1,
              help: `Rechne ${t.a} · ${tens}. Das Ergebnis rückt eine Stelle nach links, weil es eigentlich ${tens}0 sind.`,
            },
            { ask: `Zeile 2: ${t.a} · ${ones} = ?`, value: t.a * ones, shift: 0, help: `Rechne ${t.a} · ${ones}, von rechts nach links mit Übertrag.` },
            {
              ask: 'Jetzt beide Zeilen zusammenzählen.',
              value: t.a * t.b,
              shift: 0,
              help: `Zähle ${formatNumber(t.a * tens * 10)} und ${formatNumber(t.a * ones)} zusammen. Achte auf die eingerückte Zeile.`,
            },
          ];
    this.stepIndex = 0;
    this.rows = [];
    // Breite einer Ziffer messen: Die Zehnerzeile rückt genau eine Stelle nach links
    const probe = this.num(0, -100, '0', '#000000');
    const cw = probe.width;
    probe.destroy();

    // Rechnung wie im Heft, rechtsbündig
    const g = this.add.graphics();
    r.add(g);
    g.fillStyle(0xe9dcbc, 1).fillRoundedRect(150, 120, 360, 280, 8);
    r.add(this.num(RX, 150, `${t.a} · ${t.b}`, '#2a1a0c'));
    g.lineStyle(2, 0x2a1a0c, 1).lineBetween(190, 172, RX + 14, 172);
    this.steps.forEach((s, i) => {
      const last = i === this.steps.length - 1 && this.steps.length > 1;
      const y = last ? 290 : 205 + i * 40;
      if (last) g.lineStyle(2, 0x2a1a0c, 1).lineBetween(190, 268, RX + 14, 268);
      const row = this.num(RX - s.shift * cw, y, '', '#2a1a0c');
      this.rows.push(row);
      r.add(row);
    });

    this.prompt = text(this, 330, 360, '', 18, '#2a1a0c');
    r.add(this.prompt);
    const pad = createNumpad(this, 770, 300, (v) => this.check(v, pad.clear), 6, { unit: 'kg' });
    r.add(pad.container);

    this.hints = [
      tens === 0
        ? 'Rechne von rechts nach links: Einer mal die Zahl, den Übertrag in die nächste Stelle mitnehmen.'
        : 'Bei einer zweistelligen Zahl gibt es zwei Zeilen: erst mal die Zehnerziffer, dann mal die Einerziffer.',
      `Überschlag: etwa ${formatNumber(Math.round(t.a / 10) * 10)} · ${t.b} ≈ ${formatNumber(Math.round(t.a / 10) * 10 * t.b)}. So groß ungefähr muss das Ergebnis sein.`,
      this.steps[0].help,
    ];
    this.showStep();
  }

  private num(x: number, y: number, s: string, color: string): Phaser.GameObjects.Text {
    return smooth(this.add.text(x, y, s, { fontFamily: FONT, fontSize: '30px', color, resolution: 2 }).setOrigin(1, 0.5));
  }

  private showStep(): void {
    const s = this.steps[this.stepIndex];
    this.prompt.setText(s.ask);
    this.rows.forEach((row, i) => {
      if (i === this.stepIndex) row.setText('?').setColor('#8a6a3a');
    });
  }

  private check(v: number, clear: () => void): void {
    const s = this.steps[this.stepIndex];
    clear();
    if (v !== s.value) {
      this.wrong(s.help);
      return;
    }
    // Zeilen im Heft ohne Tausender-Leerzeichen, damit die Stellen untereinander stehen
    this.rows[this.stepIndex].setText(String(v)).setColor('#2a1a0c');
    this.stepIndex += 1;
    if (this.stepIndex < this.steps.length) {
      this.showOwl('');
      this.showStep();
      return;
    }
    const t = this.task;
    this.prompt.setText('');
    this.solved(`${t.b} Kisten zu ${t.a} kg wiegen ${formatNumber(t.a * t.b)} kg. Die Waage steht still.`);
  }
}
