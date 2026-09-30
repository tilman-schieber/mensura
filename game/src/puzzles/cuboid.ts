import Phaser from 'phaser';

// Quader in Schrägansicht (Kavalierperspektive), optional mit Einheitswürfel-Raster.
// a = Breite (nach rechts), b = Tiefe (schräg nach hinten), c = Höhe (nach oben).

export function drawCuboid(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  a: number,
  b: number,
  c: number,
  unit: number,
  grid = true,
  colors = { front: 0xd8a25a, top: 0xf0c984, side: 0xa8743a, line: 0x3a2408 },
): void {
  const d = unit * 0.5; // Tiefe pro Einheit (schräg)
  const fx = x;
  const fy = y; // linke untere Ecke der Vorderseite
  const W = a * unit;
  const H = c * unit;
  const D = b * d;
  const V = (px: number, py: number) => new Phaser.Math.Vector2(px, py);
  // Vorderseite
  g.fillStyle(colors.front, 1).fillRect(fx, fy - H, W, H);
  // Oberseite
  g.fillStyle(colors.top, 1).fillPoints([V(fx, fy - H), V(fx + D, fy - H - D), V(fx + W + D, fy - H - D), V(fx + W, fy - H)], true);
  // rechte Seite
  g.fillStyle(colors.side, 1).fillPoints([V(fx + W, fy), V(fx + W, fy - H), V(fx + W + D, fy - H - D), V(fx + W + D, fy - D)], true);
  g.lineStyle(1.5, colors.line, grid ? 0.8 : 1);
  if (grid) {
    for (let i = 0; i <= a; i++) {
      g.lineBetween(fx + i * unit, fy, fx + i * unit, fy - H); // Vorderseite senkrecht
      g.lineBetween(fx + i * unit, fy - H, fx + i * unit + D, fy - H - D); // Oberseite in die Tiefe
    }
    for (let k = 0; k <= c; k++) {
      g.lineBetween(fx, fy - k * unit, fx + W, fy - k * unit); // Vorderseite waagerecht
      g.lineBetween(fx + W, fy - k * unit, fx + W + D, fy - k * unit - D); // Seite in die Tiefe
    }
    for (let j = 0; j <= b; j++) {
      g.lineBetween(fx + j * d, fy - H - j * d, fx + W + j * d, fy - H - j * d); // Oberseite quer
      g.lineBetween(fx + W + j * d, fy - j * d, fx + W + j * d, fy - H - j * d); // Seite senkrecht
    }
  }
  g.lineStyle(2.5, colors.line, 1);
  g.strokeRect(fx, fy - H, W, H);
  g.strokePoints([V(fx, fy - H), V(fx + D, fy - H - D), V(fx + W + D, fy - H - D), V(fx + W, fy - H)], true);
  g.strokePoints([V(fx + W, fy), V(fx + W + D, fy - D), V(fx + W + D, fy - H - D)], false);
}
