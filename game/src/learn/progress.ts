import { loadSave, writeSave } from '../save';
import type { SkillId } from './skills';

// Könnensstand pro Skill. `level` liegt zwischen 0 (neu) und 1 (sicher) und steuert,
// wie schwer die Aufgaben werden. Richtige Lösungen ohne Hilfe heben ihn deutlich,
// mit Hilfe nur wenig; Fehler senken ihn etwas. So wächst die Schwierigkeit langsam
// mit, fällt aber nach einem Fehler nicht gleich ganz zurück.

export interface SkillStat {
  level: number;
  attempts: number;
  correct: number;
  lastSeen: number; // Zeitstempel (ms)
}

const START: SkillStat = { level: 0, attempts: 0, correct: 0, lastSeen: 0 };

export function getStat(skill: SkillId): SkillStat {
  return loadSave().progress[skill] ?? { ...START };
}

/** Schwierigkeit für die nächste Aufgabe: das Können in diesem Skill (0–1). */
export function getLevel(skill: SkillId): number {
  return getStat(skill).level;
}

/**
 * Trägt einen Versuch ein.
 * @param hintsUsed wie viele Stufen der Hinweis-Leiter benutzt wurden
 */
export function recordAttempt(skills: SkillId[], correct: boolean, hintsUsed = 0): void {
  const save = loadSave();
  for (const skill of skills) {
    const s = { ...START, ...save.progress[skill] };
    s.attempts += 1;
    s.lastSeen = Date.now();
    if (correct) {
      s.correct += 1;
      const gain = hintsUsed === 0 ? 0.12 : hintsUsed === 1 ? 0.06 : 0.02;
      s.level = Math.min(1, s.level + gain);
    } else {
      s.level = Math.max(0, s.level - 0.05);
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
