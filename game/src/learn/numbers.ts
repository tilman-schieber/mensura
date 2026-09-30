// Hilfsfunktionen rund um Zahlen: Schreibweise mit Tausender-Abständen,
// Zahlwörter (für das Diktat per Sprachausgabe), Stellenwerte und Zufallszahlen.

/** 3040005 → "3 040 005" (schmales geschütztes Leerzeichen, wie in Schulbüchern). */
export function formatNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Deutsche Schreibweise auch für Kommazahlen: 1234.5 → "1 234,5", 0.45 → "0,45".
 * Rundet auf höchstens 3 Nachkommastellen (gegen Rechenungenauigkeiten wie 0.1 + 0.2).
 */
export function formatDecimal(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  const [int, frac] = Math.abs(r).toString().split('.');
  const intPart = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return (r < 0 ? '−' : '') + intPart + (frac ? `,${frac}` : '');
}

/** Gleichheit mit Toleranz für Kommazahlen */
export function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

const ONES = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const TEENS = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

function below100(n: number): string {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return (o ? `${ONES[o]}und` : '') + TENS[t];
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? `${ONES[h]}hundert` : '') + below100(r);
}

/** Deutsche Zahlwörter bis 999 Billionen, z. B. 3040005 → "drei Millionen vierzigtausendfünf". */
export function numberToWords(n: number): string {
  if (n === 0) return 'null';
  const parts: string[] = [];
  const bio = Math.floor(n / 1e12);
  if (bio) parts.push(bio === 1 ? 'eine Billion' : `${below1000(bio)} Billionen`);
  n %= 1e12;
  const mrd = Math.floor(n / 1e9);
  const mio = Math.floor((n % 1e9) / 1e6);
  const tsd = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1e3;
  if (mrd) parts.push(mrd === 1 ? 'eine Milliarde' : `${below1000(mrd)} Milliarden`);
  if (mio) parts.push(mio === 1 ? 'eine Million' : `${below1000(mio)} Millionen`);
  let tail = '';
  if (tsd) tail += `${below1000(tsd)}tausend`;
  // „eins“ am Ende: 1 → eins, 101 → einhunderteins, aber 21 → einundzwanzig
  if (rest) tail += below1000(rest) + (rest % 100 === 1 ? 's' : '');
  if (tail) parts.push(tail);
  return parts.join(' ');
}

/**
 * Zahlwörter mit Pausen an den natürlichen Stellen, zum langsamen Vorlesen:
 * 3040005 → "drei Millionen, vierzigtausend, fünf".
 */
export function numberToWordsSlow(n: number): string {
  const parts: string[] = [];
  for (const unit of [1e12, 1e9, 1e6]) {
    const g = Math.floor(n / unit) % 1000;
    if (g) parts.push(numberToWords(g * unit));
  }
  const tsd = Math.floor(n / 1e3) % 1000;
  const rest = n % 1e3;
  // „…tausend“ als eigener Teil; numberToWords(1000·x) endet schon auf „tausend“
  if (tsd) parts.push(numberToWords(tsd * 1000));
  if (rest) parts.push(numberToWords(rest));
  return parts.length ? parts.join(', ') : 'null';
}

// ---------- Römische Zahlen ----------

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

/** 1–3999 in der üblichen Schreibweise (mit IV, IX, XL …). */
export function toRoman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

/** Liest römische Zahlen, auch „unübliche“ wie IIII (Rückgabe NaN bei ungültigen Zeichen). */
export function fromRoman(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUES[s[i]];
    if (v === undefined) return NaN;
    const next = ROMAN_VALUES[s[i + 1]] ?? 0;
    sum += v < next ? -v : v;
  }
  return sum;
}

export const PLACE_NAMES = ['Einer', 'Zehner', 'Hunderter', 'Tausender'] as const;

/** Zerlegt eine Zahl in Stellen, Index 0 = Einer. */
export function digitsOf(n: number, places = 4): number[] {
  return Array.from({ length: places }, (_, i) => Math.floor(n / 10 ** i) % 10);
}

export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Zufallszahl mit `digits` Stellen, bei der gern auch Nullen in der Mitte vorkommen
 * (3 047, 2 005). Gerade diese Zahlen sind beim Stellenwert die tückischen.
 */
export function interestingNumber(digits: number): number {
  let s = String(randInt(1, 9));
  for (let i = 1; i < digits; i++) s += Math.random() < 0.3 ? '0' : String(randInt(0, 9));
  return Number(s);
}

/** Rundet auf die gegebene Stufe (10, 100, 1000 …), kaufmännisch. */
export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}
