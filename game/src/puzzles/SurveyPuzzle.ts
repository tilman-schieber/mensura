import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { getFlag, setFlag } from '../save';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Dorfumfrage“ für Bürgermeister Rudolf (Bildungsplan 3.1.5 (1), (3), (4), (5)).
//  - zaehlen:  Die Antworten kommen einzeln (Urliste); man führt eine Strichliste und trägt dann
//              die Häufigkeiten in die Tabelle ein (D1)
//  - zeichnen: aus einer Häufigkeitstabelle ein Säulendiagramm bauen (D3)
//  - lesen:    einem Säulendiagramm etwas entnehmen: Wert, am häufigsten, Unterschied,
//              Maximum/Minimum, Mittelwert (D5, D4)
// Relative Häufigkeiten und Kreisdiagramme brauchen Brüche und Prozent: Klasse 6.

type Mode = 'zaehlen' | 'zeichnen' | 'lesen';

interface Survey {
  question: string;
  cats: string[];
}

const SURVEYS: Survey[] = [
  { question: 'Was soll auf den Dorfplatz?', cats: ['Brunnen', 'Bühne', 'Spielplatz', 'Markthalle'] },
  { question: 'Welches Tier hättest du gern?', cats: ['Katze', 'Hund', 'Pony', 'Hase'] },
  { question: 'Was isst du am liebsten?', cats: ['Suppe', 'Pfannkuchen', 'Brot', 'Äpfel'] },
  { question: 'Wohin soll der Dorfausflug gehen?', cats: ['Riesental', 'Mine', 'Ruine', 'Fluss'] },
];

const NAMES = ['Mira', 'Brom', 'Flora', 'Harald', 'Ida', 'Jonas', 'Lea', 'Tom', 'Emil', 'Nele', 'Paul', 'Sara', 'Ben', 'Mia', 'Finn', 'Lina', 'Ole', 'Pia'];

const MODE_SKILL: Record<Mode, SkillId> = { zaehlen: 'D1', zeichnen: 'D3', lesen: 'D5' };

const CHART = { x: 170, y: 150, w: 460, h: 260 };

export class SurveyPuzzle extends PuzzleScene {
  protected title = 'Die Dorfumfrage';
  protected skills: SkillId[] = ['D1'];

  private survey!: Survey;
  private counts: number[] = [];
  private lastMode: Mode | null = null;

  constructor() {
    super('SurveyPuzzle');
  }

  protected buildRound(): void {
    const level = Math.min(getLevel('D1'), getLevel('D3'), getLevel('D5'));
    const pool: Mode[] = level < 0.2 ? ['zaehlen', 'lesen'] : ['zaehlen', 'zeichnen', 'lesen'];
    let mode = pool[randInt(0, pool.length - 1)];
    if (mode === this.lastMode) mode = pool[(pool.indexOf(mode) + 1) % pool.length];
    this.lastMode = mode;
    this.skills = [MODE_SKILL[mode]];
    this.survey = SURVEYS[randInt(0, SURVEYS.length - 1)];
    const big = getLevel(MODE_SKILL[mode]) > 0.5;
    this.counts = this.survey.cats.map(() => randInt(big ? 2 : 1, big ? 12 : 7));
    // keine Gleichstände beim Höchstwert, sonst ist „am beliebtesten“ nicht eindeutig
    const max = Math.max(...this.counts);
    if (this.counts.filter((c) => c === max).length > 1) this.counts[this.counts.indexOf(max)] += 1;

    this.round.add(text(this, GAME_WIDTH / 2, 84, `Umfrage: ${this.survey.question}`, 22, COLORS.text));
    if (mode === 'zaehlen') this.buildTally();
    else if (mode === 'zeichnen') this.buildDraw();
    else this.buildRead();
  }

  // ---------- Strichliste und Häufigkeitstabelle ----------

