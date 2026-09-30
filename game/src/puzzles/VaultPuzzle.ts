import { digitsOf, formatNumber, interestingNumber, numberToWords } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { createNumpad } from '../ui/numpad';
import { VAULT_DIGITS } from '../learn/vaultCodes';
import { preloadNumber, speakNumber, stopNumber, type CodePool } from '../ui/numberVoice';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Zwergentresor“ (große Zahlen lesen und nach Diktat schreiben, Z2).
// Der Zwergenkönig nennt den Code. Man hört ihn (Sprachausgabe) oder liest ihn als
// Zahlwort und stellt ihn am Ziffernfeld ein. Tückisch sind die Nullen:
// „drei Millionen vierzigtausendfünf“ = 3 040 005.

export class VaultPuzzle extends PuzzleScene {
  protected title = 'Der Zwergentresor';
  protected skills: SkillId[] = ['Z2'];

  private code = 0;
  private used = new Set<number>();

  constructor() {
    super('VaultPuzzle');
  }

  preload(): void {
    this.load.json('vault-codes', 'assets/audio/codes/index.json');
  }

  /** Code aus dem Vorrat der gesprochenen Aufnahmen, möglichst ohne Wiederholung. */
  private pickCode(digits: number): number {
    const pool = ((this.cache.json.get('vault-codes') as CodePool | undefined) ?? {})[String(digits)] ?? [];
    const fresh = pool.filter((n) => !this.used.has(n));
    const list = fresh.length ? fresh : pool;
    const n = list.length ? list[Math.floor(Math.random() * list.length)] : interestingNumber(digits);
    this.used.add(n);
    return n;
  }

  create(): void {
    super.create();
    this.events.once('shutdown', stopNumber);
  }

  protected buildRound(): void {
    const digits = pickByLevel(getLevel('Z2'), VAULT_DIGITS);
    this.code = this.pickCode(digits);
    const words = numberToWords(this.code);
    const r = this.round;
    preloadNumber(this.code);

    r.add(text(this, GAME_WIDTH / 2, 96, 'König Durin nennt dir den Code. Stell ihn am Tresor ein!', 24, COLORS.text));

    // Vorlesen mit mitgelieferten Aufnahmen (funktioniert auch ohne Stimmen im Betriebssystem)
    r.add(button(this, 250, 190, 'Anhören', () => void speakNumber(this.code), { width: 200, height: 56, size: 22 }));
    r.add(button(this, 250, 260, 'Langsam', () => void speakNumber(this.code, true), { width: 200, height: 50, size: 20 }));
    this.time.delayedCall(500, () => void speakNumber(this.code));

    // Zahlwort erst als Hinweis
    const wordText = text(this, 250, 360, '', 20, COLORS.goldText).setWordWrapWidth(360).setAlign('center');
    r.add(wordText);

    const pad = createNumpad(this, 700, 300, (n) => this.check(n), 13);
    pad.container.setScale(0.9);
    r.add(pad.container);

    const groups = this.code >= 1e9 ? 'Milliarden, Millionen, Tausender und Rest' : this.code >= 1e6 ? 'Millionen, Tausender und Rest' : 'Tausender und Rest';
    this.hints = [
      `Achte auf die Wörter Milliarde, Million und tausend. Sie teilen die Zahl in Dreiergruppen: ${groups}.`,
      `Jede Dreiergruppe hat genau drei Ziffern. Fehlt etwas, schreibst du Nullen. So heißt der Code als Wort: „${words}“`,
      `Der Code hat ${String(this.code).length} Ziffern und fängt mit ${String(this.code)[0]} an.`,
    ];
    this.onHintShowWords = () => wordText.setText(`„${words}“`);
  }

  private onHintShowWords?: () => void;

  protected onHint(level: number): void {
    if (level >= 1) this.onHintShowWords?.();
  }

  private check(n: number): void {
    if (n === this.code) {
      this.solved(`Klack! ${formatNumber(n)} ist richtig. Der Tresor öffnet sich.`);
      return;
    }
    const a = String(n);
    const b = String(this.code);
    if (a.length !== b.length) {
      this.wrong(`Du hast ${a.length} Ziffern eingegeben, der Code hat ${a.length < b.length ? 'mehr' : 'weniger'}. Denk an die Nullen!`);
      return;
    }
    // Stellen vergleichen und die erste falsche benennen
    const da = digitsOf(n, b.length);
    const db = digitsOf(this.code, b.length);
    const i = [...da.keys()].reverse().find((k) => da[k] !== db[k]) ?? 0;
    const names = ['Einer', 'Zehner', 'Hunderter', 'Tausender', 'Zehntausender', 'Hunderttausender', 'Millionen', 'Zehnmillionen', 'Hundertmillionen', 'Milliarden', 'Zehnmilliarden', 'Hundertmilliarden'];
    this.wrong(`Fast! Bei den ${names[i] ?? 'vorderen Stellen'} stimmt es noch nicht. Hör noch einmal hin.`);
  }
}
