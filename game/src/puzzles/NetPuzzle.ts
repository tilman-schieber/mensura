import Phaser from 'phaser';
import { isCubeNet, oppositeOf, randomNet, type Cell } from '../learn/cubeNets';
import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Der Faltstab“ (Würfelnetze, R14/R15).
//  - pruefen:     Lässt sich dieses Netz zu einem Würfel falten? (Ja/Nein)
//  - finden:      Tippe alle Würfelnetze an.
//  - gegenueber:  Welche Fläche liegt gegenüber vom Stern?
// Ob ein Netz passt, entscheidet learn/cubeNets.ts (Würfel über das Netz rollen).

type Mode = 'pruefen' | 'finden' | 'gegenueber';

export class NetPuzzle extends PuzzleScene {
  protected title = 'Der Faltstab';
  protected skills: SkillId[] = ['R14'];

  private nets: Cell[][] = [];
  private selected = new Set<number>();

  constructor() {
    super('NetPuzzle');
  }

  /** Zeichnet ein Netz; gibt pro Quadrat die Mittelpunkte zurück. */
  private drawNet(net: Cell[], cx: number, cy: number, size: number, fill = 0xd8c7a0): [number, number][] {
    const w = Math.max(...net.map((c) => c[0])) + 1;
    const h = Math.max(...net.map((c) => c[1])) + 1;
    const ox = cx - (w * size) / 2;
    const oy = cy - (h * size) / 2;
    const g = this.add.graphics();
    const centers: [number, number][] = [];
    for (const [x, y] of net) {
      g.fillStyle(fill, 1).fillRect(ox + x * size, oy + y * size, size, size);
      g.lineStyle(2, 0x5a4a30, 1).strokeRect(ox + x * size, oy + y * size, size, size);
      centers.push([ox + (x + 0.5) * size, oy + (y + 0.5) * size]);
    }
    this.round.add(g);
    return centers;
  }

  protected buildRound(): void {
    const mode = pickByLevel<Mode>(getLevel('R14'), ['pruefen', 'finden', 'gegenueber', 'finden', 'gegenueber']);
    this.selected.clear();
    const r = this.round;
    this.hints = [
      'Stell dir vor, du faltest: Ein Quadrat ist der Boden, die anderen klappen hoch.',
      'Ein Würfel hat 6 Flächen. Liegen mehr als 4 Quadrate in einer Reihe, überlappen sie sich beim Falten.',
      'Gegenüberliegende Flächen berühren sich im Netz nie. In einer Reihe aus drei liegen die äußeren gegenüber.',
    ];

    if (mode === 'pruefen') {
      const valid = randInt(0, 1) === 1;
      const net = randomNet(valid);
      r.add(text(this, GAME_WIDTH / 2, 88, 'Lässt sich dieses Netz zu einem Würfel falten?', 22, COLORS.text));
      this.drawNet(net, 300, 280, 56);
      r.add(button(this, 700, 230, 'Ja', () => this.answerYesNo(valid, true), { width: 150, height: 60, size: 24 }));
      r.add(button(this, 700, 310, 'Nein', () => this.answerYesNo(valid, false), { width: 150, height: 60, size: 24 }));
      return;
    }

    if (mode === 'finden') {
      r.add(text(this, GAME_WIDTH / 2, 88, 'Tippe alle Netze an, die sich zu einem Würfel falten lassen!', 22, COLORS.text));
      const validCount = randInt(1, 3);
      // Vier verschiedene Netze: zweimal dasselbe Netz nebeneinander wäre geschenkt
      const seen = new Set<string>();
      const shape = (net: Cell[]) => net.map((c) => c.join(',')).sort().join(';');
      const fresh = (valid: boolean) => {
        let net = randomNet(valid);
        for (let i = 0; i < 20 && seen.has(shape(net)); i++) net = randomNet(valid);
        seen.add(shape(net));
        return net;
      };
      this.nets = Phaser.Utils.Array.Shuffle([
        ...Array.from({ length: validCount }, () => fresh(true)),
        ...Array.from({ length: 4 - validCount }, () => fresh(false)),
      ]);
      this.nets.forEach((net, i) => {
        const cx = 140 + i * 205;
        this.drawNet(net, cx, 250, 28);
        const ring = this.add.graphics();
        const hit = this.add.zone(cx, 250, 190, 190).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          if (this.selected.has(i)) this.selected.delete(i);
          else this.selected.add(i);
          ring.clear();
          if (this.selected.has(i)) ring.lineStyle(4, COLORS.gold, 1).strokeRoundedRect(cx - 95, 155, 190, 190, 12);
        });
        r.add([ring, hit]);
      });
      r.add(button(this, 820, 470, 'Falten!', () => this.checkFind(), { width: 170, height: 50, size: 22 }));
      return;
    }

    // gegenueber
    const net = randomNet(true);
    const star = randInt(0, 5);
    const target = oppositeOf(net, star);
    r.add(text(this, GAME_WIDTH / 2, 88, 'Welche Fläche liegt beim fertigen Würfel gegenüber vom Stern?', 22, COLORS.text));
    const centers = this.drawNet(net, 330, 280, 62);
    centers.forEach(([x, y], i) => {
      if (i === star) {
        r.add(this.add.star(x, y, 5, 8, 18, 0xf0d78a).setStrokeStyle(2, 0x5a4a30));
        return;
      }
      const hit = this.add.zone(x, y, 60, 60).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        const mark = this.add.circle(x, y, 14, i === target ? 0x7fd4ff : 0xc0504a);
        r.add(mark);
        if (i === target) this.solved('Genau! Diese beiden Flächen liegen sich gegenüber.');
        else {
          this.wrong('Diese Fläche wird beim Falten ein Nachbar vom Stern, nicht sein Gegenüber.');
          this.time.delayedCall(900, () => mark.destroy());
        }
      });
      r.add(hit);
    });
  }

  private answerYesNo(valid: boolean, said: boolean): void {
    if (valid === said) this.solved(valid ? 'Richtig, daraus wird ein Würfel!' : 'Richtig, beim Falten würden sich Flächen überlappen.');
    else this.wrong(valid ? 'Doch! Probier es im Kopf: Dieses Netz lässt sich falten.' : 'Leider nicht: Beim Falten landen zwei Quadrate auf derselben Seite.');
  }

  private checkFind(): void {
    const right = new Set(this.nets.map((n, i) => (isCubeNet(n) ? i : -1)).filter((i) => i >= 0));
    const ok = right.size === this.selected.size && [...right].every((i) => this.selected.has(i));
    if (ok) this.solved(`Richtig! ${right.size === 1 ? 'Nur dieses Netz' : `Diese ${right.size} Netze`} ergeben einen Würfel.`);
    else this.wrong(`Noch nicht ganz. Es ${right.size === 1 ? 'ist genau ein Würfelnetz' : `sind ${right.size} Würfelnetze`} dabei.`);
  }
}
