import Phaser from 'phaser';
import { formatDecimal, randInt, sameNumber } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Skalenkappe“ (Längen umrechnen, M5; Kommaverschiebung).
// Mit der Skalenkappe schrumpft man in Zehnerschritten: Meter-Welt, Zenti-Welt,
// Milli-Welt. Dieselbe Länge heißt in jeder Welt anders; das Komma wandert mit.
// Stufen: ganze Zahlen (m→cm, cm→mm) → dm und Rückweg → km↔m → Kommazahlen → gemischt.

type Unit = 'mm' | 'cm' | 'dm' | 'm' | 'km';
const MM: Record<Unit, number> = { mm: 1, cm: 10, dm: 100, m: 1000, km: 1_000_000 };
const WORLD: Record<Unit, string> = { mm: 'Milli-Welt', cm: 'Zenti-Welt', dm: 'Dezi-Welt', m: 'Meter-Welt', km: 'Riesen-Welt' };

interface Task {
  value: number;
  from: Unit;
  to: Unit;
  /** optional gemischte Angabe, z. B. „2 m 35 cm“ */
  mixed?: string;
  thing: Thing;
}

interface Thing {
  article: 'der' | 'die' | 'das';
  name: string;
}

const THINGS: Thing[] = [
  { article: 'der', name: 'Grashalm' },
  { article: 'das', name: 'Käferbein' },
  { article: 'der', name: 'Riesenzeh' },
  { article: 'der', name: 'Weg zum Fluss' },
  { article: 'der', name: 'Pilzstiel' },
  { article: 'das', name: 'Seil' },
  { article: 'die', name: 'Wurzel' },
];
const PRONOUN = { der: 'er', die: 'sie', das: 'es' } as const;

function makeTask(level: number): Task {
  const thing = THINGS[randInt(0, THINGS.length - 1)];
  const tier = pickByLevel(level, [0, 1, 2, 3, 4]);
  if (tier === 0) {
    return randInt(0, 1) ? { value: randInt(2, 9), from: 'm', to: 'cm', thing } : { value: randInt(2, 30), from: 'cm', to: 'mm', thing };
  }
  if (tier === 1) {
    const pairs: [Unit, Unit, number][] = [['dm', 'cm', randInt(2, 9)], ['m', 'dm', randInt(2, 9)], ['mm', 'cm', randInt(2, 9) * 10], ['cm', 'm', randInt(2, 9) * 100]];
    const [from, to, value] = pairs[randInt(0, pairs.length - 1)];
    return { value, from, to, thing };
  }
  if (tier === 2) {
    return randInt(0, 1) ? { value: randInt(2, 9), from: 'km', to: 'm', thing } : { value: randInt(2, 9) * 1000, from: 'm', to: 'km', thing };
  }
  if (tier === 3) {
    const opts: Task[] = [
      { value: randInt(11, 49) / 10, from: 'm', to: 'cm', thing },
      { value: randInt(11, 95), from: 'cm', to: 'm', thing },
      { value: randInt(11, 49) / 10, from: 'km', to: 'm', thing },
      { value: randInt(11, 95) / 10, from: 'cm', to: 'mm', thing },
    ];
    return opts[randInt(0, opts.length - 1)];
  }
  // gemischte Angaben und größere Sprünge
  const m = randInt(1, 4);
  const cm = randInt(1, 99);
  const options: Task[] = [
    { value: m * 100 + cm, from: 'cm', to: 'cm', mixed: `${m} m ${cm} cm`, thing },
    { value: randInt(1001, 4999), from: 'mm', to: 'm', thing },
    { value: randInt(101, 999) / 100, from: 'm', to: 'mm', thing },
  ];
  return options[randInt(0, options.length - 1)];
}

export class LengthPuzzle extends PuzzleScene {
  protected title = 'Die Skalenkappe';
  protected skills: SkillId[] = ['M5'];

  private task!: Task;
  private answer = 0;
  private stairs?: Phaser.GameObjects.Container;

  constructor() {
    super('LengthPuzzle');
  }

