import Phaser from 'phaser';
import { music } from '../audio/music';
import { URMASSE } from '../story';
import { showDialog } from '../ui/dialog';
import { stopLine } from '../ui/dialogVoice';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, button, smooth } from '../ui/theme';

// Vorspann vor dem ersten Spiel, in drei Bildern über dem Land von Mensura:
// 1. die Urmaße steigen über dem Land auf, jedes mit seinem Namen,
// 2. Vagor zerbricht sie, die Splitter fliegen davon, die Farben weichen, der Nebel kommt,
// 3. Meisterin Elle bleibt, mit einem warmen Licht, und sieht den neuen Lehrling an.
// Alles Bildliche liegt in einem Container, damit der Dialog unten nicht mitzoomt.
// Danach geht es in den Avatar-Editor. Überspringen jederzeit möglich.

const CX = GAME_WIDTH / 2;
/** Mitte des Bogens, auf dem die Urmaße stehen (über der Burg, über dem Dialogkasten) */
const ARC_Y = 170;
const ARC_R = 120;

export class PrologueScene extends Phaser.Scene {
  private done = false;
  private stage!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Image;
  private grey?: Phaser.Filters.ColorMatrix;

  constructor() {
    super('Prologue');
  }

  preload(): void {
    this.load.spritesheet('npc-elle', 'assets/npcs/elle.png', { frameWidth: 68, frameHeight: 68 });
    this.load.image('title-bg', 'assets/title/background.png');
    this.load.image('vagor', 'assets/objects/vagor.png');
  }

  create(): void {
    this.done = false;
    this.cameras.main.setBackgroundColor(0x070d15);
    this.cameras.main.fadeIn(800);
    void music.play('prologue');
    if (!this.textures.exists('ambient-mote')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1).fillCircle(2, 2, 2).generateTexture('ambient-mote', 4, 4);
      g.destroy();
    }

