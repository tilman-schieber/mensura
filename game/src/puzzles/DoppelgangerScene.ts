import Phaser from 'phaser';
import { buildAvatarTexture } from '../avatar/avatar';
import { randInt } from '../learn/numbers';
import { recordAttempt } from '../learn/progress';
import { loadSave } from '../save';
import { music } from '../audio/music';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, button, text } from '../ui/theme';

// Endgegner des Spiegeltempels: der Spiegel-Doppelgänger (Spiegelungen, R13).
// Ein dunkles Spiegelbild der eigenen Figur. In jeder Runde steht die Figur auf einem
// Feld; man tippt das Feld an, auf dem das Spiegelbild erscheinen wird. Richtig: Licht
// trifft den Doppelgänger. Falsch: Er erscheint woanders und trifft dich.
// Phasen: senkrechte Achse, waagerechte Achse, Punktspiegelung am Zentrum.
// Jede Runde hat eine Zeit (wie bei den anderen Endgegnern): Läuft sie ab, erholt sich der
// Doppelgänger um einen Treffer. Abschaltbar mit „Zeitdruck im Kampf“.

type Phase = 'senkrecht' | 'waagerecht' | 'punkt';
const PHASES: Phase[] = ['senkrecht', 'waagerecht', 'punkt'];
const HITS = 3;
const HEARTS = 3;
const COLS = 9;
const ROWS = 7;
const CELL = 50;
const KEY = 'avatar-boss';
const SECONDS = 15;

export class DoppelgangerScene extends Phaser.Scene {
  private onDone?: (won: boolean) => void;
  private phase = 0;
  private hits = 0;
  private hearts = HEARTS;
  private busy = false;
  private ox = 0;
  private oy = 0;
  private me!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Sprite;
  private pos: [number, number] = [0, 0];
  private axisLayer!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  private prompt!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private heartIcons: Phaser.GameObjects.Text[] = [];
  private hpBar!: Phaser.GameObjects.Graphics;
  private timeBar!: Phaser.GameObjects.Graphics;
  private timeLeft: number | null = null;
  private timed = true;

  constructor() {
    super('DoppelgangerScene');
  }

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

  create(): void {
    const before = music.playing;
    void music.play('boss');
    this.events.once('shutdown', () => before && void music.play(before));
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a2440, 0x2a2440, 0x0c0b14, 0x0c0b14, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0, 0).setOrigin(0).setInteractive();

