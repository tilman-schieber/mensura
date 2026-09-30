// Schulthemen für den Schulmodus, in der Reihenfolge des Bildungsplans
// (siehe ../../../konzept/spielkonzept.md, „Das Spiel wächst mit dem Schuljahr“).
//
// Ein Elternteil oder das Kind hakt im Menü ab, was im Unterricht schon dran war.
// Nicht abgehakte Themen bleiben spielbar, aber nur auf Einstiegsniveau
// (siehe `levelCap` in progress.ts). Regionen öffnen sich erst mit ihrem Thema.

export interface Topic {
  id: string;
  name: string;
  term: string;
  /** Skill-IDs (Schlüssel in SKILLS), die zu diesem Thema gehören */
  skills: string[];
  /** Region, die sich mit diesem Thema öffnet */
  region?: string;
  /** noch nicht im Spiel enthalten */
  later?: boolean;
}

export const TOPICS: Topic[] = [
  { id: 'stellenwert', name: 'Große Zahlen und Stellenwert', term: 'Klasse 5, Herbst', skills: ['Z1', 'Z2'] },
  { id: 'zahlenstrahl', name: 'Zahlenstrahl', term: 'Klasse 5, Herbst', skills: ['Z6'] },
  { id: 'runden', name: 'Runden', term: 'Klasse 5, Herbst', skills: ['Z18'] },
  { id: 'zahlsysteme', name: 'Römische Zahlen, Zweiersystem', term: 'Klasse 5, Herbst', skills: ['Z1S'] },
  { id: 'kopfrechnen', name: 'Kopfrechnen und Überschlag', term: 'Klasse 5, Winter', skills: ['Z11'] },
  {
    id: 'schriftlich',
    name: 'Schriftlich rechnen (+ − · :), Probe',
    term: 'Klasse 5, Winter',
    skills: ['Z12', 'Z21'],
    region: 'Rechenwerk',
  },
  {
    id: 'terme',
    name: 'Terme, Klammern, Rechengesetze',
    term: 'Klasse 5, Winter',
    skills: ['Z22', 'Z23', 'Z24', 'Z25', 'Z27'],
  },
  {
    id: 'geometrie',
    name: 'Figuren, Symmetrie, Koordinaten',
    term: 'Klasse 5, Frühjahr',
    skills: ['R4', 'R6', 'R12', 'R13'],
    region: 'Spiegeltempel',
  },
  {
    id: 'groessen',
    name: 'Größen und Einheiten (Länge, Gewicht, Zeit)',
    term: 'Klasse 5, Sommer',
    skills: ['M5', 'M5M', 'M5Z', 'M6'],
    region: 'Riesental',
  },
  {
    id: 'flaechen',
    name: 'Umfang, Flächen, Netze, Volumen',
    term: 'Klasse 5, Sommer',
    skills: ['M9', 'M13', 'M15', 'M15O', 'R14'],
    region: 'Würfelfestung',
  },
  { id: 'brueche', name: 'Teilbarkeit, Primzahlen, Brüche', term: 'Klasse 6, Herbst', skills: [], later: true },
  { id: 'negativ', name: 'Dezimalzahlen, Prozent, negative Zahlen', term: 'Klasse 6, Winter', skills: [], later: true },
  { id: 'zuordnungen', name: 'Winkel, Kreis, Zuordnungen, Dreisatz', term: 'Klasse 6, Frühjahr', skills: [], later: true },
];

/** Zu welchem Thema gehört ein Skill? */
export function topicOfSkill(skill: string): Topic | undefined {
  return TOPICS.find((t) => t.skills.includes(skill));
}
