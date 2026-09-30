import Phaser from 'phaser';
import { formatNumber, randInt } from '../learn/numbers';
import { getLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Runentafel“ (Zahlterme: Fachbegriffe Z23, Rechenreihenfolge und Klammern Z25,
// Sachsituation als Term Z22, Rechengesetze geschickt nutzen Z24).
// Die Runen der Zwerge leuchten nur, wenn sie in der richtigen Reihenfolge gelesen werden.

type Mode = 'begriffe' | 'reihenfolge' | 'sache' | 'klammern' | 'geschickt';

const MODE_SKILL: Record<Mode, SkillId> = { begriffe: 'Z23', reihenfolge: 'Z25', sache: 'Z22', klammern: 'Z25', geschickt: 'Z24' };

interface Choice {
  label: string;
  right: boolean;
  /** Rückmeldung, falls gewählt und falsch */
  why?: string;
}

interface Task {
  mode: Mode;
  question: string;
  sub?: string;
  /** Zahleneingabe statt Auswahl */
  answer?: number;
  leftToRight?: number;
  choices?: Choice[];
  done: string;
  hints: string[];
}

const shuffle = <T,>(xs: T[]) => Phaser.Utils.Array.Shuffle([...xs]);

function begriffe(): Task {
  const ops = [
    { sign: '+', name: 'Summe', op: 'Addition', parts: 'Summand + Summand' },
    { sign: '−', name: 'Differenz', op: 'Subtraktion', parts: 'Minuend − Subtrahend' },
    { sign: '·', name: 'Produkt', op: 'Multiplikation', parts: 'Faktor · Faktor' },
    { sign: ':', name: 'Quotient', op: 'Division', parts: 'Dividend : Divisor' },
  ];
  const o = ops[randInt(0, 3)];
  const a = randInt(4, 12);
  const b = randInt(2, 9);
  const term = o.sign === ':' ? `${a * b} : ${b}` : o.sign === '−' ? `${a + b} − ${b}` : `${a} ${o.sign} ${b}`;
  return {
    mode: 'begriffe',
    question: `Wie heißt das Ergebnis von ${term}?`,
    choices: ops.map((x) => ({ label: x.name, right: x === o, why: `${x.name} ist das Ergebnis einer ${x.op}.` })),
    done: `Genau: ${o.parts} = ${o.name}.`,
    hints: ['Summe, Differenz, Produkt, Quotient: Welche Rechenart gehört zu welchem Wort?', `Hier wird gerechnet: ${o.op}.`],
  };
}

function reihenfolge(): Task {
  const k = randInt(0, 3);
  let question: string;
  let answer: number;
  let leftToRight: number;
  if (k === 0) {
    const [a, b, c] = [randInt(2, 20), randInt(2, 9), randInt(2, 9)];
    question = `${a} + ${b} · ${c}`;
    answer = a + b * c;
    leftToRight = (a + b) * c;
  } else if (k === 1) {
    // a · b ≥ 25 > c · d: kein negatives Ergebnis (negative Zahlen kommen erst in Klasse 6)
    const [a, b, c, d] = [randInt(5, 9), randInt(5, 9), randInt(2, 4), randInt(2, 4)];
    question = `${a} · ${b} − ${c} · ${d}`;
    answer = a * b - c * d;
    leftToRight = (a * b - c) * d;
  } else if (k === 2) {
    const [a, b, c] = [randInt(2, 12), randInt(2, 12), randInt(2, 6)];
    question = `(${a} + ${b}) · ${c}`;
    answer = (a + b) * c;
    leftToRight = a + b * c;
  } else {
    const [c, q, a] = [randInt(2, 9), randInt(2, 9), randInt(30, 90)];
    question = `${a} − ${c * q} : ${c}`;
    answer = a - q;
    leftToRight = Math.round(((a - c * q) / c) * 100) / 100;
  }
  return {
    mode: 'reihenfolge',
    question: `Welchen Wert hat die Rune?   ${question}`,
    answer,
    leftToRight,
    done: `${question} = ${formatNumber(answer)}.`,
    hints: ['Klammer zuerst, dann Punkt (· und :), dann Strich (+ und −).', 'Rechne erst die Mal- oder Geteilt-Aufgabe und setze ihr Ergebnis ein.'],
  };
}

function sache(): Task {
  const k = randInt(0, 2);
  if (k === 0) {
    const [n, m, x] = [randInt(3, 8), randInt(6, 12), randInt(2, 7)];
    return {
      mode: 'sache',
      question: `${n} Kisten mit je ${m} Laternen. ${x} Laternen sind kaputt.`,
      sub: 'Welcher Term passt?',
      choices: [
        { label: `${n} · ${m} − ${x}`, right: true },
        { label: `${n} · (${m} − ${x})`, right: false, why: `Dann wären in jeder Kiste ${x} kaputt, nicht ${x} insgesamt.` },
        { label: `${n} + ${m} − ${x}`, right: false, why: `„Je ${m}“ heißt: ${n}-mal ${m}, also malnehmen.` },
        { label: `${x} − ${n} · ${m}`, right: false, why: 'Die kaputten Laternen werden abgezogen, nicht umgekehrt.' },
      ],
      done: `${n} · ${m} − ${x} = ${n * m - x} heile Laternen.`,
      hints: ['Erst: Wie viele Laternen sind es insgesamt? Dann: Was geht davon ab?'],
    };
  }
  if (k === 1) {
    const [z, t, k2] = [randInt(4, 9), randInt(5, 15), randInt(10, 40)];
    return {
      mode: 'sache',
      question: `${z} Zwerge bekommen je ${t} Taler. Der König bekommt zusätzlich ${k2} Taler.`,
      sub: 'Wie viele Taler sind es zusammen?',
      choices: [
        { label: `${z} · ${t} + ${k2}`, right: true },
        { label: `${z} · (${t} + ${k2})`, right: false, why: 'Dann bekäme jeder Zwerg auch die Taler des Königs.' },
        { label: `${z} + ${t} + ${k2}`, right: false, why: `„Je ${t}“ heißt: ${z}-mal ${t}.` },
        { label: `(${z} + ${k2}) · ${t}`, right: false, why: 'Der König ist kein Zwerg mit Anteil, er bekommt eine feste Summe dazu.' },
      ],
      done: `${z} · ${t} + ${k2} = ${z * t + k2} Taler.`,
      hints: ['Was bekommen alle Zwerge zusammen? Was kommt dann noch dazu?'],
    };
  }
  const [lo, per, extra] = [randInt(3, 6), randInt(4, 9), randInt(2, 9)];
  return {
    mode: 'sache',
    question: `${lo * per} Steine werden gerecht auf ${lo} Loren verteilt. Dann legt Brom in jede Lore noch ${extra} Steine dazu.`,
    sub: 'Wie viele Steine liegen jetzt in einer Lore?',
    choices: [
      { label: `${lo * per} : ${lo} + ${extra}`, right: true },
      { label: `${lo * per} : (${lo} + ${extra})`, right: false, why: 'Die Steine werden auf die Loren verteilt, nicht auf Loren und Steine.' },
      { label: `${lo * per} + ${extra} : ${lo}`, right: false, why: 'Punkt vor Strich: Hier würde nur das Dazugelegte geteilt.' },
      { label: `${lo * per} · ${lo} + ${extra}`, right: false, why: '„Gerecht verteilen“ heißt teilen, nicht malnehmen.' },
    ],
    done: `${lo * per} : ${lo} + ${extra} = ${per + extra} Steine pro Lore.`,
    hints: ['Erst verteilen (geteilt durch), dann dazulegen (plus). Punkt vor Strich erledigt den Rest.'],
  };
}

function klammern(): Task {
  const [a, b, c, d] = [randInt(2, 9), randInt(2, 6), randInt(4, 9), randInt(1, 3)];
  const variants = [
    { label: `(${a} + ${b}) · ${c} − ${d}`, value: (a + b) * c - d },
    { label: `${a} + ${b} · (${c} − ${d})`, value: a + b * (c - d) },
    { label: `(${a} + ${b}) · (${c} − ${d})`, value: (a + b) * (c - d) },
    { label: `${a} + ${b} · ${c} − ${d}`, value: a + b * c - d },
  ];
  // Ziel: ein Klammer-Term, dessen Wert kein anderer hat
  const unique = variants.slice(0, 3).filter((v) => variants.filter((w) => w.value === v.value).length === 1);
  const target = unique.length ? unique[randInt(0, unique.length - 1)] : variants[0];
  return {
    mode: 'klammern',
    question: `Wo gehören die Klammern hin, damit ${formatNumber(target.value)} herauskommt?`,
    sub: `${a} + ${b} · ${c} − ${d}`,
    choices: variants.map((v) => ({ label: v.label, right: v === target, why: `${v.label} ergibt ${formatNumber(v.value)}.` })),
    done: `${target.label} = ${formatNumber(target.value)}.`,
    hints: ['Rechne jeden Vorschlag aus: erst die Klammer, dann Punkt vor Strich.', 'Klammern erlauben, eine Strich-Rechnung zuerst zu machen.'],
  };
}

function geschickt(): Task {
  const k = randInt(0, 2);
  if (k === 0) {
    const x = randInt(13, 47);
    return {
      mode: 'geschickt',
      question: `Rechne geschickt: 25 · ${x} · 4`,
      choices: [
        { label: `(25 · 4) · ${x}`, right: true },
        { label: `(25 · ${x}) · 4`, right: false, why: 'Das geht, ist aber schwer im Kopf.' },
        { label: `25 · ${x} + 4`, right: false, why: 'Aus Mal darf nicht Plus werden.' },
        { label: `(${x} · 4) · 25`, right: false, why: 'Das geht, ist aber nicht leichter.' },
      ],
      done: `Vertauschen: 25 · 4 = 100, und 100 · ${x} = ${formatNumber(100 * x)}.`,
      hints: ['Beim Malnehmen darfst du die Faktoren vertauschen. Welche zwei ergeben zusammen eine glatte Zahl?'],
    };
  }
  if (k === 1) {
    const b = randInt(21, 79);
    const a = randInt(12, 88);
    return {
      mode: 'geschickt',
      question: `Rechne geschickt: ${a} + ${b} + ${100 - b}`,
      choices: [
        { label: `${a} + (${b} + ${100 - b})`, right: true },
        { label: `(${a} + ${b}) + ${100 - b}`, right: false, why: 'Das geht, ist aber nicht leichter.' },
        { label: `${a} + ${b} − ${100 - b}`, right: false, why: 'Aus Plus darf nicht Minus werden.' },
        { label: `(${a} + ${100 - b}) + ${b}`, right: false, why: 'Das geht, ist aber nicht leichter.' },
      ],
      done: `Verbinden: ${b} + ${100 - b} = 100, also ${a} + 100 = ${a + 100}.`,
      hints: ['Beim Addieren darfst du Klammern setzen, wo du willst. Welche zwei ergeben zusammen 100?'],
    };
  }
  const n = randInt(3, 9);
  const m = randInt(97, 99);
  return {
    mode: 'geschickt',
    question: `Rechne geschickt: ${n} · ${m}`,
    choices: [
      { label: `${n} · 100 − ${n} · ${100 - m}`, right: true },
      { label: `${n} · 100 − ${100 - m}`, right: false, why: `Vorsicht: Es fehlen ${n}-mal ${100 - m}, nicht nur einmal.` },
      { label: `${n} · 90 + ${n} · ${m - 90}`, right: false, why: 'Das stimmt zwar, ist aber nicht leichter.' },
      { label: `${n} · ${m - 50} + ${n} · 50`, right: false, why: 'Das stimmt zwar, ist aber nicht leichter.' },
    ],
    done: `Verteilen: ${n} · 100 − ${n} · ${100 - m} = ${n * 100} − ${n * (100 - m)} = ${n * m}.`,
    hints: [`${m} ist fast 100. Rechne mit 100 und zieh ab, was zu viel ist, für jeden der ${n} Faktoren.`],
  };
}

function makeTask(level: number): Task {
  // Je weiter, desto mehr Arten kommen dazu; gemischt wird aus allen freigeschalteten
  const unlocked: (() => Task)[] = [begriffe, reihenfolge, sache, klammern, geschickt].slice(0, 1 + Math.floor(level * 5));
  return unlocked[randInt(0, Math.min(unlocked.length, 5) - 1)]();
}

export class TermPuzzle extends PuzzleScene {
  protected title = 'Die Runentafel';
  protected skills: SkillId[] = ['Z23'];

  private lastMode: Mode | null = null;

  constructor() {
    super('TermPuzzle');
  }

  protected buildRound(): void {
    const level = Math.min(...(['Z22', 'Z23', 'Z24', 'Z25'] as SkillId[]).map((s) => getLevel(s)), 1);
    let t = makeTask(Math.max(level, 0.21));
    for (let i = 0; i < 4 && t.mode === this.lastMode; i++) t = makeTask(Math.max(level, 0.21));
    this.lastMode = t.mode;
    this.skills = [MODE_SKILL[t.mode]];
    const r = this.round;

    // Runentafel
    const g = this.add.graphics();
    g.fillStyle(0x1c2430, 1).fillRoundedRect(100, 80, 760, t.sub ? 110 : 80, 10);
    g.lineStyle(2, 0x5ab0e0, 1).strokeRoundedRect(100, 80, 760, t.sub ? 110 : 80, 10);
    r.add(g);
    r.add(text(this, GAME_WIDTH / 2, 118, t.question, 22, '#bfe6ff').setWordWrapWidth(720).setAlign('center'));
    if (t.sub) r.add(text(this, GAME_WIDTH / 2, 164, t.sub, 22, COLORS.goldText));

    if (t.answer !== undefined) {
      const pad = createNumpad(this, GAME_WIDTH / 2, 360, (v) => {
        pad.clear();
        if (v === t.answer) this.solved(t.done);
        else if (v === t.leftToRight) this.wrong('Einfach von links nach rechts gerechnet? Denk an die Regel: Klammer vor Punkt vor Strich.');
        else this.wrong('Das stimmt noch nicht. Welcher Teil wird zuerst gerechnet?');
      }, 5);
      r.add(pad.container);
    } else {
      shuffle(t.choices!).forEach((c, i) => {
        const x = GAME_WIDTH / 2 + (i % 2 ? 190 : -190);
        const y = 260 + Math.floor(i / 2) * 84;
        r.add(
          button(this, x, y, c.label, () => (c.right ? this.solved(t.done) : this.wrong(c.why ?? 'Schau noch einmal genau hin.')), {
            width: 350,
            height: 64,
            size: 20,
          }),
        );
      });
    }
    this.hints = t.hints;
  }
}
