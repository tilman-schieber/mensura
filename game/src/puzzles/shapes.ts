import Phaser from 'phaser';

// Figuren für die Geometrie-Rätsel, mit ihren Symmetrie-Eigenschaften.
// Koordinaten um den Mittelpunkt (0|0), Bildschirmrichtung (y nach unten).
// Achsen als Winkel der Achsenrichtung in Grad: 0 = waagerecht, 90 = senkrecht.

export interface ShapeDef {
  name: string;
  /** Artikel für Sätze wie „Das Rechteck …“ */
  article: 'der' | 'die' | 'das';
  points: [number, number][];
  axes: number[];
  pointSymmetric: boolean;
}

const hexagon: [number, number][] = Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]);

export const SHAPES: ShapeDef[] = [
  { name: 'Quadrat', article: 'das', points: [[-1, -1], [1, -1], [1, 1], [-1, 1]], axes: [0, 90, 45, 135], pointSymmetric: true },
  { name: 'Rechteck', article: 'das', points: [[-1.3, -0.75], [1.3, -0.75], [1.3, 0.75], [-1.3, 0.75]], axes: [0, 90], pointSymmetric: true },
  { name: 'Raute', article: 'die', points: [[0, -1.2], [0.8, 0], [0, 1.2], [-0.8, 0]], axes: [0, 90], pointSymmetric: true },
  { name: 'Drachenviereck', article: 'das', points: [[0, -1], [0.8, -0.35], [0, 1.3], [-0.8, -0.35]], axes: [90], pointSymmetric: false },
  { name: 'Parallelogramm', article: 'das', points: [[-1.3, 0.7], [0.4, 0.7], [1.3, -0.7], [-0.4, -0.7]], axes: [], pointSymmetric: true },
  { name: 'Trapez', article: 'das', points: [[-1.3, 0.7], [1.3, 0.7], [0.6, -0.7], [-0.6, -0.7]], axes: [90], pointSymmetric: false },
  { name: 'gleichschenklige Dreieck', article: 'das', points: [[0, -1.2], [0.8, 0.8], [-0.8, 0.8]], axes: [90], pointSymmetric: false },
  { name: 'gleichseitige Dreieck', article: 'das', points: [[0, -1], [0.866, 0.5], [-0.866, 0.5]], axes: [90, 30, 150], pointSymmetric: false },
  { name: 'unregelmäßige Dreieck', article: 'das', points: [[-1.1, 0.8], [1.2, 0.8], [-0.3, -1]], axes: [], pointSymmetric: false },
  { name: 'Sechseck', article: 'das', points: hexagon, axes: [0, 30, 60, 90, 120, 150], pointSymmetric: true },
  { name: 'Pfeil', article: 'der', points: [[0, -1.2], [0.9, -0.1], [0.35, -0.1], [0.35, 1.1], [-0.35, 1.1], [-0.35, -0.1], [-0.9, -0.1]], axes: [90], pointSymmetric: false },
];

export function shapeByName(name: string): ShapeDef {
  return SHAPES.find((s) => s.name === name)!;
}

/** Zeichnet eine Figur (gefüllt) mit Mittelpunkt (cx|cy) und Größe `scale`. */
export function drawShape(
  g: Phaser.GameObjects.Graphics,
  shape: ShapeDef,
  cx: number,
  cy: number,
  scale: number,
  fill = 0x7fd4ff,
  line = 0xe9e4d8,
): void {
  const pts = shape.points.map(([x, y]) => new Phaser.Math.Vector2(cx + x * scale, cy + y * scale));
  g.fillStyle(fill, 0.85).fillPoints(pts, true);
  g.lineStyle(3, line, 1).strokePoints(pts, true, true);
}

/** Zeichnet die Symmetrieachsen einer Figur als gestrichelte goldene Linien. */
export function drawAxes(g: Phaser.GameObjects.Graphics, shape: ShapeDef, cx: number, cy: number, length: number): void {
  g.lineStyle(3, 0xf0d78a, 1);
  for (const a of shape.axes) {
    const rad = (a * Math.PI) / 180;
    const dx = Math.cos(rad) * length;
    const dy = Math.sin(rad) * length;
    // gestrichelt
    const steps = 12;
    for (let i = 0; i < steps; i += 2) {
      const t0 = -1 + (2 * i) / steps;
      const t1 = -1 + (2 * (i + 1)) / steps;
      g.lineBetween(cx + dx * t0, cy + dy * t0, cx + dx * t1, cy + dy * t1);
    }
  }
}
