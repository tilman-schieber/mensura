import { formatDecimal, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, text } from '../ui/theme';
import { drawCuboid } from './cuboid';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Das Würfellager“ (Volumen von Quadern, M15).
// Stufen: kleinen Quader aus Einheitswürfeln abzählen → größere (Schichten zählen) →
// nur Maße (a · b · c in cm³) → Liter (1 dm³ = 1 l).

interface Task {
  a: number;
  b: number;
  c: number;
  grid: boolean;
  unit: string;
  liters: boolean;
}

function makeTask(level: number): Task {
  const tier = pickByLevel(level, [0, 1, 2, 3]);
  if (tier === 0) return { a: randInt(2, 3), b: randInt(2, 3), c: randInt(1, 2), grid: true, unit: 'Würfel', liters: false };
  if (tier === 1) return { a: randInt(3, 5), b: randInt(2, 4), c: randInt(2, 4), grid: true, unit: 'cm³', liters: false };
  if (tier === 2) return { a: randInt(4, 12), b: randInt(3, 8), c: randInt(2, 6), grid: false, unit: 'cm³', liters: false };
  // Becken in dm: Liter
  return { a: randInt(3, 8) * 1, b: randInt(2, 5), c: randInt(2, 4), grid: false, unit: 'l', liters: true };
}

export class VolumePuzzle extends PuzzleScene {
  protected title = 'Das Würfellager';
  protected skills: SkillId[] = ['M15'];

  private task!: Task;

  constructor() {
    super('VolumePuzzle');
  }

  protected buildRound(): void {
    this.task = makeTask(getLevel('M15'));
    const t = this.task;
    const r = this.round;
    const prompt = t.liters
      ? `Das Wasserbecken ist ${t.a * 10} cm lang, ${t.b * 10} cm breit und ${t.c * 10} cm hoch. Wie viele Liter passen hinein?`
      : t.grid
        ? `Aus wie vielen ${t.unit === 'Würfel' ? 'Würfeln' : 'Zentimeterwürfeln'} besteht der Stapel?`
        : `Die Kiste ist ${t.a} cm lang, ${t.b} cm breit und ${t.c} cm hoch. Wie groß ist ihr Volumen?`;
    r.add(text(this, GAME_WIDTH / 2, 88, prompt, 20, COLORS.text).setWordWrapWidth(860).setAlign('center'));

    const g = this.add.graphics();
    const unit = Math.min(44, 300 / (t.a + t.b * 0.5), 240 / (t.c + t.b * 0.5));
    drawCuboid(g, 90, 420, t.a, t.b, t.c, unit, t.grid, t.liters ? { front: 0x5b9bd5, top: 0x8cc4ef, side: 0x3b77ad, line: 0x16324a } : undefined);
    r.add(g);
    if (!t.grid) {
      const f = t.liters ? 10 : 1;
      const u = t.liters ? 'cm' : 'cm';
      r.add(text(this, 90 + (t.a * unit) / 2, 440, `${t.a * f} ${u}`, 16, COLORS.goldText));
      r.add(text(this, 60, 420 - (t.c * unit) / 2, `${t.c * f} ${u}`, 16, COLORS.goldText));
      r.add(text(this, 90 + t.a * unit + (t.b * unit * 0.5) / 2 + 36, 420 - (t.b * unit * 0.5) / 2, `${t.b * f} ${u}`, 16, COLORS.goldText));
    }

    const pad = createNumpad(this, 770, 310, (v) => this.check(v), 5, { unit: t.unit });
    pad.container.setScale(0.78);
    r.add(pad.container);

    this.hints = t.liters
      ? ['1 Liter passt in einen Würfel mit 10 cm Kantenlänge (1 dm³).', 'Rechne die Maße in dm um: 10 cm = 1 dm.', `${t.a} dm · ${t.b} dm · ${t.c} dm`]
      : [
          'Zähle eine Schicht (Länge mal Breite) und nimm sie so oft, wie es Schichten gibt.',
          'Volumen eines Quaders = Länge · Breite · Höhe.',
          `${t.a} · ${t.b} · ${t.c}`,
        ];
  }

  private check(v: number): void {
    const t = this.task;
    const vol = t.a * t.b * t.c;
    if (v === vol) {
      this.solved(t.liters ? `Genau: ${vol} dm³ = ${vol} Liter!` : `Richtig: ${t.a} · ${t.b} · ${t.c} = ${vol} ${t.unit}.`);
      return;
    }
    if (t.liters && v === vol * 1000) this.wrong(`Das sind cm³! 1000 cm³ sind 1 Liter. Rechne lieber in dm.`);
    else if (v === t.a * t.b) this.wrong('Das ist nur eine Schicht. Wie viele Schichten liegen übereinander?');
    else if (v === t.a + t.b + t.c) this.wrong('Nicht zusammenzählen: Das Volumen ist Länge MAL Breite MAL Höhe.');
    else this.wrong(`${formatDecimal(v)} stimmt noch nicht. Rechne Schicht für Schicht.`);
  }
}
