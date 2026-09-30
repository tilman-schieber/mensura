import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Fliesenhalle“ (Flächeninhalt M13, Umfang M9).
// Räume werden mit Fliesen ausgelegt (Fläche) oder mit einer Leiste umrandet (Umfang).
// Stufen: Rechteck mit Raster zum Abzählen → mit Einheiten → nur Seitenlängen →
// L-förmiger Raum mit Raster → L-Raum nur mit Maßen.

type Ask = 'flaeche' | 'umfang';

interface Room {
  /** Rechtecke in Einheiten (x, y, w, h); ein L-Raum besteht aus zweien */
  rects: [number, number, number, number][];
  grid: boolean;
  unit: string;
}

function area(room: Room): number {
  return room.rects.reduce((s, [, , w, h]) => s + w * h, 0);
}

/** Umfang über die Kanten des Rasters: Randkanten zählen, die nur ein Feld berühren. */
function perimeter(room: Room): number {
  const cells = new Set<string>();
  for (const [x, y, w, h] of room.rects) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.add(`${x + i},${y + j}`);
  let p = 0;
  for (const c of cells) {
    const [x, y] = c.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!cells.has(`${x + dx},${y + dy}`)) p++;
  }
  return p;
}

function makeRoom(level: number): Room {
  const tier = pickByLevel(level, [0, 1, 2, 3, 4]);
  const unit = tier === 0 ? 'Fliesen' : ['cm', 'm', 'dm'][randInt(0, 2)];
  if (tier <= 2) {
    const w = randInt(3, tier === 0 ? 6 : 9);
    const h = randInt(2, tier === 0 ? 5 : 6);
    return { rects: [[0, 0, w, h]], grid: tier < 2, unit };
  }
  // L-Form: großes Rechteck plus Anbau
  const w = randInt(4, 7);
  const h = randInt(2, 3);
  const w2 = randInt(2, w - 1);
  const h2 = randInt(2, 3);
  return { rects: [[0, 0, w, h], [0, h, w2, h2]], grid: tier === 3, unit };
}

export class TilePuzzle extends PuzzleScene {
  protected title = 'Die Fliesenhalle';
  protected skills: SkillId[] = ['M13'];

  private room!: Room;
  private ask!: Ask;
  private answer = 0;

  constructor() {
    super('TilePuzzle');
  }

