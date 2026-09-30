import Phaser from 'phaser';
import { formatDecimal, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Riesenwaage“ (Gewichte umrechnen, M5 Masse).
// Links hängt der Sack der Riesin, rechts legt man Gewichtsstücke auf. Erst beim
// Prüfen neigt sich der Balken: zu leicht, zu schwer oder im Gleichgewicht.
// Stufen: Gramm → kg und g gemischt → Kommazahl in kg → Tonnen und kg → knifflige Nullen.

interface Tier {
  weights: number[]; // in g
  make: () => { grams: number; label: string };
}

const kgLabel = (g: number) => {
  const kg = Math.floor(g / 1000);
  const rest = g % 1000;
  return kg && rest ? `${kg} kg ${rest} g` : kg ? `${kg} kg` : `${rest} g`;
};

/**
 * Vielfaches von 50 g zwischen min·50 und max·50. Ausgeschlossen: glatte Kilogramm
 * (2 kg = zwei Kilostücke) und Werte, die genau ein einzelnes Gewichtsstück sind.
 */
const pickGrams = (min: number, max: number, single: number[] = []) => {
  let g: number;
  do g = randInt(min, max) * 50;
  while (g % 1000 === 0 || single.includes(g));
  return g;
};

const TIERS: Tier[] = [
  { weights: [500, 200, 100, 50], make: () => { const g = pickGrams(2, 19, [100, 200, 500]); return { grams: g, label: `${g} g` }; } },
  { weights: [1000, 500, 200, 100, 50], make: () => { const g = pickGrams(21, 79); return { grams: g, label: kgLabel(g) }; } },
  { weights: [1000, 500, 200, 100, 50], make: () => { const g = pickGrams(21, 79); return { grams: g, label: `${formatDecimal(g / 1000)} kg` }; } },
  {
    weights: [1_000_000, 500_000, 200_000, 100_000],
    make: () => {
      let kg = randInt(11, 39) * 100;
      if (kg % 1000 === 0) kg += 300;
      const t = Math.floor(kg / 1000);
      return { grams: kg * 1000, label: `${t} t ${kg % 1000} kg` };
    },
  },
  {
    weights: [1000, 500, 200, 100, 50],
    make: () => {
      const g = randInt(1, 4) * 1000 + [50, 100, 250][randInt(0, 2)];
      return { grams: g, label: `${formatDecimal(g / 1000)} kg` };
    },
  },
];

const wLabel = (g: number) => (g >= 1_000_000 ? `${g / 1_000_000} t` : g >= 100_000 ? `${g / 1000} kg` : g >= 1000 ? `${g / 1000} kg` : `${g} g`);

export class ScalePuzzle extends PuzzleScene {
  protected title = 'Die Riesenwaage';
  protected skills: SkillId[] = ['M5M'];

  private target = 0;
  private label = '';
  private placed: number[] = [];
  private beam!: Phaser.GameObjects.Container;
  private rightPan!: Phaser.GameObjects.Container;
  private busyTilt = false;

  constructor() {
    super('ScalePuzzle');
  }

  protected buildRound(): void {
    const tier = pickByLevel(getLevel('M5M'), TIERS);
    const t = tier.make();
    this.target = t.grams;
    this.label = t.label;
    this.placed = [];
    const r = this.round;
    const big = tier.weights[0] >= 1_000_000;

    r.add(text(this, GAME_WIDTH / 2, 88, `Der ${big ? 'Getreidesack der Riesin' : 'Sack'} wiegt ${t.label}. Bring die Waage ins Gleichgewicht!`, 21, COLORS.text));

    // Waage: Ständer, Balken (dreht sich), zwei Schalen
    const stand = this.add.graphics();
    stand.fillStyle(0x5a3a1e, 1).fillRect(316, 180, 14, 200).fillRect(270, 374, 106, 14);
    r.add(stand);
    this.beam = this.add.container(323, 184);
    const bg = this.add.graphics();
    bg.fillStyle(0x8a5a2e, 1).fillRoundedRect(-190, -6, 380, 12, 4);
    bg.fillStyle(0xd9b25f, 1).fillCircle(0, 0, 9);
    this.beam.add(bg);
    const leftPan = this.pan(-170, 'Sack');
    const sack = this.add.graphics();
    sack.fillStyle(0xb08a55, 1).fillRoundedRect(-34, 70, 68, 56, 18);
    sack.fillStyle(0x7a5a30, 1).fillRect(-8, 64, 16, 10);
    leftPan.add([sack, text(this, 0, 104, t.label, 15, '#2a1a08')]);
    this.rightPan = this.pan(170, '');
    this.beam.add([leftPan, this.rightPan]);
    r.add(this.beam);

    // Gewichtsstücke zum Auflegen
    r.add(text(this, 760, 150, 'Gewichtsstücke', 18, COLORS.muted));
    tier.weights.forEach((w, i) => {
      r.add(button(this, 700 + (i % 2) * 130, 200 + Math.floor(i / 2) * 64, wLabel(w), () => this.add_(w), { width: 118, height: 52, size: 20 }));
    });
    r.add(button(this, 760, 400, 'Waage prüfen', () => this.check(), { width: 200, height: 52, size: 20 }));
    r.add(text(this, 323, 420, 'Tippe ein Gewicht in der Schale an, um es wieder wegzunehmen.', 14, COLORS.muted));

    this.hints = [
      '1 kg = 1000 g und 1 t = 1000 kg.',
      big ? `${t.label}: Rechne alles in kg um und lege die großen Gewichte zuerst auf.` : `Rechne ${t.label} in Gramm um. Dann lege erst die großen, dann die kleinen Gewichte auf.`,
      `${t.label} sind ${big ? `${formatDecimal(this.target / 1000)} kg` : `${formatDecimal(this.target)} g`}.`,
    ];
    this.refreshPan();
  }

  private pan(x: number, _label: string): Phaser.GameObjects.Container {
    const c = this.add.container(x, 0);
    const g = this.add.graphics();
    g.lineStyle(2, 0x9a8a6a, 1).lineBetween(0, 0, -44, 128).lineBetween(0, 0, 44, 128);
    g.fillStyle(0xc9a25a, 1).fillEllipse(0, 130, 110, 20);
    c.add(g);
    return c;
  }

  private add_(w: number): void {
    if (this.placed.length >= 14) return;
    this.placed.push(w);
    this.refreshPan();
  }

  private refreshPan(): void {
    // Gewichte (ab Index 1) neu zeichnen
    this.rightPan.list.slice(1).forEach((o) => o.destroy());
    const sorted = [...this.placed].sort((a, b) => b - a);
    sorted.forEach((w, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = (col - 1) * 34;
      const y = 112 - row * 26;
      const block = this.add.rectangle(x, y, 32, 24, w >= 1000 ? 0x6a6f78 : 0xb88a3a).setStrokeStyle(2, 0x2a2016);
      const lbl = text(this, x, y, wLabel(w).replace(' ', ''), 11, '#fff4d8');
      block.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        const k = this.placed.indexOf(w);
        if (k >= 0) this.placed.splice(k, 1);
        this.refreshPan();
      });
      this.rightPan.add([block, lbl]);
    });
  }

  private check(): void {
    if (this.busyTilt) return;
    const sum = this.placed.reduce((a, b) => a + b, 0);
    const diff = sum - this.target;
    // Balken neigen: schwerere Seite geht nach unten
    // positiver Winkel dreht im Uhrzeigersinn: rechte Schale (Gewichte) sinkt
    const angle = diff === 0 ? 0 : diff > 0 ? 12 : -12;
    this.busyTilt = true;
    this.tweens.add({ targets: this.beam, angle, duration: 500, ease: 'back.out', onComplete: () => (this.busyTilt = false) });
    const unit = this.target >= 1_000_000 ? 'kg' : 'g';
    const fmt = (g: number) => (unit === 'kg' ? `${formatDecimal(g / 1000)} kg` : `${formatDecimal(g)} g`);
    if (diff === 0) {
      this.solved(`Gleichgewicht! ${fmt(sum)} = ${this.label}.`);
      return;
    }
    this.time.delayedCall(1300, () => this.tweens.add({ targets: this.beam, angle: 0, duration: 400 }));
    this.wrong(`Auf der Waage liegen ${fmt(sum)}. Das ist ${fmt(Math.abs(diff))} zu ${diff > 0 ? 'schwer' : 'leicht'}.`);
  }
}
