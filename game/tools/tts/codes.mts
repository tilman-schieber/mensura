// Würfelt den Vorrat an Tresor-Codes und gibt ihn mit Zahlwörtern als JSON aus.
// Quelle der Wörter ist src/learn/numbers.ts, damit Anzeige und Aufnahme übereinstimmen.
import { interestingNumber, numberToWords, numberToWordsSlow } from '../../src/learn/numbers.ts';
import { VAULT_DIGITS } from '../../src/learn/vaultCodes.ts';

const PER_TIER = Number(process.argv[2] ?? 30);
const out: { n: number; digits: number; words: string; slow: string }[] = [];
for (const digits of VAULT_DIGITS) {
  const seen = new Set<number>();
  while (seen.size < PER_TIER) seen.add(interestingNumber(digits));
  for (const n of seen) out.push({ n, digits, words: numberToWords(n), slow: numberToWordsSlow(n) });
}
console.log(JSON.stringify(out));
