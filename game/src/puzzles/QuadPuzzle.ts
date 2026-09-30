import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';
import { drawShape, shapeByName } from './shapes';

// Rätsel „Das Haus der Vierecke“ (Vierecke und ihre Eigenschaften, R6).
// Die Hierarchie der Vierecke als Schlüssel-und-Schloss-Regel: Ein Schlüssel öffnet
// jedes Schloss, dessen Viereck er „auch ist“. Ein Quadrat ist auch ein Rechteck,
// eine Raute, ein Parallelogramm, ein Trapez und ein Drachenviereck.
//  - benennen:     Wie heißt dieses Viereck?
//  - eigenschaft:  Welche Vierecke haben … ?
//  - schluessel:   Welche Schlösser öffnet dieser Schlüssel?
//  - schloss:      Welche Schlüssel passen in dieses Schloss?

const QUADS = ['Quadrat', 'Rechteck', 'Raute', 'Parallelogramm', 'Trapez', 'Drachenviereck'] as const;
type Quad = (typeof QUADS)[number];

/** Was ein Viereck „auch ist“ (einschließlich sich selbst) */
const IS_A: Record<Quad, Quad[]> = {
  Quadrat: ['Quadrat', 'Rechteck', 'Raute', 'Parallelogramm', 'Trapez', 'Drachenviereck'],
  Rechteck: ['Rechteck', 'Parallelogramm', 'Trapez'],
  Raute: ['Raute', 'Parallelogramm', 'Trapez', 'Drachenviereck'],
  Parallelogramm: ['Parallelogramm', 'Trapez'],
  Trapez: ['Trapez'],
  Drachenviereck: ['Drachenviereck'],
};

/** „ein Quadrat“, „eine Raute“ */
const A = (q: Quad) => (q === 'Raute' ? 'eine' : 'ein') + ' ' + q;
/** Bestimmungswort in Zusammensetzungen: Rauten-Schlüssel */
const C = (q: Quad) => (q === 'Raute' ? 'Rauten' : q);

const PROPERTIES: { text: string; has: Quad[] }[] = [
  { text: 'vier rechte Winkel', has: ['Quadrat', 'Rechteck'] },
  { text: 'vier gleich lange Seiten', has: ['Quadrat', 'Raute'] },
  { text: 'zwei Paare paralleler Seiten', has: ['Quadrat', 'Rechteck', 'Raute', 'Parallelogramm'] },
  { text: 'senkrecht aufeinander stehende Diagonalen', has: ['Quadrat', 'Raute', 'Drachenviereck'] },
];

type Mode = 'benennen' | 'eigenschaft' | 'schluessel' | 'schloss';

export class QuadPuzzle extends PuzzleScene {
  protected title = 'Das Haus der Vierecke';
  protected skills: SkillId[] = ['R6'];

  private correct = new Set<Quad>();
  private selected = new Set<Quad>();
  private explain = '';

  constructor() {
    super('QuadPuzzle');
  }

