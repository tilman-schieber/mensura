import { music } from '../audio/music';
import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { recordAttempt } from '../learn/progress';
import { loadSave } from '../save';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, button, text } from '../ui/theme';

// Gemeinsames Gerüst für Endgegner mit Phasen (Erzkoloss, Riesenkäfer …):
// Herzen, Lebensbalken, Zeitbalken, Hinweis, Treffer-Effekt, Phasenwechsel, Sieg.
// Fehler kosten ein Herz; ohne Herzen beginnt nur die Phase neu.
// Jede Aufgabe hat eine Zeit. Läuft sie ab, regeneriert sich der Gegner um einen Treffer und
// es kommt eine neue Aufgabe: Man braucht dann mehr Aufgaben, verliert aber nicht.
// Der Zeitbalken lässt sich mit „Zeitdruck im Kampf“ in den Einstellungen abschalten.
//
// Unterklassen setzen die Konfiguration und bauen in `ask(phase)` eine Frage in
// `this.area` auf. Antworten melden sie mit `right()` oder `wrong()`.

export interface BossConfig {
  title: string;
  imageKey: string;
  imagePath: string;
  imageScale: number;
  /** Farben des Hintergrund-Verlaufs (oben, unten) */
  background: [number, number];
  phases: number;
  hitsPerPhase: number;
  /** Übergangstexte nach Phase 1, 2, … */
  phaseBreaks: string[];
  winText: string;
  regroupText: string;
  /** Farbe der Splitter beim Treffer */
  chipColor: number;
  /** Sekunden pro Aufgabe (Standard 30) */
  seconds?: number;
  /** Meldung, wenn die Zeit abläuft und der Gegner sich erholt */
  regenText?: string;
}

const HEARTS = 3;

export abstract class BossScene extends Phaser.Scene {
  protected abstract config: BossConfig;
  protected area!: Phaser.GameObjects.Container;
  protected prompt!: Phaser.GameObjects.Text;
  protected feedback!: Phaser.GameObjects.Text;
  protected hint = '';
  protected boss!: Phaser.GameObjects.Image;
  protected phase = 0;

  private onDone?: (won: boolean) => void;
  private hits = 0;
  private hearts = HEARTS;
  private busy = false;
  private heartIcons: Phaser.GameObjects.Text[] = [];
  private hpBar!: Phaser.GameObjects.Graphics;
  private timeBar!: Phaser.GameObjects.Graphics;
  /** verbleibende Zeit der Aufgabe in ms; null = Uhr steht */
  private timeLeft: number | null = null;
  private timed = true;

  /** Frage für die aktuelle Phase aufbauen */
  protected abstract ask(phase: number): void;

  init(data: { onDone?: (won: boolean) => void }): void {
    this.onDone = data.onDone;
    this.phase = 0;
    this.hits = 0;
    this.hearts = HEARTS;
    this.busy = false;
    this.heartIcons = [];
    this.timeLeft = null;
    this.timed = loadSave().settings.battleTimer;
  }

  preload(): void {
    this.load.image(this.config.imageKey, this.config.imagePath);
  }

  create(): void {
    // Kampfmusik, danach wieder die Musik des Orts
    const before = music.playing;
    void music.play('boss');
    this.events.once('shutdown', () => before && void music.play(before));
    const c = this.config;
    const bg = this.add.graphics();
    bg.fillGradientStyle(c.background[0], c.background[0], c.background[1], c.background[1], 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0, 0).setOrigin(0).setInteractive();

    this.boss = this.add.image(GAME_WIDTH / 2, 205, c.imageKey).setScale(c.imageScale);
    this.tweens.add({ targets: this.boss, y: 199, duration: 1400, yoyo: true, repeat: -1, ease: 'sine.inout' });

    text(this, GAME_WIDTH / 2, 22, c.title, 24, COLORS.goldText);
    this.hpBar = this.add.graphics();
    this.timeBar = this.add.graphics();
    for (let i = 0; i < HEARTS; i++) this.heartIcons.push(text(this, 40 + i * 34, 30, '♥', 30, '#e0564a'));
    button(this, GAME_WIDTH - 60, 30, 'Hinweis', () => this.feedback.setText(this.hint), { width: 110, height: 44, size: 18 });

    this.prompt = text(this, GAME_WIDTH / 2, 330, '', 24, COLORS.text);
    this.feedback = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 22, '', 19, COLORS.goldText);
    this.area = this.add.container(0, 0);

