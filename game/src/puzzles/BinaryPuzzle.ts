import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Leuchtsteine“ (Zweiersystem, Bildungsplan Z1: Stellenwertsystem im
// Vergleich zu einem anderen Zahlsystem).
// Eine Reihe Steine mit den Werten …, 16, 8, 4, 2, 1. Ein leuchtender Stein zählt,
// ein dunkler nicht. Das ist ein Stellenwertsystem wie unseres, nur wird immer zu
// zweit gebündelt statt zu zehnt.
//  - entzünden: eine Zahl mit leuchtenden Steinen darstellen
//  - ablesen:   eine leuchtende Reihe (und ihre Schreibweise aus 0 und 1) in unsere Zahl übersetzen

interface Tier {
  stones: number;
  showValues: boolean;
}

const TIERS: Tier[] = [
  { stones: 3, showValues: true },
  { stones: 4, showValues: true },
  { stones: 5, showValues: true },
  { stones: 5, showValues: false },
  { stones: 6, showValues: false },
  { stones: 7, showValues: false },
];

export class BinaryPuzzle extends PuzzleScene {
  protected title = 'Die Leuchtsteine';
  protected skills: SkillId[] = ['Z1S'];

  private target = 0;
  private lit: boolean[] = [];
  private stoneViews: Phaser.GameObjects.Arc[] = [];
  private glowViews: Phaser.GameObjects.Arc[] = [];
  private codeText?: Phaser.GameObjects.Text;

  constructor() {
    super('BinaryPuzzle');
  }

  protected buildRound(): void {
    const tier = pickByLevel(getLevel('Z1S'), TIERS);
    const n = tier.stones;
    this.target = randInt(1, 2 ** n - 1);
    this.lit = Array(n).fill(false);
    this.stoneViews = [];
    this.glowViews = [];
    const mode = randInt(0, 1) === 0 ? 'entzuenden' : 'ablesen';
    const r = this.round;

    // Steine von links (größter Wert) nach rechts (1)
    const gap = 96;
    const x0 = GAME_WIDTH / 2 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const place = n - 1 - i; // Stelle: 0 = Einer
      const x = x0 + i * gap;
      const glow = this.add.circle(x, 200, 42, 0x7fd4ff, 0).setBlendMode(Phaser.BlendModes.ADD);
      const stone = this.add.circle(x, 200, 34, 0x4f555c).setStrokeStyle(4, 0x2a2e33);
      r.add([glow, stone]);
      this.glowViews[place] = glow;
      this.stoneViews[place] = stone;
      if (tier.showValues) r.add(text(this, x, 256, formatNumber(2 ** place), 20, COLORS.muted));
      if (mode === 'entzuenden') {
        stone.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(place));
      }
    }

    this.hints = [
      'Die Alten bündelten immer zu zweit: 2 Einer sind ein Zweier, 2 Zweier ein Vierer, 2 Vierer ein Achter …',
      `Jeder Stein ist doppelt so viel wert wie sein rechter Nachbar: ${Array.from({ length: n }, (_, k) => 2 ** (n - 1 - k)).join(', ')}.`,
      `Fang beim größten Stein an: Passt sein Wert noch in ${formatNumber(this.target)}? Dann zünde ihn an und rechne weiter mit dem Rest.`,
    ];

    if (mode === 'entzuenden') {
      r.add(text(this, GAME_WIDTH / 2, 100, `Lass die Steine so leuchten, dass sie zusammen ${formatNumber(this.target)} ergeben!`, 22, COLORS.text));
      r.add(text(this, GAME_WIDTH / 2, 130, 'Tipp auf einen Stein, um ihn zu entzünden oder zu löschen.', 17, COLORS.muted));
      this.codeText = text(this, GAME_WIDTH / 2, 316, '', 26, COLORS.goldText);
      r.add(this.codeText);
      r.add(button(this, GAME_WIDTH / 2, 390, 'Tor berühren', () => this.checkLit(), { width: 220, height: 54, size: 22 }));
    } else {
      r.add(text(this, GAME_WIDTH / 2, 100, 'Welche Zahl zeigen die leuchtenden Steine?', 22, COLORS.text));
      for (let p = 0; p < n; p++) this.lit[p] = ((this.target >> p) & 1) === 1;
      this.codeText = text(this, 330, 330, '', 26, COLORS.goldText);
      r.add(this.codeText);
      r.add(text(this, 330, 370, '(so schrieben es die Alten)', 16, COLORS.muted));
      const pad = createNumpad(this, 790, 400, (v) => this.checkRead(v), 3);
      pad.container.setScale(0.62);
      r.add(pad.container);
    }
    this.refresh();
  }

  private toggle(place: number): void {
    this.lit[place] = !this.lit[place];
    this.refresh();
  }

  private value(): number {
    return this.lit.reduce((sum, on, p) => sum + (on ? 2 ** p : 0), 0);
  }

  private refresh(): void {
    this.lit.forEach((on, p) => {
      this.stoneViews[p].setFillStyle(on ? 0xbfeaff : 0x4f555c);
      this.glowViews[p].setFillStyle(0x7fd4ff, on ? 0.45 : 0);
    });
    // Schreibweise der Alten: 1 für leuchtend, 0 für dunkel
    const code = [...this.lit].reverse().map((on) => (on ? '1' : '0')).join(' ');
    this.codeText?.setText(code);
  }

  private checkLit(): void {
    const v = this.value();
    if (v === this.target) {
      this.solved(`Das Tor summt! ${[...this.lit].reverse().map((on) => (on ? 1 : 0)).join('')} bei den Alten ist ${formatNumber(v)} bei uns.`);
    } else {
      this.wrong(`Die leuchtenden Steine ergeben ${formatNumber(v)}. Gesucht ist ${formatNumber(this.target)}, das ist ${v < this.target ? 'mehr' : 'weniger'}.`);
    }
  }

  private checkRead(v: number): void {
    if (v === this.target) {
      this.solved(`Genau! Zusammen sind es ${formatNumber(this.target)}.`);
      return;
    }
    const parts = this.lit.map((on, p) => (on ? 2 ** p : 0)).filter((x) => x).reverse();
    this.wrong(this.hintsUsed >= 2 ? `Zähle zusammen: ${parts.join(' + ')}.` : 'Zähle nur die Werte der leuchtenden Steine zusammen.');
  }
}
