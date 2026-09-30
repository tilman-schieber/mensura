import { playClip, stopClip } from './audio';
import { canSpeak, speak, stopSpeaking } from './speech';
import { loadPrefs } from '../save';

// Vertonte Dialoge. Alle festen Dialogzeilen im Code werden vorab mit Piper
// aufgenommen (tools/tts/make_dialog_audio.py), eine Stimme pro Figur.
// Dateiname = Hash aus Sprecher und Text; ändert man eine Zeile, gibt es eine
// neue Aufnahme und die alte wird nicht mehr benutzt.
// Zeilen mit eingesetzten Werten (z. B. „Noch 2 Stationen“) haben keine Aufnahme;
// dafür springt die Browser-Stimme ein, falls vorhanden.

const BASE = 'assets/audio/dialog/';
let recorded = new Set<string>();

/** FNV-1a (32 Bit) – muss mit tools/tts/make_dialog_audio.py übereinstimmen. */
export function lineHash(speaker: string, text: string): string {
  let h = 0x811c9dc5;
  const s = `${speaker}\u0000${text}`;
  const bytes = new TextEncoder().encode(s);
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Liste der vorhandenen Aufnahmen setzen (aus index.json, geladen in der Boot-Szene). */
export function setRecordedLines(hashes: string[] | undefined): void {
  recorded = new Set(hashes ?? []);
}

export function speakLine(speaker: string, text: string): void {
  if (!loadPrefs().voice) {
    stopLine();
    return;
  }
  const h = lineHash(speaker, text);
  if (recorded.has(h)) {
    stopSpeaking();
    playClip(`${BASE}${h}.mp3`).catch(() => canSpeak() && speak(text));
  } else {
    stopClip();
    speak(text);
  }
}

export function stopLine(): void {
  stopClip();
  stopSpeaking();
}
