import { music } from '../audio/music';
import Phaser from 'phaser';
import { mentalTask, type MathTask } from '../learn/mentalMath';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel, recordAttempt } from '../learn/progress';
import { loadSave } from '../save';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, button, text } from '../ui/theme';

// Kampf gegen Nebelwesen (Kopfrechnen, Z11).
// Mehrere Wesen schweben heran, jedes trägt eine Aufgabe. Man tippt die richtige
// von vier Antworten; das Wesen zerfällt in Licht. Mit Zeitdruck (abschaltbar im
// Menü) läuft pro Aufgabe ein Balken ab, großzügig bemessen und mit dem Können
// kürzer werdend. Ohne Herzen weichen die Wesen nur zurück, keine Strafe.

export interface FogBattleData {
  /** Anzahl der Nebelwesen (kommt über `rounds` von WorldScene.startPuzzle) */
  rounds?: number;
  onDone?: (won: boolean) => void;
}

const HEARTS = 3;

export class FogBattleScene extends Phaser.Scene {
  private onDone?: (won: boolean) => void;
  private remaining = 0;
  private hearts = HEARTS;
  private task!: MathTask;
  private wisps: Phaser.GameObjects.Container[] = [];
  private current?: Phaser.GameObjects.Container;
  private options: Phaser.GameObjects.Container[] = [];
  private heartIcons: Phaser.GameObjects.Text[] = [];
  private feedback!: Phaser.GameObjects.Text;
  private question!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Graphics;
  private timer?: Phaser.Time.TimerEvent;
  private timeLimit = 0;
  private busy = false;
  private asked = new Set<string>();

  constructor() {
    super('FogBattleScene');
  }

  init(data: FogBattleData): void {
    this.onDone = data.onDone;
    this.remaining = Math.min(data.rounds ?? 3, 4);
    this.hearts = HEARTS;
    this.wisps = [];
    this.options = [];
    this.heartIcons = [];
    this.busy = false;
    this.asked = new Set();
  }

  preload(): void {
    this.load.image('nebelwesen', 'assets/objects/nebelwesen.png');
  }

