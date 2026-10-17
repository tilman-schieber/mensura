// Dekoration je Ort: Büsche, Blumen, Steine, Fässer, Kristalle … (Bilder von PixelLab,
// public/assets/objects/deco-*.png und mine-*.png). Jede Angabe: Bild, Zelle x, Zelle y,
// blockiert (man läuft nicht hindurch), Größe. Blumen, Gras und Kiesel kann man überlaufen.
// Die Zellen sind so gewählt, dass sie keine Wege, Stationen, Figuren oder Startplätze verdecken.

export type DecoItem = [key: string, x: number, y: number, block?: boolean, scale?: number];

export const DECO: Record<string, DecoItem[]> = {
  Village: [
    ['deco-bush-round', 17, 10, true],
    ['deco-bush-flowering', 4, 4, true],
    ['deco-stump', 22, 4, true],
    ['deco-rock-mossy', 19, 19, true],
    ['deco-hay-bale', 13, 19, true],
    ['deco-barrel', 7, 18, true],
    ['deco-stone-wall', 1, 4, true],
    ['deco-bush-round', 9, 0, true],
    ['deco-flowers-cornflower', 3, 7],
    ['deco-flowers-wild', 1, 8],
    ['deco-flowers-poppy', 25, 19],
    ['deco-flowers-wild', 12, 16],
    ['deco-flowers-cornflower', 23, 5],
    ['deco-grass-tall', 15, 1],
    ['deco-grass-tall', 0, 17],
    ['deco-bush-round', 32, 18, true],
    ['deco-grass-tall', 33, 19],
    ['deco-flowers-poppy', 30, 4],
    ['chicken', 5, 10],
    ['chicken', 6, 10, false, 0.9],
    ['cat', 6, 7],
  ],
  Valley: [
    ['deco-fence', 11, 19, true],
    ['deco-fence', 18, 19, true],
    ['deco-bush-berry', 10, 7, true],
    ['deco-bush-flowering', 19, 7, true],
    ['deco-bush-round', 4, 18, true],
    ['deco-rock-mossy', 21, 4, true],
    ['deco-rock-mossy', 3, 14, true],
    ['deco-stump', 9, 3, true],
    ['deco-log', 24, 19, true],
    ['deco-hay-bale', 19, 14, true],
    ['deco-flowers-wild', 3, 4],
    ['deco-flowers-poppy', 9, 6],
    ['deco-flowers-daisy', 20, 6],
    ['deco-flowers-cornflower', 26, 3],
    ['deco-flowers-wild', 3, 18],
    ['deco-mushrooms', 12, 16],
    ['deco-grass-tall', 18, 12],
    ['deco-grass-tall', 9, 17],
    ['deco-pebbles', 25, 18],
    // alles riesig: Gänseblümchen wie Bäume, eine Schnecke, Eicheln wie Fässer, Kiefern am Hang
    ['giant-daisy', 3, 8, true, 0.7],
    ['giant-daisy', 18, 15, true, 0.6],
    ['giant-snail', 8, 13, true, 0.5],
    ['giant-acorn', 20, 3, true, 0.5],
    ['giant-acorn', 17, 15, true, 0.45],
    ['bridge', 20, 17, false, 0.6],
    ['tree-pine', 10, 3, true, 0.6],
    ['tree-pine', 23, 3, true, 0.6],
    ['tree-pine', 3, 16, true, 0.6],
  ],
  Temple: [
    ['temple-column', 2, 5, true, 0.8],
    ['temple-column', 2, 13, true, 0.8],
    ['temple-column', 22, 5, true, 0.8],
    ['temple-column', 22, 13, true, 0.8],
    ['temple-brazier', 9, 5, true, 0.9],
    ['temple-brazier', 16, 5, true, 0.9],
    ['temple-brazier', 9, 13, true, 0.9],
    ['temple-brazier', 16, 13, true, 0.9],
    ['temple-statue', 10, 4, true, 0.75],
    ['temple-statue', 15, 4, true, 0.75],
  ],
  Fortress: [
    ['fort-banner', 11, 4, true, 0.8],
    ['fort-banner', 14, 4, true, 0.8],
    ['fort-cube-stack', 10, 10, true],
    ['fort-cube-stack', 22, 9, true],
    ['fort-cube-stack', 2, 11, true, 0.8],
    ['fort-scaffold', 22, 14, true, 0.7],
  ],
  Mine: [
    ['mine-crates', 3, 14, true, 0.8],
    ['mine-barrel', 4, 14, true],
    ['mine-lantern-post', 8, 5, true],
    ['mine-lantern-post', 17, 5, true],
    ['mine-crystal-blue', 22, 8, true],
    ['mine-crystal-purple', 3, 8, true],
    ['mine-rubble', 9, 14, true, 0.8],
    ['mine-ore-gold', 7, 6, true],
    ['mine-workbench', 6, 14, true, 0.8],
    ['mine-coal-sack', 8, 14, true],
    ['mine-rope-bucket', 10, 5],
    ['mine-tools', 22, 14, true, 0.8],
    ['mine-stalagmites', 22, 4, true, 0.8],
    ['mine-glow-mushrooms', 17, 8, false, 0.7],
    ['mine-glow-mushrooms', 4, 9, false, 0.7],
  ],
  MineDeep: [
    ['mine-lantern-post', 10, 5, true],
    ['mine-lantern-post', 16, 5, true],
    ['mine-crystal-blue', 3, 5, true],
    ['mine-crystal-purple', 22, 5, true],
    ['mine-crates', 22, 10, true, 0.8],
    ['mine-barrel', 3, 10, true],
    ['mine-coal-sack', 9, 7, true],
    ['mine-workbench', 16, 14, true, 0.8],
    ['mine-tools', 3, 14, true, 0.8],
    ['mine-rubble', 22, 12, true, 0.8],
    ['mine-rope-bucket', 9, 12],
    ['mine-stalagmites', 2, 7, true, 0.8],
    ['mine-stalagmites', 22, 7, true, 0.8],
    ['mine-glow-mushrooms', 4, 8, false, 0.7],
    ['mine-glow-mushrooms', 16, 12, false, 0.7],
    ['mine-glow-mushrooms', 9, 10, false, 0.7],
  ],
};

