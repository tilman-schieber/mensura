import Phaser from 'phaser';
import { SLOTS, activeSlot, loadSave, newGame, readSlot } from '../save';
import { URMASSE } from '../story';
import { FONT, FONT_CARVED, GAME_HEIGHT, GAME_WIDTH, button, smooth, text } from '../ui/theme';
import { enterGame } from './flow';
import { music } from '../audio/music';

/**
 * Titelbild: gemalte Landschaft mit Eichstadt, der zerbrochenen Brücke und Vagors Zitadelle,
 * ziehender Nebel, Glühwürmchen, Sternschnuppen. Der Titel fällt Buchstabe für Buchstabe herein
 * und schimmert; die sieben Splitter kreisen um ihn, geborgene leuchten.
 */
export class TitleScene extends Phaser.Scene {
  private shards: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Arc; angle: number }[] = [];
  private letters: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('Title');
  }

  preload(): void {
    this.load.image('title-bg', 'assets/title/background.png');
  }

  create(): void {
    this.cameras.main.fadeIn(900);
    void music.play('title');
    music.setFog(0);
    const current = activeSlot() ? loadSave() : null;

    this.backdrop();
    this.fireflies();
    this.time.addEvent({ delay: 4200, loop: true, callback: () => Math.random() < 0.7 && this.shootingStar() });
    this.shardRing(current);
    this.title();
    this.menu(current);

    // Vignette: Ränder dunkler, der Blick geht zur Mitte
    this.cameras.main.filters.internal.addVignette(0.5, 0.5, 0.95, 0.3);
  }

  // ---------- Hintergrund ----------

  private backdrop(): void {
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'title-bg').setDepth(-20);
    const cover = Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height);
    bg.setScale(cover);
    // ganz langsames Heranfahren, wie eine Kamerafahrt
    this.tweens.add({ targets: bg, scale: cover * 1.06, duration: 40_000, yoyo: true, repeat: -1, ease: 'sine.inout' });

    // Nebelbänke unten, in zwei Schichten mit verschiedenem Tempo
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 7; i++) {
        const y = GAME_HEIGHT * (0.62 + Math.random() * 0.4);
        const e = this.add
          .ellipse(Math.random() * GAME_WIDTH, y, 300 + Math.random() * 300, 60 + Math.random() * 50, 0xd8e0ea, 0.07 + layer * 0.04)
          .setDepth(-10 + layer * 12);
        this.tweens.add({ targets: e, x: e.x + (layer ? 160 : -120), duration: 14_000 + Math.random() * 8000, yoyo: true, repeat: -1, ease: 'sine.inout' });
      }
    }
    // dunkler Verlauf unten, damit die Knöpfe gut lesbar sind
    this.add
      .graphics()
      .fillGradientStyle(0x05080b, 0x05080b, 0x05080b, 0x05080b, 0, 0, 0.45, 0.45)
      .fillRect(0, GAME_HEIGHT * 0.6, GAME_WIDTH, GAME_HEIGHT * 0.4)
      .setDepth(-5);
  }

  private fireflies(): void {
    for (let i = 0; i < 26; i++) {
      const f = this.add.circle(Math.random() * GAME_WIDTH, GAME_HEIGHT * (0.45 + Math.random() * 0.5), Math.random() < 0.3 ? 2.5 : 1.6, 0xfff0a0, 0.9);
      f.setBlendMode(Phaser.BlendModes.ADD).setDepth(-4);
      const wander = () => {
        this.tweens.add({
          targets: f,
          x: Phaser.Math.Clamp(f.x + Phaser.Math.Between(-80, 80), 0, GAME_WIDTH),
          y: Phaser.Math.Clamp(f.y + Phaser.Math.Between(-50, 50), GAME_HEIGHT * 0.4, GAME_HEIGHT),
          duration: Phaser.Math.Between(2500, 5000),
          ease: 'sine.inout',
          onComplete: wander,
        });
      };
      wander();
      this.tweens.add({ targets: f, alpha: 0.1, duration: Phaser.Math.Between(600, 1600), yoyo: true, repeat: -1, delay: Math.random() * 1500 });
    }
  }

  private shootingStar(): void {
    const x = Phaser.Math.Between(80, GAME_WIDTH - 300);
    const y = Phaser.Math.Between(20, 120);
    const star = this.add.rectangle(x, y, 60, 2, 0xffffff, 0.9).setAngle(22).setBlendMode(Phaser.BlendModes.ADD).setDepth(-6);
    this.tweens.add({ targets: star, x: x + 260, y: y + 105, scaleX: 0.2, alpha: 0, duration: 900, ease: 'quad.in', onComplete: () => star.destroy() });
  }

  // ---------- Splitter ----------

  private shardRing(current: ReturnType<typeof loadSave> | null): void {
    this.shards = URMASSE.map((u, i) => {
      const found = !!(current && u.flag && current.flags[u.flag]);
      const glow = this.add.circle(0, 0, found ? 20 : 12, u.tint, found ? 0.35 : 0.12).setBlendMode(Phaser.BlendModes.ADD);
      const img = this.add.image(0, 0, 'splitter').setTint(found ? u.tint : 0x8a9aa8).setScale(1.1).setAlpha(found ? 1 : 0.5);
      this.tweens.add({ targets: glow, scale: 1.4, alpha: found ? 0.15 : 0.05, duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'sine.inout' });
      return { img, glow, angle: (i / URMASSE.length) * Math.PI * 2 };
    });
  }

  update(time: number): void {
    const t = time / 9000;
    for (const s of this.shards) {
      const a = s.angle + t;
      const x = GAME_WIDTH / 2 + Math.cos(a) * 340;
      const y = 122 + Math.sin(a) * 66;
      const front = Math.sin(a) > 0;
      s.img.setPosition(x, y + Math.sin(time / 600 + s.angle) * 4).setDepth(front ? 4 : 0).setScale(front ? 1.2 : 0.9);
      s.glow.setPosition(s.img.x, s.img.y).setDepth(front ? 3 : -1);
    }
  }

  // ---------- Titel ----------

  private title(): void {
    const word = 'MENSURA';
    const size = 92;
    const probe = this.add.text(0, 0, word, { fontFamily: FONT_CARVED, fontSize: `${size}px` });
    const total = probe.width + (word.length - 1) * 4;
    probe.destroy();
    let x = GAME_WIDTH / 2 - total / 2;
    this.letters = [];
    [...word].forEach((ch, i) => {
      const t = smooth(
        this.add
          .text(x, 118, ch, { fontFamily: FONT_CARVED, fontSize: `${size}px`, color: '#f4d98a', stroke: '#2a1804', strokeThickness: 7, resolution: 2 })
          .setOrigin(0, 0.5)
          .setDepth(2)
          .setShadow(0, 4, '#000000', 10, true, true),
      );
      // goldener Verlauf von hell oben nach dunkel unten
      const grad = t.context.createLinearGradient(0, 0, 0, t.height);
      grad.addColorStop(0.15, '#fffbe6');
      grad.addColorStop(0.5, '#ffd766');
      grad.addColorStop(0.85, '#d48a1e');
      t.setFill(grad);
      x += t.width + 4;
      // Buchstaben fallen nacheinander herein
      t.setAlpha(0).setY(60);
      this.tweens.add({ targets: t, alpha: 1, y: 118, duration: 650, delay: 300 + i * 110, ease: 'back.out' });
      this.letters.push(t);
    });
    // Schimmer-Welle über den Titel, alle paar Sekunden
    this.time.addEvent({
      delay: 5200,
      loop: true,
      callback: () =>
        this.letters.forEach((t, i) =>
          this.tweens.add({ targets: t, scale: 1.1, y: 110, duration: 180, delay: i * 70, yoyo: true, ease: 'sine.out' }),
        ),
    });

    // Untertitel mit Zierlinien
    const SUB_Y = 182;
    const sub = text(this, GAME_WIDTH / 2, SUB_Y, 'Die sieben Urmaße', 28, '#fff6dc').setDepth(2).setAlpha(0);
    sub.setShadow(0, 2, '#000000', 8, true, true);
    const w = sub.width / 2 + 24;
    const deco = this.add.graphics().setDepth(2).setAlpha(0);
    for (const dir of [-1, 1]) {
      deco.lineStyle(2, 0xffd766, 1).lineBetween(GAME_WIDTH / 2 + dir * w, SUB_Y, GAME_WIDTH / 2 + dir * (w + 110), SUB_Y);
      deco.fillStyle(0xffd766, 1).fillPoints(
        [
          new Phaser.Math.Vector2(GAME_WIDTH / 2 + dir * (w + 118), SUB_Y),
          new Phaser.Math.Vector2(GAME_WIDTH / 2 + dir * (w + 126), SUB_Y - 6),
          new Phaser.Math.Vector2(GAME_WIDTH / 2 + dir * (w + 134), SUB_Y),
          new Phaser.Math.Vector2(GAME_WIDTH / 2 + dir * (w + 126), SUB_Y + 6),
        ],
        true,
      );
    }
    this.tweens.add({ targets: [sub, deco], alpha: 1, duration: 800, delay: 1300 });
  }

  // ---------- Menü ----------

  private menu(current: ReturnType<typeof loadSave> | null): void {
    const cx = GAME_WIDTH / 2;
    const filled = SLOTS.filter((n) => readSlot(n)?.avatar);
    const rows: [string, () => void][] = [];
    if (current?.avatar) rows.push([`Weiterspielen: ${current.avatar.name}`, () => enterGame(this)]);
    else if (current && activeSlot()) rows.push(['Weiterspielen', () => enterGame(this)]);
    rows.push(['Neues Spiel', () => this.newGame()]);
    if (filled.length) rows.push(['Spiel laden', () => this.scene.start('Slots', { mode: 'load', from: 'Title' })]);
    rows.push(['Einstellungen', () => this.scene.launch('Settings', { from: 'Title' }).bringToTop('Settings')]);
    rows.forEach(([label, action], i) => {
      const y = 290 + i * 56;
      const b = button(this, cx, y, label, action, { width: 320, height: 48, size: 21, alpha: 0.72 }).setDepth(10).setAlpha(0);
      // Knöpfe gleiten nacheinander herein
      b.y = y + 24;
      this.tweens.add({ targets: b, alpha: 1, y, duration: 500, delay: 1700 + i * 120, ease: 'quad.out' });
    });
    const foot = smooth(
      this.add
        .text(cx, GAME_HEIGHT - 18, 'Ein Mathe-Abenteuer für Klasse 5 und 6', { fontFamily: FONT, fontSize: '15px', color: '#d8d2c0', resolution: 2 })
        .setShadow(0, 1, '#000000', 4, true, true)
        .setOrigin(0.5)
        .setDepth(10)
        .setAlpha(0),
    );
    this.tweens.add({ targets: foot, alpha: 1, duration: 800, delay: 2300 });
    this.input.keyboard?.on('keydown-ENTER', () => rows[0][1]());
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
