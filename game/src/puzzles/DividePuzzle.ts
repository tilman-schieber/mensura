import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel, pickByLevel, recordAttempt } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Beute teilen“ (schriftlich dividieren, Z12, und Probe mit der Umkehraufgabe, Z21).
// Goldstücke werden gerecht auf Zwerge verteilt. Erst das Ergebnis, dann die Probe:
// Ergebnis mal Anzahl der Zwerge muss wieder die ganze Beute ergeben. Die Teilung geht
// immer auf (Divisionen mit Rest kommen später).

interface Task {
  dividend: number;
  divisor: number;
}

function makeTask(level: number): Task {
  const tier = pickByLevel(level, [0, 1, 2, 3]);
  const [dMin, dMax, qMin, qMax] =
    tier === 0 ? [2, 5, 11, 49] : tier === 1 ? [3, 9, 21, 199] : tier === 2 ? [4, 9, 102, 999] : [11, 25, 12, 99];
  const divisor = randInt(dMin, dMax);
  const q = randInt(qMin, qMax);
  return { dividend: divisor * q, divisor };
}

/** Die Schritte der schriftlichen Division, als Hinweis-Text: „7 passt in 8 einmal, Rest 1 …“ */
function steps(t: Task): string[] {
  const out: string[] = [];
  const digits = String(t.dividend).split('').map(Number);
  let rest = 0;
  let started = false;
  for (const d of digits) {
    const part = rest * 10 + d;
    const fits = Math.floor(part / t.divisor);
    if (!started && fits === 0) {
      rest = part;
      continue;
    }
    started = true;
    rest = part - fits * t.divisor;
    out.push(`${t.divisor} passt ${fits}-mal in ${part}, Rest ${rest}.`);
  }
  return out;
}

export class DividePuzzle extends PuzzleScene {
  protected title = 'Die Beute teilen';
  protected skills: SkillId[] = ['Z12'];

  private task!: Task;
  private phase: 'teilen' | 'probe' = 'teilen';
  private prompt!: Phaser.GameObjects.Text;
  private sum!: Phaser.GameObjects.Text;

  constructor() {
    super('DividePuzzle');
  }

  protected buildRound(): void {
    const t = (this.task = makeTask(getLevel('Z12')));
    this.phase = 'teilen';
    this.skills = ['Z12'];
    const r = this.round;
    r.add(this.add.image(250, 230, 'treasure').setScale(2.4));
    r.add(text(this, GAME_WIDTH / 2, 88, `${formatNumber(t.dividend)} Goldstücke für ${t.divisor} Zwerge, alle bekommen gleich viel.`, 22, COLORS.text));
    this.sum = text(this, 250, 355, `${formatNumber(t.dividend)} : ${t.divisor} = ?`, 28, COLORS.goldText);
    this.prompt = text(this, 250, 400, 'Wie viele Goldstücke bekommt jeder?', 18, COLORS.muted);
    r.add([this.sum, this.prompt]);
    const pad = createNumpad(this, 720, 300, (v) => {
      pad.clear();
      this.check(v);
    }, 6);
    r.add(pad.container);

    const s = steps(t);
    this.hints = [
      'Teile Stelle für Stelle von links: Wie oft passt die Zahl der Zwerge hinein? Den Rest nimmst du mit zur nächsten Stelle.',
      s.slice(0, 2).join(' '),
      `Probier es mit der Umkehraufgabe: Welche Zahl mal ${t.divisor} ergibt ${formatNumber(t.dividend)}?`,
    ];
  }

  private check(v: number): void {
    const t = this.task;
    const q = t.dividend / t.divisor;
    if (this.phase === 'teilen') {
      if (v !== q) {
        const back = v * t.divisor;
        this.wrong(`Probe: ${formatNumber(v)} · ${t.divisor} = ${formatNumber(back)}. Das ist ${back > t.dividend ? 'zu viel' : 'zu wenig'} Gold.`);
        return;
      }
      // Die Teilung zählt für Z12, danach weiter mit der Probe (Umkehraufgabe, Z21)
      recordAttempt(['Z12'], true, this.hintsUsed);
      this.phase = 'probe';
      this.skills = ['Z21'];
      this.showOwl('');
      this.sum.setText(`${formatNumber(t.dividend)} : ${t.divisor} = ${formatNumber(q)}`);
      this.prompt.setText(`Jetzt die Probe: ${formatNumber(q)} · ${t.divisor} = ?`);
      this.hints = [
        'Bei der Probe rechnest du rückwärts: Ergebnis mal Anzahl der Zwerge.',
        'Stimmt die Teilung, kommt genau die ganze Beute wieder heraus.',
      ];
      return;
    }
    if (v !== t.dividend) {
      this.wrong(`Rechne ${formatNumber(q)} · ${t.divisor} noch einmal nach, von rechts nach links.`);
      return;
    }
    this.solved(`Probe bestanden: ${formatNumber(q)} · ${t.divisor} = ${formatNumber(t.dividend)}. Jeder Zwerg bekommt ${formatNumber(q)} Goldstücke.`);
  }
}
