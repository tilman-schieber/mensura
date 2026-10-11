import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, text } from '../ui/theme';
import { drawCuboid } from './cuboid';
import { PuzzleScene } from './PuzzleScene';

// Eichstadt ausbauen: Bevor gebaut wird, wird gerechnet. Jedes Bauprojekt hat zwei
// Aufgaben zu dem Stoff, den man bis dahin kann (Kopfrechnen, schriftlich rechnen,
// Einheiten, Volumen). Die Zahlen wachsen mit dem Können.

export interface BuildTask {
  prompt: string;
  answer: number;
  unit: string;
  skills: SkillId[];
  hints: string[];
  /** typische Fehler erkennen; null = allgemeine Rückmeldung */
  mistake?: (v: number) => string | null;
  /** kleine Zeichnung zur Aufgabe */
  draw?: (scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, r: Phaser.GameObjects.Container) => void;
  done: string;
}

export interface BuildProject {
  id: string;
  name: string;
  /** Lichtfunken */
  cost: number;
  /** Bauplatz erscheint, sobald dieser Merker gesetzt ist */
  after: string;
  /** was Bürgermeister Rudolf über den Bauplatz sagt */
  pitch: string;
  tasks: (() => BuildTask)[];
}

const pick = <T>(xs: T[]): T => xs[randInt(0, xs.length - 1)];

/** Rechteck mit Seitenlängen, für Garten und Zaun */
function drawPlot(a: number, b: number, unit: string) {
  return (scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, r: Phaser.GameObjects.Container) => {
    const s = Math.min(280 / a, 200 / b);
    const w = a * s;
    const h = b * s;
    const x = 260 - w / 2;
    const y = 300 - h / 2;
    g.fillStyle(0x6b8f3a, 1).fillRect(x, y, w, h);
    g.lineStyle(4, 0x8a5a2a, 1).strokeRect(x, y, w, h);
    r.add(text(scene, x + w / 2, y - 18, `${a} ${unit}`, 18, COLORS.goldText));
    r.add(text(scene, x + w / 2, y + h + 18, `${a} ${unit}`, 18, COLORS.goldText));
    r.add(text(scene, x - 34, y + h / 2, `${b} ${unit}`, 18, COLORS.goldText));
    r.add(text(scene, x + w + 34, y + h / 2, `${b} ${unit}`, 18, COLORS.goldText));
  };
}

