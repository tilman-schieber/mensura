import Phaser from 'phaser';
import { speakLine, stopLine } from './dialogVoice';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, smooth } from './theme';

export interface DialogLine {
  speaker: string;
  text: string;
}

/**
 * Zeigt Dialogzeilen unten im Bild. Weiter mit Tippen/Klicken oder Leertaste.
 * Jede Zeile wird zusätzlich vorgelesen (kurze Texte, großes Schriftbild, für
 * ein Kind am Anfang von Klasse 5).
 */
export function showDialog(scene: Phaser.Scene, lines: DialogLine[], onDone?: () => void): void {
  const w = GAME_WIDTH - 60;
  const h = 150;
  const x = 30;
  const y = GAME_HEIGHT - h - 20;

  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(10_000);
  const bg = scene.add.graphics();
  bg.fillStyle(COLORS.panel, 0.96).fillRoundedRect(x, y, w, h, 12);
  bg.lineStyle(3, COLORS.gold, 1).strokeRoundedRect(x, y, w, h, 12);
  const name = smooth(scene.add.text(x + 24, y + 14, '', {
    fontFamily: FONT,
    fontSize: '22px',
    color: COLORS.goldText,
    resolution: 2,
  }));
  const body = smooth(scene.add.text(x + 24, y + 48, '', {
    fontFamily: FONT,
    fontSize: '24px',
    color: COLORS.text,
    wordWrap: { width: w - 60 },
    lineSpacing: 6,
    resolution: 2,
  }));
  const more = smooth(
    scene.add
      .text(x + w - 28, y + h - 24, '▶', { fontFamily: FONT, fontSize: '22px', color: COLORS.goldText, resolution: 2 })
      .setOrigin(0.5),
  );
  scene.tweens.add({ targets: more, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

  // Unsichtbare Fläche über dem ganzen Bild fängt Klicks ab, solange der Dialog offen ist.
  const blocker = scene.add
    .zone(0, 0, GAME_WIDTH, GAME_HEIGHT)
    .setOrigin(0)
    .setScrollFactor(0)
    .setInteractive();
  root.add([blocker, bg, name, body, more]);

  let i = 0;
  const show = () => {
    name.setText(lines[i].speaker);
    body.setText(lines[i].text);
    speakLine(lines[i].speaker, lines[i].text);
  };
  const next = () => {
    i += 1;
    if (i >= lines.length) {
      stopLine();
      scene.input.keyboard?.off('keydown-SPACE', next);
      root.destroy();
      onDone?.();
      return;
    }
    show();
  };
  blocker.on('pointerup', next);
  scene.input.keyboard?.on('keydown-SPACE', next);
  show();
}