  protected buildRound(): void {
    this.task = makeTask(getLevel('M5'));
    const t = this.task;
    this.answer = t.mixed ? t.value : (t.value * MM[t.from]) / MM[t.to];
    this.stairs = undefined;
    const r = this.round;

    const given = t.mixed ?? `${formatDecimal(t.value)} ${t.from}`;
    r.add(text(this, GAME_WIDTH / 2, 90, `In der ${t.mixed ? 'Meter-Welt' : WORLD[t.from]} ist ${t.thing.article} ${t.thing.name} ${given} lang.`, 22, COLORS.text));
    r.add(text(this, GAME_WIDTH / 2, 124, `Du setzt die Skalenkappe auf: Wie lang ist ${PRONOUN[t.thing.article]} in ${t.to}?`, 20, COLORS.muted));

    // Lineal-Andeutung: Balken, darunter die Skala der Zielwelt
    const g = this.add.graphics();
    g.fillStyle(0x6d8a3a, 1).fillRoundedRect(80, 200, 420, 22, 6);
    g.fillStyle(0xe8d9a8, 1).fillRect(80, 232, 420, 26);
    for (let i = 0; i <= 40; i++) g.fillStyle(0x3a2a18, 1).fillRect(80 + i * 10.5, 232, 2, i % 10 === 0 ? 20 : i % 5 === 0 ? 14 : 8);
    r.add(g);
    r.add(text(this, 290, 280, `? ${t.to}`, 24, COLORS.goldText));

    const pad = createNumpad(this, 760, 300, (v) => this.check(v), 9, { decimal: true, unit: t.to });
    pad.container.setScale(0.78);
    r.add(pad.container);

    const factor = MM[t.from] / MM[t.to];
    this.hints = [
      factor > 1
        ? 'Du wirst kleiner, also brauchst du mehr kleine Einheiten: Die Zahl wird größer.'
        : 'Du wirst größer, also brauchst du weniger große Einheiten: Die Zahl wird kleiner.',
      'Die Einheitentreppe zeigt dir, womit du rechnen musst.',
      t.mixed
        ? `${t.mixed}: Rechne die Meter in cm um und zähle die cm dazu.`
        : `Rechne mal ${factor >= 1 ? formatDecimal(factor) : `1 : ${formatDecimal(1 / factor)}`}: Das Komma rückt um ${Math.round(Math.abs(Math.log10(factor)))} Stellen nach ${factor > 1 ? 'rechts' : 'links'}.`,
    ];
  }

  protected onHint(level: number): void {
    if (level === 1 && !this.stairs) this.showStairs();
  }

  /** Einheitentreppe: km –·1000→ m –·10→ dm –·10→ cm –·10→ mm */
  private showStairs(): void {
    const c = this.add.container(80, 330);
    const steps: [string, string][] = [['km', '· 1000'], ['m', '· 10'], ['dm', '· 10'], ['cm', '· 10'], ['mm', '']];
    steps.forEach(([u, f], i) => {
      const x = i * 90;
      const y = i * 22;
      const g = this.add.graphics();
      g.fillStyle(0x2a3844, 1).fillRoundedRect(x, y, 70, 34, 6);
      c.add(g);
      c.add(text(this, x + 35, y + 17, u, 18, COLORS.goldText));
      if (f) c.add(text(this, x + 80, y + 34, f, 14, COLORS.muted));
    });
    this.stairs = c;
    this.round.add(c);
  }

  private check(v: number): void {
    const t = this.task;
    if (sameNumber(v, this.answer)) {
      this.solved(`Richtig: ${t.mixed ?? `${formatDecimal(t.value)} ${t.from}`} = ${formatDecimal(this.answer)} ${t.to}.`);
      return;
    }
    const ratio = v / this.answer;
    if (sameNumber(ratio, 10) || sameNumber(ratio, 0.1) || sameNumber(ratio, 100) || sameNumber(ratio, 0.01)) {
      this.wrong('Die Ziffern stimmen, aber das Komma steht an der falschen Stelle. Wie viele Stellen muss es wandern?');
    } else if (sameNumber(v, t.value)) {
      this.wrong(`Das ist die Zahl aus der ${WORLD[t.from]}. In ${t.to} heißt sie anders!`);
    } else {
      this.wrong(`${formatDecimal(v)} ${t.to} passt nicht. Schau auf die Einheitentreppe.`);
    }
  }
}