  private buildTally(): void {
    const r = this.round;
    const cats = this.survey.cats;
    // Urliste: alle Antworten in zufälliger Reihenfolge
    const answers = Phaser.Utils.Array.Shuffle(cats.flatMap((_, i) => new Array(this.counts[i]).fill(i) as number[]));
    const names = Phaser.Utils.Array.Shuffle([...NAMES]);
    const tallies = cats.map(() => 0);
    let k = 0;

    const label = text(this, 700, 118, 'Nächste Antwort:', 17, COLORS.muted);
    const current = text(this, 700, 150, '', 22, COLORS.goldText);
    const progress = text(this, 700, 186, '', 16, COLORS.muted);
    r.add([label, current, progress]);

    const rowY = (i: number) => 170 + i * 62;
    const marks = this.add.graphics();
    r.add(marks);
    const drawTally = () => {
      marks.clear();
      tallies.forEach((n, i) => {
        const y = rowY(i);
        for (let s = 0; s < n; s++) {
          const bundle = Math.floor(s / 5);
          const inB = s % 5;
          const x = 260 + bundle * 46 + inB * 8;
          if (inB === 4) marks.lineStyle(3, 0xe8c877, 1).lineBetween(x - 36, y + 12, x + 2, y - 12);
          else marks.lineStyle(3, 0xe9e4d8, 1).lineBetween(x, y - 14, x, y + 14);
        }
      });
    };
    const show = () => {
      if (k < answers.length) {
        current.setText(`${names[k % names.length]}: „${cats[answers[k]]}“`);
        progress.setText(`${k + 1} von ${answers.length}`);
      }
    };

    // Nur beim ersten Mal von Hand: danach läuft die Strichliste von selbst durch,
    // und man füllt nur noch die Tabelle aus (das ist der eigentliche Denkschritt).
    const manual = !getFlag('survey_tally_manual');
    const rowButtons: Phaser.GameObjects.Container[] = [];
    const finish = () => {
      label.setText('');
      if (manual) setFlag('survey_tally_manual');
      this.startTable(current, progress);
    };
    if (!manual) {
      label.setText('Rudolf liest vor, die Strichliste füllt sich:');
      const step = () => {
        if (!this.sys.isActive()) return;
        if (k >= answers.length) {
          finish();
          return;
        }
        show();
        const i = answers[k];
        this.tweens.killTweensOf(rowButtons[i]);
        rowButtons[i].setScale(1);
        this.tweens.add({ targets: rowButtons[i], scale: 1.08, duration: 110, yoyo: true });
        tallies[i] += 1;
        k += 1;
        drawTally();
        this.time.delayedCall(420, step);
      };
      this.time.delayedCall(500, step);
    }

    cats.forEach((c, i) => {
      const b = button(this, 150, rowY(i), c, () => {
        if (!manual || k >= answers.length) return;
        if (i !== answers[k]) {
          this.wrong(`${names[k % names.length]} hat „${cats[answers[k]]}“ gesagt, nicht „${c}“.`);
          return;
        }
        this.showOwl('');
        tallies[i] += 1;
        k += 1;
        drawTally();
        if (k < answers.length) show();
        else finish();
      }, { width: 170, height: 48, size: 18 });
      rowButtons.push(b);
      r.add(b);
    });
    if (manual) show();
    this.hints = [
      'Tipp für jede Antwort auf die passende Zeile. Jeder Strich ist eine Stimme.',
      'Der fünfte Strich geht quer über die vier davor. So zählt man später in Fünferbündeln.',
    ];
  }

