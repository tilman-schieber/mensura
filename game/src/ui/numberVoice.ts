import { numberToWords, numberToWordsSlow } from '../learn/numbers';
import { loadClip, playClip, stopClip } from './audio';
import { canSpeak, speak } from './speech';

// Zahlen vorlesen mit mitgelieferten Aufnahmen (public/assets/audio/codes/).
// Jede Zahl ist am Stück gesprochen, damit Betonung und Fluss natürlich klingen.
// Es gibt daher nur Aufnahmen für einen festen Vorrat an Zahlen (index.json);
// die Rätsel wählen ihre Zahlen aus diesem Vorrat. Fehlt eine Aufnahme, springt
// die Browser-Sprachausgabe ein (falls das System Stimmen hat).

const BASE = 'assets/audio/codes/';

export type CodePool = Record<string, number[]>;

const fileOf = (n: number, slow: boolean) => `${BASE}${n}${slow ? '_langsam' : ''}.mp3`;

export const stopNumber = stopClip;

/** Liest eine Zahl vor; `slow` ist die langsame Aufnahme mit Pausen zwischen den Gruppen. */
export async function speakNumber(n: number, slow = false): Promise<void> {
  try {
    await playClip(fileOf(n, slow));
  } catch (err) {
    console.warn(`Keine Aufnahme für ${n}, nutze Browser-Stimme`, err);
    if (canSpeak()) speak(slow ? numberToWordsSlow(n) : numberToWords(n), slow ? 0.7 : 0.9);
  }
}

/** Lädt beide Aufnahmen einer Zahl vorab, damit das Abspielen sofort startet. */
export function preloadNumber(n: number): void {
  void loadClip(fileOf(n, false)).catch(() => {});
  void loadClip(fileOf(n, true)).catch(() => {});
}