    this.drawHp();
    this.time.delayedCall(400, () => this.nextQuestion());
  }

  private drawHp(): void {
    const total = this.config.phases * this.config.hitsPerPhase;
    const done = this.phase * this.config.hitsPerPhase + this.hits;
    const w = 300;
    const x = GAME_WIDTH / 2 - w / 2;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x0b1117, 1).fillRoundedRect(x, 44, w, 12, 5);
    this.hpBar.fillStyle(0xc9803a, 1).fillRoundedRect(x + 2, 46, (w - 4) * (1 - done / total), 8, 4);
  }

  private nextQuestion(): void {
    this.area.removeAll(true);
    this.busy = false;
    this.feedback.setText('');
    this.ask(this.phase);
    this.timeLeft = this.timed ? (this.config.seconds ?? 30) * 1000 : null;
  }

  update(_t: number, delta: number): void {
    if (this.timeLeft === null || this.busy) {
      this.drawTime();
      return;
    }
    this.timeLeft -= delta;
    this.drawTime();
    if (this.timeLeft <= 0) this.timeUp();
  }

  private drawTime(): void {
    const g = this.timeBar;
    g.clear();
    if (this.timeLeft === null) return;
    const total = (this.config.seconds ?? 30) * 1000;
    const f = Math.max(0, this.timeLeft / total);
    const w = 300;
    const x = GAME_WIDTH / 2 - w / 2;
    g.fillStyle(0x0b1117, 1).fillRoundedRect(x, 62, w, 8, 4);
    g.fillStyle(f > 0.5 ? 0x7ac070 : f > 0.2 ? 0xe0b040 : 0xe0564a, 1).fillRoundedRect(x + 2, 63, (w - 4) * f, 6, 3);
  }

  /** Zeit abgelaufen: Der Gegner erholt sich um einen Treffer, dann kommt eine neue Aufgabe. */
  private timeUp(): void {
    this.timeLeft = null;
    this.busy = true;
    const healed = this.hits > 0;
    if (healed) this.hits -= 1;
    this.drawHp();
    this.cameras.main.flash(300, 120, 200, 140);
    this.tweens.add({ targets: this.boss, scale: this.config.imageScale * 1.12, duration: 250, yoyo: true });
    this.feedback.setText(
      healed
        ? (this.config.regenText ?? 'Zu langsam! Der Gegner erholt sich ein Stück.')
        : 'Die Zeit ist um. Hier kommt eine neue Aufgabe.',
    );
    this.time.delayedCall(1600, () => this.nextQuestion());
  }

  protected right(skills: SkillId[], message: string): void {
    if (this.busy) return;
    this.busy = true;
    this.timeLeft = null;
    recordAttempt(skills, true);
    this.feedback.setText(message);
    this.strike();
    this.hits += 1;
    this.drawHp();
    this.time.delayedCall(1100, () => {
      if (this.hits >= this.config.hitsPerPhase) {
        this.hits = 0;
        this.phase += 1;
        if (this.phase >= this.config.phases) this.win();
        else this.phaseBreak();
        return;
      }
      this.nextQuestion();
    });
  }

  protected wrong(skills: SkillId[], message: string): void {
    if (this.busy) return;
    recordAttempt(skills, false);
    this.hearts -= 1;
    this.heartIcons.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.2));
    this.cameras.main.shake(300, 0.012);
    this.tweens.add({ targets: this.boss, scale: this.config.imageScale * 1.08, duration: 120, yoyo: true });
    this.feedback.setText(message);
    if (this.hearts <= 0) {
      this.busy = true;
      this.timeLeft = null;
      this.time.delayedCall(1600, () => {
        this.feedback.setText(this.config.regroupText);
        this.hearts = HEARTS;
        this.hits = 0;
        this.heartIcons.forEach((h) => h.setAlpha(1));
        this.drawHp();
        this.time.delayedCall(1800, () => this.nextQuestion());
      });
    }
  }

  /** Treffer: Aufblitzen, Splitter fliegen. */
  private strike(): void {
    this.cameras.main.flash(160, 255, 230, 160);
    this.cameras.main.shake(160, 0.006);
    const kx = this.boss.x + randInt(-50, 50);
    const ky = this.boss.y + randInt(-40, 40);
    for (let i = 0; i < 6; i++) {
      const chip = this.add.rectangle(kx, ky, 9, 9, this.config.chipColor).setStrokeStyle(1, 0x2a1a08);
      this.tweens.add({
        targets: chip,
        x: kx + randInt(-140, 140),
        y: ky + randInt(40, 160),
        angle: randInt(-180, 180),
        alpha: 0,
        duration: 800,
        ease: 'quad.out',
        onComplete: () => chip.destroy(),
      });
    }
  }

  private phaseBreak(): void {
    this.area.removeAll(true);
    this.prompt.setText(this.config.phaseBreaks[this.phase - 1] ?? '');
    this.feedback.setText('');
    this.tweens.add({ targets: this.boss, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 5, onComplete: () => this.boss.setAngle(0) });
    this.time.delayedCall(2200, () => this.nextQuestion());
  }

  private win(): void {
    this.area.removeAll(true);
    this.prompt.setText(this.config.winText);
    this.feedback.setText('');
    this.tweens.killTweensOf(this.boss);
    this.tweens.add({ targets: this.boss, alpha: 0, scale: this.config.imageScale * 1.2, y: this.boss.y + 30, duration: 1800, ease: 'quad.in' });
    for (let i = 0; i < 40; i++) {
      const p = this.add.circle(this.boss.x + randInt(-90, 90), this.boss.y + randInt(-90, 90), randInt(4, 12), 0x9aa3ad, 0.7);
      this.tweens.add({ targets: p, y: p.y - randInt(40, 140), alpha: 0, duration: randInt(900, 2000), delay: randInt(0, 800) });
    }
    this.time.delayedCall(2800, () => {
      const cb = this.onDone;
      this.scene.stop();
      cb?.(true);
    });
  }
}
