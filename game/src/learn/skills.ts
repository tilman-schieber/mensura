// Skill-Katalog. Die IDs entsprechen den Lernziel-Dateien (../../01-zahlen.md usw.)
// und damit den Standards des Bildungsplans. Hier stehen nur die Skills, die das Spiel
// schon trainiert; der Rest kommt mit den weiteren Regionen dazu.

export interface Skill {
  id: string;
  name: string;
}

export const SKILLS = {
  Z1: { id: 'Z1', name: 'Stellenwertsystem: bündeln und entbündeln' },
  Z1S: { id: 'Z1', name: 'Andere Zahlsysteme: römische Zahlen, Zweiersystem' },
  Z2: { id: 'Z2', name: 'Große Zahlen lesen und nach Diktat schreiben' },
  Z6: { id: 'Z6', name: 'Zahlen am Zahlenstrahl ablesen und eintragen' },
  Z11: { id: 'Z11', name: 'Kopfrechnen und Überschlag' },
  Z12: { id: 'Z12', name: 'Schriftlich addieren, subtrahieren, multiplizieren, dividieren' },
  Z18: { id: 'Z18', name: 'Runden' },
  Z21: { id: 'Z21', name: 'Probe mit der Umkehraufgabe' },
  Z22: { id: 'Z22', name: 'Sachaufgabe als Term schreiben' },
  Z23: { id: 'Z23', name: 'Fachbegriffe: Summe, Differenz, Produkt, Quotient' },
  Z24: { id: 'Z24', name: 'Rechengesetze geschickt nutzen' },
  Z25: { id: 'Z25', name: 'Klammern und Rechenreihenfolge' },
  Z27: { id: 'Z27', name: 'Unbekannte Zahl rückwärts finden' },
  M5: { id: 'M5', name: 'Längen umrechnen (mm, cm, dm, m, km)' },
  M5M: { id: 'M5', name: 'Gewichte umrechnen (g, kg, t)' },
  M5Z: { id: 'M5', name: 'Zeitspannen berechnen' },
  M6: { id: 'M6', name: 'Größen schätzen' },
  M9: { id: 'M9', name: 'Umfang berechnen' },
  M13: { id: 'M13', name: 'Flächeninhalt berechnen' },
  M15: { id: 'M15', name: 'Volumen von Quadern' },
  M15O: { id: 'M15', name: 'Oberfläche von Quadern' },
  R14: { id: 'R14', name: 'Würfelnetze' },
  R4: { id: 'R4', name: 'Symmetrie erkennen (Achsen, Zentrum)' },
  R6: { id: 'R6', name: 'Vierecke und ihre Eigenschaften' },
  R12: { id: 'R12', name: 'Koordinatensystem' },
  R13: { id: 'R13', name: 'Achsen- und Punktspiegelung durchführen' },
  R1: { id: 'R1', name: 'Parallel und senkrecht' },
  M5G: { id: 'M5', name: 'Geld: Euro und Cent' },
  D1: { id: 'D1', name: 'Strichliste und Häufigkeitstabelle' },
  D3: { id: 'D3', name: 'Säulendiagramme zeichnen' },
  D4: { id: 'D4', name: 'Minimum, Maximum, Mittelwert' },
  D5: { id: 'D5', name: 'Daten aus Diagrammen ablesen' },
  PLAUS: { id: '2.2.13', name: 'Ergebnisse prüfen: Überschlag und Plausibilität' },
} as const satisfies Record<string, Skill>;

export type SkillId = keyof typeof SKILLS;
