import { formatNumber, randInt } from './numbers';
import { pickByLevel } from './progress';

// Kopfrechen-Aufgaben für die Kämpfe gegen Nebelwesen (Z11: sicher im Kopf rechnen,
// Überschlag). Jede Aufgabe hat eine richtige Antwort und drei Ablenker, die typische
// Fehler abbilden: eine Einmaleinsreihe daneben, um 10 verrutscht, Stelle vertauscht.

export interface MathTask {
  question: string;
  answer: number;
  options: number[];
  /** kurze Erklärung für den Fehlerfall */
  explain: string;
}

type Maker = () => MathTask;

function withOptions(question: string, answer: number, distractors: number[], explain: string): MathTask {
  const set = new Set<number>([answer]);
  for (const d of distractors) if (d > 0 && d !== answer) set.add(d);
  // auffüllen, falls Ablenker doppelt waren
  let k = 1;
  while (set.size < 4) {
    set.add(answer + k * (k % 2 ? 1 : -1) * (answer >= 100 ? 10 : 1));
    k++;
  }
  const options = [...set].slice(0, 4).sort(() => Math.random() - 0.5);
  return { question, answer, options, explain };
}

const mulSmall: Maker = () => {
  const a = randInt(2, 5);
  const b = randInt(2, 10);
  return withOptions(`${a} · ${b}`, a * b, [a * (b + 1), a * (b - 1), (a + 1) * b], `${a} · ${b} = ${a * b}`);
};

const addSub20: Maker = () => {
  if (randInt(0, 1)) {
    const a = randInt(6, 9);
    const b = randInt(11 - a, 9);
    return withOptions(`${a} + ${b}`, a + b, [a + b - 1, a + b + 1, a + b - 10], `${a} + ${b} = ${a + b} (über die 10)`);
  }
  const a = randInt(11, 18);
  const b = randInt(a - 9, 9);
  return withOptions(`${a} − ${b}`, a - b, [a - b + 1, a - b - 1, a - b + 10], `${a} − ${b} = ${a - b}`);
};

const mulFull: Maker = () => {
  const a = randInt(3, 9);
  const b = randInt(3, 9);
  return withOptions(`${a} · ${b}`, a * b, [a * (b + 1), a * (b - 1), a * b + 10], `${a} · ${b} = ${a * b}`);
};

const addSub100: Maker = () => {
  const a = randInt(23, 89);
  const b = randInt(4, 9);
  if (randInt(0, 1)) {
    const r = a + b;
    return withOptions(`${a} + ${b}`, r, [r - 10, r + 10, r - 1], `${a} + ${b} = ${r}`);
  }
  const r = a - b;
  return withOptions(`${a} − ${b}`, r, [r + 10, r - 10, r + 1], `${a} − ${b} = ${r}`);
};

const twoDigit: Maker = () => {
  const a = randInt(24, 78);
  let b = randInt(13, 47);
  while (Math.abs(a - b) < 6) b = randInt(13, 47);
  if (randInt(0, 1)) {
    const r = a + b;
    return withOptions(`${a} + ${b}`, r, [r - 10, r + 10, r - 1], `${a} + ${b} = ${r}`);
  }
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const r = big - small;
  return withOptions(`${big} − ${small}`, r, [r + 10, r - 10, r + 2], `${big} − ${small} = ${r}`);
};

const divide: Maker = () => {
  const b = randInt(3, 9);
  const r = randInt(3, 9);
  return withOptions(`${b * r} : ${b}`, r, [r + 1, r - 1, b], `${b * r} : ${b} = ${r}, denn ${r} · ${b} = ${b * r}`);
};

const tens: Maker = () => {
  const kind = randInt(0, 2);
  if (kind === 0) {
    const a = randInt(2, 9) * 10;
    const b = randInt(2, 9) * 10;
    const r = a * b;
    return withOptions(`${a} · ${b}`, r, [r / 10, r * 10, r + 100], `${a / 10} · ${b / 10} = ${(a * b) / 100}, dazu zwei Nullen: ${formatNumber(r)}`);
  }
  if (kind === 1) {
    const b = randInt(2, 9);
    const r = randInt(2, 9) * 100;
    return withOptions(`${formatNumber(b * r)} : ${b}`, r, [r / 10, r * 10, r + 100], `${(b * r) / 100} : ${b} = ${r / 100}, also ${formatNumber(r)}`);
  }
  const a = randInt(12, 48) * 10;
  const b = randInt(12, 48) * 10;
  const r = a + b;
  return withOptions(`${a} + ${b}`, r, [r - 100, r + 100, r - 10], `${a} + ${b} = ${formatNumber(r)}`);
};

/** Überschlag: runden, dann rechnen. Die Antworten unterscheiden sich um Zehnerpotenzen. */
const estimate: Maker = () => {
  const a = randInt(2, 9) * 100 + randInt(-4, 4);
  const b = randInt(2, 9) * 10 + randInt(-2, 2);
  const ra = Math.round(a / 100) * 100;
  const rb = Math.round(b / 10) * 10;
  const r = ra * rb;
  return withOptions(`Überschlag: ${a} · ${b} ≈ ?`, r, [r / 10, r * 10, r / 2], `${a} ≈ ${ra}, ${b} ≈ ${rb}, also etwa ${formatNumber(ra)} · ${rb} = ${formatNumber(r)}`);
};

const TIERS: Maker[][] = [
  [mulSmall, addSub20],
  [mulFull, addSub100],
  [mulFull, twoDigit, divide],
  [divide, tens, twoDigit],
  [tens, estimate, mulFull],
];

export function mentalTask(level: number): MathTask {
  const makers = pickByLevel(level, TIERS);
  return makers[randInt(0, makers.length - 1)]();
}
