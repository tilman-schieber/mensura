import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';
import { Rail, drawCart, type RailSpec } from './rail';

// Rätsel „Lorenbahn“ (Zahlenstrahl, Z6 für natürliche Zahlen).
//  - schieben: Lore genau an eine Zahl schieben und die Bremse ziehen
//  - ablesen:  Die Lore steht irgendwo, welche Zahl ist das?
// Die Schwierigkeit steckt in der Skala: erst 0–100 mit allen Beschriftungen,
// später 0–10 000 nur mit Anfang und Ende, Strahlen, die nicht bei 0 beginnen, usw.

// Immer mit feiner Einteilung: Ziele liegen nie auf den beschrifteten großen Schwellen.
const TIERS: RailSpec[] = [
  { from: 0, to: 100, major: 10, minor: 1, labels: 'all' },
  { from: 0, to: 1000, major: 100, minor: 10, labels: 'all' },
  { from: 0, to: 10000, major: 1000, minor: 100, labels: 'ends+middle' },
  { from: 2000, to: 3000, major: 100, minor: 10, labels: 'ends' },
  { from: 0, to: 1000000, major: 100000, minor: 10000, labels: 'ends+middle' },
];

export class RailPuzzle extends PuzzleScene {
  protected title = 'Die Lorenbahn';
  protected skills: SkillId[] = ['Z6'];

  private rail!: Rail;
  private target = 0;
  private cart!: Phaser.GameObjects.Container;
  private cartValue = 0;

  constructor() {
    super('RailPuzzle');
  }

  protected buildRound(): void {
    const spec = { ...pickByLevel(getLevel('Z6'), TIERS) };
    // Bei den verschobenen Strahlen den Startpunkt würfeln (z. B. 4 000–5 000)
    if (spec.from !== 0) {
      const width = spec.to - spec.from;
      spec.from = randInt(1, 8) * width;
      spec.to = spec.from + width;
    }
    const step = spec.minor || spec.major;
    const steps = Math.round((spec.to - spec.from) / step);
    // nicht auf einer großen Schwelle (80, 3 000 …): Man soll die feinen Striche zählen
    do this.target = spec.from + randInt(1, steps - 1) * step;
    while (spec.minor && (this.target - spec.from) % spec.major === 0);
    const mode = randInt(0, 1) === 0 ? 'schieben' : 'ablesen';

    const r = this.round;
    this.rail = new Rail(this, r, spec);
    this.cart = drawCart(this);
    r.add(this.cart);

    this.hints = [
      'Schau auf die beschrifteten Schwellen. Wie viel ist der Abstand zwischen zwei großen Schwellen?',
      spec.minor
        ? `Zähle die kleinen Schwellen zwischen zwei großen. Jede kleine Schwelle ist ${formatNumber(spec.minor)} weiter.`
        : `Jede große Schwelle ist ${formatNumber(spec.major)} weiter als die vorige.`,
      `Von ${formatNumber(Math.floor(this.target / spec.major) * spec.major)} aus sind es noch ${formatNumber(
        this.target % spec.major,
      )} bis zum Ziel.`,
    ];

    if (mode === 'schieben') {
      r.add(text(this, GAME_WIDTH / 2, 100, `Schiebe die Lore genau zur ${formatNumber(this.target)}!`, 26, COLORS.text));
      r.add(text(this, GAME_WIDTH / 2, 132, 'Ziehe die Lore mit dem Finger oder der Maus.', 18, COLORS.muted));
      this.placeCart(spec.from);
      const hit = this.add
        .zone(this.rail.x0 - 30, this.rail.y - 80, this.rail.x1 - this.rail.x0 + 60, 120)
        .setOrigin(0)
        .setInteractive({ draggable: true, useHandCursor: true });
      const move = (p: Phaser.Input.Pointer) => this.placeCart(this.rail.snap(p.x));
      hit.on('pointerdown', move);
      hit.on('drag', move);
      r.add(hit);
      r.add(button(this, GAME_WIDTH / 2, 390, 'Bremse ziehen', () => this.checkPlace(), { width: 240, height: 54, size: 22 }));
    } else {
      r.add(text(this, GAME_WIDTH / 2, 100, 'Bei welcher Zahl steht die Lore?', 26, COLORS.text));
      this.placeCart(this.target);
      const pad = createNumpad(this, 790, 420, (n) => this.checkRead(n), 8);
      pad.container.setScale(0.62);
      r.add(pad.container);
    }
  }

  private placeCart(value: number): void {
    this.cartValue = value;
    this.cart.setPosition(this.rail.xOf(value), this.rail.y);
  }

  private checkPlace(): void {
    if (this.cartValue === this.target) {
      this.solved(`Punktgenau bei ${formatNumber(this.target)}!`);
    } else {
      const dir = this.cartValue < this.target ? 'weiter nach rechts' : 'weiter nach links';
      this.wrong(`Die Lore steht bei ${formatNumber(this.cartValue)}. Das Ziel liegt ${dir}.`);
    }
  }

  private checkRead(n: number): void {
    if (n === this.target) {
      this.solved(`Genau, ${formatNumber(this.target)}!`);
      return;
    }
    // Zeige, wo die eingegebene Zahl läge (falls auf der Schiene): Fehler sichtbar machen
    const { from, to } = this.rail.spec;
    if (n >= from && n <= to) {
      const x = this.rail.xOf(n);
      const marker = this.add.triangle(x, this.rail.y - 70, 0, 0, 16, 0, 8, 14, 0xf08a5d);
      this.round.add(marker);
      this.tweens.add({ targets: marker, alpha: 0, delay: 1500, duration: 600, onComplete: () => marker.destroy() });
      this.wrong(`${formatNumber(n)} wäre hier (Pfeil). Die Lore steht ${n < this.target ? 'weiter rechts' : 'weiter links'}.`);
    } else {
      this.wrong(`${formatNumber(n)} liegt gar nicht auf dieser Strecke. Sie geht von ${formatNumber(from)} bis ${formatNumber(to)}.`);
    }
  }
}
