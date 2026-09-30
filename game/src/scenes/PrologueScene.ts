import Phaser from 'phaser';
import { music } from '../audio/music';
import { URMASSE } from '../story';
import { showDialog } from '../ui/dialog';
import { stopLine } from '../ui/dialogVoice';
import { fogBackdrop } from '../ui/screens';
import { GAME_HEIGHT, GAME_WIDTH, button } from '../ui/theme';

// Vorspann vor dem ersten Spiel: die Urmaße, Vagor, der Nebel, Meisterin Elle.
// Danach geht es in den Avatar-Editor. Überspringen jederzeit möglich.

const CX = GAME_WIDTH / 2;
const CY = 170;

export class PrologueScene extends Phaser.Scene {
  private done = false;

  constructor() {
    super('Prologue');
  }

  preload(): void {
    this.load.spritesheet('npc-elle', 'assets/npcs/elle.png', { frameWidth: 68, frameHeight: 68 });
  }

  create(): void {
    this.done = false;
    fogBackdrop(this);
    this.cameras.main.fadeIn(800);
    void music.play('prologue');
    // über dem Klick-Blocker des Dialogs, damit man auch mitten im Text überspringen kann
    button(this, GAME_WIDTH - 90, 34, 'Überspringen', () => this.finish(), { width: 160, height: 44, size: 17 }).setDepth(20_000);

    // Die sieben Urmaße, im Kreis vereint
    const shards = URMASSE.map((u, i) => {
      const a = (i / URMASSE.length) * Math.PI * 2 - Math.PI / 2;
      const img = this.add.image(CX + Math.cos(a) * 70, CY + Math.sin(a) * 70, 'splitter').setTint(u.tint).setScale(1.3).setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, delay: 300 + i * 150, duration: 600 });
      return { img, a };
    });
    const glow = this.add.circle(CX, CY, 110, 0xf2e3b0, 0).setDepth(-1);
    this.tweens.add({ targets: glow, fillAlpha: 0.12, duration: 1500, yoyo: true, repeat: -1, ease: 'sine.inout' });
    const fog = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xaab6c2, 0).setOrigin(0).setDepth(5);

    showDialog(
      this,
      [
        { speaker: 'Erzählerin', text: 'Vor langer Zeit schmiedeten die Alten sieben Urmaße: Zahl, Zeichen, Teil, Größe, Form, Raum und Takt.' },
        { speaker: 'Erzählerin', text: 'Solange sie in der Halle der Alten ruhten, hatte alles in Mensura sein Maß: Flüsse, Wege, Brücken und Versprechen.' },
      ],
      () => {
        // Vagor zerbricht die Urmaße: Die Splitter fliegen davon, der Nebel kommt
        this.cameras.main.shake(600, 0.01);
        glow.destroy();
        for (const s of shards) {
          this.tweens.add({ targets: s.img, x: CX + Math.cos(s.a) * 700, y: CY + Math.sin(s.a) * 500, angle: 360, alpha: 0.2, duration: 1400, ease: 'quad.in' });
        }
        this.tweens.add({ targets: fog, fillAlpha: 0.22, duration: 2500 });
        showDialog(
          this,
          [
            { speaker: 'Erzählerin', text: 'Dann zerbrach Vagor, einst der beste Vermesser des Landes, die Urmaße. Die Splitter flogen über das ganze Land.' },
            { speaker: 'Erzählerin', text: 'Seitdem kriecht der Nebel des Ungefähren über Mensura. Nichts hat mehr sein genaues Maß.' },
          ],
          () => {
            const elle = this.add.sprite(CX, CY + 30, 'npc-elle', 0).setScale(3).setAlpha(0).setDepth(6);
            this.tweens.add({ targets: elle, alpha: 1, duration: 900 });
            showDialog(
              this,
              [
                { speaker: 'Erzählerin', text: 'Nur eine hat nicht aufgegeben: die alte Kartographin Meisterin Elle. Und sie hat einen neuen Lehrling.' },
                { speaker: 'Erzählerin', text: 'Dich.' },
              ],
              () => this.finish(),
            );
          },
        );
      },
    );
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    stopLine();
    this.cameras.main.fadeOut(500);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Avatar', { returnTo: 'Village' }));
  }
}
