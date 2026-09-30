import type { AvatarLook } from './avatar/avatar';
import type { SkillStat } from './learn/progress';

// Spielstand im Browser. Später IndexedDB plus Export/Import als Datei,
// für den Anfang reicht localStorage. Zugriffe können in privaten Fenstern
// scheitern, deshalb alles in try/catch.

const KEY = 'mensura.save.v1';

export interface SaveGame {
  version: 1;
  avatar: AvatarLook | null;
  /** Könnensstand pro Skill-ID */
  progress: Record<string, SkillStat>;
  /** Story-Merker, z. B. `elle_intro`, `mine_cart_1` */
  flags: Record<string, boolean>;
  /** Wo die Figur zuletzt war */
  place: { scene: string; x: number; y: number } | null;
  settings: {
    /** Zeitdruck in Kämpfen gegen Nebelwesen */
    battleTimer: boolean;
    /** Schulmodus: Themen, die im Unterricht schon dran waren (Topic-IDs) */
    topics: Record<string, boolean>;
  };
}

const empty = (): SaveGame => ({ version: 1, avatar: null, progress: {}, flags: {}, place: null, settings: { battleTimer: true, topics: {} } });

export function loadSave(): SaveGame {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as Partial<SaveGame>;
    return data.version === 1 ? { ...empty(), ...data, settings: { ...empty().settings, ...data.settings } } : empty();
  } catch {
    return empty();
  }
}

export function writeSave(save: SaveGame): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Ohne Speicher läuft das Spiel trotzdem, nur ohne Fortschritt.
  }
}

export function getFlag(name: string): boolean {
  return !!loadSave().flags[name];
}

/** Wurde ein Schulthema schon im Unterricht behandelt (Schulmodus)? */
export function topicDone(id: string): boolean {
  return !!loadSave().settings.topics[id];
}

export function setFlag(name: string, value = true): void {
  const save = loadSave();
  save.flags[name] = value;
  writeSave(save);
}
