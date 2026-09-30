import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, button, smooth, text } from './theme';

// Bausteine für Bildschirme außerhalb der Welt: Titelbild, Spielstände, Einstellungen.

/** Nachthimmel mit Sternen und ziehendem Nebel */
export function fogBackdrop(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x070d15, 0x070d15, 0x1c2b3b, 0x1c2b3b, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  g.setDepth(-10);
  for (let i = 0; i < 60; i++) {
    const star = scene.add.circle(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT * 0.6, Math.random() < 0.2 ? 1.6 : 1, 0xe9e4d8, 0.7).setDepth(-9);
    scene.tweens.add({ targets: star, alpha: 0.15, duration: 1200 + Math.random() * 2400, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
  }
  // Nebel aus vielen blassen, übereinanderliegenden Schwaden, damit keine harten Kanten entstehen
  for (let i = 0; i < 16; i++) {
    const y = GAME_HEIGHT * (0.5 + Math.random() * 0.55);
    const e = scene.add.ellipse(Math.random() * GAME_WIDTH, y, 360 + Math.random() * 360, 90 + Math.random() * 80, 0xc9d4de, 0.025 + Math.random() * 0.03).setDepth(-8);
    scene.tweens.add({ targets: e, x: e.x + (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 120), duration: 7000 + Math.random() * 6000, yoyo: true, repeat: -1, ease: 'sine.inout' });
  }
}

/** Kasten mit goldenem Rand */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, alpha).fillRoundedRect(x, y, w, h, 14);
  g.lineStyle(3, COLORS.gold, 1).strokeRoundedRect(x, y, w, h, 14);
  return g;
}

/** Rückfrage vor etwas, das sich nicht rückgängig machen lässt. */
export function confirmBox(scene: Phaser.Scene, message: string, yes: string, onYes: () => void): void {
  const root = scene.add.container(0, 0).setDepth(50_000);
  const shade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080b, 0.75).setOrigin(0).setInteractive();
  const w = 520;
  const h = 230;
  const x = (GAME_WIDTH - w) / 2;
  const y = (GAME_HEIGHT - h) / 2;
  const box = panel(scene, x, y, w, h);
  const msg = smooth(
    scene.add
      .text(GAME_WIDTH / 2, y + 80, message, { fontFamily: FONT, fontSize: '22px', color: COLORS.text, align: 'center', wordWrap: { width: w - 60 }, resolution: 2 })
      .setOrigin(0.5),
  );
  const close = () => root.destroy();
  const no = button(scene, GAME_WIDTH / 2 - 120, y + h - 50, 'Abbrechen', close, { width: 200, height: 50, size: 20 });
  const ok = button(scene, GAME_WIDTH / 2 + 120, y + h - 50, yes, () => {
    close();
    onYes();
  }, { width: 200, height: 50, size: 20 });
  root.add([shade, box, msg, no, ok]);
}

/** Kurze Meldung oben im Bild, verschwindet von selbst. */
export function toast(scene: Phaser.Scene, message: string): void {
  const t = text(scene, GAME_WIDTH / 2, 40, message, 20, COLORS.goldText).setDepth(60_001);
  const b = t.getBounds();
  const bg = scene.add.graphics().setDepth(60_000);
  bg.fillStyle(COLORS.panel, 0.95).fillRoundedRect(b.x - 18, b.y - 8, b.width + 36, b.height + 16, 10);
  bg.lineStyle(2, COLORS.gold, 1).strokeRoundedRect(b.x - 18, b.y - 8, b.width + 36, b.height + 16, 10);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 1800, duration: 600, onComplete: () => (t.destroy(), bg.destroy()) });
}

/** Text einer Schaltfläche aus `button()` ändern */
export function setButtonLabel(b: Phaser.GameObjects.Container, label: string): void {
  (b.list[1] as Phaser.GameObjects.Text).setText(label);
}
