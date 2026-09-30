import Phaser from 'phaser';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const COLORS = {
  night: 0x101820,
  panel: 0x1c2a36,
  panelEdge: 0x3c5566,
  gold: 0xd9b25f,
  goldText: '#e8c877',
  text: '#e9e4d8',
  muted: '#9aa7b0',
};

// Andika ist für Leseanfänger gemacht: eindeutige Ziffern und Buchstaben (2 ≠ Z, 1 ≠ l ≠ I).
// Für ein Mathespiel wichtiger als Pixel-Optik; die Grafiken bleiben Pixelart.
export const FONT = 'Andika, system-ui, sans-serif';
/** Nur für Inschriften der Alten (römische Zahlen). */
export const FONT_CARVED = 'Cinzel, Georgia, serif';

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  size = 22,
  color = COLORS.text,
): Phaser.GameObjects.Text {
  return smooth(
    scene.add.text(x, y, content, { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2 }).setOrigin(0.5),
  );
}

/**
 * Das Spiel läuft mit `pixelArt: true` (keine Glättung, damit Pixelgrafik scharf bleibt).
 * Text in einer normalen Schrift würde dadurch kantig; für Texte deshalb Glättung an.
 */
export function smooth<T extends Phaser.GameObjects.Text>(t: T): T {
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

/** Schaltfläche, die mit Finger und Maus gleich gut funktioniert (mindestens 44 px hoch). */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onTap: () => void,
  opts: { width?: number; height?: number; size?: number; /** Deckkraft der Fläche (Titelbild: durchscheinend) */ alpha?: number } = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? Math.max(56, label.length * 14 + 40);
  const h = Math.max(44, opts.height ?? 52);
  const bg = scene.add.graphics();
  const draw = (fill: number) => {
    bg.clear();
    bg.fillStyle(fill, opts.alpha ?? 1).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(3, COLORS.gold, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  };
  draw(COLORS.panel);
  const t = text(scene, 0, 0, label, opts.size ?? 24, COLORS.goldText);
  const c = scene.add.container(x, y, [bg, t]).setSize(w, h);
  c.setInteractive({ useHandCursor: true })
    .on('pointerdown', () => draw(COLORS.panelEdge))
    .on('pointerout', () => draw(COLORS.panel))
    .on('pointerup', () => {
      draw(COLORS.panel);
      onTap();
    });
  return c;
}
