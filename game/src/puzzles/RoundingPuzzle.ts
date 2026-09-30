import { formatNumber, interestingNumber, randInt, roundTo } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';
import { Rail, drawCart } from './rail';

// Rätsel „Haltestellen“ (Runden, Z18).
// Loren halten nur an vollen Zehnern/Hundertern/Tausendern. Eine Lore steht zwischen
// zwei Haltestellen und rollt zur näheren. Genau in der Mitte rollt sie immer vorwärts
// (Regel: bei 5 wird aufgerundet). Das Bild macht sichtbar, warum Runden „zur näheren
// Zahl“ heißt. Auf hoher Stufe verschwindet das Bild und man rechnet selbst.

interface Tier {
  step: number;
  digits: number;
  picture: boolean;
}

const TIERS: Tier[] = [
  { step: 10, digits: 2, picture: true },
  { step: 100, digits: 3, picture: true },
  { step: 100, digits: 4, picture: true },
  { step: 1000, digits: 4, picture: true },
  { step: 1000, digits: 5, picture: false },
  { step: 10000, digits: 6, picture: false },
];

const STEP_NAME: Record<number, string> = { 10: 'Zehner', 100: 'Hunderter', 1000: 'Tausender', 10000: 'Zehntausender' };

export class RoundingPuzzle extends PuzzleScene {
  protected title = 'Die Haltestellen';
  protected skills: SkillId[] = ['Z18'];

  private value = 0;
  private step = 10;

  constructor() {
    super('RoundingPuzzle');
  }

  protected buildRound(): void {
    const tier = pickByLevel(getLevel('Z18'), TIERS);
    this.step = tier.step;
    // Zahl, die nicht schon rund ist; ab und zu genau die Mitte (…5…)
    let v = interestingNumber(tier.digits);
    if (v % tier.step === 0) v += randInt(1, tier.step - 1);
    if (randInt(0, 5) === 0) v = Math.floor(v / tier.step) * tier.step + tier.step / 2;
    this.value = v;

    const lower = Math.floor(v / tier.step) * tier.step;
    const upper = lower + tier.step;
    const r = this.round;

    r.add(text(this, GAME_WIDTH / 2, 96, `Die Lore trägt die Nummer ${formatNumber(v)}.`, 26, COLORS.text));
    r.add(
      text(this, GAME_WIDTH / 2, 130, `Loren halten nur an vollen ${STEP_NAME[tier.step]}n. Wo hält sie?`, 20, COLORS.muted),
    );

    this.hints = [
      `Die Lore steht zwischen ${formatNumber(lower)} und ${formatNumber(upper)}. Welche Haltestelle ist näher?`,
      `Schau auf die Ziffer rechts neben den ${STEP_NAME[tier.step]}n: 0 bis 4 rollt zurück, 5 bis 9 rollt vorwärts.`,
      `${formatNumber(v)} ist gerundet ${formatNumber(roundTo(v, tier.step))}.`,
    ];

    if (tier.picture) {
      const rail = new Rail(this, r, { from: lower, to: upper, major: tier.step, minor: tier.step / 10, labels: 'ends' }, 190, 770, 260);
      const cart = drawCart(this);
      cart.setPosition(rail.xOf(v), rail.y);
      r.add(cart);
      r.add(text(this, rail.xOf(v), rail.y - 96, formatNumber(v), 20, COLORS.goldText));
      // Die zwei Haltestellen als große Knöpfe unter den Enden
      r.add(button(this, rail.x0, 380, `Halt ${formatNumber(lower)}`, () => this.check(lower), { width: 210, height: 54, size: 20 }));
      r.add(button(this, rail.x1, 380, `Halt ${formatNumber(upper)}`, () => this.check(upper), { width: 210, height: 54, size: 20 }));
    } else {
      r.add(text(this, GAME_WIDTH / 2 - 120, 290, `Runde ${formatNumber(v)}\nauf ${STEP_NAME[tier.step]}.`, 26, COLORS.text));
      const pad = createNumpad(this, 700, 330, (n) => this.check(n), 8);
      pad.container.setScale(0.75);
      r.add(pad.container);
    }
  }

  private check(n: number): void {
    const correct = roundTo(this.value, this.step);
    if (n === correct) {
      const mid = this.value % this.step === this.step / 2;
      this.solved(mid ? `Genau in der Mitte rollt sie vorwärts: ${formatNumber(correct)}!` : `Richtig, sie hält bei ${formatNumber(correct)}.`);
      return;
    }
    const lower = Math.floor(this.value / this.step) * this.step;
    if (n === lower || n === lower + this.step) {
      const dNear = Math.abs(this.value - correct);
      const dFar = Math.abs(this.value - n);
      this.wrong(
        dNear === dFar
          ? 'Genau in der Mitte! Dann rollt die Lore immer vorwärts zur größeren Zahl.'
          : `Bis ${formatNumber(n)} sind es ${formatNumber(dFar)}, bis ${formatNumber(correct)} nur ${formatNumber(dNear)}.`,
      );
    } else {
      this.wrong(`${formatNumber(n)} ist keine der beiden nächsten Haltestellen. Die Lore steht zwischen ${formatNumber(lower)} und ${formatNumber(lower + this.step)}.`);
    }
  }
}
