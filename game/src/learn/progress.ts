import { loadSave, writeSave } from '../save';
import type { SkillId } from './skills';

// Könnensstand pro Skill. `level` liegt zwischen 0 (neu) und 1 (sicher) und steuert,
// wie schwer die Aufgaben werden. Richtige Lösungen ohne Hilfe heben ihn deutlich,
// mit Hilfe nur wenig; Fehler senken ihn etwas. So wächst die Schwierigkeit langsam
// mit, fällt aber nach einem Fehler nicht gleich ganz zurück.
//
// Verteilte Wiederholung: Jeder Skill hat einen Abstand in Tagen (`interval`) und ein
// Datum, an dem er wieder dran ist (`due`). Wer einen fälligen Skill ohne Hilfe richtig
// löst, bekommt einen längeren Abstand (1 → 2 → 5 → 12 → 28 → 60 Tage); ein Fehler
// halbiert ihn, und der Skill ist schon morgen wieder dran. Was lange überfällig ist,
// verblasst: Die Schwierigkeit sinkt langsam (bis auf 60 % des alten Stands), damit
// man nach den Ferien nicht mit den schwersten Aufgaben anfängt.

export interface SkillStat {
  level: number;
  attempts: number;
  correct: number;
  lastSeen: number; // Zeitstempel (ms)
  /** Abstand bis zur nächsten Wiederholung in Tagen (fehlt in alten Spielständen) */
  interval?: number;
  /** ab diesem Zeitpunkt (ms) ist der Skill wieder dran */
  due?: number;
  /** wie oft eine Hinweisstufe gebraucht wurde (für die Eltern-Ansicht) */
  hints?: number;
}

const START: SkillStat = { level: 0, attempts: 0, correct: 0, lastSeen: 0 };
const DAY = 24 * 60 * 60 * 1000;
const MAX_INTERVAL = 60;

/** Uhr des Spiels. Im Entwicklungsmodus lässt sie sich vorstellen (`?tage=3`), um die Wiederholung zu testen. */
let offsetDays = 0;
export function setClockOffset(days: number): void {
  offsetDays = days;
}
export function now(): number {
  return Date.now() + offsetDays * DAY;
}

/** Kalendertag (lokal) als Text, z. B. „2026-10-11“ */
export function today(t = now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Beginn des Kalendertags (lokal) */
function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Alte Spielstände kennen weder Abstand noch Fälligkeit: aus dem Könnensstand ableiten. */
function withSchedule(s: SkillStat): Required<SkillStat> {
  const interval = s.interval ?? Math.max(1, Math.round(1 + s.level * 6));
  const due = s.due ?? (s.lastSeen ? s.lastSeen + interval * DAY : 0);
  return { ...s, interval, due, hints: s.hints ?? 0 };
}

export function getStat(skill: SkillId): Required<SkillStat> {
  return withSchedule(loadSave().progress[skill] ?? { ...START });
}

/** Wie viele Tage ein geübter Skill überfällig ist (0 = nicht fällig). */
export function overdueDays(s: SkillStat, t = now()): number {
  const st = withSchedule(s);
  if (!st.attempts || !st.due) return 0;
  return Math.max(0, (t - st.due) / DAY);
}

/** Ist der Skill heute dran? (Tagesgenau: was im Laufe des Tages fällig wird, zählt schon.) */
export function isDue(skill: SkillId, t = now()): boolean {
  const s = getStat(skill);
  return s.attempts > 0 && s.due > 0 && startOfDay(s.due) <= startOfDay(t);
}

/** Könnensstand mit Verblassen: lange Überfälliges wird langsam wieder leichter. */
function effective(s: SkillStat, t = now()): number {
  const fade = Math.max(0.6, 1 - 0.015 * overdueDays(s, t));
  return s.level * fade;
}

/** Schwierigkeit für die nächste Aufgabe: das Können in diesem Skill (0–1). */
export function getLevel(skill: SkillId): number {
  return effective(getStat(skill));
}

/** Alle geübten Skills, die heute dran sind, die am längsten überfälligen zuerst. */
export function dueSkills(skills: SkillId[], t = now()): SkillId[] {
  return skills
    .filter((id) => isDue(id, t))
    .sort((a, b) => overdueDays(getStat(b), t) / getStat(b).interval - overdueDays(getStat(a), t) / getStat(a).interval);
}

/**
 * Trägt einen Versuch ein.
 * @param hintsUsed wie viele Stufen der Hinweis-Leiter benutzt wurden
 */
export function recordAttempt(skills: SkillId[], correct: boolean, hintsUsed = 0): void {
  const save = loadSave();
  const t = now();
  for (const skill of skills) {
    const s = withSchedule({ ...START, ...save.progress[skill] });
    const first = s.attempts === 0;
    const wasDue = !first && startOfDay(s.due) <= startOfDay(t);
    // Verblasstes Können zählt ab jetzt als echter Stand
    s.level = effective(s, t);
    s.attempts += 1;
    s.lastSeen = t;
    if (hintsUsed) s.hints += 1;
    if (correct) {
      s.correct += 1;
      const gain = hintsUsed === 0 ? 0.12 : hintsUsed === 1 ? 0.06 : 0.02;
      s.level = Math.min(1, s.level + gain);
      if (first) {
        s.interval = 1;
        s.due = t + DAY;
      } else if (wasDue) {
        // Gewusst, obwohl es länger her war: nächstes Mal mit größerem Abstand
        const factor = hintsUsed === 0 ? 2.3 : hintsUsed === 1 ? 1.3 : 1;
        s.interval = Math.min(MAX_INTERVAL, Math.max(1, Math.round(s.interval * factor)));
        s.due = t + s.interval * DAY;
      }
      // Noch einmal am selben Tag geübt: Der Plan bleibt, wie er ist.
    } else {
      s.level = Math.max(0, s.level - 0.05);
      // Gleich morgen noch einmal, danach wieder in kürzerem Abstand
      s.interval = Math.max(1, Math.floor(s.interval / 2));
      s.due = Math.min(s.due || Infinity, t + DAY);
    }
    save.progress[skill] = s;
  }
  writeSave(save);
}

/** Wählt aus einer Stufenliste den Eintrag passend zum Können (0..1). */
export function pickByLevel<T>(level: number, tiers: T[]): T {
  const i = Math.min(tiers.length - 1, Math.floor(level * tiers.length));
  return tiers[i];
}
