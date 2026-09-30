// Kleiner Abspieler für mitgelieferte Sprachaufnahmen (Web Audio).
// Immer nur eine Aufnahme gleichzeitig: Eine neue beendet die vorige.

let ctx: AudioContext | null = null;
const cache = new Map<string, Promise<AudioBuffer>>();
let current: AudioBufferSourceNode | null = null;

function context(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

export function loadClip(url: string): Promise<AudioBuffer> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((data) => context().decodeAudioData(data));
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

export function stopClip(): void {
  try {
    current?.stop();
  } catch {
    // schon beendet
  }
  current = null;
}

/** Spielt eine Aufnahme ab. Wirft, wenn sie nicht geladen werden kann (für Rückfall auf Browser-Stimme). */
export async function playClip(url: string): Promise<void> {
  stopClip();
  const ac = context();
  if (ac.state === 'suspended') await ac.resume();
  const buf = await loadClip(url);
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(ac.destination);
  src.start();
  current = src;
}
