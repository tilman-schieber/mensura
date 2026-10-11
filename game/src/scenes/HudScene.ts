import Phaser from 'phaser';
import { showDialog, type DialogLine } from '../ui/dialog';
import { COLORS, FONT, GAME_WIDTH, button, smooth } from '../ui/theme';

/**
 * Anzeigen über der Welt: aktuelles Ziel oben und Dialoge unten.
 * Läuft parallel zur Weltszene, ohne deren Kamera-Zoom.
 * Die Weltszene startet sie im selben Moment, in dem sie schon Ziele setzt;
 * deshalb werden Aufträge vor `create()` vorgemerkt.
 */
export class HudScene extends Phaser.Scene {
  private goal?: Phaser.GameObjects.Text;
  private goalBg?: Phaser.GameObjects.Graphics;
  private pendingGoal: string | null = null;
  private funkenText?: Phaser.GameObjects.Text;
  private funkenBg?: Phaser.GameObjects.Graphics;
  private pendingFunken: number | null = null;
  private pendingDialogs: [DialogLine[], (() => void) | undefined][] = [];
  /** Aktuelle Weltszene (für das Menü) */
  world = '';
  /** Darf das Menü gerade geöffnet werden? (nicht während Dialogen und Rätseln) */
  canOpenMenu: () => boolean = () => true;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.goalBg = this.add.graphics();
    this.goal = smooth(
      this.add
        .text(GAME_WIDTH / 2, 16, '', { fontFamily: FONT, fontSize: '19px', color: COLORS.goldText, resolution: 2 })
        .setOrigin(0.5, 0),
    );
    button(this, GAME_WIDTH - 62, 34, 'Menü', () => this.openMenu(), { width: 96, height: 44, size: 18 });
    this.input.keyboard?.on('keydown-ESC', () => this.openMenu());
    // Lichtfunken oben links
    // über den schwebenden Markierungen der Welt (Tiefe 5000)
    this.funkenBg = this.add.graphics().setDepth(6000);
    this.funkenText = smooth(
      this.add.text(24, 34, '', { fontFamily: FONT, fontSize: '20px', color: '#fff1b0', resolution: 2 }).setOrigin(0, 0.5).setDepth(6001),
    );
    if (this.pendingFunken !== null) this.setFunken(this.pendingFunken);
    if (this.pendingGoal !== null) this.setGoal(this.pendingGoal);
    const queued = this.pendingDialogs;
    this.pendingDialogs = [];
    for (const [lines, onDone] of queued) this.dialog(lines, onDone);
    this.events.once('shutdown', () => {
      this.goal = undefined;
      this.goalBg = undefined;
      this.funkenText = undefined;
      this.funkenBg = undefined;
    });
  }

  private openMenu(): void {
    if (!this.world || !this.canOpenMenu() || this.scene.isActive('Menu')) return;
    this.scene.pause(this.world);
    this.scene.launch('Menu', { world: this.world });
    this.scene.bringToTop('Menu');
  }

  setGoal(message: string): void {
    if (!this.goal || !this.goalBg) {
      this.pendingGoal = message;
      return;
    }
    this.goal.setText(message ? `Ziel: ${message}` : '');
    this.goalBg.clear();
    if (!message) return;
    const b = this.goal.getBounds();
    this.goalBg.fillStyle(COLORS.panel, 0.85).fillRoundedRect(b.x - 14, b.y - 6, b.width + 28, b.height + 12, 10);
  }

  /** Anzeige der Lichtfunken (✦) setzen; 0 = ausblenden, solange man noch keine hat */
  setFunken(n: number): void {
    if (!this.funkenText || !this.funkenBg) {
      this.pendingFunken = n;
      return;
    }
    this.funkenText.setText(n > 0 ? `✦ ${n}` : '');
    this.funkenBg.clear();
    if (n <= 0) return;
    const b = this.funkenText.getBounds();
    this.funkenBg.fillStyle(COLORS.panel, 0.85).fillRoundedRect(b.x - 12, b.y - 6, b.width + 24, b.height + 12, 10);
  }

  /** Funken dazugewonnen: kleine Zahl steigt auf, die Anzeige zählt hoch */
  gainFunken(amount: number, total: number, label = ''): void {
    this.setFunken(total);
    if (!this.funkenText) return;
    const msg = smooth(
      this.add
        .text(GAME_WIDTH / 2, 90, `+${amount} ✦${label ? `  ${label}` : ''}`, {
          fontFamily: FONT,
          fontSize: label ? '26px' : '20px',
          color: '#fff1b0',
          stroke: '#2a1804',
          strokeThickness: 5,
          resolution: 2,
        })
        .setOrigin(0.5),
    );
    this.tweens.add({ targets: msg, y: 60, alpha: { from: 1, to: 0 }, delay: label ? 1200 : 500, duration: 900, onComplete: () => msg.destroy() });
    this.tweens.add({ targets: this.funkenText, scale: 1.3, duration: 150, yoyo: true });
  }

  dialog(lines: DialogLine[], onDone?: () => void): void {
    if (!this.goal) {
      this.pendingDialogs.push([lines, onDone]);
      return;
    }
    showDialog(this, lines, onDone);
  }
}
