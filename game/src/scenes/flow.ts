import type Phaser from 'phaser';
import { loadSave } from '../save';
import { stopLine } from '../ui/dialogVoice';

// Übergänge zwischen Titelbild, Spielständen und der Welt.

/** Beendet alle laufenden Szenen außer der aufrufenden (Welt, Hud, Menü, Rätsel …). */
function stopOthers(scene: Phaser.Scene): void {
  for (const s of scene.scene.manager.getScenes(false)) {
    if (s !== scene && (s.sys.isActive() || s.sys.isPaused() || s.sys.isSleeping())) s.scene.stop();
  }
  stopLine();
}

/** Startet den aktiven Spielstand: dort, wo die Figur zuletzt war, oder mit dem Vorspann. */
export function enterGame(scene: Phaser.Scene): void {
  stopOthers(scene);
  const save = loadSave();
  if (!save.avatar) scene.scene.start('Prologue');
  else scene.scene.start(save.place?.scene ?? 'Village');
}

export function goToTitle(scene: Phaser.Scene): void {
  stopOthers(scene);
  scene.scene.start('Title');
}
