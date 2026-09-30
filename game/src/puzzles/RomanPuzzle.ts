import Phaser from 'phaser';
import { formatNumber, fromRoman, randInt, toRoman } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, FONT_CARVED, GAME_WIDTH, button, smooth, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Tafel der Alten“ (römische Zahlen, Bildungsplan Z1: Stellenwertsystem
// im Vergleich zu einem anderen Zahlsystem).
// Lesen (römisch → Ziffern) und Meißeln (Ziffern → römisch, aus Zeichen-Steinen).
// Der Vergleich steckt in den Hinweisen: Ein römisches Zeichen ist überall gleich
// viel wert; bei uns hängt der Wert einer Ziffer von ihrer Stelle ab.

interface Tier {
  max: number;
  mode: 'lesen' | 'meisseln';
  symbols: string[];
}

const TIERS: Tier[] = [
  { max: 20, mode: 'lesen', symbols: ['I', 'V', 'X'] },
  { max: 20, mode: 'meisseln', symbols: ['I', 'V', 'X'] },
  { max: 100, mode: 'lesen', symbols: ['I', 'V', 'X', 'L', 'C'] },
  { max: 100, mode: 'meisseln', symbols: ['I', 'V', 'X', 'L', 'C'] },
  { max: 3999, mode: 'lesen', symbols: ['I', 'V', 'X', 'L', 'C', 'D', 'M'] },
  { max: 3999, mode: 'meisseln', symbols: ['I', 'V', 'X', 'L', 'C', 'D', 'M'] },
];

const LEGEND = 'I = 1   V = 5   X = 10   L = 50   C = 100   D = 500   M = 1000';

export class RomanPuzzle extends PuzzleScene {
  protected title = 'Die Tafel der Alten';
  protected skills: SkillId[] = ['Z1S'];

  private target = 0;
  private carved = '';
  private carvedText?: Phaser.GameObjects.Text;

  constructor() {
    super('RomanPuzzle');
  }

  protected buildRound(): void {
    const tier = pickByLevel(getLevel('Z1S'), TIERS);
    // bei den großen Zahlen gern Jahreszahlen
    // nicht trivial: kein einzelnes Zeichen (V, X, L …) und nicht nur ein Zeichen wiederholt (II, XX, CCC)
    do this.target = tier.max > 100 && randInt(0, 1) ? randInt(1400, 2100) : randInt(tier.max > 20 ? 21 : 2, tier.max);
    while (new Set(toRoman(this.target)).size < 2);
    this.carved = '';
    const r = this.round;
    const roman = toRoman(this.target);

    // Steintafel
    const g = this.add.graphics();
    g.fillStyle(0x6f6a60, 1).fillRoundedRect(GAME_WIDTH / 2 - 260, 110, 520, 120, 10);
    g.lineStyle(4, 0x3f3b35, 1).strokeRoundedRect(GAME_WIDTH / 2 - 260, 110, 520, 120, 10);
    r.add(g);
    const legendSymbols = tier.symbols.length;
    r.add(text(this, GAME_WIDTH / 2, 256, LEGEND.split('   ').slice(0, legendSymbols).join('    '), 17, COLORS.muted));

    this.hints = [
      'Bei den Römern hat jedes Zeichen immer denselben Wert, egal wo es steht. Du zählst einfach zusammen.',
      'Steht ein kleineres Zeichen vor einem größeren, wird es abgezogen: IV = 5 − 1 = 4, IX = 9, XL = 40, XC = 90.',
      `${formatNumber(this.target)} heißt römisch ${roman}.`,
    ];

    if (tier.mode === 'lesen') {
      r.add(text(this, GAME_WIDTH / 2, 88, 'Welche Zahl ist in die Tafel gemeißelt?', 22, COLORS.text));
      r.add(this.carvedLabel(roman));
      const pad = createNumpad(this, 790, 400, (n) => this.checkRead(n), 4);
      pad.container.setScale(0.62);
      r.add(pad.container);
      r.add(
        text(this, 330, 350, 'Bei uns: Die Stelle bestimmt den Wert.\nBei den Alten: Jedes Zeichen hat einen festen Wert.', 17, COLORS.muted).setAlign('center'),
      );
    } else {
      r.add(text(this, GAME_WIDTH / 2, 88, `Meißle die Zahl ${formatNumber(this.target)} in römischen Zeichen!`, 22, COLORS.text));
      this.carvedText = this.carvedLabel('');
      r.add(this.carvedText);
      const n = tier.symbols.length;
      tier.symbols.forEach((sym, i) => {
        const x = GAME_WIDTH / 2 + (i - (n - 1) / 2) * 76;
        const b = button(this, x, 320, sym, () => this.carve(sym), { width: 66, height: 60, size: 28 });
        r.add(b);
      });
      r.add(button(this, GAME_WIDTH / 2 - 120, 400, 'Zurück', () => this.carve(null), { width: 150, height: 50, size: 20 }));
      r.add(button(this, GAME_WIDTH / 2 + 120, 400, 'Einmeißeln', () => this.checkCarve(), { width: 190, height: 50, size: 20 }));
    }
  }

  private carvedLabel(content: string): Phaser.GameObjects.Text {
    return smooth(
      this.add
        .text(GAME_WIDTH / 2, 170, content, { fontFamily: FONT_CARVED, fontSize: '54px', color: '#e8e1cf', resolution: 2 })
        .setOrigin(0.5)
        .setShadow(2, 2, '#2a2620', 0, false, true),
    );
  }

  private carve(sym: string | null): void {
    if (sym === null) this.carved = this.carved.slice(0, -1);
    else if (this.carved.length < 15) this.carved += sym;
    this.carvedText?.setText(this.carved);
  }

  private checkRead(n: number): void {
    const roman = toRoman(this.target);
    if (n === this.target) {
      this.solved(`Richtig: ${roman} = ${formatNumber(this.target)}.`);
      return;
    }
    this.wrong(`${formatNumber(n)} wäre römisch ${n > 0 && n < 4000 ? toRoman(n) : '… (zu groß)'}. Vergleiche Zeichen für Zeichen.`);
  }

  private checkCarve(): void {
    if (!this.carved) return;
    const value = fromRoman(this.carved);
    const roman = toRoman(this.target);
    if (this.carved === roman) {
      this.solved(`Perfekt gemeißelt: ${roman} = ${formatNumber(this.target)}.`);
    } else if (value === this.target) {
      // Rechnerisch richtig, aber unübliche Schreibweise (z. B. IIII statt IV)
      this.solved(`Der Wert stimmt! Üblich ist aber die kürzere Schreibweise ${roman}.`);
    } else {
      this.wrong(`${this.carved} ist ${Number.isNaN(value) ? 'keine gültige Zahl' : formatNumber(value)}, gesucht ist ${formatNumber(this.target)}.`);
    }
  }
}