/** Kleine Bewegung für Dekoration: Flammen flackern, Tiere picken, Katzen atmen */
export const DECO_ANIM: Record<string, 'flicker' | 'peck' | 'breathe' | 'bob'> = {
  'temple-brazier': 'flicker',
  'mine-glow-mushrooms': 'flicker',
  chicken: 'peck',
  cat: 'breathe',
  sheep: 'breathe',
  fox: 'breathe',
};

/** Dinge, die auf dem Boden stehen und einen weichen Schatten bekommen (nicht Flaches wie Blumen oder Kiesel) */
export const SHADOW_KEYS = new Set([
  'tree-oak', 'tree-birch', 'tree-pine', 'tree-apple', 'tree-autumn',
  'deco-bush-round', 'deco-bush-flowering', 'deco-bush-berry', 'deco-barrel', 'deco-stump', 'deco-rock-mossy', 'deco-hay-bale', 'deco-well',
  'mine-barrel', 'mine-crates', 'mine-crystal-blue', 'mine-crystal-purple', 'mine-lantern-post', 'mine-stalagmites', 'mine-cart',
  'temple-column', 'temple-brazier', 'temple-statue', 'giant-daisy', 'giant-snail', 'giant-acorn', 'giant-mushroom', 'giant-boot',
  'fort-cube-stack', 'fort-banner', 'fort-scaffold', 'chicken', 'cat', 'sheep', 'fox', 'lantern', 'market-stall', 'fountain', 'balance', 'mirror', 'prism', 'stele',
]);

/** Größe je Ort: Im Riesental ist alles riesig, in der Mine etwas größer als die kleinen Bilder */
export const DECO_SCALE: Record<string, number> = { Valley: 1.8, Mine: 1.25, MineDeep: 1.25 };

/** Alle Bilder, einmal beim Start geladen */
export const DECO_KEYS = [...new Set(Object.values(DECO).flatMap((list) => list.map(([k]) => k)))];