export const PROJECTS: BuildProject[] = [
  {
    id: 'beet',
    name: 'Das Blumenbeet',
    cost: 5,
    after: 'elle_splitter',
    pitch: 'Ein Blumenbeet neben Elles Haus! Dann ist Eichstadt nicht mehr so grau.',
    tasks: [
      () => {
        const big = getLevel('Z11') > 0.5;
        const r = randInt(4, 9);
        const c = big ? randInt(11, 15) : randInt(4, 9);
        return {
          prompt: `Im Beet sollen ${r} Reihen mit je ${c} Blumen wachsen. Wie viele Blumen brauchst du?`,
          answer: r * c,
          unit: 'Blumen',
          skills: ['Z11'],
          hints: [`In jeder Reihe stehen ${c} Blumen, und es gibt ${r} Reihen.`, `Rechne ${r} · ${c}.`, big ? `${r} · 10 + ${r} · ${c - 10}` : `${r} · ${c}`],
          mistake: (v) => (v === r + c ? 'Nicht zusammenzählen: Es sind ' + r + ' Reihen, jede mit ' + c + ' Blumen.' : null),
          done: `${r} · ${c} = ${r * c} Blumen. Die Zwiebeln liegen bereit!`,
        };
      },
      () => {
        const per = pick([4, 5, 6, 8]);
        const k = randInt(4, 9);
        return {
          prompt: `Mira verkauft Blumenzwiebeln im Netz, ${per} Stück pro Netz. Du brauchst ${per * k} Zwiebeln. Wie viele Netze kaufst du?`,
          answer: k,
          unit: 'Netze',
          skills: ['Z11'],
          hints: [`Wie oft passt ${per} in ${per * k}?`, `Rechne ${per * k} : ${per}.`, `${per} · ? = ${per * k}`],
          mistake: (v) => (v === per * k * per ? 'Das ist viel zu viel! Teilen, nicht malnehmen.' : null),
          done: `${per * k} : ${per} = ${k} Netze. Genau richtig, nichts bleibt übrig.`,
        };
      },
    ],
  },
  {
    id: 'garten',
    name: 'Der Gemüsegarten',
    cost: 10,
    after: 'elle_deep',
    pitch: 'Ein Gemüsegarten! Aber ohne Zaun fressen uns die Rehe alles weg.',
    tasks: [
      () => {
        const big = getLevel('Z12') > 0.5;
        const a = big ? randInt(23, 48) : randInt(7, 18);
        let b = big ? randInt(12, 29) : randInt(4, 12);
        if (b === a) b -= 1;
        return {
          prompt: `Der Garten ist ${a} m lang und ${b} m breit. Wie viele Meter Zaun brauchst du rundherum?`,
          answer: 2 * a + 2 * b,
          unit: 'm',
          skills: ['Z12'],
          hints: ['Der Zaun geht um alle vier Seiten herum.', 'Zwei Seiten sind lang, zwei sind kurz.', `${a} + ${b} + ${a} + ${b}`],
          mistake: (v) =>
            v === a + b ? 'Das sind nur zwei Seiten. Der Zaun geht ganz herum!' : v === a * b ? 'Das ist die Fläche des Gartens. Für den Zaun läufst du außen herum.' : null,
          draw: drawPlot(a, b, 'm'),
          done: `${a} + ${b} + ${a} + ${b} = ${2 * a + 2 * b} m Zaun.`,
        };
      },
      () => {
        const big = getLevel('Z12') > 0.5;
        const m = big ? randInt(46, 98) : randInt(24, 45);
        const p = randInt(3, 9);
        return {
          prompt: `Mira verkauft den Zaun am Stück. Ein Meter kostet ${p} €. Was kosten ${m} Meter?`,
          answer: m * p,
          unit: '€',
          skills: ['Z12'],
          hints: [`Jeder Meter kostet ${p} €, und du brauchst ${m} Meter.`, `Rechne ${m} · ${p}, zum Beispiel schriftlich.`, `${Math.floor(m / 10) * 10} · ${p} + ${m % 10} · ${p}`],
          mistake: (v) => (v === m + p ? 'Malnehmen, nicht zusammenzählen: jeder Meter kostet ' + p + ' €.' : null),
          done: `${m} · ${p} = ${formatNumber(m * p)} €. Rudolf zahlt aus der Dorfkasse.`,
        };
      },
    ],
  },
  {
    id: 'laternen',
    name: 'Laternen am Weg',
    cost: 15,
    after: 'elle_form',
    pitch: 'Laternen am Weg, auf beiden Seiten gleich, wie im Spiegel! Dann findet nachts jeder heim, und der Nebel traut sich nicht heran.',
    tasks: [
      () => {
        const d = pick([4, 5, 6, 8, 10]);
        const k = randInt(4, 9);
        return {
          prompt: `Der Weg ist ${d * k} m lang. Alle ${d} m soll eine Laterne stehen, auch ganz am Anfang und ganz am Ende. Wie viele Laternen brauchst du?`,
          answer: k + 1,
          unit: 'Laternen',
          skills: ['PLAUS'],
          hints: [
            'Probier es erst mit einem kurzen Weg: 10 m, alle 5 m eine Laterne. Zeichne es auf!',
            'Bei 10 m und alle 5 m stehen Laternen bei 0 m, 5 m und 10 m. Das sind 3, nicht 2.',
            `${d * k} : ${d} = ${k} Abstände. Laternen gibt es eine mehr als Abstände.`,
          ],
          mistake: (v) => (v === k ? `Fast! ${k} ist die Zahl der Abstände. Zähl die Laterne ganz am Anfang mit.` : null),
          done: `${k} Abstände, also ${k + 1} Laternen. Die erste steht gleich am Anfang!`,
        };
      },
      () => {
        const n = randInt(6, 12);
        const h = randInt(3, 6);
        return {
          prompt: `${n} Laternen brennen jeden Abend ${h} Stunden lang. Wie viele Stunden brennen sie zusammen in einer Woche?`,
          answer: n * h * 7,
          unit: 'h',
          skills: ['Z12'],
          hints: [`Eine Woche hat 7 Abende.`, `An einem Abend sind es ${n} · ${h} Stunden.`, `${n * h} · 7`],
          mistake: (v) => (v === n * h ? 'Das ist nur ein einziger Abend. Die Woche hat 7!' : null),
          done: `${n} · ${h} · 7 = ${n * h * 7} Stunden Licht gegen den Nebel.`,
        };
      },
    ],
  },
  {
    id: 'obstwiese',
    name: 'Die Obstwiese',
    cost: 20,
    after: 'elle_size',
    pitch: 'Eine Obstwiese am Ostweg! Hanna hat uns Apfelbäumchen geschenkt. Für Riesen sind sie winzig, für uns genau richtig.',
    tasks: [
      () => {
        const m = randInt(1, 2);
        const cm = randInt(1, 9) * 5 + 5;
        const grow = randInt(3, 9) * 5;
        const years = randInt(2, 3);
        const now = m * 100 + cm;
        return {
          prompt: `Das Apfelbäumchen ist ${m} m ${cm} cm hoch. Jedes Jahr wächst es ${grow} cm. Wie hoch ist es in ${years} Jahren? Antworte in cm.`,
          answer: now + years * grow,
          unit: 'cm',
          skills: ['M5'],
          hints: ['Rechne zuerst die Höhe ganz in cm um: 1 m = 100 cm.', `${m} m ${cm} cm = ${now} cm.`, `${now} + ${years} · ${grow}`],
          mistake: (v) =>
            v === m + cm + years * grow ? 'Die Meter musst du erst in Zentimeter umrechnen: 1 m = 100 cm.' : v === now + grow ? `Es wächst ${years} Jahre lang, nicht nur eines.` : null,
          done: `${now} cm + ${years} · ${grow} cm = ${now + years * grow} cm.`,
        };
      },
      () => {
        const whole = randInt(3, 8);
        const half = pick([0, 5]);
        const dist = whole * 10 + half; // in dm
        const shown = half ? `${whole},${half}` : `${whole}`;
        return {
          prompt: `Zwischen zwei Bäumen sollen ${shown} m Platz sein. Wie viele Zentimeter sind das?`,
          answer: dist * 10,
          unit: 'cm',
          skills: ['M5'],
          hints: ['1 m = 100 cm.', `Das Komma rutscht zwei Stellen nach rechts.`, `${shown} · 100`],
          mistake: (v) => (v === dist ? 'Das wären Dezimeter. Ein Meter hat 100 Zentimeter.' : v === dist * 100 ? 'Das wären Millimeter. Ein Meter hat 100 Zentimeter.' : null),
          done: `${shown} m = ${dist * 10} cm.`,
        };
      },
    ],
  },
  {
    id: 'speicher',
    name: 'Das Vorratslager',
    cost: 25,
    after: 'elle_space',
    pitch: 'Ein Vorratslager für den Winter! Harald zimmert die Kisten, aber wie groß müssen sie sein?',
    tasks: [
      () => {
        const a = randInt(2, 6);
        const b = randInt(2, 4);
        const c = randInt(1, 3) + (a === b ? 1 : 0);
        return {
          prompt: `Die Kornkiste ist ${a} m lang, ${b} m breit und ${c} m hoch. Wie viele Kubikmeter Korn passen hinein?`,
          answer: a * b * c,
          unit: 'm³',
          skills: ['M15'],
          hints: ['Eine Schicht am Boden: Länge mal Breite.', 'So viele Schichten, wie die Kiste hoch ist.', `${a} · ${b} · ${c}`],
          mistake: (v) => (v === a * b ? 'Das ist nur die unterste Schicht.' : v === a + b + c ? 'Nicht zusammenzählen: Länge mal Breite mal Höhe.' : null),
          draw: (scene, g, r) => {
            const u = Math.min(46, 260 / (a + b * 0.5), 200 / (c + b * 0.5));
            drawCuboid(g, 140, 400, a, b, c, u, true);
            r.add(text(scene, 140 + (a * u) / 2, 420, `${a} m`, 17, COLORS.goldText));
            r.add(text(scene, 112, 400 - (c * u) / 2, `${c} m`, 17, COLORS.goldText));
          },
          done: `${a} · ${b} · ${c} = ${a * b * c} m³ Korn.`,
        };
      },
      () => {
        const a = randInt(2, 5);
        const b = randInt(2, 4);
        const c = randInt(1, 3);
        const area = a * b + 2 * a * c + 2 * b * c;
        return {
          prompt: `Die Kiste ist ${a} m lang, ${b} m breit und ${c} m hoch und hat keinen Deckel. Wie viele Quadratmeter Holz braucht Harald für Boden und Wände?`,
          answer: area,
          unit: 'm²',
          skills: ['M15O'],
          hints: ['Ohne Deckel: ein Boden und vier Wände.', `Boden ${a} · ${b}, zwei Wände ${a} · ${c}, zwei Wände ${b} · ${c}.`, `${a * b} + 2 · ${a * c} + 2 · ${b * c}`],
          mistake: (v) =>
            v === 2 * (a * b + a * c + b * c) ? 'Das ist mit Deckel. Die Kiste ist oben offen!' : v === a * b * c ? 'Das ist das Volumen. Gefragt ist die Fläche der Bretter.' : null,
          draw: (_scene, g) => drawCuboid(g, 140, 400, a, b, c, Math.min(46, 260 / (a + b * 0.5), 200 / (c + b * 0.5)), false),
          done: `${a * b} + ${2 * a * c} + ${2 * b * c} = ${area} m² Holz.`,
        };
      },
    ],
  },
];