  protected buildRound(): void {
    const mode = pickByLevel<Mode>(getLevel('R6'), ['benennen', 'eigenschaft', 'schluessel', 'schloss']);
    this.selected.clear();
    this.correct.clear();
    const r = this.round;
    this.hints = [
      'Ein Quadrat ist ein ganz besonderes Rechteck: Es hat vier rechte Winkel UND vier gleich lange Seiten.',
      'Rechteck, Raute und Quadrat sind alle auch Parallelogramme: Ihre gegenüberliegenden Seiten sind parallel.',
      'Ein Trapez braucht nur ein Paar paralleler Seiten. Darum ist jedes Parallelogramm auch ein Trapez.',
    ];

    if (mode === 'benennen') {
      const q = QUADS[randInt(0, QUADS.length - 1)];
      const g = this.add.graphics();
      drawShape(g, shapeByName(q), 300, 250, 90);
      r.add(g);
      r.add(text(this, GAME_WIDTH / 2, 88, 'Wie heißt dieses Viereck ganz genau?', 22, COLORS.text));
      const options = Phaser.Utils.Array.Shuffle(QUADS.filter((x) => x !== q)).slice(0, 3);
      Phaser.Utils.Array.Shuffle([q, ...options]).forEach((name, i) => {
        r.add(button(this, 720, 160 + i * 70, name, () => {
          if (name === q) this.solved(`Richtig, ${A(q)}!`);
          else this.wrong(`Das ist ${name === 'Raute' ? 'keine' : 'kein'} ${name}. Schau auf Winkel, Seitenlängen und parallele Seiten.`);
        }, { width: 240, height: 56, size: 20 }));
      });
      return;
    }

    let prompt = '';
    if (mode === 'eigenschaft') {
      const p = PROPERTIES[randInt(0, PROPERTIES.length - 1)];
      p.has.forEach((q) => this.correct.add(q));
      prompt = `Welche Vierecke haben ${p.text}?`;
      this.explain = `${p.text[0].toUpperCase()}${p.text.slice(1)} haben: ${p.has.join(', ')}.`;
    } else if (mode === 'schluessel') {
      const key = QUADS[randInt(0, 3)]; // Quadrat, Rechteck, Raute oder Parallelogramm
      IS_A[key].forEach((q) => this.correct.add(q));
      prompt = `Der ${C(key)}-Schlüssel: Welche Schlösser öffnet er?`;
      this.explain = `${A(key)[0].toUpperCase()}${A(key).slice(1)} ist auch: ${IS_A[key].filter((q) => q !== key).join(', ') || 'nichts anderes'}.`;
      const g = this.add.graphics();
      drawShape(g, shapeByName(key), 120, 150, 34, 0xf0d78a);
      r.add(g);
    } else {
      const lock = (['Parallelogramm', 'Trapez', 'Drachenviereck', 'Raute', 'Rechteck'] as Quad[])[randInt(0, 4)];
      QUADS.filter((q) => IS_A[q].includes(lock)).forEach((q) => this.correct.add(q));
      prompt = `Das ${C(lock)}-Schloss: Welche Schlüssel passen hinein?`;
      this.explain = `Hinein passen alle, die auch ${A(lock)} sind: ${[...this.correct].join(', ')}.`;
    }
    r.add(text(this, GAME_WIDTH / 2, 88, prompt, 22, COLORS.text));
    r.add(text(this, GAME_WIDTH / 2, 114, 'Tippe alle passenden an.', 16, COLORS.muted));

    // Sechs Vierecke zur Auswahl, je mit Namen
    QUADS.forEach((q, i) => {
      const cx = 160 + (i % 3) * 250;
      const cy = 190 + Math.floor(i / 3) * 140;
      const g = this.add.graphics();
      drawShape(g, shapeByName(q), cx - 50, cy, 26);
      const t = text(this, cx + 30, cy, q, 18, COLORS.text).setOrigin(0, 0.5);
      const ring = this.add.graphics();
      const hit = this.add.zone(cx + 20, cy, 220, 110).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (this.selected.has(q)) this.selected.delete(q);
        else this.selected.add(q);
        ring.clear();
        if (this.selected.has(q)) ring.lineStyle(4, COLORS.gold, 1).strokeRoundedRect(cx - 90, cy - 52, 220, 104, 12);
      });
      r.add([g, t, ring, hit]);
    });
    r.add(button(this, 820, 480, 'Prüfen', () => this.checkMulti(), { width: 180, height: 50, size: 22 }));
  }

  private checkMulti(): void {
    const ok = this.correct.size === this.selected.size && [...this.correct].every((q) => this.selected.has(q));
    if (ok) this.solved(`Richtig! ${this.explain}`);
    else this.wrong(`Noch nicht ganz. ${this.hintsUsed >= 2 ? this.explain : 'Denk daran: Besondere Vierecke gehören oft auch zu allgemeineren.'}`);
  }
}