    this.stage = this.add.container(0, 0);
    const bg = this.add.image(CX, GAME_HEIGHT / 2, 'title-bg');
    bg.setScale(Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height));
    this.stage.add(bg);
    this.bg = bg;
    // die Kamera fährt ganz langsam näher, wie ein Blick, der sich sammelt
    this.zoomStage(1.06, CX, ARC_Y + 60, 14_000, 'sine.inout');

    // über dem Klick-Blocker des Dialogs, damit man auch mitten im Text überspringen kann
    button(this, GAME_WIDTH - 90, 34, 'Überspringen', () => this.finish(), { width: 160, height: 44, size: 17 }).setDepth(20_000);

    // 1. Die Urmaße steigen über dem Land auf
    const shards = URMASSE.map((u, i) => {
      const a = Math.PI * (1 + (i + 0.5) / URMASSE.length);
      const x = CX + Math.cos(a) * ARC_R;
      const y = ARC_Y + Math.sin(a) * ARC_R;
      const glow = this.add.circle(x, y, 30, u.tint, 0).setBlendMode(Phaser.BlendModes.ADD);
      const img = this.add.image(x, y + 40, 'splitter').setTint(u.tint).setScale(1.4).setAlpha(0);
      const label = smooth(this.add.text(x, y + 34, u.name, { fontFamily: FONT, fontSize: '19px', color: COLORS.goldText, resolution: 3 }).setOrigin(0.5, 0).setAlpha(0));
      this.stage.add([glow, img, label]);
      const delay = 400 + i * 420;
      this.tweens.add({ targets: img, alpha: 1, y, delay, duration: 700, ease: 'back.out' });
      this.tweens.add({ targets: label, alpha: 1, delay: delay + 300, duration: 500 });
      this.tweens.add({ targets: glow, fillAlpha: 0.28, delay, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inout' });
      this.tweens.add({ targets: img, y: y - 4, delay: delay + 700, duration: 1500 + i * 90, yoyo: true, repeat: -1, ease: 'sine.inout' });
      return { img, glow, label, a, tint: u.tint };
    });
    // ein stilles Leuchten, das über das Land geht: Alles hat sein Maß
    const light = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xfff2c0, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.stage.add(light);
    this.tweens.add({ targets: light, fillAlpha: 0.1, delay: 1200, duration: 2500, yoyo: true, repeat: -1, ease: 'sine.inout' });

    showDialog(
      this,
      [
        // fester Text, damit die Zeile aufgenommen wird (Vorlagen-Strings überspringt der Rekorder)
        { speaker: 'Erzählerin', text: 'Vor langer Zeit schmiedeten die Alten fünf Urmaße: Zahl, Form, Größe, Raum und Teil.' },
        { speaker: 'Erzählerin', text: 'Solange sie in der Halle der Alten ruhten, hatte alles in Mensura sein Maß: Flüsse, Wege, Brücken und Versprechen.' },
      ],
      () => this.vagorBreaksThem(shards, light),
    );
  }

  /** 2. Vagor steigt auf, ein Blitz, die Splitter fliegen davon, die Farben weichen, der Nebel kommt */
  private vagorBreaksThem(shards: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; a: number; tint: number }[], light: Phaser.GameObjects.Rectangle): void {
    this.tweens.killTweensOf(light);
    this.tweens.add({ targets: light, fillAlpha: 0, duration: 600 });
    const dusk = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a1030, 0).setOrigin(0);
    const vagor = this.add.image(CX, GAME_HEIGHT + 80, 'vagor').setOrigin(0.5, 1).setScale(2.2).setAlpha(0.95);
    this.stage.add([dusk, vagor]);
    this.tweens.add({ targets: dusk, fillAlpha: 0.45, duration: 1400 });
    this.tweens.add({ targets: vagor, y: 365, duration: 1600, ease: 'sine.out' });

    showDialog(this, [{ speaker: 'Erzählerin', text: 'Dann zerbrach Vagor, einst der beste Vermesser des Landes, die Urmaße. Die Splitter flogen über das ganze Land.' }], () => this.fogComes(vagor, dusk));

    this.time.delayedCall(1900, () => {
      // der Schlag: Blitz, Beben, Splitter in alle Richtungen mit leuchtender Spur
      const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.9).setOrigin(0).setDepth(100);
      this.tweens.add({ targets: flash, fillAlpha: 0, duration: 700, onComplete: () => flash.destroy() });
      this.cameras.main.shake(700, 0.012);
      for (const s of shards) {
        this.tweens.killTweensOf([s.img, s.glow, s.label]);
        s.glow.destroy();
        this.tweens.add({ targets: s.label, alpha: 0, duration: 300 });
        const trail = this.add.particles(0, 0, 'ambient-mote', {
          follow: s.img,
          tint: s.tint,
          speed: { min: 10, max: 50 },
          lifespan: 700,
          scale: { start: 1.4, end: 0 },
          alpha: { start: 0.9, end: 0 },
          frequency: 25,
          blendMode: 'ADD',
        });
        this.stage.add(trail);
        this.tweens.add({
          targets: s.img,
          x: CX + Math.cos(s.a) * 760,
          y: ARC_Y + Math.sin(s.a) * 560,
          angle: 540,
          scale: 0.7,
          alpha: 0.3,
          duration: 1500,
          ease: 'quad.in',
          onComplete: () => trail.stop(),
        });
      }
      // die Farben weichen aus dem Land, wie später an jedem Ort ohne seinen Splitter (nur das Bild, nicht der Dialog)
      this.bg.enableFilters();
      const grey = this.bg.filters!.internal.addColorMatrix();
      grey.colorMatrix.saturate(-0.85).brightness(0.85, true);
      grey.colorMatrix.alpha = 0;
      this.grey = grey;
      this.tweens.addCounter({ from: 0, to: 1, duration: 3500, delay: 400, onUpdate: (t) => (grey.colorMatrix.alpha = t.getValue() ?? 1) });
    });
  }

  /** Der Nebel des Ungefähren kriecht herein, Vagor verschwindet darin */
  private fogComes(vagor: Phaser.GameObjects.Image, dusk: Phaser.GameObjects.Rectangle): void {
    // viele blasse, große Schwaden übereinander, damit keine harten Kanten entstehen
    const fogs: Phaser.GameObjects.Ellipse[] = [];
    for (let i = 0; i < 34; i++) {
      const fromLeft = i % 2 === 0;
      const e = this.add
        .ellipse(fromLeft ? -300 : GAME_WIDTH + 300, 80 + Math.random() * 380, 520 + Math.random() * 420, 150 + Math.random() * 120, 0xc9d4de, 0)
        .setDepth(50);
      this.tweens.add({ targets: e, x: Math.random() * GAME_WIDTH, fillAlpha: 0.045 + Math.random() * 0.04, delay: i * 90, duration: 2800 + Math.random() * 1500, ease: 'sine.out' });
      this.tweens.add({ targets: e, y: e.y - 20 - Math.random() * 30, delay: 3000, duration: 6000 + Math.random() * 4000, yoyo: true, repeat: -1, ease: 'sine.inout' });
      fogs.push(e);
    }
    this.tweens.add({ targets: vagor, alpha: 0, y: 420, delay: 600, duration: 2400, ease: 'sine.in' });
    this.tweens.add({ targets: dusk, fillAlpha: 0.25, delay: 600, duration: 2400 });
    showDialog(this, [{ speaker: 'Erzählerin', text: 'Seitdem kriecht der Nebel des Ungefähren über Mensura. Nichts hat mehr sein genaues Maß.' }], () => this.elleRemains(fogs));
  }

  /** 3. Meisterin Elle bleibt, mit einem warmen Licht im Nebel, und sieht den Lehrling an */
  private elleRemains(fogs: Phaser.GameObjects.Ellipse[]): void {
    const grey = this.grey;
    const ex = CX;
    const ey = 250;
    // warmes Licht um sie: mehrere blasse Kreise übereinander, damit der Rand weich wird
    const halos = [150, 115, 85, 60].map((r) => this.add.circle(ex, ey + 20, r, 0xf2c070, 0).setBlendMode(Phaser.BlendModes.ADD));
    const elle = this.add.sprite(ex, ey, 'npc-elle', 0).setScale(3).setAlpha(0);
    this.stage.add([...halos, elle]);
    this.tweens.add({ targets: elle, alpha: 1, duration: 1100 });
    halos.forEach((h, i) => this.tweens.add({ targets: h, fillAlpha: 0.05 + i * 0.015, duration: 1400, delay: i * 120 }));
    this.tweens.add({ targets: halos[3], fillAlpha: { from: 0.09, to: 0.14 }, delay: 1800, duration: 1400, yoyo: true, repeat: -1, ease: 'sine.inout' });
    // um sie herum weicht der Nebel ein wenig, und ein Rest Farbe kehrt zurück
    for (const f of fogs) this.tweens.add({ targets: f, fillAlpha: f.fillAlpha * 0.5, x: f.x + (f.x < CX ? -140 : 140), duration: 2500, ease: 'sine.inout' });
    if (grey) this.tweens.addCounter({ from: grey.colorMatrix.alpha, to: 0.6, duration: 2500, onUpdate: (t) => (grey.colorMatrix.alpha = t.getValue() ?? 0.6) });

    showDialog(this, [{ speaker: 'Erzählerin', text: 'Nur eine hat nicht aufgegeben: die alte Kartographin Meisterin Elle. Und sie hat einen neuen Lehrling.' }], () => {
      // „Dich.“: näher an Elle heran
      this.zoomStage(1.6, ex, ey, 900, 'sine.inout');
      showDialog(this, [{ speaker: 'Erzählerin', text: 'Dich.' }], () => this.finish());
    });
  }

  /** Das Bild (nicht den Dialog) um einen Punkt vergrößern; der Punkt bleibt auf dem Bildschirm, wo er ist. */
  private zoomStage(scale: number, px: number, py: number, duration: number, ease: string): void {
    this.tweens.killTweensOf(this.stage);
    this.tweens.add({ targets: this.stage, scale, x: px - px * scale, y: py - py * scale, duration, ease });
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    stopLine();
    this.cameras.main.fadeOut(500);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Avatar', { returnTo: 'Village' }));
  }
}