export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);

export class BuildPuzzle extends PuzzleScene {
  protected title = 'Bauplatz';
  protected skills: SkillId[] = ['Z11'];
  private project!: BuildProject;
  private step = 0;
  private task!: BuildTask;

  constructor() {
    super('BuildPuzzle');
  }

  init(data: { project?: string; rounds?: number; onDone?: (solved: boolean) => void }): void {
    this.project = projectById(data.project ?? '') ?? PROJECTS[0];
    this.title = this.project.name;
    this.step = 0;
    super.init({ ...data, rounds: this.project.tasks.length });
  }

  protected buildRound(): void {
    const make = this.project.tasks[this.step % this.project.tasks.length];
    this.step += 1;
    const t = (this.task = make());
    this.skills = t.skills;
    const r = this.round;
    r.add(text(this, GAME_WIDTH / 2, 100, t.prompt, 21, COLORS.text).setWordWrapWidth(860).setAlign('center'));
    if (t.draw) {
      const g = this.add.graphics();
      r.add(g);
      t.draw(this, g, r);
    }
    const pad = createNumpad(this, t.draw ? 740 : GAME_WIDTH / 2, 330, (v) => this.check(v), 6, { unit: t.unit });
    pad.container.setScale(0.78);
    r.add(pad.container);
    this.hints = t.hints;
  }

  private check(v: number): void {
    const t = this.task;
    if (v === t.answer) {
      this.solved(t.done);
      return;
    }
    this.wrong(t.mistake?.(v) ?? `${formatNumber(v)} ${t.unit} stimmt noch nicht. Schau dir die Aufgabe noch einmal genau an.`);
  }
}
