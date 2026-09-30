import type { SaveGame } from './save';

// Überblick über den Spielfortschritt, für Titelbild und Spielstände.

/** Die sieben Urmaße, mit Merker für die geborgene Hälfte (null = noch nicht im Spiel) */
export const URMASSE: { name: string; tint: number; flag: string | null }[] = [
  { name: 'Zahl', tint: 0xffffff, flag: 'mine_outer_done' },
  { name: 'Zeichen', tint: 0xffb08a, flag: null },
  { name: 'Teil', tint: 0xf0e08a, flag: null },
  { name: 'Größe', tint: 0xc8f0a8, flag: 'valley_done' },
  { name: 'Form', tint: 0xbfe6ff, flag: 'temple_done' },
  { name: 'Raum', tint: 0xb8c8ff, flag: 'fort_done' },
  { name: 'Takt', tint: 0xe0b8ff, flag: null },
];

/** Jedes Urmaß ist in zwei Hälften zerbrochen. */
export const SPLINTER_TOTAL = URMASSE.length * 2;

export function splinters(save: SaveGame): number {
  return URMASSE.filter((u) => u.flag && save.flags[u.flag]).length;
}

export const PLACE_NAMES: Record<string, string> = {
  Village: 'Eichstadt',
  Mine: 'Stellenstollen',
  MineDeep: 'Rechenwerk',
  Temple: 'Spiegeltempel',
  Valley: 'Riesental',
  Fortress: 'Würfelfestung',
};

export function placeName(save: SaveGame): string {
  return PLACE_NAMES[save.place?.scene ?? 'Village'] ?? 'Eichstadt';
}

export function formatPlaytime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  if (min < 1) return 'gerade begonnen';
  if (min < 60) return `${min} Min.`;
  return `${Math.floor(min / 60)} Std. ${min % 60} Min.`;
}

export function formatSavedAt(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date();
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `heute, ${time}`;
  return `${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' })}, ${time}`;
}
