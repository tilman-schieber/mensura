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
    if (this.pendingGoal !== null) this.setGoal(this.pendingGoal);
    const queued = this.pendingDialogs;
    this.pendingDialogs = [];
    for (const [lines, onDone] of queued) this.dialog(lines, onDone);
    this.events.once('shutdown', () => {
      this.goal = undefined;
      this.goalBg = undefined;
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

  dialog(lines: DialogLine[], onDone?: () => void): void {
    if (!this.goal) {
      this.pendingDialogs.push([lines, onDone]);
      return;
    }
    showDialog(this, lines, onDone);
  }
}
