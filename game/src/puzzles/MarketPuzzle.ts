import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel, levelCap } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Miras Marktstand“ (Überschlag Z11, Geld M5G).
//  - reicht:      Einkaufskorb überschlagen: Reicht das Geld? (Z11)
//  - wechselgeld: Mit einem Schein bezahlen, Wechselgeld ausrechnen (Z11/M5G)
//  - menge:       mehrere Stück zum gleichen Preis (M5G)
//  - umrechnen:   Euro und Cent (M5G, erst wenn das Schulthema „Größen“ dran war)
// Preise in ganzen Euro, bis Cent-Beträge freigeschaltet sind. Das Bild des Stands lädt Eichstadt.

type Mode = 'reicht' | 'wechselgeld' | 'menge' | 'umrechnen';

const GOODS: [string, number][] = [
  ['Äpfel', 3], ['Brot', 4], ['Käse', 7], ['Honig', 6], ['Rüben', 2], ['Eier', 3], ['Milch', 2], ['Kuchen', 9], ['Nüsse', 5], ['Fisch', 12],
];

/** Betrag in Euro mit Komma, wenn Cent dabei sind: 3 → „3 €“, 2.5 → „2,50 €“ */
const euro = (v: number) => (Number.isInteger(v) ? `${v} €` : `${v.toFixed(2).replace('.', ',')} €`);
const cents = (v: number) => Math.round(v * 100);

export class MarketPuzzle extends PuzzleScene {
  protected title = 'Miras Marktstand';
  protected skills: SkillId[] = ['Z11'];
  private lastMode: Mode | null = null;

  constructor() {
    super('MarketPuzzle');
  }

