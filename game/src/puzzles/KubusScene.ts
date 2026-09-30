import Phaser from 'phaser';
import { oppositeOf, randomNet } from '../learn/cubeNets';
import { randInt } from '../learn/numbers';
import { button } from '../ui/theme';
import { BossScene, type BossConfig } from './BossScene';

// Endgegner der Würfelfestung: der Kubus-Wächter.
//  1. Schilde (Fläche/Umfang, M13/M9):  „Mein Schild ist 6 cm × 4 cm. Wie groß ist er?“
//  2. Schwachstelle (Netze, R14):         Sie liegt gegenüber vom Stern auf seinem Netz
//  3. Zerfall (Volumen, M15):             „Ich bestehe aus 4 × 3 × 2 Würfeln!“

export class KubusScene extends BossScene {
  protected config: BossConfig = {
    title: 'Der Kubus-Wächter',
    imageKey: 'kubus',
    imagePath: 'assets/objects/kubus.png',
    imageScale: 1.2,
    background: [0x2a3040, 0x0a0c12],
    phases: 3,
    hitsPerPhase: 3,
    phaseBreaks: ['Seine Schilde zerbrechen! Er klappt sich auf …', 'Er wankt! Gleich zerfällt er in Würfel …'],
    winText: 'Der Kubus-Wächter zerfällt in viele kleine Würfel!',
    regroupText: 'Der Wächter setzt sich wieder zusammen. Versuch es noch einmal!',
    chipColor: 0x8aa0c8,
  };

  constructor() {
    super('KubusScene');
  }

  protected ask(phase: number): void {
    if (phase === 0) this.askShield();
    else if (phase === 1) this.askNet();
    else this.askVolume();
  }

  private options(values: number[], correct: number, unit: string, onWrong: (v: number) => string, skill: 'M13' | 'M9' | 'M15'): void {
    const opts = Phaser.Utils.Array.Shuffle([...new Set(values)].filter((v) => v > 0)).slice(0, 4);
    if (!opts.includes(correct)) opts[0] = correct;
    Phaser.Utils.Array.Shuffle(opts).forEach((v, i, arr) => {
      const x = 480 + (i - (arr.length - 1) / 2) * 200;
      this.area.add(
        button(this, x, 420, `${v} ${unit}`, () => {
          if (v === correct) this.right([skill], `Richtig: ${v} ${unit}!`);
          else this.wrong([skill], onWrong(v));
        }, { width: 180, height: 64, size: 22 }),
      );
    });
  }

  private askShield(): void {
    let a = randInt(3, 9);
    let b = randInt(2, 7);
    // Maße, bei denen Fläche und Umfang gleich sind (4 × 4, 3 × 6), wären mehrdeutig
    while (a * b === 2 * (a + b)) {
      a = randInt(3, 9);
      b = randInt(2, 7);
    }
    if (randInt(0, 1)) {
      this.prompt.setText(`„Mein Schild ist ${a} cm × ${b} cm groß!“ Wie groß ist sein Flächeninhalt?`);
      this.hint = 'Flächeninhalt eines Rechtecks: Länge mal Breite.';
      this.options([a * b, 2 * (a + b), a + b, a * b + a], a * b, 'cm²', (v) => (v === 2 * (a + b) ? 'Das ist der Umfang, nicht die Fläche!' : `${a} · ${b} = ${a * b}`), 'M13');
    } else {
      this.prompt.setText(`„Mein Schild ist ${a} cm × ${b} cm groß!“ Wie lang ist sein Rand (Umfang)?`);
      this.hint = 'Umfang eines Rechtecks: 2 · Länge + 2 · Breite.';
      this.options([2 * (a + b), a * b, a + b, 2 * a + b], 2 * (a + b), 'cm', (v) => (v === a * b ? 'Das ist der Flächeninhalt, nicht der Umfang!' : `2 · ${a} + 2 · ${b} = ${2 * (a + b)}`), 'M9');
    }
  }

  private askNet(): void {
    const net = randomNet(true);
    const star = randInt(0, 5);
    const target = oppositeOf(net, star);
    this.prompt.setText('Er klappt sich auf! Seine Schwachstelle liegt gegenüber vom Stern. Triff sie!');
    this.hint = 'Gegenüberliegende Flächen berühren sich im Netz nie.';
    // Netze sind höchstens 5 Kästchen hoch: 5 · 36 px passen unter den Text
    const size = 36;
    const w = Math.max(...net.map((c) => c[0])) + 1;
    const ox = 480 - (w * size) / 2;
    const oy = 352;
    const g = this.add.graphics();
    this.area.add(g);
    net.forEach(([x, y], i) => {
      const px = ox + x * size;
      const py = oy + y * size;
      g.fillStyle(0x6a7a9a, 1).fillRect(px, py, size, size).lineStyle(2, 0x1a2030, 1).strokeRect(px, py, size, size);
      if (i === star) {
        this.area.add(this.add.star(px + size / 2, py + size / 2, 5, 7, 16, 0xf0d78a));
        return;
      }
      const hit = this.add.zone(px + size / 2, py + size / 2, size, size).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (i === target) this.right(['R14'], 'Treffer! Genau gegenüber vom Stern.');
        else this.wrong(['R14'], 'Diese Fläche ist beim Würfel ein Nachbar vom Stern.');
      });
      this.area.add(hit);
    });
  }

  private askVolume(): void {
    const a = randInt(2, 5);
    const b = randInt(2, 4);
    const c = randInt(2, 4);
    this.prompt.setText(`„Ich bestehe aus ${a} × ${b} × ${c} Würfeln!“ Wie viele Würfel sind das?`);
    this.hint = 'Volumen: Länge · Breite · Höhe.';
    this.options([a * b * c, a * b + c, a + b + c, a * b * c + a * b], a * b * c, 'Würfel', () => `${a} · ${b} · ${c} = ${a * b * c}`, 'M15');
  }
}

