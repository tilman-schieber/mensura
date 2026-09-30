import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Sternenkarte“ (Koordinatensystem, R12 / F3).
//  - setzen:   Setze den Kristall auf (4|3).
//  - ablesen:  Wo steht der Stern? Unter den Antworten ist immer der Tauschfehler (3|4).
//  - figur:    Setze vier Punkte; die Karte verbindet sie. Welches Viereck entsteht?
// Später sind die Achsen in Zweier- oder Fünferschritten beschriftet.

interface Tier {
  max: number;
  /** Abstand der Gitterlinien in Einheiten */
  grid: number;
  /** Abstand der Beschriftungen in Einheiten */
  label: number;
  mode: 'setzen' | 'ablesen' | 'figur';
}

const TIERS: Tier[] = [
  { max: 6, grid: 1, label: 1, mode: 'setzen' },
  { max: 8, grid: 1, label: 1, mode: 'ablesen' },
  { max: 12, grid: 1, label: 2, mode: 'setzen' },
  { max: 50, grid: 5, label: 10, mode: 'ablesen' },
  { max: 8, grid: 1, label: 1, mode: 'figur' },
];

const FIGURES: { name: string; pts: [number, number][] }[] = [
  { name: 'Rechteck', pts: [[1, 1], [6, 1], [6, 4], [1, 4]] },
  { name: 'Quadrat', pts: [[2, 1], [6, 1], [6, 5], [2, 5]] },
  { name: 'Parallelogramm', pts: [[1, 1], [5, 1], [7, 4], [3, 4]] },
  { name: 'Trapez', pts: [[1, 1], [7, 1], [5, 4], [3, 4]] },
  { name: 'Raute', pts: [[4, 1], [6, 4], [4, 7], [2, 4]] },
  { name: 'Drachenviereck', pts: [[4, 1], [6, 3], [4, 7], [2, 3]] },
];

const fmt = (x: number, y: number) => `(${x}|${y})`;

export class CoordinatePuzzle extends PuzzleScene {
  protected title = 'Die Sternenkarte';
  protected skills: SkillId[] = ['R12'];

  private tier!: Tier;
  private ox = 0;
  private oy = 0;
  private unit = 0;
  private target: [number, number] = [0, 0];
  private figure?: (typeof FIGURES)[number];
  private placed: [number, number][] = [];
  private layer!: Phaser.GameObjects.Graphics;

  constructor() {
    super('CoordinatePuzzle');
  }

  private px(x: number, y: number): [number, number] {
    return [this.ox + x * this.unit, this.oy - y * this.unit];
  }

  protected buildRound(): void {
    this.tier = pickByLevel(getLevel('R12'), TIERS);
    const t = this.tier;
    this.placed = [];
    const r = this.round;

    // Koordinatensystem links, 300 px hoch (Platz lassen für den Hinweis-Knopf unten links)
    const size = 300;
    this.unit = size / t.max;
    this.ox = 200;
    this.oy = 420;
    const g = this.add.graphics();
    r.add(g);
    for (let v = 0; v <= t.max; v += t.grid) {
      const [x] = this.px(v, 0);
      const [, y] = this.px(0, v);
      g.lineStyle(1, 0x3c5566, 1).lineBetween(x, this.oy, x, this.oy - size);
      g.lineStyle(1, 0x3c5566, 1).lineBetween(this.ox, y, this.ox + size, y);
      if (v % t.label === 0) {
        r.add(text(this, x, this.oy + 16, String(v), 14, COLORS.muted));
        if (v > 0) r.add(text(this, this.ox - 16, y, String(v), 14, COLORS.muted));
      }
    }
    g.lineStyle(3, 0xe9e4d8, 1).lineBetween(this.ox, this.oy, this.ox + size + 14, this.oy).lineBetween(this.ox, this.oy, this.ox, this.oy - size - 14);
    r.add(text(this, this.ox + size + 26, this.oy, 'x', 18, COLORS.text));
    r.add(text(this, this.ox, this.oy - size - 28, 'y', 18, COLORS.text));
    this.layer = this.add.graphics().setDepth(3);
    r.add(this.layer);

    this.hints = [
      'Erst nach rechts (x), dann nach oben (y). Der erste Wert in der Klammer ist immer x.',
      t.label > 1 ? `Nicht jede Linie ist beschriftet. Eine Linie weiter bedeutet ${t.grid} ${t.grid === 1 ? 'Einheit' : 'Einheiten'}.` : 'Zähle die Linien vom Ursprung (0|0) aus ab.',
      'Merkhilfe: Erst gehen, dann klettern.',
    ];

    const step = t.grid;
    const rnd = () => randInt(1, t.max / step - 1) * step;

    if (t.mode === 'figur') {
      this.figure = FIGURES[randInt(0, FIGURES.length - 1)];
      const names = ['A', 'B', 'C', 'D'];
      r.add(text(this, 700, 110, 'Setze die Punkte der Reihe nach:', 20, COLORS.text));
      this.figure.pts.forEach(([x, y], i) => r.add(text(this, 700, 150 + i * 32, `${names[i]} ${fmt(x, y)}`, 22, COLORS.goldText)));
      this.enableTap();
      return;
    }

    this.target = [rnd(), rnd()];
    if (this.target[0] === this.target[1]) this.target[1] = this.target[1] === step ? 2 * step : this.target[1] - step;
    const [tx, ty] = this.target;

    if (t.mode === 'setzen') {
      r.add(text(this, 700, 140, `Setze den Kristall auf ${fmt(tx, ty)}!`, 24, COLORS.text));
      r.add(text(this, 700, 176, 'Tippe auf den Kreuzungspunkt.', 16, COLORS.muted));
      this.enableTap();
    } else {
      const [sx, sy] = this.px(tx, ty);
      this.drawStar(sx, sy, 0xf0d78a);
      r.add(text(this, 700, 140, 'Wo steht der Stern?', 24, COLORS.text));
      const options = Phaser.Utils.Array.Shuffle([
        [tx, ty],
        [ty, tx],
        [tx + step, ty],
        [tx, ty - step],
      ]);
      options.forEach(([x, y], i) => {
        r.add(button(this, 620 + (i % 2) * 170, 230 + Math.floor(i / 2) * 76, fmt(x, y), () => this.checkRead(x, y), { width: 150, height: 60, size: 24 }));
      });
    }
  }

