import Phaser from 'phaser';
import { CLOTH_COLORS, HAIR_COLORS, recolorCanvas } from './palette';

export const HAIR_TYPES = [
  { id: 'kurz', name: 'Kurz' },
  { id: 'strubbel', name: 'Strubbelkopf' },
  { id: 'kurzlocken', name: 'Kurze Locken' },
  { id: 'lang', name: 'Lang' },
  { id: 'zoepfe', name: 'Zöpfe' },
  { id: 'locken', name: 'Große Locken' },
] as const;

export const CLOTH_TYPES = [
  { id: 'hose', name: 'Tunika & Hose' },
  { id: 'robe', name: 'Robe' },
] as const;

export type HairType = (typeof HAIR_TYPES)[number]['id'];
export type ClothType = (typeof CLOTH_TYPES)[number]['id'];
export type Direction = 'south' | 'east' | 'north' | 'west';

export interface AvatarLook {
  name: string;
  hairType: HairType;
  hairColor: string; // id aus HAIR_COLORS
  clothType: ClothType;
  clothColor: string; // id aus CLOTH_COLORS
}

export const DEFAULT_LOOK: AvatarLook = {
  name: '',
  hairType: 'kurz',
  hairColor: 'braun',
  clothType: 'hose',
  clothColor: 'gruen',
};

// Aufbau der Spritesheets (erzeugt von tools/build_avatar_sheets.py):
// eine Zeile pro Richtung, Spalte 0 = Stehen, danach die Lauf-Frames.
export const SHEET = {
  frameWidth: 80,
  frameHeight: 80,
  directions: ['south', 'east', 'north', 'west'] as Direction[],
  walkFrames: 6,
};

export const sheetKey = (hair: HairType, cloth: ClothType) => `avatar-${hair}-${cloth}`;

export function preloadAvatarSheets(scene: Phaser.Scene): void {
  for (const h of HAIR_TYPES) {
    for (const c of CLOTH_TYPES) {
      scene.load.image(sheetKey(h.id, c.id), `assets/avatar/${h.id}_${c.id}.png`);
    }
  }
}

const hex = (list: { id: string; hex: string }[], id: string) =>
  (list.find((o) => o.id === id) ?? list[0]).hex;

/**
 * Baut aus dem Grund-Sheet eine umgefärbte Textur mit Frames und Animationen.
 * Frames heißen `<richtung>-<n>`, Animationen `<textureKey>-walk-<richtung>`.
 * Existiert die Textur schon, wird nur ihr Inhalt neu gezeichnet. So bleiben Sprites,
 * die sie gerade anzeigen, und ihre Animationen gültig.
 */
export function buildAvatarTexture(scene: Phaser.Scene, look: AvatarLook, textureKey: string): void {
  const source = scene.textures.get(sheetKey(look.hairType, look.clothType)).getSourceImage() as HTMLImageElement;
  const { frameWidth: w, frameHeight: fh, directions, walkFrames } = SHEET;

  let tex = scene.textures.exists(textureKey)
    ? (scene.textures.get(textureKey) as Phaser.Textures.CanvasTexture)
    : null;

  if (!tex) {
    tex = scene.textures.createCanvas(textureKey, source.width, source.height)!;
    directions.forEach((dir, row) => {
      for (let col = 0; col <= walkFrames; col++) {
        tex!.add(`${dir}-${col}`, 0, col * w, row * fh, w, fh);
      }
    });
  }

  const ctx = tex.getContext();
  ctx.clearRect(0, 0, tex.width, tex.height);
  ctx.drawImage(source, 0, 0);
  recolorCanvas(tex.getCanvas(), hex(HAIR_COLORS, look.hairColor), hex(CLOTH_COLORS, look.clothColor), fh);
  tex.refresh();

  for (const dir of directions) {
    const animKey = `${textureKey}-walk-${dir}`;
    if (scene.anims.exists(animKey)) continue;
    scene.anims.create({
      key: animKey,
      frames: Array.from({ length: walkFrames }, (_, i) => ({ key: textureKey, frame: `${dir}-${i + 1}` })),
      frameRate: 10,
      repeat: -1,
    });
  }
}