    text(this, GAME_WIDTH / 2, 22, 'Der Spiegel-Doppelgänger', 24, COLORS.goldText);
    for (let i = 0; i < HEARTS; i++) this.heartIcons.push(text(this, 40 + i * 34, 30, '♥', 30, '#e0564a'));
    this.hpBar = this.add.graphics();
    this.timeBar = this.add.graphics();
    this.prompt = text(this, GAME_WIDTH / 2, 76, '', 21, COLORS.text);
    this.feedback = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 22, '', 18, COLORS.goldText);
    button(this, GAME_WIDTH - 60, 30, 'Hinweis', () => this.feedback.setText(this.hint()), { width: 110, height: 44, size: 18 });

    // Spielfeld aus Marmorplatten
    this.ox = GAME_WIDTH / 2 - (COLS * CELL) / 2;
    this.oy = 110;
    const g = this.add.graphics();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        g.fillStyle((x + y) % 2 ? 0x3a3552 : 0x443e5f, 1).fillRect(this.ox + x * CELL, this.oy + y * CELL, CELL - 2, CELL - 2);
      }
    }
    const zone = this.add.zone(this.ox, this.oy, COLS * CELL, ROWS * CELL).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const x = Math.floor((p.x - this.ox) / CELL);
      const y = Math.floor((p.y - this.oy) / CELL);
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) this.guess(x, y);
    });
    this.axisLayer = this.add.graphics().setDepth(2);
    this.marks = this.add.graphics().setDepth(3);

    const look = loadSave().avatar;
    if (look) buildAvatarTexture(this, look, KEY);
    const tex = look ? KEY : 'mine-cart';
    this.me = this.add.sprite(0, 0, tex, look ? 'south-0' : undefined).setScale(1.05).setOrigin(0.5, 0.62).setDepth(5);
    this.shadow = this.add.sprite(0, 0, tex, look ? 'south-0' : undefined).setScale(1.05).setOrigin(0.5, 0.62).setDepth(5).setTint(0x6a4aa8).setAlpha(0);

    this.drawHp();
    this.time.delayedCall(400, () => this.nextRound());
  }

  private center(x: number, y: number): [number, number] {
    return [this.ox + x * CELL + CELL / 2 - 1, this.oy + y * CELL + CELL / 2 - 1];
  }

  private mirror(x: number, y: number): [number, number] {
    const p = PHASES[this.phase];
    if (p === 'senkrecht') return [COLS - 1 - x, y];
    if (p === 'waagerecht') return [x, ROWS - 1 - y];
    return [COLS - 1 - x, ROWS - 1 - y];
  }

  private hint(): string {
    const p = PHASES[this.phase];
    if (p === 'punkt') return 'Punktspiegelung: Geh vom Punkt durch das Zentrum hindurch und genauso weit auf der anderen Seite weiter.';
    return 'Zähle die Felder von dir bis zur Achse. Das Spiegelbild steht genauso weit auf der anderen Seite.';
  }

  private drawHp(): void {
    const total = PHASES.length * HITS;
    const done = this.phase * HITS + this.hits;
    const w = 300;
    const x = GAME_WIDTH / 2 - w / 2;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x0b1117, 1).fillRoundedRect(x, 44, w, 10, 5);
    this.hpBar.fillStyle(0x9a7ad8, 1).fillRoundedRect(x + 2, 46, (w - 4) * (1 - done / total), 6, 3);
  }

  private drawAxis(): void {
    const g = this.axisLayer;
    g.clear();
    const p = PHASES[this.phase];
    const [cx, cy] = this.center((COLS - 1) / 2, (ROWS - 1) / 2);
    g.lineStyle(4, 0xf0d78a, 1);
    if (p === 'senkrecht') g.lineBetween(cx, this.oy - 8, cx, this.oy + ROWS * CELL + 6);
    else if (p === 'waagerecht') g.lineBetween(this.ox - 8, cy, this.ox + COLS * CELL + 6, cy);
    else g.fillStyle(0xf0d78a, 1).fillCircle(cx, cy, 8);
  }

  private nextRound(): void {
    this.busy = false;
    this.marks.clear();
    this.shadow.setAlpha(0);
    this.drawAxis();
    const p = PHASES[this.phase];
    this.prompt.setText(
      p === 'punkt'
        ? 'Er spiegelt sich jetzt am Punkt in der Mitte! Wo erscheint er?'
        : `Er spiegelt sich an der ${p === 'senkrecht' ? 'senkrechten' : 'waagerechten'} Achse. Tippe das Feld, auf dem er erscheint!`,
    );
    // Figur auf ein Feld, das nicht auf der Achse / im Zentrum liegt. Außerdem nicht direkt
    // neben der Achse (Spiegelbild wäre einfach das Nachbarfeld) und bei der Punktspiegelung
    // nicht auf der Mittelzeile/-spalte (dann wäre es nur eine gewöhnliche Achsenspiegelung).
    // Auch nicht zweimal hintereinander dasselbe Feld.
    const [prevX, prevY] = this.pos;
    const cx = (COLS - 1) / 2;
    const cy = (ROWS - 1) / 2;
    let x: number;
    let y: number;
    do {
      x = randInt(0, COLS - 1);
      y = randInt(0, ROWS - 1);
    } while (
      (x === prevX && y === prevY) ||
      (p === 'senkrecht' && Math.abs(x - cx) <= 1) ||
      (p === 'waagerecht' && Math.abs(y - cy) <= 1) ||
      (p === 'punkt' && (x === cx || y === cy))
    );
    this.pos = [x, y];
    const [px, py] = this.center(x, y);
    this.me.setPosition(px, py);
    this.timeLeft = this.timed ? SECONDS * 1000 : null;
  }

  update(_t: number, delta: number): void {
    const g = this.timeBar;
    g.clear();
    if (this.timeLeft === null) return;
    if (!this.busy) this.timeLeft -= delta;
    const f = Math.max(0, this.timeLeft / (SECONDS * 1000));
    const w = 300;
    const x = GAME_WIDTH / 2 - w / 2;
    g.fillStyle(0x0b1117, 1).fillRoundedRect(x, 58, w, 8, 4);
    g.fillStyle(f > 0.5 ? 0x7ac070 : f > 0.2 ? 0xe0b040 : 0xe0564a, 1).fillRoundedRect(x + 2, 59, (w - 4) * f, 6, 3);
    if (this.timeLeft <= 0 && !this.busy) this.timeUp();
  }

  /** Zeit abgelaufen: Der Doppelgänger erholt sich um einen Treffer, neue Runde. */
  private timeUp(): void {
    this.timeLeft = null;
    this.busy = true;
    const healed = this.hits > 0;
    if (healed) this.hits -= 1;
    this.drawHp();
    this.cameras.main.flash(300, 150, 120, 220);
    this.feedback.setText(healed ? 'Zu langsam! Der Doppelgänger sammelt neuen Nebel.' : 'Die Zeit ist um. Er taucht woanders auf …');
    this.time.delayedCall(1500, () => this.nextRound());
  }

  private guess(x: number, y: number): void {
    if (this.busy) return;
    this.busy = true;
    this.timeLeft = null;
    const [tx, ty] = this.mirror(...this.pos);
    const [sx, sy] = this.center(tx, ty);
    this.shadow.setPosition(sx, sy).setAlpha(0);
    this.tweens.add({ targets: this.shadow, alpha: 0.9, duration: 300 });
    const [gx, gy] = this.center(x, y);

    if (x === tx && y === ty) {
      recordAttempt(['R13'], true);
      this.marks.fillStyle(0xfff1b0, 0.8).fillCircle(gx, gy, 22);
      this.cameras.main.flash(200, 255, 245, 200);
      this.tweens.add({ targets: this.shadow, angle: { from: -10, to: 10 }, duration: 80, yoyo: true, repeat: 3, onComplete: () => this.shadow.setAngle(0) });
      this.feedback.setText('Getroffen! Du hast sein Spiegelbild vorausgesehen.');
      this.hits += 1;
      this.drawHp();
      this.time.delayedCall(1200, () => this.afterHit());
    } else {
      recordAttempt(['R13'], false);
      this.marks.lineStyle(3, 0xc0504a, 1).strokeCircle(gx, gy, 20);
      this.hearts -= 1;
      this.heartIcons.forEach((h, i) => h.setAlpha(i < this.hearts ? 1 : 0.2));
      this.cameras.main.shake(250, 0.01);
      this.feedback.setText('Daneben! Er erschien auf dem goldenen Feld. Siehst du, warum?');
      this.marks.lineStyle(3, 0xf0d78a, 1).strokeRect(sx - CELL / 2 + 2, sy - CELL / 2 + 2, CELL - 4, CELL - 4);
      this.time.delayedCall(1800, () => {
        if (this.hearts <= 0) {
          this.feedback.setText('Der Doppelgänger lacht. Sammle dich und versuch es noch einmal!');
          this.hearts = HEARTS;
          this.hits = 0;
          this.heartIcons.forEach((h) => h.setAlpha(1));
          this.drawHp();
        }
        this.nextRound();
      });
    }
  }

  private afterHit(): void {
    if (this.hits < HITS) {
      this.nextRound();
      return;
    }
    this.hits = 0;
    this.phase += 1;
    if (this.phase >= PHASES.length) {
      this.prompt.setText('Der Doppelgänger zerspringt wie Glas!');
      this.feedback.setText('');
      this.axisLayer.clear();
      this.marks.clear();
      this.tweens.add({ targets: this.shadow, alpha: 0, scale: 1.4, duration: 1200 });
      for (let i = 0; i < 24; i++) {
        const shard = this.add.rectangle(this.shadow.x, this.shadow.y, randInt(4, 10), randInt(8, 16), 0xc9b8ff, 0.9).setAngle(randInt(0, 180));
        this.tweens.add({ targets: shard, x: shard.x + randInt(-160, 160), y: shard.y + randInt(-120, 160), angle: randInt(-360, 360), alpha: 0, duration: 1300 });
      }
      this.time.delayedCall(2200, () => this.finish(true));
      return;
    }
    this.prompt.setText(this.phase === 1 ? 'Er dreht die Welt! Jetzt spiegelt er sich oben und unten …' : 'Er wird schneller! Jetzt der Punkt in der Mitte …');
    this.feedback.setText('');
    this.time.delayedCall(1800, () => this.nextRound());
  }

  private finish(won: boolean): void {
    const cb = this.onDone;
    this.scene.stop();
    cb?.(won);
  }
}