  /** Nach der Strichliste: Häufigkeiten in die Tabelle eintragen */
  private startTable(current: Phaser.GameObjects.Text, progress: Phaser.GameObjects.Text): void {
    const r = this.round;
    let row = 0;
    r.add(text(this, 520, 130, 'Anzahl', 16, COLORS.muted));
    const cells = this.survey.cats.map((_, i) => {
      const t = text(this, 520, 170 + i * 62, '?', 24, '#5d6b76');
      r.add(t);
      return t;
    });
    current.setText('Jetzt die Tabelle:');
    const ask = () => progress.setText(`Wie oft „${this.survey.cats[row]}“?`);
    ask();
    cells[0].setColor(COLORS.goldText);
    const pad = createNumpad(this, 790, 340, (v) => {
      pad.clear();
      if (v !== this.counts[row]) {
        this.wrong(`Zähl die Striche bei „${this.survey.cats[row]}“ noch einmal: Jedes Fünferbündel sind 5.`);
        return;
      }
      this.showOwl('');
      cells[row].setText(String(v)).setColor(COLORS.text);
      row += 1;
      if (row < cells.length) {
        cells[row].setColor(COLORS.goldText);
        ask();
      } else this.solved('Strichliste und Tabelle stimmen. So zählt man ehrlich.');
    }, 2);
    pad.container.setScale(0.8);
    r.add(pad.container);
  }

  // ---------- Säulendiagramm zeichnen ----------

  private scaleStep(): number {
    return Math.max(...this.counts) > 8 ? 2 : 1;
  }

  private axes(g: Phaser.GameObjects.Graphics, step: number, top: number): void {
    const { x, y, w, h } = CHART;
    const r = this.round;
    g.lineStyle(2, 0xe9e4d8, 1).lineBetween(x, y, x, y + h).lineBetween(x, y + h, x + w, y + h);
    for (let v = 0; v <= top; v += step) {
      const yy = y + h - (v / top) * h;
      g.lineStyle(1, 0x3c5566, 0.6).lineBetween(x, yy, x + w, yy);
      r.add(text(this, x - 18, yy, String(v), 14, COLORS.muted));
    }
    this.survey.cats.forEach((c, i) => r.add(text(this, x + (i + 0.5) * (w / 4), y + h + 20, c, 15, COLORS.text)));
  }