  private drawStar(x: number, y: number, color: number): void {
    const s = this.add.star(x, y, 5, 5, 12, color).setStrokeStyle(2, 0x2a2016).setDepth(4);
    this.round.add(s);
  }

  private enableTap(): void {
    const t = this.tier;
    const size = t.max * this.unit;
    const zone = this.add.zone(this.ox - 20, this.oy - size - 20, size + 40, size + 40).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const step = t.grid;
      const x = Phaser.Math.Clamp(Math.round((p.x - this.ox) / this.unit / step) * step, 0, t.max);
      const y = Phaser.Math.Clamp(Math.round((this.oy - p.y) / this.unit / step) * step, 0, t.max);
      if (t.mode === 'figur') this.placeFigurePoint(x, y);
      else this.checkPlace(x, y);
    });
    this.round.add(zone);
  }

  private checkPlace(x: number, y: number): void {
    const [tx, ty] = this.target;
    const [sx, sy] = this.px(x, y);
    this.layer.clear();
    this.layer.fillStyle(x === tx && y === ty ? 0x7fd4ff : 0xc0504a, 1).fillCircle(sx, sy, 9);
    if (x === tx && y === ty) this.solved(`Der Kristall leuchtet auf ${fmt(tx, ty)}!`);
    else if (x === ty && y === tx) this.wrong(`Das ist ${fmt(x, y)}: x und y vertauscht! Erst nach rechts, dann nach oben.`);
    else this.wrong(`Das ist ${fmt(x, y)}. Gesucht ist ${fmt(tx, ty)}.`);
  }

  private checkRead(x: number, y: number): void {
    const [tx, ty] = this.target;
    if (x === tx && y === ty) this.solved(`Genau, der Stern steht auf ${fmt(tx, ty)}.`);
    else if (x === ty && y === tx) this.wrong('x und y vertauscht! Der erste Wert gibt an, wie weit es nach rechts geht.');
    else this.wrong(`${fmt(x, y)} liegt woanders. Zähle noch einmal: erst rechts, dann hoch.`);
  }

  private placeFigurePoint(x: number, y: number): void {
    const fig = this.figure!;
    const i = this.placed.length;
    const [ex, ey] = fig.pts[i];
    if (x !== ex || y !== ey) {
      this.wrong(`Das ist ${fmt(x, y)}. Punkt ${'ABCD'[i]} liegt bei ${fmt(ex, ey)}.`);
      return;
    }
    this.placed.push([x, y]);
    const [sx, sy] = this.px(x, y);
    this.layer.fillStyle(0x7fd4ff, 1).fillCircle(sx, sy, 8);
    this.round.add(text(this, sx + 14, sy - 14, 'ABCD'[i], 16, COLORS.goldText));
    if (this.placed.length < 4) return;
    // Viereck zeichnen und nach dem Namen fragen
    const pts = this.placed.map(([px, py]) => new Phaser.Math.Vector2(...this.px(px, py)));
    this.layer.lineStyle(3, 0xf0d78a, 1).strokePoints(pts, true, true);
    this.round.add(text(this, 700, 300, 'Welches Viereck ist entstanden?', 20, COLORS.text));
    const options = Phaser.Utils.Array.Shuffle(FIGURES.map((f) => f.name).filter((n) => n !== fig.name)).slice(0, 3);
    Phaser.Utils.Array.Shuffle([fig.name, ...options]).forEach((name, k) => {
      this.round.add(
        button(this, 620 + (k % 2) * 180, 350 + Math.floor(k / 2) * 64, name, () => {
          if (name === fig.name) this.solved(`Richtig, ein${fig.name === 'Raute' ? 'e' : ''} ${fig.name}!`);
          else this.wrong('Schau auf die Seiten: Welche sind parallel, welche gleich lang?');
        }, { width: 170, height: 54, size: 17 }),
      );
    });
  }
}
