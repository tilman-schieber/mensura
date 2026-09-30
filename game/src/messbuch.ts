import type { DialogLine } from './ui/dialog';

// Vagors Messbuch: eine versteckte Seite pro Ort, jede mit einer Rechnung aus der Zeit, als
// Vagor und Elle die Große Brücke planten, und einem Satz von Vagor darunter.
// Manche Rechnungen enthalten einen Fehler, den man im Menü (Messbuch) finden kann
// (Denkstrategie „Ergebnis prüfen“). Die Seiten erzählen die Vorgeschichte in Stücken.

export interface MessbuchPage {
  id: string;
  /** Ort, an dem die Seite versteckt ist */
  place: string;
  title: string;
  /** Rechenzeilen der Seite */
  lines: string[];
  /** Index der falschen Zeile, oder null, wenn alles stimmt */
  error: number | null;
  /** Erklärung nach dem Prüfen */
  explain: string;
  /** Vagors Satz unter der Rechnung (wird beim Finden vorgelesen, darum als Dialogzeile) */
  note: DialogLine;
}

export const PAGES: MessbuchPage[] = [
  {
    id: 'page_village',
    place: 'Eichstadt',
    title: 'Tag 1: Der Fluss',
    lines: ['Breite des Flusses: 84 m', 'Auflager links und rechts: je 8 m', 'Länge der Brücke: 84 m + 2 · 8 m = 100 m'],
    error: null,
    explain: 'Alles richtig: 2 · 8 m = 16 m, und 84 m + 16 m = 100 m.',
    note: { speaker: 'Vagor', text: 'Elle sagt, ich soll die Probe machen. Wozu? Ich irre mich nie.' },
  },
  {
    id: 'page_mine',
    place: 'Stellenstollen',
    title: 'Steine für die Pfeiler',
    lines: ['4 Pfeiler zu je 2 500 Steinen', '4 · 2 500 = 100 000 Steine', 'Die Zwerge liefern 1 000 Steine pro Woche'],
    error: 1,
    explain: '4 · 2 500 sind 10 000, nicht 100 000. Eine Null zu viel: Der Stellenwert ist verrutscht.',
    note: { speaker: 'Vagor', text: 'Durin wollte die Steine nachzählen. Ich habe ihn weggeschickt.' },
  },
  {
    id: 'page_temple',
    place: 'Spiegeltempel',
    title: 'Die Bögen',
    lines: ['Linker Bogen: 42 m', 'Rechter Bogen: 42 m, genau gespiegelt', 'Mittelstück: 100 m − 42 m − 42 m = 16 m'],
    error: null,
    explain: 'Alles richtig: 42 m + 42 m + 16 m = 100 m, und die Bögen sind gleich lang wie Spiegelbilder.',
    note: { speaker: 'Vagor', text: 'Lumen sagt, Spiegel lügen nicht. Ich brauche keine Spiegel, ich habe Zahlen.' },
  },
  {
    id: 'page_valley',
    place: 'Riesental',
    title: 'Die Seile',
    lines: ['12 Seile zu je 850 cm', '12 · 850 cm = 10 200 cm', '10 200 cm = 1 020 m'],
    error: 2,
    explain: '100 cm sind 1 m. Also sind 10 200 cm nur 102 m, nicht 1 020 m. Ein Fehler beim Umrechnen der Einheiten.',
    note: { speaker: 'Vagor', text: 'Die Riesen haben gelacht, als ich mich verrechnet habe. Ich habe es verbessert. Diesmal.' },
  },
  {
    id: 'page_fortress',
    place: 'Würfelfestung',
    title: 'Beton für die Auflager',
    lines: ['Ein Auflager: 4 m · 2 m · 1 m = 8 m³', 'Zwei Auflager: 2 · 8 m³ = 16 m³', 'Morgen wird gegossen'],
    error: null,
    explain: 'Alles richtig: Länge mal Breite mal Höhe, 4 · 2 · 1 = 8, und zweimal 8 m³ sind 16 m³.',
    note: { speaker: 'Vagor', text: 'Morgen ist die Einweihung. Elle hat die Probe nicht gemacht. Gut so. Sie vertraut mir.' },
  },
];

export function pageById(id: string): MessbuchPage | undefined {
  return PAGES.find((p) => p.id === id);
}
