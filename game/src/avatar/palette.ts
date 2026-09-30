// Palettentausch für den Avatar.
// Die Sprites sind mit Schlüsselfarben gezeichnet: Haare magenta, Kleidung grün.
// Diese Pixel werden per Farbton erkannt und auf die gewählte Farbe umgefärbt,
// Helligkeit und Sättigung bleiben relativ erhalten, damit die Schattierung stimmt.

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

export const HAIR_COLORS: ColorOption[] = [
  { id: 'schwarz', name: 'Schwarz', hex: '#2b2522' },
  { id: 'dunkelbraun', name: 'Dunkelbraun', hex: '#5b3a24' },
  { id: 'braun', name: 'Braun', hex: '#8c5a30' },
  { id: 'kupfer', name: 'Kupfer', hex: '#b9542a' },
  { id: 'blond', name: 'Blond', hex: '#e2b85a' },
  { id: 'hellblond', name: 'Hellblond', hex: '#f1dea2' },
  { id: 'silber', name: 'Silber', hex: '#d6d8e2' },
  { id: 'blau', name: 'Blau', hex: '#3d6bd4' },
  { id: 'magenta', name: 'Magenta', hex: '#d2308f' },
];

export const CLOTH_COLORS: ColorOption[] = [
  { id: 'gruen', name: 'Grün', hex: '#4fae3b' },
  { id: 'blau', name: 'Blau', hex: '#3b5fc2' },
  { id: 'rot', name: 'Rot', hex: '#ba3434' },
  { id: 'violett', name: 'Violett', hex: '#7242b2' },
  { id: 'ocker', name: 'Ocker', hex: '#cf9f2f' },
  { id: 'tuerkis', name: 'Türkis', hex: '#2a9b9b' },
  { id: 'grau', name: 'Grau', hex: '#6c6c74' },
  { id: 'schwarz', name: 'Schwarz', hex: '#34343c' },
  { id: 'weiss', name: 'Weiß', hex: '#e6e6e2' },
];

interface KeyRange {
  hueMin: number;
  hueMax: number;
  satMin: number;
  valMin: number;
  refSat: number;
  refVal: number;
}

// Werte aus der Analyse der generierten Sprites: Haare liegen bei 300–330°, Glanzlichter
// im Haar bis 355°. Das weinrot schattierte hintere Hosenbein liegt ebenfalls bei 335–355°.
// Deshalb gilt der weite Bereich nur im Kopfbereich jedes Frames, darunter der enge.
const HAIR_KEY: KeyRange = { hueMin: 290, hueMax: 333, satMin: 0.5, valMin: 0.15, refSat: 0.8, refVal: 0.72 };
const HAIR_KEY_HEAD: KeyRange = { ...HAIR_KEY, hueMax: 356 };
// Helle, weniger gesättigte Glanzlichter im Haar und die Augen (teils lila bis 280°). Haut und Wangen liegen
// bei 0–10° bzw. um 350° und werden von diesem Bereich nicht erfasst.
const HAIR_KEY_HEAD_LIGHT: KeyRange = { ...HAIR_KEY, hueMin: 270, hueMax: 335, satMin: 0.35 };
const HEAD_FRACTION = 0.45; // oberer Anteil eines Frames, der als Kopf gilt
const CLOTH_KEY: KeyRange = { hueMin: 65, hueMax: 160, satMin: 0.35, valMin: 0.12, refSat: 0.72, refVal: 0.68 };

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [rgb[0] + m, rgb[1] + m, rgb[2] + m];
}

function hexToHsv(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return rgbToHsv(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function matches(key: KeyRange, h: number, s: number, v: number): boolean {
  return h >= key.hueMin && h <= key.hueMax && s >= key.satMin && v >= key.valMin;
}

/** Färbt die Pixel eines Canvas in place um. `frameHeight` ist die Höhe eines Frames im Sheet. */
export function recolorCanvas(
  canvas: HTMLCanvasElement,
  hairHex: string,
  clothHex: string,
  frameHeight: number,
): void {
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hair = hexToHsv(hairHex);
  const cloth = hexToHsv(clothHex);

  const headRows = frameHeight * HEAD_FRACTION;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const y = Math.floor(i / 4 / canvas.width);
    const inHead = y % frameHeight < headRows;
    const [h, s, v] = rgbToHsv(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    let target: [number, number, number] | null = null;
    let key: KeyRange | null = null;
    const hairKey = !inHead
      ? HAIR_KEY
      : matches(HAIR_KEY_HEAD, h, s, v)
        ? HAIR_KEY_HEAD
        : HAIR_KEY_HEAD_LIGHT;
    if (matches(hairKey, h, s, v)) {
      target = hair;
      key = hairKey;
    } else if (matches(CLOTH_KEY, h, s, v)) {
      target = cloth;
      key = CLOTH_KEY;
    }
    if (!target || !key) continue;
    const ns = clamp01(target[1] * (s / key.refSat));
    const nv = clamp01(target[2] * (v / key.refVal));
    const [r, g, b] = hsvToRgb(target[0], ns, nv);
    d[i] = Math.round(r * 255);
    d[i + 1] = Math.round(g * 255);
    d[i + 2] = Math.round(b * 255);
  }
  ctx.putImageData(img, 0, 0);
}