  protected buildRound(): void {
    // Cent-Beträge erst, wenn Geld (Größen) im Unterricht dran war und das Können reicht
    const withCents = levelCap('M5G') >= 1 && getLevel('M5G') > 0.3;
    const pool: Mode[] = withCents ? ['reicht', 'wechselgeld', 'menge', 'umrechnen'] : ['reicht', 'wechselgeld', 'menge'];
    let mode = pool[randInt(0, pool.length - 1)];
    if (mode === this.lastMode) mode = pool[(pool.indexOf(mode) + 1) % pool.length];
    this.lastMode = mode;
    const r = this.round;
    r.add(this.add.image(170, 250, 'market-stall').setScale(2));

    const price = (base: number) => (withCents ? base - [0, 0.05, 0.1, 0.5][randInt(0, 3)] : base);

    if (mode === 'reicht') {
      this.skills = ['Z11'];
      const items = Phaser.Utils.Array.Shuffle([...GOODS]).slice(0, randInt(3, 4)).map(([n, p]) => [n, price(p * randInt(1, 2))] as [string, number]);
      const total = items.reduce((s, [, p]) => s + p, 0);
      // Geld so wählen, dass der Überschlag klar entscheidet (mindestens 3 € Abstand)
      const enough = Math.random() < 0.5;
      const money = enough ? Math.ceil((total + 3) / 5) * 5 : Math.max(5, Math.floor((total - 3) / 5) * 5);
      const ok = money >= total;
      r.add(text(this, GAME_WIDTH / 2 + 80, 90, `Ida hat ${money} € dabei. Reicht das für ihren Korb?`, 22, COLORS.text));
      items.forEach(([n, p], i) => r.add(text(this, 560, 150 + i * 36, `${n}: ${euro(p)}`, 21, COLORS.text)));
      const say = `Überschlag: etwa ${Math.round(total)} €.`;
      r.add(button(this, 480, 370, 'Reicht', () => (ok ? this.solved(`Reicht. ${say} Genau sind es ${euro(total)}.`) : this.wrong(`Leider nicht. ${say} Das ist mehr als ${money} €.`)), { width: 190, height: 56, size: 22 }));
      r.add(button(this, 700, 370, 'Reicht nicht', () => (!ok ? this.solved(`Stimmt, es reicht nicht. ${say} Genau sind es ${euro(total)}.`) : this.wrong(`Doch! ${say} Das ist weniger als ${money} €.`)), { width: 190, height: 56, size: 22 }));
      this.hints = ['Du musst nicht genau rechnen. Runde jeden Preis auf ganze Euro und zähle zusammen.', 'Vergleiche deinen Überschlag mit dem Geld, das Ida hat.'];
      return;
    }

    if (mode === 'wechselgeld') {
      this.skills = withCents ? ['M5G'] : ['Z11'];
      const [n, base] = GOODS[randInt(0, GOODS.length - 1)];
      const cost = price(base * randInt(1, 3));
      const note = [5, 10, 20, 50].find((x) => x > cost + 0.5) ?? 50;
      const change = (cents(note) - cents(cost)) / 100;
      r.add(text(this, GAME_WIDTH / 2 + 80, 90, `${n} für ${euro(cost)}. Tom bezahlt mit ${note} €.`, 22, COLORS.text));
      r.add(text(this, 560, 150, 'Wie viel Wechselgeld bekommt er?', 19, COLORS.muted));
      const pad = createNumpad(this, 560, 360, (v) => {
        pad.clear();
        if (cents(v) === cents(change)) this.solved(`Richtig: ${euro(change)} zurück. Probe: ${euro(cost)} + ${euro(change)} = ${note} €.`);
        else this.wrong(`Probe: ${euro(cost)} + ${euro(v)} = ${euro((cents(cost) + cents(v)) / 100)}, nicht ${note} €.`);
      }, 5, { decimal: withCents, unit: '€' });
      pad.container.setScale(0.85);
      r.add(pad.container);
      this.hints = ['Ergänze vom Preis bis zum Schein: Wie viel fehlt bis dahin?', withCents ? 'Erst bis zum nächsten vollen Euro ergänzen, dann bis zum Schein.' : 'Rechne Schein minus Preis.'];
      return;
    }

    if (mode === 'menge') {
      this.skills = ['M5G'];
      const [n, base] = GOODS[randInt(0, GOODS.length - 1)];
      const p = price(base);
      const k = randInt(3, 8);
      const total = (cents(p) * k) / 100;
      r.add(text(this, GAME_WIDTH / 2 + 80, 90, `Mira verkauft ${n}. Ein Stück kostet ${euro(p)}.`, 22, COLORS.text));
      r.add(text(this, 560, 150, `Was kosten ${k} Stück?`, 19, COLORS.muted));
      const pad = createNumpad(this, 560, 360, (v) => {
        pad.clear();
        if (cents(v) === cents(total)) this.solved(`${k} · ${euro(p)} = ${euro(total)}.`);
        else this.wrong(`Überschlag: ${k} · etwa ${Math.round(p)} € ≈ ${k * Math.round(p)} €. Passt dein Ergebnis dazu?`);
      }, 5, { decimal: withCents, unit: '€' });
      pad.container.setScale(0.85);
      r.add(pad.container);
      this.hints = ['Mal nehmen: Anzahl · Preis.', withCents ? 'Rechne in Cent, das ist leichter: Dann gibt es kein Komma.' : 'Zerlege, wenn es hilft: 6 · 7 = 6 · 5 + 6 · 2.'];
      return;
    }

    // umrechnen
    this.skills = ['M5G'];
    const toEuro = Math.random() < 0.5;
    const c = randInt(1, 19) * 100 + [5, 10, 25, 50, 95][randInt(0, 4)];
    const e = c / 100;
    r.add(text(this, GAME_WIDTH / 2 + 80, 90, toEuro ? `Wie viel Euro sind ${c} Cent?` : `Wie viel Cent sind ${euro(e)}?`, 22, COLORS.text));
    const pad = createNumpad(this, 560, 330, (v) => {
      pad.clear();
      const right = toEuro ? cents(v) === c : v === c;
      if (right) this.solved(`${c} ct = ${euro(e)}. 100 Cent sind 1 Euro.`);
      else this.wrong('100 Cent sind 1 Euro. Die letzten zwei Ziffern der Cent stehen hinter dem Komma.');
    }, 5, { decimal: toEuro, unit: toEuro ? '€' : 'ct' });
    pad.container.setScale(0.85);
    r.add(pad.container);
    this.hints = ['1 € = 100 ct.', toEuro ? `${c} ct: die Hunderter sind Euro, der Rest Cent.` : 'Euro mal 100, dann die Cent dazu.'];
  }
}