  create(): void {
    // Im Kampf gegen Nebelwesen wird die Musik schief, danach wieder wie vorher
    const fogBefore = music.fogLevel;
    music.setFog(1, 0.6);
    this.events.once('shutdown', () => music.setFog(fogBefore, 1));
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x4a5a6b, 0x4a5a6b, 0x1a222b, 0x1a222b, 0.96).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0, 0).setOrigin(0).setInteractive();
    // Nebelschwaden im Hintergrund
    for (let i = 0; i < 14; i++) {
      const c = this.add.ellipse(randInt(0, GAME_WIDTH), randInt(60, 300), randInt(120, 260), randInt(30, 60), 0xc9d4de, 0.08);
      this.tweens.add({ targets: c, x: c.x + randInt(-80, 80), duration: randInt(3000, 6000), yoyo: true, repeat: -1, ease: 'sine.inout' });
    }

    text(this, GAME_WIDTH / 2, 24, 'Nebelwesen!', 24, COLORS.goldText);
    for (let i = 0; i < HEARTS; i++) this.heartIcons.push(text(this, 40 + i * 34, 30, '♥', 30, '#e0564a'));
    this.timerBar = this.add.graphics();
    this.feedback = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 24, '', 19, COLORS.goldText);
    this.question = text(this, GAME_WIDTH / 2, 292, '', 42, '#fff4c8').setStroke('#1a1f26', 8);

    // Die Wesen reihen sich auf
    for (let i = 0; i < this.remaining; i++) {
      const x = GAME_WIDTH / 2 + (i - (this.remaining - 1) / 2) * 170;
      const glow = this.add.circle(0, 0, 58, 0xc9d8e8, 0.22);
      const img = this.add.image(0, 0, 'nebelwesen').setScale(2.4);
      const w = this.add.container(x, 150, [glow, img]).setAlpha(0);
      this.tweens.add({ targets: w, alpha: 1, duration: 600, delay: i * 200 });
      this.tweens.add({ targets: w, y: 140, duration: randInt(1300, 1800), yoyo: true, repeat: -1, ease: 'sine.inout' });
      this.wisps.push(w);
    }
    this.time.delayedCall(700, () => this.nextTask());
  }

  private nextTask(): void {
    this.busy = false;
    this.options.forEach((o) => o.destroy());
    this.options = [];
    this.current = this.wisps.find((w) => w.active);
    if (!this.current) return;
    // Keine Aufgabe zweimal im selben Kampf (auch nicht als Tauschaufgabe 3 · 7 / 7 · 3)
    const norm = (q: string) => q.replace(/^(\d+) ([+·]) (\d+)$/, (_m, a: string, op: string, b: string) => [a, b].sort().join(` ${op} `));
    let tries = 0;
    do this.task = mentalTask(getLevel('Z11'));
    while (this.asked.has(norm(this.task.question)) && ++tries < 30);
    this.asked.add(norm(this.task.question));
    this.question.setText(this.task.question);
    // Das Wesen, das gerade dran ist, leuchtet golden
    (this.current.list[0] as Phaser.GameObjects.Arc).setFillStyle(0xf0d78a, 0.45);
    this.tweens.add({ targets: this.current, scale: 1.12, duration: 250, yoyo: true });

    this.task.options.forEach((o, i) => {
      const x = GAME_WIDTH / 2 + (i - 1.5) * 200;
      const b = button(this, x, 400, formatNumber(o), () => this.answer(o), { width: 176, height: 72, size: 30 });
      this.options.push(b);
    });
    this.startTimer();
  }

  private startTimer(): void {
    this.timer?.remove();
    this.timerBar.clear();
    if (!loadSave().settings.battleTimer) return;
    // 14 s am Anfang, bis 7 s bei sicherem Können
    this.timeLimit = 14000 - getLevel('Z11') * 7000;
    const start = this.time.now;
    this.timer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        const left = 1 - (this.time.now - start) / this.timeLimit;
        this.drawTimer(Math.max(0, left));
        if (left <= 0) {
          this.timer?.remove();
          this.hurt(`Zu langsam! ${this.task.explain}.`);
          this.time.delayedCall(1300, () => this.busy || this.startTimer());
        }
      },
    });
  }

  private drawTimer(fraction: number): void {
    const w = 400;
    const x = GAME_WIDTH / 2 - w / 2;
    this.timerBar.clear();
    this.timerBar.fillStyle(0x0b1117, 1).fillRoundedRect(x, 452, w, 10, 5);
    this.timerBar.fillStyle(fraction > 0.3 ? 0x7fd4ff : 0xe0564a, 1).fillRoundedRect(x + 2, 454, (w - 4) * fraction, 6, 3);
  }

  private answer(value: number): void {
    if (this.busy || !this.current) return;
    if (value === this.task.answer) {
      this.busy = true;
      this.timer?.remove();
      this.timerBar.clear();
      recordAttempt(['Z11'], true);
      this.feedback.setText(`${this.task.question.replace('Überschlag: ', '')} → ${formatNumber(value)}. Richtig!`);
      this.dissolve(this.current);
      this.remaining -= 1;
      this.time.delayedCall(900, () => {
        this.question.setText('');
        if (this.remaining <= 0) this.finish(true);
        else this.nextTask();
      });
    } else {
      recordAttempt(['Z11'], false);
      this.hurt(`${formatNumber(value)} stimmt nicht. ${this.task.explain}.`);
    }
  }

  /** Richtige Antwort: Das Wesen zerfällt in Licht. */
  private dissolve(w: Phaser.GameObjects.Container): void {
    this.tweens.killTweensOf(w);
    for (let i = 0; i < 16; i++) {
      const p = this.add.circle(w.x + randInt(-30, 30), w.y + randInt(-30, 30), randInt(3, 7), 0xfff1b0, 0.9);
      this.tweens.add({ targets: p, y: p.y - randInt(40, 120), x: p.x + randInt(-40, 40), alpha: 0, duration: randInt(600, 1100), onComplete: () => p.destroy() });
    }
    this.tweens.add({ targets: w, alpha: 0, scale: 1.6, duration: 600, onComplete: () => w.destroy() });
  }

  /** Falsche Antwort oder Zeit abgelaufen: Herz weg, das Wesen bläht sich auf. */
  private hurt(message: string): void {
    this.hearts -= 1;
    this.heartIcons.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.2));
    this.feedback.setText(message);
    this.cameras.main.shake(200, 0.008);
    if (this.current) this.tweens.add({ targets: this.current, scale: 1.3, duration: 150, yoyo: true });
    if (this.hearts <= 0) {
      this.busy = true;
      this.timer?.remove();
      this.feedback.setText('Der Nebel wird zu dicht. Du weichst zurück … Versuch es gleich noch einmal!');
      this.time.delayedCall(2200, () => this.finish(false));
    }
  }

  private finish(won: boolean): void {
    this.timer?.remove();
    const cb = this.onDone;
    this.scene.stop();
    cb?.(won);
  }
}