  protected buildRound(): void {
    this.room = makeRoom(Math.max(getLevel('M13'), getLevel('M9')));
    this.ask = randInt(0, 2) === 0 ? 'umfang' : 'flaeche';
    this.skills = [this.ask === 'flaeche' ? 'M13' : 'M9'];
    const room = this.room;
    this.answer = this.ask === 'flaeche' ? area(room) : perimeter(room);
    const r = this.round;

    const sq = room.unit === 'Fliesen' ? '' : `${room.unit}²`;
    const unitAnswer = this.ask === 'flaeche' ? (room.unit === 'Fliesen' ? 'Fliesen' : sq) : room.unit === 'Fliesen' ? 'Fliesenkanten' : room.unit;
    r.add(
      text(
        this,
        GAME_WIDTH / 2,
        88,
        this.ask === 'flaeche' ? 'Wie groß ist der Flächeninhalt des Raums? (Fliesen zum Auslegen)' : 'Wie lang ist der Umfang des Raums? (Leiste rundherum)',
        21,
        COLORS.text,
      ),
    );

    // Raum zeichnen
    const maxW = Math.max(...room.rects.map(([x, , w]) => x + w));
    const maxH = Math.max(...room.rects.map(([, y, , h]) => y + h));
    const cell = Math.min(46, 330 / maxW, 300 / maxH);
    const ox = 90;
    const oy = 140;
    const g = this.add.graphics();
    for (const [x, y, w, h] of room.rects) {
      g.fillStyle(0xd8c7a0, 1).fillRect(ox + x * cell, oy + y * cell, w * cell, h * cell);
      if (room.grid) {
        g.lineStyle(1, 0x8a7550, 1);
        for (let i = 0; i <= w; i++) g.lineBetween(ox + (x + i) * cell, oy + y * cell, ox + (x + i) * cell, oy + (y + h) * cell);
        for (let j = 0; j <= h; j++) g.lineBetween(ox + x * cell, oy + (y + j) * cell, ox + (x + w) * cell, oy + (y + j) * cell);
      }
    }
    // Außenkontur in Gold (Leiste)
    g.lineStyle(4, this.ask === 'umfang' ? 0xf0d78a : 0x5a4a30, 1);
    const cells = new Set<string>();
    for (const [x, y, w, h] of room.rects) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.add(`${x + i},${y + j}`);
    for (const c of cells) {
      const [x, y] = c.split(',').map(Number);
      const px = ox + x * cell;
      const py = oy + y * cell;
      if (!cells.has(`${x},${y - 1}`)) g.lineBetween(px, py, px + cell, py);
      if (!cells.has(`${x},${y + 1}`)) g.lineBetween(px, py + cell, px + cell, py + cell);
      if (!cells.has(`${x - 1},${y}`)) g.lineBetween(px, py, px, py + cell);
      if (!cells.has(`${x + 1},${y}`)) g.lineBetween(px + cell, py, px + cell, py + cell);
    }
    r.add(g);

    // Maße an die Außenkanten schreiben (ohne Raster)
    if (!room.grid) {
      const [x0, , w0, h0] = room.rects[0];
      r.add(text(this, ox + (x0 + w0 / 2) * cell, oy - 14, `${w0} ${room.unit}`, 16, COLORS.goldText));
      if (room.rects.length === 1) {
        r.add(text(this, ox + w0 * cell + 30, oy + (h0 / 2) * cell, `${h0} ${room.unit}`, 16, COLORS.goldText));
      } else {
        const [, y1, w1, h1] = room.rects[1];
        r.add(text(this, ox + w0 * cell + 30, oy + (h0 / 2) * cell, `${h0} ${room.unit}`, 16, COLORS.goldText));
        r.add(text(this, ox - 34, oy + ((h0 + h1) / 2) * cell, `${h0 + h1} ${room.unit}`, 16, COLORS.goldText));
        r.add(text(this, ox + (w1 / 2) * cell, oy + (y1 + h1) * cell + 14, `${w1} ${room.unit}`, 16, COLORS.goldText));
      }
    } else if (room.unit !== 'Fliesen') {
      r.add(text(this, ox + 60, oy + maxH * cell + 18, `Ein Kästchen: 1 ${room.unit} × 1 ${room.unit}`, 14, COLORS.muted));
    }

    const pad = createNumpad(this, 760, 300, (v) => this.check(v), 4, { unit: unitAnswer });
    pad.container.setScale(0.78);
    r.add(pad.container);

    const lShape = room.rects.length > 1;
    this.hints =
      this.ask === 'flaeche'
        ? [
            'Der Flächeninhalt zählt, wie viele Einheitsquadrate hineinpassen.',
            lShape ? 'Zerlege den Raum in zwei Rechtecke und rechne beide einzeln aus.' : 'Rechteck: Länge mal Breite, also Reihen mal Quadrate pro Reihe.',
            lShape
              ? `Zwei Rechtecke: ${room.rects.map(([, , w, h]) => `${w} · ${h}`).join(' und ')}.`
              : `${room.rects[0][2]} · ${room.rects[0][3]}`,
          ]
        : [
            'Der Umfang ist die Länge der Leiste einmal ganz um den Raum herum.',
            lShape ? 'Geh einmal außen herum und zähle jede Seite. Auch die kurzen Stücke am Knick!' : 'Rechteck: 2 · Länge + 2 · Breite.',
            lShape ? 'Ein L hat genauso viel Umfang wie das große Rechteck drumherum.' : `2 · ${room.rects[0][2]} + 2 · ${room.rects[0][3]}`,
          ];
  }

  private check(v: number): void {
    const u = this.room.unit;
    if (v === this.answer) {
      this.solved(
        this.ask === 'flaeche'
          ? `Richtig: ${this.answer} ${u === 'Fliesen' ? 'Fliesen' : `${u}²`}.`
          : `Richtig: Die Leiste ist ${this.answer} ${u === 'Fliesen' ? 'Fliesenkanten' : u} lang.`,
      );
      return;
    }
    const other = this.ask === 'flaeche' ? perimeter(this.room) : area(this.room);
    if (v === other) {
      this.wrong(
        this.ask === 'flaeche'
          ? 'Das ist der Umfang (die Leiste außen herum). Gesucht ist die Fläche: wie viele Quadrate passen hinein?'
          : 'Das ist der Flächeninhalt. Gesucht ist der Umfang: die Länge einmal außen herum.',
      );
    } else {
      this.wrong(`${v} stimmt noch nicht. Schau dir die Hinweise an.`);
    }
  }
}
