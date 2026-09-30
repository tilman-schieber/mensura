import type { AvatarLook } from './avatar/avatar';
import type { SkillStat } from './learn/progress';

// Spielstände im Browser (localStorage): drei Plätze, einer davon ist aktiv.
// Das Spiel speichert laufend in den aktiven Platz; `loadSave`/`writeSave` arbeiten
// immer auf ihm. Einstellungen, die für alle Spielstände gelten (Lautstärke …),
// liegen getrennt. Zugriffe können in privaten Fenstern scheitern, deshalb alles
// in try/catch; ohne Speicher läuft das Spiel trotzdem, nur ohne Fortschritt.

export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];

const SLOT_KEY = (n: Slot) => `mensura.slot.${n}`;
const ACTIVE_KEY = 'mensura.active';
const PREFS_KEY = 'mensura.prefs';
/** Spielstand aus der Zeit vor den Speicherplätzen; wird zu Platz 1. */
const LEGACY_KEY = 'mensura.save.v1';

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
    /** früher: abgehakte Schulthemen (nicht mehr benutzt, bleibt für alte Spielstände) */
    topics: Record<string, boolean>;
    /**
     * Schriftliche Subtraktion wie in der Grundschule gelernt. Der Bildungsplan BW (Grundschule 3/4,
     * 3.2.1.2 (9)) lässt „Abziehen oder Ergänzen“ offen; unbekannt = beim ersten Mal fragen.
     */
    subtraction?: 'abziehen' | 'ergaenzen';
  };
  /** Gespielte Zeit in Sekunden (nur Zeit in der Welt) */
  playtime: number;
  /** Zeitpunkt der letzten Speicherung (ms seit 1970) */
  savedAt: number;
}

/** Einstellungen für alle Spielstände */
export interface Prefs {
  /** Dialoge vorlesen */
  voice: boolean;
  /** Lautstärke der Stimmen 0–1 */
  volume: number;
  /** Lautstärke der Musik 0–1 */
  music: number;
}

const empty = (): SaveGame => ({
  version: 1,
  avatar: null,
  progress: {},
  flags: {},
  place: null,
  settings: { battleTimer: true, topics: {} },
  playtime: 0,
  savedAt: 0,
});

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // kein Speicher verfügbar
  }
}

/** Prüft und ergänzt einen gelesenen Spielstand; null, wenn er unbrauchbar ist. */
function parse(raw: string | null): SaveGame | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SaveGame>;
    if (data?.version !== 1 || typeof data.flags !== 'object') return null;
    return { ...empty(), ...data, settings: { ...empty().settings, ...data.settings } };
  } catch {
    return null;
  }
}

function migrate(): void {
  const legacy = read(LEGACY_KEY);
  if (legacy === null) return;
  if (read(SLOT_KEY(1)) === null && parse(legacy)) {
    write(SLOT_KEY(1), legacy);
    write(ACTIVE_KEY, '1');
  }
  write(LEGACY_KEY, null);
}
migrate();

// ---------- aktiver Spielstand ----------

export function activeSlot(): Slot | null {
  const n = Number(read(ACTIVE_KEY));
  return (SLOTS as readonly number[]).includes(n) ? (n as Slot) : null;
}

export function setActiveSlot(n: Slot): void {
  write(ACTIVE_KEY, String(n));
}

export function loadSave(): SaveGame {
  const n = activeSlot();
  return (n && parse(read(SLOT_KEY(n)))) || empty();
}

export function writeSave(save: SaveGame): void {
  const n = activeSlot();
  if (!n) return;
  save.savedAt = Date.now();
  write(SLOT_KEY(n), JSON.stringify(save));
}

export function getFlag(name: string): boolean {
  return !!loadSave().flags[name];
}

export function setFlag(name: string, value = true): void {
  const save = loadSave();
  save.flags[name] = value;
  writeSave(save);
}

// ---------- Speicherplätze ----------

export function readSlot(n: Slot): SaveGame | null {
  return parse(read(SLOT_KEY(n)));
}

/** Legt in Platz n ein neues Spiel an und macht ihn zum aktiven. */
export function newGame(n: Slot): void {
  const save = empty();
  save.savedAt = Date.now();
  write(SLOT_KEY(n), JSON.stringify(save));
  setActiveSlot(n);
}

export function deleteSlot(n: Slot): void {
  write(SLOT_KEY(n), null);
  if (activeSlot() === n) write(ACTIVE_KEY, null);
}

/** Speichert den aktiven Spielstand zusätzlich in Platz n und spielt dort weiter. */
export function saveAs(n: Slot): void {
  const save = loadSave();
  setActiveSlot(n);
  writeSave(save);
}

/** Spielstand als Datei-Inhalt (zum Sichern auf dem Gerät) */
export function exportSlot(n: Slot): string | null {
  const save = readSlot(n);
  return save ? JSON.stringify({ game: 'mensura', ...save }, null, 1) : null;
}

/** Liest eine gesicherte Datei in Platz n ein. Gibt false zurück, wenn die Datei nicht passt. */
export function importSlot(n: Slot, content: string): boolean {
  const save = parse(content);
  if (!save || !save.avatar) return false;
  write(SLOT_KEY(n), JSON.stringify(save));
  return true;
}

// ---------- Einstellungen für alle Spielstände ----------

export function loadPrefs(): Prefs {
  const defaults: Prefs = { voice: true, volume: 0.8, music: 0.5 };
  try {
    return { ...defaults, ...(JSON.parse(read(PREFS_KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return defaults;
  }
}

export function writePrefs(prefs: Prefs): void {
  write(PREFS_KEY, JSON.stringify(prefs));
}
