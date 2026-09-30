import Phaser from 'phaser';

// Gelände aus Wang-Kachelsets von PixelLab.
//
// Eine Karte wird als Raster von Eckpunkten beschrieben (eine Zeile mehr und eine
// Spalte mehr als Kacheln): 0 = unteres Gelände (Weg, Boden), 1 = oberes Gelände
// (Wiese, Felswand). Jede Kachel hat 4 Ecken; das Kachelset enthält für jede
// Kombination ein passendes Bild.
//
// Übergangs-Sets (Felswände mit Vorderseite) brauchen zusätzlich den Wert 2:
// Ein unterer Eckpunkt direkt unter einem oberen ist „Übergang“, dort sitzt die
// Wandfläche. Die Auswahl läuft über ein 4×4-Muster (Zeile darüber, die 2 Zeilen
// der Kachel, Zeile darunter), wie in den Metadaten von PixelLab beschrieben.

export interface TileDef {
  p: number[]; // 16 Werte, 255 = egal
  x: number;
  y: number;
}

export interface TilesetData {
  size: number;
  tiles: TileDef[];
}

const WILD = 255;

export class Terrain {
  readonly cols: number;
  readonly rows: number;
  /** Eckpunkte inkl. Übergang (0/1/2), [y][x] */
  readonly v: number[][];
  readonly layer: Phaser.Tilemaps.TilemapLayer;

  constructor(
    scene: Phaser.Scene,
    tilesetKey: string,
    data: TilesetData,
    vertices: number[][],
  ) {
    this.rows = vertices.length - 1;
    this.cols = vertices[0].length - 1;
    const hasTransition = data.tiles.some((t) => t.p.includes(2));
    this.v = vertices.map((row, y) =>
      row.map((val, x) => (hasTransition && val === 0 && y > 0 && vertices[y - 1][x] === 1 ? 2 : val)),
    );

    const size = data.size;
    const map = scene.make.tilemap({ tileWidth: size, tileHeight: size, width: this.cols, height: this.rows });
    const tileset = map.addTilesetImage(tilesetKey, tilesetKey, size, size, 0, 0)!;
    const sheetCols = Math.round(tileset.image!.getSourceImage().width / size);
    this.layer = map.createBlankLayer('ground', tileset, 0, 0)!;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const t = this.pick(data.tiles, x, y);
        this.layer.putTileAt((t.y / size) * sheetCols + t.x / size, x, y);
      }
    }
    this.layer.setDepth(-1000);
  }

  private at(x: number, y: number): number {
    const yy = Phaser.Math.Clamp(y, 0, this.rows);
    const xx = Phaser.Math.Clamp(x, 0, this.cols);
    return this.v[yy][xx];
  }

  /** Passendste Kachel: alle festen Musterwerte müssen stimmen, dann die mit den meisten Treffern. */
  private pick(tiles: TileDef[], x: number, y: number): TileDef {
    const sample: number[] = [];
    for (let r = -1; r <= 2; r++) for (let c = -1; c <= 2; c++) sample.push(this.at(x + c, y + r));
    let best: TileDef | null = null;
    let bestScore = -1;
    let fallback = tiles[0];
    let fallbackScore = -1;
    for (const t of tiles) {
      let ok = true;
      let score = 0;
      let partial = 0;
      for (let i = 0; i < 16; i++) {
        if (t.p[i] === WILD) continue;
        if (t.p[i] === sample[i]) {
          score++;
          partial++;
        } else {
          ok = false;
          // Übergang zählt als halbe Übereinstimmung mit „unten“
          if ((t.p[i] === 0 && sample[i] === 2) || (t.p[i] === 2 && sample[i] === 0)) partial += 0.5;
        }
      }
      if (ok && score > bestScore) {
        best = t;
        bestScore = score;
      }
      if (partial > fallbackScore) {
        fallback = t;
        fallbackScore = partial;
      }
    }
    return best ?? fallback;
  }

  /** Ist die Kachel begehbar? (alle vier Ecken unteres Gelände) */
  isFloor(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return false;
    return this.v[y][x] === 0 && this.v[y][x + 1] === 0 && this.v[y + 1][x] === 0 && this.v[y + 1][x + 1] === 0;
  }
}

/**
 * Baut ein Eckpunkt-Raster aus Rechtecken: Startwert `fill`, dann werden die
 * Rechtecke (in Eckpunkt-Koordinaten, inklusive) mit `value` überschrieben.
 */
export function vertexGrid(
  cols: number,
  rows: number,
  fill: number,
  rects: [x0: number, y0: number, x1: number, y1: number, value: number][],
): number[][] {
  const g = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(fill));
  for (const [x0, y0, x1, y1, value] of rects) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]?.[x] !== undefined) g[y][x] = value;
  }
  return g;
}