  private buildDraw(): void {
    const r = this.round;
    const step = this.scaleStep();
    const top = Math.ceil((Math.max(...this.counts) + 1) / step) * step;
    const g = this.add.graphics();
    r.add(g);
    this.axes(g, step, top);
    const heights = this.survey.cats.map(() => 0);
    const bars = this.add.graphics();
    r.add(bars);
    const { x, y, w, h } = CHART;
    const drawBars = () => {
      bars.clear();
      heights.forEach((v, i) => {
        const bh = (v / top) * h;
        bars.fillStyle(0xd9b25f, 1).fillRect(x + i * (w / 4) + 25, y + h - bh, w / 4 - 50, bh);
      });
    };
    // Tabelle rechts
    r.add(text(this, 790, 130, 'Häufigkeitstabelle', 18, COLORS.goldText));
    this.survey.cats.forEach((c, i) => {
      r.add(text(this, 740, 170 + i * 36, c, 17, COLORS.text));
      r.add(text(this, 860, 170 + i * 36, String(this.counts[i]), 18, COLORS.text));
    });
    // In eine Spalte tippen: Säule auf diese Höhe (auf ganze Einheiten gerundet)
    this.survey.cats.forEach((_, i) => {
      const zone = this.add.zone(x + i * (w / 4), y - 10, w / 4, h + 10).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
        const v = Math.round(((y + h - p.y) / h) * top);
        heights[i] = Math.max(0, Math.min(top, v));
        drawBars();
      });
      r.add(zone);
    });
    r.add(
      button(this, 790, 360, 'Fertig', () => {
        const bad = heights.findIndex((v, i) => v !== this.counts[i]);
        if (bad < 0) this.solved('Das Säulendiagramm stimmt. Jetzt sieht man auf einen Blick, was die Leute wollen.');
        else this.wrong(`Die Säule „${this.survey.cats[bad]}“ muss bis ${this.counts[bad]} reichen, sie reicht bis ${heights[bad]}.`);
      }, { width: 160, height: 50, size: 20 }),
    );
    drawBars();
    this.hints = [
      'Tipp in eine Spalte: Die Säule wächst bis dorthin. Die Höhe muss zur Zahl in der Tabelle passen.',
      step === 2 ? 'Achte auf die Einteilung links: Jede Linie ist 2 mehr als die darunter.' : 'Jede Linie links ist 1 mehr als die darunter.',
    ];
  }

  // ---------- Diagramm lesen ----------

  private buildRead(): void {
    const r = this.round;
    const step = this.scaleStep();
    const top = Math.ceil((Math.max(...this.counts) + 1) / step) * step;
    const g = this.add.graphics();
    r.add(g);
    this.axes(g, step, top);
    const { x, y, w, h } = CHART;
    this.counts.forEach((v, i) => {
      const bh = (v / top) * h;
      g.fillStyle(0x5ab0e0, 1).fillRect(x + i * (w / 4) + 25, y + h - bh, w / 4 - 50, bh);
    });

    const cats = this.survey.cats;
    const c = this.counts;
    const max = Math.max(...c);
    const min = Math.min(...c);
    const imax = c.indexOf(max);
    const a = randInt(0, 3);
    let b = randInt(0, 3);
    if (b === a) b = (a + 1) % 4;
    const [hi, lo] = c[a] >= c[b] ? [a, b] : [b, a];
    const sum = c.reduce((s, v) => s + v, 0);
    const kinds: { q: string; answer: number | string; skill: SkillId; tip: string }[] = [
      { q: `Wie viele haben „${cats[a]}“ gewählt?`, answer: c[a], skill: 'D5', tip: 'Geh von der Säule waagerecht nach links zur Zahl.' },
      { q: 'Was wurde am häufigsten gewählt?', answer: cats[imax], skill: 'D5', tip: 'Die höchste Säule.' },
      { q: `Wie viele mehr haben „${cats[hi]}“ gewählt als „${cats[lo]}“?`, answer: c[hi] - c[lo], skill: 'D5', tip: 'Lies beide Werte ab und zieh sie voneinander ab.' },
      { q: 'Wie groß ist der Unterschied zwischen Maximum und Minimum?', answer: max - min, skill: 'D4', tip: 'Maximum ist der größte Wert, Minimum der kleinste.' },
      { q: 'Wie viele Leute wurden insgesamt gefragt?', answer: sum, skill: 'D5', tip: 'Zähle alle vier Werte zusammen.' },
    ];
    // Mittelwert nur, wenn er glatt aufgeht
    if (sum % 4 === 0) kinds.push({ q: 'Wie viele Stimmen hat eine Antwort im Mittel?', answer: sum / 4, skill: 'D4', tip: 'Mittelwert: alle Werte zusammenzählen und durch 4 teilen.' });
    const k = kinds[randInt(0, kinds.length - 1)];
    this.skills = [k.skill];
    r.add(text(this, 790, 130, k.q, 18, COLORS.goldText).setWordWrapWidth(300).setAlign('center'));
    if (typeof k.answer === 'string') {
      cats.forEach((cat, i) => {
        r.add(button(this, 790, 200 + i * 60, cat, () => (cat === k.answer ? this.solved(`Genau: „${cat}“ mit ${max} Stimmen.`) : this.wrong(`„${cat}“ hat ${c[i]} Stimmen. Gibt es eine höhere Säule?`)), { width: 200, height: 50, size: 19 }));
      });
    } else {
      const pad = createNumpad(this, 790, 350, (v) => {
        pad.clear();
        if (v === k.answer) this.solved(`Richtig, ${v}.`);
        else this.wrong(k.tip);
      }, 3);
      pad.container.setScale(0.8);
      r.add(pad.container);
    }
    this.hints = [k.tip, step === 2 ? 'Die Einteilung geht in Zweierschritten. Liegt eine Säule zwischen zwei Linien, ist es die Zahl dazwischen.' : 'Jede Linie ist 1 mehr als die darunter.'];
  }
}
