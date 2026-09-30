// Sprachausgabe über die Web Speech API des Browsers.
// Wird für Diktat-Rätsel gebraucht und zum Vorlesen von Dialogen.

import { loadPrefs } from '../save';

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'de-DE') ?? voices.find((v) => v.lang.startsWith('de')) ?? null;
}

if ('speechSynthesis' in window) {
  voice = pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => (voice = pickVoice()));
}

export function canSpeak(): boolean {
  return 'speechSynthesis' in window;
}

export function speak(text: string, rate = 0.9): void {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE';
  if (voice) u.voice = voice;
  u.rate = rate;
  u.volume = loadPrefs().volume;
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) speechSynthesis.cancel();
}
