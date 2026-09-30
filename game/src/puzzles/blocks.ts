import Phaser from 'phaser';

// Stellenwert-Blöcke wie die Mehrsystemblöcke aus der Grundschule, als Erz-Kristalle:
// Einer = Nugget, Zehner = Stange aus 10 Nuggets, Hunderter = Platte aus 10 Stangen,
// Tausender = Würfel aus 10 Platten. Jede Einheit ist als Kästchen sichtbar, damit
// die Kinder nachzählen können. Deshalb im Code gezeichnet und nicht generiert.
// Wichtig: nur mit ganzzahligen Faktoren skalieren, sonst verschwimmt das Raster.

export const BLOCK_VALUES = [1000, 100, 10, 1] as const;
export type BlockValue = (typeof BLOCK_VALUES)[number];

export const BLOCK_NAMES: Record<BlockValue, string> = {
  1000: 'Tausender',
  100: 'Hunderter',
  10: 'Zehner',
  1: 'Einer',
};

export const CELL = 4; // Kantenlänge eines Nugget-Kästchens in Texturpixeln
const SIDE = CELL * 10;
const DEPTH = CELL * 5; // Tiefe der Schrägansicht beim Würfel

const EDGE = 0x3a2408;
const FRONT = 0xe0a93a;
const TOP = 0xf6d47a;
const RIGHT = 0xa8701f;

export const blockKey = (v: BlockValue) => `block-${v}`;

/** Fläche mit Kästchenraster (Rahmen + Gitterlinien). */
function grid(g: Phaser.GameObjects.Graphics, x: number, y: number, cols: number, rows: number, fill: number) {
  g.fillStyle(fill, 1).fillRect(x, y, cols * CELL, rows * CELL);
  g.lineStyle(1, EDGE, 1);
  for (let c = 0; c <= cols; c++) g.lineBetween(x + c * CELL + 0.5, y, x + c * CELL + 0.5, y + rows * CELL);
  for (let r = 0; r <= rows; r++) g.lineBetween(x, y + r * CELL + 0.5, x + cols * CELL, y + r * CELL + 0.5);
}

export function makeBlockTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(blockKey(1))) return;
  const g = scene.make.graphics({}, false);

  grid(g, 0, 0, 1, 1, FRONT);
  g.generateTexture(blockKey(1), CELL + 1, CELL + 1);
  g.clear();

  grid(g, 0, 0, 1, 10, FRONT);
  g.generateTexture(blockKey(10), CELL + 1, SIDE + 1);
  g.clear();

  grid(g, 0, 0, 10, 10, FRONT);
  g.generateTexture(blockKey(100), SIDE + 1, SIDE + 1);
  g.clear();

  // Tausender: Vorderseite unten links, Oberseite und rechte Seite als Parallelogramme.
  const fx = 0;
  const fy = DEPTH;
  // Oberseite
  g.fillStyle(TOP, 1).fillPoints(
    [
      new Phaser.Math.Vector2(fx, fy),
      new Phaser.Math.Vector2(fx + DEPTH, fy - DEPTH),
      new Phaser.Math.Vector2(fx + SIDE + DEPTH, fy - DEPTH),
      new Phaser.Math.Vector2(fx + SIDE, fy),
    ],
    true,
  );
  // rechte Seite
  g.fillStyle(RIGHT, 1).fillPoints(
    [
      new Phaser.Math.Vector2(fx + SIDE, fy),
      new Phaser.Math.Vector2(fx + SIDE + DEPTH, fy - DEPTH),
      new Phaser.Math.Vector2(fx + SIDE + DEPTH, fy + SIDE - DEPTH),
      new Phaser.Math.Vector2(fx + SIDE, fy + SIDE),
    ],
    true,
  );
  // Gitterlinien auf Ober- und Seitenfläche (10 Teilungen längs, 10 in die Tiefe)
  g.lineStyle(1, EDGE, 0.8);
  for (let i = 0; i <= 10; i++) {
    const t = (i / 10) * DEPTH;
    g.lineBetween(fx + t, fy - t, fx + SIDE + t, fy - t); // Oberseite, parallel zur Vorderkante
    g.lineBetween(fx + i * CELL, fy, fx + i * CELL + DEPTH, fy - DEPTH); // Oberseite, in die Tiefe
    g.lineBetween(fx + SIDE + t, fy - t, fx + SIDE + t, fy + SIDE - t); // Seite, senkrecht
    g.lineBetween(fx + SIDE, fy + i * CELL, fx + SIDE + DEPTH, fy + i * CELL - DEPTH); // Seite, in die Tiefe
  }
  grid(g, fx, fy, 10, 10, FRONT);
  g.generateTexture(blockKey(1000), SIDE + DEPTH + 1, SIDE + DEPTH + 1);
  g.destroy();
}
