import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Spiegelwand“ (Achsenspiegelung, R13; Symmetrie, R4).
// Auf einer Seite der Spiegelachse leuchten Kacheln. Man tippt auf der anderen
// Seite die Kacheln an, die das Spiegelbild bilden. Die Achse ist erst senkrecht,
// dann waagerecht, dann schräg; die Figur liegt später auch nicht mehr direkt an der Achse.

type Axis = 'senkrecht' | 'waagerecht' | 'schraeg';

interface Tier {
  size: number;
  axis: Axis;
  cells: [number, number];
}

const TIERS: Tier[] = [
  { size: 6, axis: 'senkrecht', cells: [3, 4] },
  { size: 8, axis: 'senkrecht', cells: [4, 6] },
  { size: 8, axis: 'waagerecht', cells: [4, 6] },
  { size: 8, axis: 'waagerecht', cells: [6, 8] },
  { size: 8, axis: 'schraeg', cells: [4, 6] },
];

const key = (x: number, y: number) => `${x},${y}`;

export class MirrorWallPuzzle extends PuzzleScene {
  protected title = 'Die Spiegelwand';
  protected skills: SkillId[] = ['R13', 'R4'];

  private tier!: Tier;
  private source = new Set<string>();
  private target = new Set<string>();
  private chosen = new Set<string>();
  private cellViews = new Map<string, Phaser.GameObjects.Rectangle>();
  private cellSize = 40;
  private origin = { x: 0, y: 0 };

  constructor() {
    super('MirrorWallPuzzle');
  }

  /** Spiegelbild einer Zelle an der Achse der Stufe */
  private mirror(x: number, y: number): [number, number] {
    const n = this.tier.size;
    if (this.tier.axis === 'senkrecht') return [n - 1 - x, y];
    if (this.tier.axis === 'waagerecht') return [x, n - 1 - y];
    return [y, x]; // Diagonale von links oben nach rechts unten
  }

  /** Liegt die Zelle auf der Seite, auf der die Vorlage steht? */
  private onSourceSide(x: number, y: number): boolean {
    const n = this.tier.size;
    if (this.tier.axis === 'senkrecht') return x < n / 2;
    if (this.tier.axis === 'waagerecht') return y < n / 2;
    return x > y;
  }

  /** Abstand einer Zelle zur Achse in Kacheln (0 = liegt direkt an der Achse) */
  private axisGap(x: number, y: number): number {
    const n = this.tier.size;
    if (this.tier.axis === 'senkrecht') return n / 2 - 1 - x;
    if (this.tier.axis === 'waagerecht') return n / 2 - 1 - y;
    return x - y - 1;
  }

  /**
   * Zu leichte Figuren ausschließen: eine gerade Reihe (Spiegelbild nur „abschreiben“)
   * und ab Stufe 2 eine Figur, die ganz an der Achse klebt (dann muss man nicht abzählen).
   */
  private tooEasy(tierIndex: number): boolean {
    const cells = [...this.source].map((k) => k.split(',').map(Number) as [number, number]);
    const xs = new Set(cells.map(([x]) => x));
    const ys = new Set(cells.map(([, y]) => y));
    if (xs.size === 1 || ys.size === 1) return true;
    if (tierIndex >= 2 && cells.every(([x, y]) => this.axisGap(x, y) === 0)) return true;
    if (tierIndex >= 3 && cells.some(([x, y]) => this.axisGap(x, y) === 0)) return true;
    return false;
  }

