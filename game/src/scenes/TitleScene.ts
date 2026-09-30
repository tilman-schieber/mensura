import Phaser from 'phaser';
import { SLOTS, activeSlot, loadSave, newGame, readSlot } from '../save';
import { URMASSE } from '../story';
import { fogBackdrop } from '../ui/screens';
import { COLORS, FONT_CARVED, GAME_HEIGHT, GAME_WIDTH, button, smooth, text } from '../ui/theme';
import { enterGame } from './flow';

/**
 * Titelbild: Die sieben Splitter kreisen um den Namen des Spiels; geborgene leuchten.
 * Weiterspielen, neues Spiel, Spiel laden, Einstellungen.
 */
export class TitleScene extends Phaser.Scene {
  private shards: { img: Phaser.GameObjects.Image; angle: number }[] = [];

  constructor() {
    super('Title');
  }

  create(): void {
    fogBackdrop(this);
    this.cameras.main.fadeIn(500);

    const current = activeSlot() ? loadSave() : null;
    const cx = GAME_WIDTH / 2;

    // Splitter-Kreis hinter dem Titel
    this.shards = URMASSE.map((u, i) => {
      const found = !!(current && u.flag && current.flags[u.flag]);
      const img = this.add.image(0, 0, 'splitter').setTint(found ? u.tint : 0x8a9aa8).setScale(1).setAlpha(found ? 1 : 0.45);
      if (found) this.tweens.add({ targets: img, scale: 1.1, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'sine.inout' });
      return { img, angle: (i / URMASSE.length) * Math.PI * 2 };
    });

    const title = smooth(
      this.add
        .text(cx, 116, 'Mensura', { fontFamily: FONT_CARVED, fontSize: '84px', color: COLORS.goldText, resolution: 2 })
        .setOrigin(0.5)
        .setShadow(0, 4, '#000000', 12, false, true)
        .setDepth(1),
    );
    this.tweens.add({ targets: title, alpha: { from: 0, to: 1 }, y: { from: 126, to: 116 }, duration: 1200, ease: 'sine.out' });
    text(this, cx, 182, 'Die sieben Urmaße', 26, COLORS.text);

    const filled = SLOTS.filter((n) => readSlot(n)?.avatar);
    const opts = { width: 320, height: 50, size: 21 };
    const rows: [string, () => void][] = [];
    if (current?.avatar) rows.push([`Weiterspielen: ${current.avatar.name}`, () => enterGame(this)]);
    else if (current && activeSlot()) rows.push(['Weiterspielen', () => enterGame(this)]);
    rows.push(['Neues Spiel', () => this.newGame()]);
    if (filled.length) rows.push(['Spiel laden', () => this.scene.start('Slots', { mode: 'load', from: 'Title' })]);
    rows.push(['Einstellungen', () => this.scene.launch('Settings', { from: 'Title' }).bringToTop('Settings')]);
    rows.forEach(([label, action], i) => button(this, cx, 262 + i * 60, label, action, opts));

    text(this, cx, GAME_HEIGHT - 20, 'Ein Mathe-Abenteuer für Klasse 5 und 6', 15, COLORS.muted);

    this.input.keyboard?.on('keydown-ENTER', () => rows[0][1]());
  }

  update(time: number): void {
    const t = time / 9000;
    for (const s of this.shards) {
      const a = s.angle + t;
      s.img.setPosition(GAME_WIDTH / 2 + Math.cos(a) * 330, 128 + Math.sin(a) * 78);
      // hintere Splitter kleiner und hinter dem Titel
      s.img.setDepth(Math.sin(a) > 0 ? 2 : -1);
    }
  }

  /** Erstes Spiel: gleich los. Sonst Platz wählen. */
  private newGame(): void {
    const empty = SLOTS.filter((n) => !readSlot(n));
    if (empty.length === SLOTS.length) {
      newGame(SLOTS[0]);
      enterGame(this);
      return;
    }
    this.scene.start('Slots', { mode: 'new', from: 'Title' });
  }
}
