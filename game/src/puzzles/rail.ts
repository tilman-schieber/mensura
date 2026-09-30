import Phaser from 'phaser';
import { formatNumber } from '../learn/numbers';
import { COLORS, text } from '../ui/theme';

// Eine Lorenschiene als Zahlenstrahl: Schwellen sind Striche, große Schwellen die
// Hauptmarken. Beschriftet werden je nach Schwierigkeit alle Hauptmarken oder nur
// Anfang und Ende. Das Kind muss dann selbst herausfinden, was ein Strich wert ist.

export interface RailSpec {
  from: number;
  to: number;
  /** Abstand der Hauptmarken */
  major: number;
  /** Abstand der kleinen Marken (0 = keine) */
  minor: number;
  /** welche Hauptmarken beschriftet sind */
  labels: 'all' | 'ends' | 'ends+middle';
}

export class Rail {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;

  constructor(
    private scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    readonly spec: RailSpec,
    x0 = 90,
    x1 = 870,
    y = 250,
  ) {
    this.x0 = x0;
    this.x1 = x1;
    this.y = y;
    const g = scene.add.graphics();
    parent.add(g);

    // Schienenstränge
    g.fillStyle(0x6b6f76, 1).fillRect(x0 - 20, y - 9, x1 - x0 + 40, 4);
    g.fillStyle(0x6b6f76, 1).fillRect(x0 - 20, y + 5, x1 - x0 + 40, 4);

    const { from, to, major, minor, labels } = spec;
    // kleine Schwellen
    if (minor > 0) {
      for (let v = from; v <= to + 1e-9; v += minor) {
        const x = this.xOf(v);
        g.fillStyle(0x5a3a1e, 1).fillRect(x - 1.5, y - 14, 3, 28);
      }
    }
    // Hauptschwellen und Beschriftung
    const count = Math.round((to - from) / major);
    for (let i = 0; i <= count; i++) {
      const v = from + i * major;
      const x = this.xOf(v);
      g.fillStyle(0x8a5a2e, 1).fillRect(x - 3, y - 22, 6, 44);
      const show =
        labels === 'all' || i === 0 || i === count || (labels === 'ends+middle' && i === count / 2);
      if (show) parent.add(text(scene, x, y + 42, formatNumber(v), 18, COLORS.text));
    }
  }

  xOf(value: number): number {
    const { from, to } = this.spec;
    return this.x0 + ((value - from) / (to - from)) * (this.x1 - this.x0);
  }

  valueAt(x: number): number {
    const { from, to } = this.spec;
    return from + ((x - this.x0) / (this.x1 - this.x0)) * (to - from);
  }

  /** Nächste Marke (klein oder groß) zu einer x-Position */
  snap(x: number): number {
    const step = this.spec.minor || this.spec.major;
    const v = Math.round((this.valueAt(x) - this.spec.from) / step) * step + this.spec.from;
    return Phaser.Math.Clamp(v, this.spec.from, this.spec.to);
  }
}

/** Lore als einfache Pixelgrafik (bis die generierte Grafik da ist bzw. als Fallback). */
export function drawCart(scene: Phaser.Scene): Phaser.GameObjects.Container {
  if (scene.textures.exists('mine-cart')) {
    return scene.add.container(0, 0, [scene.add.image(0, -18, 'mine-cart').setScale(1.5)]);
  }
  const g = scene.add.graphics();
  g.fillStyle(0x2a1a0c, 1).fillRect(-26, -40, 52, 30);
  g.fillStyle(0x7a4e28, 1).fillRect(-23, -37, 46, 24);
  g.fillStyle(0xe0a93a, 1).fillRect(-18, -44, 36, 8);
  g.fillStyle(0x333333, 1).fillCircle(-14, -8, 7).fillCircle(14, -8, 7);
  return scene.add.container(0, 0, [g]);
}
