import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';
import { SHAPES, drawAxes, drawShape, type ShapeDef } from './shapes';

// Rätsel „Die Siegel der Symmetrie“ (Symmetrie erkennen, R4).
//  - zaehlen:  Wie viele Symmetrieachsen hat dieses Siegel?
//  - finden:   Tippe alle achsensymmetrischen Siegel an.
//  - punkt:    Ist dieses Siegel punktsymmetrisch?
// Nach jeder Antwort werden die Achsen eingezeichnet, damit man sie sieht.

type Mode = 'zaehlen' | 'finden' | 'punkt';

const EASY = ['Quadrat', 'Rechteck', 'gleichschenklige Dreieck', 'Pfeil', 'Drachenviereck', 'unregelmäßige Dreieck', 'Trapez'];

export class SymmetryPuzzle extends PuzzleScene {
  protected title = 'Die Siegel der Symmetrie';
  protected skills: SkillId[] = ['R4'];

  private mode!: Mode;
  private shape!: ShapeDef;
  private choices: ShapeDef[] = [];
  private selected = new Set<number>();
  private axesLayer!: Phaser.GameObjects.Graphics;
  private choiceGraphics: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super('SymmetryPuzzle');
  }

  protected buildRound(): void {
    const level = getLevel('R4');
    this.mode = pickByLevel<Mode>(level, ['zaehlen', 'finden', 'zaehlen', 'finden', 'punkt']);
    const pool = level < 0.4 ? SHAPES.filter((s) => EASY.includes(s.name)) : SHAPES;
    this.selected.clear();
    this.choiceGraphics = [];
    const r = this.round;
    this.axesLayer = this.add.graphics().setDepth(3);
    r.add(this.axesLayer);

    this.hints = [
      'Eine Symmetrieachse teilt eine Figur so, dass beide Hälften genau aufeinanderpassen, wenn man sie faltet.',
      'Stell dir vor, du faltest die Figur entlang einer Linie. Passen alle Ecken aufeinander?',
      'Punktsymmetrisch heißt: Dreht man die Figur um eine halbe Drehung, sieht sie genauso aus.',
    ];

    if (this.mode === 'finden') {
      r.add(text(this, GAME_WIDTH / 2, 88, 'Tippe alle Siegel an, die achsensymmetrisch sind!', 22, COLORS.text));
      this.choices = Phaser.Utils.Array.Shuffle([...pool]).slice(0, 4);
      // mindestens eines ohne und eines mit Achse
      if (this.choices.every((c) => c.axes.length)) this.choices[3] = pool.find((s) => !s.axes.length) ?? this.choices[3];
      if (this.choices.every((c) => !c.axes.length)) this.choices[3] = pool.find((s) => s.axes.length) ?? this.choices[3];
      this.choices.forEach((s, i) => {
        const cx = 170 + i * 205;
        const g = this.add.graphics();
        drawShape(g, s, cx, 240, 58);
        this.choiceGraphics.push(g);
        const ring = this.add.graphics();
        const hit = this.add.zone(cx, 240, 180, 180).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          if (this.selected.has(i)) this.selected.delete(i);
          else this.selected.add(i);
          ring.clear();
          if (this.selected.has(i)) ring.lineStyle(4, COLORS.gold, 1).strokeRoundedRect(cx - 90, 150, 180, 180, 14);
        });
        r.add([g, ring, hit]);
      });
      r.add(button(this, GAME_WIDTH / 2, 390, 'Siegel prüfen', () => this.checkFind(), { width: 220, height: 54, size: 22 }));
      return;
    }

    this.shape = pool[randInt(0, pool.length - 1)];
    const g = this.add.graphics();
    drawShape(g, this.shape, 300, 250, 85);
    r.add(g);
    this.axesLayer.setDepth(4);

    if (this.mode === 'zaehlen') {
      r.add(text(this, GAME_WIDTH / 2, 88, 'Wie viele Symmetrieachsen hat dieses Siegel?', 22, COLORS.text));
      [0, 1, 2, 3, 4, 6].forEach((n, i) => {
        r.add(button(this, 640 + (i % 3) * 90, 200 + Math.floor(i / 3) * 80, String(n), () => this.checkCount(n), { width: 76, height: 64, size: 28 }));
      });
    } else {
      r.add(text(this, GAME_WIDTH / 2, 88, 'Ist dieses Siegel punktsymmetrisch?', 22, COLORS.text));
      r.add(text(this, 730, 170, 'Sieht es nach einer halben\nDrehung genauso aus?', 17, COLORS.muted).setAlign('center'));
      r.add(button(this, 660, 250, 'Ja', () => this.checkPoint(true), { width: 120, height: 60, size: 24 }));
      r.add(button(this, 800, 250, 'Nein', () => this.checkPoint(false), { width: 120, height: 60, size: 24 }));
      r.add(button(this, 730, 340, 'Drehen', () => this.spin(g), { width: 150, height: 50, size: 20 }));
    }
  }

  private spin(g: Phaser.GameObjects.Graphics): void {
    // halbe Drehung um den Mittelpunkt der Figur (300|250) als Anschauung
    const c = this.add.container(300, 250);
    g.setPosition(-300, -250);
    c.add(g);
    this.round.add(c);
    this.tweens.add({ targets: c, angle: 180, duration: 1200, ease: 'sine.inout', onComplete: () => {
      c.setAngle(0);
    } });
  }

  /** „das Rechteck“ bzw. „Das Rechteck“ am Satzanfang */
  private nom(capital: boolean): string {
    const a = this.shape.article;
    return `${capital ? a[0].toUpperCase() + a.slice(1) : a} ${this.shape.name}`;
  }

  private axesWord(n: number): string {
    return n === 0 ? 'keine Symmetrieachse' : n === 1 ? 'genau eine Symmetrieachse' : `${n} Symmetrieachsen`;
  }

  private checkCount(n: number): void {
    const correct = this.shape.axes.length;
    drawAxes(this.axesLayer, this.shape, 300, 250, 150);
    const Name = this.nom(true);
    if (n === correct) this.solved(`Richtig! ${Name} hat ${this.axesWord(correct)}.`);
    else {
      this.wrong(`${Name} hat ${this.axesWord(correct)}. Schau sie dir an!`);
      this.time.delayedCall(2200, () => this.axesLayer.clear());
    }
  }

  private checkFind(): void {
    const right = new Set(this.choices.map((c, i) => (c.axes.length ? i : -1)).filter((i) => i >= 0));
    this.choices.forEach((s, i) => drawAxes(this.axesLayer, s, 170 + i * 205, 240, 90));
    const ok = right.size === this.selected.size && [...right].every((i) => this.selected.has(i));
    if (ok) this.solved('Genau! Die goldenen Linien sind ihre Symmetrieachsen.');
    else {
      const missed = this.choices.filter((_c, i) => right.has(i) && !this.selected.has(i)).map((c) => c.name);
      const extra = this.choices.filter((_c, i) => !right.has(i) && this.selected.has(i)).map((c) => c.name);
      const parts = [];
      if (missed.length) parts.push(`übersehen: ${missed.join(', ')}`);
      if (extra.length) parts.push(`ohne Achse: ${extra.join(', ')}`);
      this.wrong(`Fast! ${parts.join('; ')}.`);
      this.time.delayedCall(2500, () => this.axesLayer.clear());
    }
  }

  private checkPoint(answer: boolean): void {
    const Name = this.nom(true);
    if (answer === this.shape.pointSymmetric) {
      this.solved(this.shape.pointSymmetric ? `Ja! ${Name} sieht nach einer halben Drehung gleich aus.` : `Richtig, ${this.nom(false)} ist nicht punktsymmetrisch.`);
    } else {
      this.wrong(`Tipp auf „Drehen“ und schau genau hin: ${Name} ist ${this.shape.pointSymmetric ? '' : 'nicht '}punktsymmetrisch.`);
    }
  }
}
