import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Der Zahlenautomat“ (Unbekannte durch Rückwärtsrechnen finden, Z27).
// Das alte Tor unter dem Rechenwerk will eine Zahl. Man sieht nur, was der Automat mit
// ihr macht (·2, +7 …) und was am Ende herauskommen muss. Wer falsch rät, sieht, was aus
// seiner Zahl wird: Die Welt zeigt, um wie viel es daneben war.

type Sym = '+' | '−' | '·' | ':';

interface Gear {
  sym: Sym;
  k: number;
}

const apply = (x: number, g: Gear) => (g.sym === '+' ? x + g.k : g.sym === '−' ? x - g.k : g.sym === '·' ? x * g.k : x / g.k);
const undo: Record<Sym, string> = { '+': '−', '−': '+', '·': ':', ':': '·' };

function makeGears(level: number): { start: number; gears: Gear[] } {
  const tier = pickByLevel(level, [0, 1, 2, 3]);
  const count = tier === 0 ? 1 : tier === 3 ? 3 : 2;
  const allowed: Sym[] = tier === 0 ? ['+', '−'] : tier === 1 ? ['+', '−', '·'] : ['+', '−', '·', ':'];
  for (;;) {
    const start = randInt(3, 30);
    let x = start;
    const gears: Gear[] = [];
    for (let i = 0; i < count; i++) {
      const sym = allowed[randInt(0, allowed.length - 1)];
      let k: number;
      if (sym === '+') k = randInt(3, 25);
      else if (sym === '−') k = randInt(2, Math.max(2, Math.min(20, x - 1)));
      else if (sym === '·') k = randInt(2, 5);
      else {
        const divs = [2, 3, 4, 5].filter((d) => x % d === 0);
        if (!divs.length) continue;
        k = divs[randInt(0, divs.length - 1)];
      }
      if (sym === '−' && x - k < 1) continue;
      gears.push({ sym, k });
      x = apply(x, { sym, k });
    }
    if (gears.length === count && x <= 400) return { start, gears };
  }
}

export class AutomatonPuzzle extends PuzzleScene {
  protected title = 'Der Zahlenautomat';
  protected skills: SkillId[] = ['Z27'];

  private start = 0;
  private gears: Gear[] = [];
  private trace: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('AutomatonPuzzle');
  }

  protected buildRound(): void {
    const { start, gears } = makeGears(getLevel('Z27'));
    this.start = start;
    this.gears = gears;
    const target = gears.reduce(apply, start);
    const r = this.round;
    r.add(text(this, GAME_WIDTH / 2, 88, 'Welche Zahl musst du in den Automaten werfen?', 22, COLORS.text));

    // Kette: [ ? ] → (·2) → (+7) → [31]
    const n = gears.length + 2;
    const step = Math.min(150, 500 / (n - 1));
    const x0 = 330 - ((n - 1) * step) / 2;
    const y = 220;
    const g = this.add.graphics();
    r.add(g);
    this.trace = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step;
      if (i > 0) {
        g.lineStyle(4, 0xb88a3a, 1).lineBetween(x - step + 40, y, x - 44, y);
        g.fillStyle(0xb88a3a, 1).fillTriangle(x - 44, y - 8, x - 44, y + 8, x - 34, y);
      }
      if (i === 0 || i === n - 1) {
        g.fillStyle(0x0b1117, 1).fillRoundedRect(x - 40, y - 30, 80, 60, 8);
        g.lineStyle(3, i === 0 ? COLORS.gold : 0x5ab0e0, 1).strokeRoundedRect(x - 40, y - 30, 80, 60, 8);
        r.add(text(this, x, y, i === 0 ? '?' : formatNumber(target), 28, i === 0 ? COLORS.goldText : '#bfe6ff'));
      } else {
        const gear = gears[i - 1];
        g.fillStyle(0x3a2c14, 1).fillCircle(x, y, 34);
        g.lineStyle(3, 0xd9b25f, 1).strokeCircle(x, y, 34);
        for (let t = 0; t < 8; t++) {
          const a = (t / 8) * Math.PI * 2;
          g.fillStyle(0xd9b25f, 1).fillCircle(x + Math.cos(a) * 38, y + Math.sin(a) * 38, 5);
        }
        r.add(text(this, x, y, `${gear.sym}${gear.k}`, 24, COLORS.text));
      }
      // Hier erscheint, was aus einer falschen Zahl wird
      const tr = text(this, x, y + 56, '', 18, '#f0a090');
      this.trace.push(tr);
      r.add(tr);
    }

    const pad = createNumpad(this, 770, 300, (v) => {
      pad.clear();
      this.check(v, target);
    }, 4);
    r.add(pad.container);

    const last = gears[gears.length - 1];
    this.hints = [
      'Rechne rückwärts: Fang beim Ergebnis an und geh die Zahnräder von hinten nach vorn durch.',
      'Rückwärts wird jeder Schritt umgekehrt: aus + wird −, aus · wird :.',
      `Der letzte Schritt war ${last.sym}${last.k}. Rückwärts: ${formatNumber(target)} ${undo[last.sym]} ${last.k} = ${formatNumber(apply(target, { sym: undo[last.sym] as Sym, k: last.k }))}.`,
    ];
  }

  private check(v: number, target: number): void {
    // Zeigen, was aus der eingeworfenen Zahl wird
    let x = v;
    this.trace[0].setText(formatNumber(v));
    // unter jedem Zahnrad: was nach diesem Schritt herauskommt
    this.gears.forEach((g, i) => {
      x = apply(x, g);
      this.trace[i + 1].setText(Number.isInteger(x) ? formatNumber(x) : x.toFixed(1).replace('.', ','));
    });
    if (v === this.start) {
      this.trace.forEach((t) => t.setColor('#bfe6ff'));
      this.solved(`${formatNumber(v)} ist richtig. Der Automat klickt und dreht sich: Es kommt genau ${formatNumber(target)} heraus.`);
      return;
    }
    this.trace.forEach((t) => t.setColor('#f0a090'));
    this.wrong(`Mit ${formatNumber(v)} kommt ${Number.isInteger(x) ? formatNumber(x) : 'keine glatte Zahl'} heraus, nicht ${formatNumber(target)}. ${x > target ? 'Deine Zahl ist zu groß.' : 'Deine Zahl ist zu klein.'}`);
  }
}
