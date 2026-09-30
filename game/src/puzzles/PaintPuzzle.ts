import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, text } from '../ui/theme';
import { drawCuboid } from './cuboid';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Malerwerkstatt“ (Oberfläche von Quadern, M15).
// Eine Kiste soll von allen Seiten angemalt werden. Wie viel cm² Fläche sind das?
// Stufen: Würfel (6 · a²) → kleiner Quader → größerer Quader → Kiste ohne Deckel (5 Seiten).
// Hinweis 2 blendet das aufgeklappte Netz mit den Flächen der Seiten ein.

interface Task {
  a: number;
  b: number;
  c: number;
  lid: boolean;
}

function makeTask(level: number): Task {
  const tier = pickByLevel(level, [0, 1, 2, 3]);
  if (tier === 0) {
    const s = randInt(2, 6);
    return { a: s, b: s, c: s, lid: true };
  }
  // Ab Stufe 1 ein echter Quader: kein zufälliger Würfel, und keine zwei gleichen Kanten,
  // damit wirklich drei verschiedene Flächenpaare zu berechnen sind.
  let t: Task;
  do {
    t =
      tier === 1
        ? { a: randInt(2, 5), b: randInt(2, 4), c: randInt(2, 4), lid: true }
        : { a: randInt(4, 10), b: randInt(3, 7), c: randInt(2, 6), lid: tier === 2 };
  } while (t.a === t.b || t.b === t.c || t.a === t.c);
  return t;
}

const surface = (t: Task) => 2 * (t.a * t.b + t.a * t.c + t.b * t.c) - (t.lid ? 0 : t.a * t.b);

export class PaintPuzzle extends PuzzleScene {
  protected title = 'Die Malerwerkstatt';
  protected skills: SkillId[] = ['M15O'];

  private task!: Task;
  private netShown = false;

  constructor() {
    super('PaintPuzzle');
  }

  protected buildRound(): void {
    this.task = makeTask(getLevel('M15O'));
    this.netShown = false;
    const t = this.task;
    const r = this.round;
    const cube = t.a === t.b && t.b === t.c;
    r.add(
      text(
        this,
        GAME_WIDTH / 2,
        88,
        t.lid
          ? `Die ${cube ? 'würfelförmige ' : ''}Kiste wird von allen Seiten angemalt. Wie viel Fläche ist das?`
          : 'Die Kiste hat keinen Deckel. Sie wird außen angemalt, aber nicht oben. Wie viel Fläche ist das?',
        20,
        COLORS.text,
      ),
    );

    const g = this.add.graphics();
    const unit = Math.min(34, 280 / (t.a + t.b * 0.5), 220 / (t.c + t.b * 0.5));
    drawCuboid(g, 80, 400, t.a, t.b, t.c, unit, false, { front: 0xb8834a, top: t.lid ? 0xd8a86a : 0x3a2408, side: 0x8a5a2e, line: 0x2a1a08 });
    r.add(g);
    r.add(text(this, 80 + (t.a * unit) / 2, 420, `${t.a} cm`, 16, COLORS.goldText));
    r.add(text(this, 48, 400 - (t.c * unit) / 2, `${t.c} cm`, 16, COLORS.goldText));
    r.add(text(this, 80 + t.a * unit + (t.b * unit * 0.5) / 2 + 34, 400 - (t.b * unit * 0.5) / 2, `${t.b} cm`, 16, COLORS.goldText));

    const pad = createNumpad(this, 770, 310, (v) => this.check(v), 5, { unit: 'cm²' });
    pad.container.setScale(0.78);
    r.add(pad.container);

    this.hints = [
      cube ? 'Ein Würfel hat 6 gleich große quadratische Seiten.' : 'Ein Quader hat 6 Seiten: je zwei gleiche gegenüber (vorne/hinten, oben/unten, links/rechts).',
      'Schau dir das aufgeklappte Netz der Kiste an: Die Oberfläche ist die Summe aller Rechtecke.',
      cube
        ? `6 · ${t.a} · ${t.a}`
        : `2 · ${t.a}·${t.b} + 2 · ${t.a}·${t.c} + 2 · ${t.b}·${t.c}${t.lid ? '' : `, ohne Deckel: minus ${t.a}·${t.b}`}`,
    ];
  }

  protected onHint(level: number): void {
    if (level === 1 && !this.netShown) this.showNet();
  }

  /** Aufgeklapptes Netz mit der Fläche jeder Seite */
  private showNet(): void {
    this.netShown = true;
    const t = this.task;
    const s = Math.min(9, 120 / (t.a + 2 * t.c), 150 / (2 * t.b + 2 * t.c));
    const ox = 470;
    const oy = 140;
    const g = this.add.graphics();
    const face = (x: number, y: number, w: number, h: number, label: string, show = true) => {
      if (!show) return;
      g.fillStyle(0xd8a86a, 1).fillRect(ox + x * s, oy + y * s, w * s, h * s);
      g.lineStyle(1.5, 0x2a1a08, 1).strokeRect(ox + x * s, oy + y * s, w * s, h * s);
      this.round.add(text(this, ox + (x + w / 2) * s, oy + (y + h / 2) * s, label, 11, '#2a1a08'));
    };
    // Mittelstreifen: Deckel, Vorderseite, Boden, Rückseite; links und rechts die Seitenflächen
    face(t.c, 0, t.a, t.b, `${t.a * t.b}`, t.lid); // Deckel
    face(t.c, t.b, t.a, t.c, `${t.a * t.c}`); // Vorderseite
    face(t.c, t.b + t.c, t.a, t.b, `${t.a * t.b}`); // Boden
    face(t.c, 2 * t.b + t.c, t.a, t.c, `${t.a * t.c}`); // Rückseite
    face(0, t.b + t.c, t.c, t.b, `${t.b * t.c}`); // links
    face(t.c + t.a, t.b + t.c, t.c, t.b, `${t.b * t.c}`); // rechts
    this.round.add(g);
    g.setDepth(2);
  }

  private check(v: number): void {
    const t = this.task;
    const o = surface(t);
    if (v === o) {
      this.solved(`Richtig: ${o} cm² Farbe. Die Kiste glänzt!`);
      return;
    }
    if (v === t.a * t.b * t.c) this.wrong('Das ist das Volumen (was hineinpasst). Gesucht ist die Fläche außen herum.');
    else if (!t.lid && v === surface({ ...t, lid: true })) this.wrong('Fast! Aber die Kiste hat keinen Deckel: Eine Seite fällt weg.');
    else if (v === t.a * t.b + t.a * t.c + t.b * t.c) this.wrong('Das sind erst drei Seiten. Jede Seite gibt es zweimal!');
    else this.wrong(`${v} cm² stimmt noch nicht. Rechne jede Seite einzeln aus.`);
  }
}

