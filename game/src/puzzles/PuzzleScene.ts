import Phaser from 'phaser';
import { recordAttempt } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, button, smooth, text } from '../ui/theme';

export interface PuzzleData {
  /** Wird gerufen, wenn alle Aufgaben der Station gelöst sind (oder abgebrochen wurde). */
  onDone?: (solved: boolean) => void;
  /** Wie viele Aufgaben hintereinander */
  rounds?: number;
}

/**
 * Grundgerüst für alle Rätsel: Rahmen, Titel, Hinweis-Leiter (Eule), Abbrechen,
 * mehrere Runden und das Eintragen in den Lernfortschritt.
 *
 * Unterklassen bauen in `buildRound()` eine Aufgabe auf (alles in `this.round`,
 * das zwischen den Runden geleert wird) und melden das Ergebnis mit `solved()`
 * oder `wrong()`.
 */
export abstract class PuzzleScene extends Phaser.Scene {
  protected abstract title: string;
  protected abstract skills: SkillId[];

  protected round!: Phaser.GameObjects.Container;
  protected hints: string[] = [];
  protected hintsUsed = 0;

  private data_: PuzzleData = {};
  private roundIndex = 0;
  private rounds = 3;
  private roundLabel!: Phaser.GameObjects.Text;
  private owlText!: Phaser.GameObjects.Text;
  private owlBubble!: Phaser.GameObjects.Graphics;
  private busy = false;

  init(data: PuzzleData): void {
    this.data_ = data;
    this.rounds = data.rounds ?? 3;
    this.roundIndex = 0;
  }

  create(): void {
    // Abgedunkelter Hintergrund, fängt alle Klicks auf die Welt dahinter ab
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080b, 0.82)
      .setOrigin(0)
      .setInteractive();
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(20, 16, GAME_WIDTH - 40, GAME_HEIGHT - 32, 14);
    g.lineStyle(3, COLORS.gold, 1).strokeRoundedRect(20, 16, GAME_WIDTH - 40, GAME_HEIGHT - 32, 14);

    text(this, GAME_WIDTH / 2, 44, this.title, 26, COLORS.goldText);
    this.roundLabel = text(this, GAME_WIDTH - 110, 44, '', 18, COLORS.muted);
    button(this, 70, 44, 'X', () => this.close(false), { width: 48, height: 44, size: 22 });

    // Hinweis-Eule unten links
    button(this, 104, GAME_HEIGHT - 56, 'Hinweis', () => this.nextHint(), { width: 140, height: 48, size: 20 });
    this.owlBubble = this.add.graphics();
    this.owlText = smooth(this.add
      .text(190, GAME_HEIGHT - 72, '', {
        fontFamily: FONT,
        fontSize: '19px',
        color: COLORS.text,
        wordWrap: { width: 560 },
        resolution: 2,
      })
      .setDepth(5));

    this.round = this.add.container(0, 0);
    this.startRound();
  }

  private startRound(): void {
    this.round.removeAll(true);
    this.hints = [];
    this.hintsUsed = 0;
    this.busy = false;
    this.showOwl('');
    this.roundLabel.setText(`Aufgabe ${this.roundIndex + 1} von ${this.rounds}`);
    this.buildRound();
  }

  protected abstract buildRound(): void;

  private nextHint(): void {
    if (this.hints.length === 0) return;
    const i = Math.min(this.hintsUsed, this.hints.length - 1);
    this.hintsUsed = Math.max(this.hintsUsed, i + 1);
    this.showOwl(this.hints[i]);
    this.onHint(i);
  }

  /** Unterklassen können bei einer Hinweisstufe zusätzlich etwas einblenden. */
  protected onHint(_level: number): void {}

  protected showOwl(message: string): void {
    this.owlText.setText(message);
    this.owlBubble.clear();
    if (!message) return;
    const b = this.owlText.getBounds();
    this.owlBubble
      .fillStyle(0x0b1117, 0.95)
      .fillRoundedRect(b.x - 10, b.y - 8, b.width + 20, b.height + 16, 8)
      .lineStyle(2, COLORS.panelEdge, 1)
      .strokeRoundedRect(b.x - 10, b.y - 8, b.width + 20, b.height + 16, 8);
  }

  /** Richtige Lösung: eintragen, kurz feiern, nächste Runde. */
  protected solved(message = 'Richtig!'): void {
    if (this.busy) return;
    this.busy = true;
    recordAttempt(this.skills, true, this.hintsUsed);
    this.showOwl(message);
    this.cameras.main.flash(250, 217, 178, 95);
    this.time.delayedCall(1400, () => {
      this.roundIndex += 1;
      if (this.roundIndex >= this.rounds) this.close(true);
      else this.startRound();
    });
  }

  /** Falsche Lösung: eintragen, erklären, weiterprobieren lassen. */
  protected wrong(message: string): void {
    recordAttempt(this.skills, false, this.hintsUsed);
    this.showOwl(message);
    this.cameras.main.shake(180, 0.004);
  }

  private close(solved: boolean): void {
    const onDone = this.data_.onDone;
    this.scene.stop();
    onDone?.(solved);
  }
}
