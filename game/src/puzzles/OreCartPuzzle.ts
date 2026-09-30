import Phaser from 'phaser';
import { digitsOf, formatNumber, interestingNumber, numberToWords, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { BLOCK_NAMES, BLOCK_VALUES, blockKey, makeBlockTextures, type BlockValue } from './blocks';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Erzloren“ (Stellenwertsystem, Z1/Z2).
//
// Drei Spielarten, je nach Können:
//  - laden:       Brom bestellt eine Erzmenge, man lädt die passenden Blöcke in die Lore.
//                 Später als Zahlwort bestellt („zweitausenddreihundertfünf“).
//  - entbündeln:  Wie laden, aber im Lager fehlen Sorten. Mit dem Spalthammer macht man
//                 aus 1 Tausender 10 Hunderter usw.
//  - bündeln:     Ein unordentlicher Haufen (z. B. 14 Einer) liegt in der Lore. Man presst
//                 je 10 zu einem größeren Block und liest dann ab, wie viel Erz es ist.

type Mode = 'laden' | 'entbuendeln' | 'buendeln';

interface Task {
  mode: Mode;
  target: number;
  asWords: boolean;
  /** Vorrat im Lager (Infinity = unbegrenzt) */
  supply: Record<BlockValue, number>;
  /** Startinhalt der Lore */
  start: Record<BlockValue, number>;
}

const EMPTY = (): Record<BlockValue, number> => ({ 1000: 0, 100: 0, 10: 0, 1: 0 });
const ALL = (): Record<BlockValue, number> => ({ 1000: Infinity, 100: Infinity, 10: Infinity, 1: Infinity });

const valueOf = (c: Record<BlockValue, number>) => BLOCK_VALUES.reduce((sum, v) => sum + v * c[v], 0);

function makeTask(level: number): Task {
  const tier = pickByLevel(level, [0, 1, 2, 3, 4]);
  if (tier === 0) return { mode: 'laden', target: interestingNumber(3), asWords: false, supply: ALL(), start: EMPTY() };
  if (tier === 1) return { mode: 'laden', target: interestingNumber(4), asWords: false, supply: ALL(), start: EMPTY() };
  if (tier === 2) return { mode: 'laden', target: interestingNumber(4), asWords: true, supply: ALL(), start: EMPTY() };
  if (tier === 3) {
    // Bündeln: 1–2 Sorten mit 10–19 Stück
    const start = EMPTY();
    start[1] = randInt(10, 19);
    start[10] = randInt(0, 1) ? randInt(10, 16) : randInt(1, 8);
    start[100] = randInt(0, 6);
    return { mode: 'buendeln', target: valueOf(start), asWords: false, supply: EMPTY(), start };
  }
  // Entbündeln: es gibt nur Tausender, die Bestellung braucht kleinere Blöcke
  const target = interestingNumber(4) % 3000 || 1250;
  const supply = EMPTY();
  supply[1000] = Math.floor(target / 1000) + 1;
  return { mode: 'entbuendeln', target, asWords: randInt(0, 1) === 1, supply, start: EMPTY() };
}

export class OreCartPuzzle extends PuzzleScene {
  protected title = 'Die Erzloren';
  protected skills: SkillId[] = ['Z1'];

  private task!: Task;
  private cart = EMPTY();
  private stock = ALL();
  private hammer = false;
  private cartViews: Phaser.GameObjects.Container[] = [];
  private stockLabels: Partial<Record<BlockValue, Phaser.GameObjects.Text>> = {};
  private hammerButton?: Phaser.GameObjects.Container;
  private chart?: Phaser.GameObjects.Container;

  constructor() {
    super('OreCartPuzzle');
  }

  create(): void {
    makeBlockTextures(this);
    super.create();
  }

  protected buildRound(): void {
    this.task = makeTask(getLevel('Z1'));
    this.skills = this.task.asWords ? ['Z1', 'Z2'] : ['Z1'];
    this.cart = { ...this.task.start };
    this.stock = { ...this.task.supply };
    this.hammer = false;
    this.cartViews = [];
    this.stockLabels = {};
    this.chart = undefined;
    const t = this.task;
    const r = this.round;

    // Auftrag
    const order = t.asWords ? `„${numberToWords(t.target)}“` : formatNumber(t.target);
    const prompt =
      t.mode === 'buendeln'
        ? 'Die Lore ist unordentlich beladen. Presse je 10 gleiche Blöcke zu einem großen.\nDann lies ab: Wie viel Erz ist in der Lore?'
        : `Brom braucht genau ${order} Erz. Lade die Lore!`;
    r.add(text(this, GAME_WIDTH / 2, 92, prompt, t.asWords ? 22 : 24, COLORS.text).setAlign('center'));

    // Lore: vier Spalten T H Z E
    const g = this.add.graphics();
    g.fillStyle(0x3a2616, 1).fillRoundedRect(60, 140, 560, 250, 10);
    g.lineStyle(4, 0x1e130a, 1).strokeRoundedRect(60, 140, 560, 250, 10);
    r.add(g);
    BLOCK_VALUES.forEach((v, i) => {
      const cx = 130 + i * 140;
      r.add(text(this, cx, 158, BLOCK_NAMES[v], 18, COLORS.muted));
      const col = this.add.container(cx, 0);
      this.cartViews.push(col);
      r.add(col);
    });

    // Lager rechts
    if (t.mode !== 'buendeln') {
      r.add(text(this, 790, 130, 'Lager', 20, COLORS.muted));
      BLOCK_VALUES.forEach((v, i) => {
        const y = 175 + i * 62;
        const icon = this.add.image(690, y, blockKey(v)).setScale(v === 1 ? 3 : 1);
        const b = button(this, 810, y, `+ ${BLOCK_NAMES[v]}`, () => this.take(v), { width: 170, height: 50, size: 18 });
        const lbl = text(this, 910, y, '', 16, COLORS.muted);
        this.stockLabels[v] = lbl;
        r.add([icon, b, lbl]);
      });
      if (t.mode === 'entbuendeln') {
        this.hammerButton = button(this, 790, 425, 'Spalthammer', () => this.toggleHammer(), { width: 200, height: 50, size: 20 });
        r.add(this.hammerButton);
      }
      r.add(button(this, 340, 430, 'Lore abschicken', () => this.check(), { width: 240, height: 54, size: 22 }));
    } else {
      // Bündeln: Pressen-Knöpfe unter den Spalten, Zahleingabe rechts
      [1, 10, 100].forEach((v, i) => {
        const cx = 130 + (3 - i) * 140;
        r.add(button(this, cx - 70, 415, `10 → 1`, () => this.bundle(v as BlockValue), { width: 96, height: 46, size: 18 }));
      });
      const pad = createNumpad(this, 790, 300, (n) => this.checkBundle(n), 6);
      pad.container.setScale(0.85);
      r.add(pad.container);
    }

    const [e, z, h, th] = digitsOf(t.target);
    this.hints =
      t.mode === 'buendeln'
        ? [
            '10 Einer ergeben 1 Zehner. Drück die Presse unter den Einern.',
            'Wenn jede Sorte höchstens 9 Blöcke hat, kannst du die Zahl direkt ablesen.',
            'Zähle Spalte für Spalte: Tausender, Hunderter, Zehner, Einer.',
          ]
        : [
            `Zerlege die Zahl: Wie viele Tausender, Hunderter, Zehner und Einer stecken in ${formatNumber(t.target)}?`,
            'Die Stellenwerttafel zeigt dir, wie viele Blöcke von jeder Sorte du brauchst.',
            `${formatNumber(t.target)} = ${th} Tausender + ${h} Hunderter + ${z} Zehner + ${e} Einer`,
          ];
    if (t.mode === 'entbuendeln') {
      this.hints.splice(1, 0, 'Im Lager gibt es nur Tausender. Tipp mit dem Spalthammer auf einen Block in der Lore: aus 1 Tausender werden 10 Hunderter.');
    }
    this.refresh();
  }

  protected onHint(level: number): void {
    // Stufe 2: Stellenwerttafel mit der Zielzahl einblenden
    if (this.task.mode !== 'buendeln' && this.hints[level]?.startsWith('Die Stellenwerttafel')) this.showChart();
  }

  private showChart(): void {
    if (this.chart) return;
    const [e, z, h, th] = digitsOf(this.task.target);
    const c = this.add.container(340, 490);
    const g = this.add.graphics();
    g.fillStyle(0x0b1117, 1).fillRoundedRect(-150, -26, 300, 52, 6);
    c.add(g);
    ['T', 'H', 'Z', 'E'].forEach((p, i) => {
      c.add(text(this, -105 + i * 70, -12, p, 16, COLORS.muted));
      c.add(text(this, -105 + i * 70, 10, String([th, h, z, e][i]), 22, COLORS.goldText));
    });
    this.chart = c;
    this.round.add(c);
  }

  private take(v: BlockValue): void {
    if (this.stock[v] <= 0) {
      this.showOwl(`Keine ${BLOCK_NAMES[v]} mehr im Lager.${this.task.mode === 'entbuendeln' ? ' Vielleicht hilft der Spalthammer?' : ''}`);
      return;
    }
    if (this.stock[v] !== Infinity) this.stock[v] -= 1;
    this.cart[v] += 1;
    this.refresh();
  }

  private toggleHammer(): void {
    this.hammer = !this.hammer;
    this.showOwl(this.hammer ? 'Spalthammer bereit: Tipp auf einen Block in der Lore.' : '');
    this.refresh();
  }

  /** Tipp auf einen Block in der Lore: entfernen, oder mit dem Hammer spalten. */
  private tapCart(v: BlockValue): void {
    if (this.cart[v] <= 0) return;
    if (this.hammer) {
      if (v === 1) {
        this.showOwl('Einen Einer kann man nicht weiter spalten.');
        return;
      }
      this.cart[v] -= 1;
      this.cart[(v / 10) as BlockValue] += 10;
      this.cameras.main.shake(80, 0.003);
    } else if (this.task.mode !== 'buendeln') {
      this.cart[v] -= 1;
      if (this.stock[v] !== Infinity) this.stock[v] += 1;
    }
    this.refresh();
  }

  private bundle(v: BlockValue): void {
    if (this.cart[v] < 10) {
      this.showOwl(`Für die Presse brauchst du 10 ${BLOCK_NAMES[v]}. Es sind nur ${this.cart[v]}.`);
      return;
    }
    this.cart[v] -= 10;
    this.cart[(v * 10) as BlockValue] += 1;
    this.refresh();
  }

  private refresh(): void {
    BLOCK_VALUES.forEach((v, i) => {
      const col = this.cartViews[i];
      col.removeAll(true);
      const n = this.cart[v];
      const shown = Math.min(n, 9);
      for (let k = 0; k < shown; k++) {
        const img = this.add.image(0, 0, blockKey(v)).setScale(v === 1 ? 3 : v === 1000 ? 1 : 2);
        // Einer im 3er-Raster, Zehner nebeneinander, Platten und Würfel versetzt gestapelt
        if (v === 1) img.setPosition(((k % 3) - 1) * 22, 225 + Math.floor(k / 3) * 22);
        else if (v === 10) img.setPosition((k - (shown - 1) / 2) * 13, 262);
        else if (v === 100) img.setPosition(-12 + k * 3, 300 - k * 9);
        else img.setPosition(-16 + k * 4, 320 - k * 14);
        img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tapCart(v));
        col.add(img);
      }
      const more = n > 9 ? `${n} Stück` : String(n);
      col.add(text(this, 0, 370, more, n > 9 ? 22 : 26, n > 9 ? '#f08a5d' : COLORS.text));
      // Größere Trefferfläche für die ganze Spalte
      const hit = this.add.zone(0, 270, 120, 200).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.tapCart(v));
      col.addAt(hit, 0);
      const lbl = this.stockLabels[v];
      if (lbl) lbl.setText(this.stock[v] === Infinity ? '' : `(${this.stock[v]})`);
    });
    if (this.hammerButton) this.hammerButton.setAlpha(this.hammer ? 1 : 0.75);
  }

  private check(): void {
    const loaded = valueOf(this.cart);
    const target = this.task.target;
    if (loaded === target) {
      this.solved(`Genau ${formatNumber(target)}! Brom nickt zufrieden.`);
      return;
    }
    const diff = loaded > target ? 'zu viel' : 'zu wenig';
    this.wrong(`In der Lore sind ${formatNumber(loaded)}. Das ist ${formatNumber(Math.abs(loaded - target))} ${diff}.`);
  }

  private checkBundle(n: number): void {
    const tidy = BLOCK_VALUES.every((v) => this.cart[v] <= 9);
    if (n === this.task.target) {
      this.solved(tidy ? `Genau: ${formatNumber(n)}!` : `Richtig, ${formatNumber(n)}! Mit der Presse wäre das Ablesen noch leichter.`);
      return;
    }
    this.wrong(tidy ? 'Lies Spalte für Spalte ab: Tausender, Hunderter, Zehner, Einer.' : 'Presse erst, bis keine Sorte mehr als 9 Blöcke hat.');
  }
}