  protected buildRound(): void {
    this.tier = pickByLevel(getLevel('R13'), TIERS);
    const n = this.tier.size;
    this.source.clear();
    this.target.clear();
    this.chosen.clear();
    this.cellViews.clear();

    // Zusammenhängende Figur auf der Vorlagenseite wachsen lassen
    const candidates: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (this.onSourceSide(x, y)) candidates.push([x, y]);
    const tierIndex = TIERS.indexOf(this.tier);
    for (let attempt = 0; attempt < 40; attempt++) {
      this.source.clear();
      const want = randInt(this.tier.cells[0], this.tier.cells[1]);
      let [sx, sy] = candidates[randInt(0, candidates.length - 1)];
      this.source.add(key(sx, sy));
      let guard = 0;
      while (this.source.size < want && guard++ < 200) {
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][randInt(0, 3)];
        const nx = sx + dx;
        const ny = sy + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || !this.onSourceSide(nx, ny)) continue;
        sx = nx;
        sy = ny;
        this.source.add(key(sx, sy));
      }
      if (!this.tooEasy(tierIndex)) break;
    }
    for (const k of this.source) {
      const [x, y] = k.split(',').map(Number);
      this.target.add(key(...this.mirror(x, y)));
    }

    const r = this.round;
    r.add(text(this, GAME_WIDTH / 2, 84, 'Ergänze das Spiegelbild! Tippe die Kacheln auf der anderen Seite der Achse an.', 20, COLORS.text));

    this.cellSize = n <= 6 ? 50 : 40;
    const cs = this.cellSize;
    this.origin = { x: GAME_WIDTH / 2 - (n * cs) / 2 - 60, y: 116 };
    const g = this.add.graphics();
    r.add(g);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = this.origin.x + x * cs;
        const py = this.origin.y + y * cs;
        const isSource = this.source.has(key(x, y));
        const rect = this.add
          .rectangle(px + cs / 2, py + cs / 2, cs - 3, cs - 3, isSource ? 0x7fd4ff : 0x2a3844)
          .setStrokeStyle(1, 0x3c5566);
        r.add(rect);
        this.cellViews.set(key(x, y), rect);
        if (!isSource && !this.onSourceSide(x, y)) {
          rect.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggle(x, y));
        }
      }
    }
    // Spiegelachse
    g.lineStyle(4, COLORS.gold, 1);
    const L = n * cs;
    const { x: ox, y: oy } = this.origin;
    if (this.tier.axis === 'senkrecht') g.lineBetween(ox + L / 2, oy - 10, ox + L / 2, oy + L + 10);
    else if (this.tier.axis === 'waagerecht') g.lineBetween(ox - 10, oy + L / 2, ox + L + 10, oy + L / 2);
    else g.lineBetween(ox - 8, oy - 8, ox + L + 8, oy + L + 8);
    g.setDepth(2);

    r.add(button(this, 800, 300, 'Spiegeln!', () => this.check(), { width: 180, height: 56, size: 22 }));

    this.hints = [
      'Jede Kachel hat ein Spiegelbild, das genau gleich weit von der Achse entfernt ist, nur auf der anderen Seite.',
      this.tier.axis === 'schraeg'
        ? 'Bei der schrägen Achse tauschen Zeile und Spalte die Rollen: Die Kachel in Zeile 2, Spalte 5 landet in Zeile 5, Spalte 2.'
        : 'Zähle die Kästchen von der Achse bis zur leuchtenden Kachel. Genauso viele zählst du auf der anderen Seite ab.',
      'Nimm dir eine Kachel nach der anderen vor und hake sie im Kopf ab.',
    ];
  }

  private toggle(x: number, y: number): void {
    const k = key(x, y);
    if (this.chosen.has(k)) this.chosen.delete(k);
    else this.chosen.add(k);
    this.cellViews.get(k)?.setFillStyle(this.chosen.has(k) ? 0xf0d78a : 0x2a3844);
  }

  private check(): void {
    const missing = [...this.target].filter((k) => !this.chosen.has(k));
    const extra = [...this.chosen].filter((k) => !this.target.has(k));
    if (!missing.length && !extra.length) {
      for (const k of this.target) this.cellViews.get(k)?.setFillStyle(0x7fd4ff);
      this.solved('Perfekt gespiegelt! Die Wand leuchtet auf.');
      return;
    }
    // Fehler sichtbar machen: falsche Kacheln rot, fehlende kurz aufblitzen (ab Hinweis 2)
    for (const k of extra) this.cellViews.get(k)?.setFillStyle(0xc0504a);
    this.time.delayedCall(900, () => {
      for (const k of extra) if (this.chosen.has(k)) this.cellViews.get(k)?.setFillStyle(0xf0d78a);
    });
    const parts = [];
    if (extra.length) parts.push(`${extra.length} ${extra.length === 1 ? 'Kachel ist' : 'Kacheln sind'} zu viel (rot)`);
    if (missing.length) parts.push(`${missing.length} ${missing.length === 1 ? 'fehlt' : 'fehlen'} noch`);
    this.wrong(`Noch nicht ganz: ${parts.join(', ')}.`);
  }
}
