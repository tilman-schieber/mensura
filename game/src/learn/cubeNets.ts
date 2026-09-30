// Würfelnetze: prüfen, ob sich sechs Quadrate zu einem Würfel falten lassen,
// und welche Flächen sich dann gegenüberliegen.
//
// Verfahren: Man legt einen Würfel auf das erste Quadrat und rollt ihn über die
// Nachbarquadrate. Jedes Quadrat bekommt die Würfelseite, die gerade unten liegt.
// Sind alle sechs verschieden, ist es ein Würfelnetz. Gegenüber liegen zwei Quadrate,
// wenn ihre Würfelseiten entgegengesetzt sind.

export type Cell = [number, number];
type Vec = [number, number, number];
type Mat = [Vec, Vec, Vec];

const I: Mat = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function mul(a: Mat, b: Mat): Mat {
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c])) as Mat;
}

// Rollen in Richtung +x/−x (Drehung um y) und +y/−y (Drehung um x), jeweils 90°
const ROLL: Record<string, Mat> = {
  '1,0': [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  '-1,0': [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  '0,1': [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  '0,-1': [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
};

/** Würfelseite (als Normalenvektor im Würfel), die auf einem Quadrat unten liegt. */
function groundFace(r: Mat): Vec {
  // unten ist (0,0,−1) in der Welt; im Würfel ist das Rᵀ·(0,0,−1) = −(3. Zeile von R)
  return [-r[2][0], -r[2][1], -r[2][2]];
}

/** Liefert für jedes Quadrat seine Würfelseite, oder null, wenn es kein Würfelnetz ist. */
export function foldCube(cells: Cell[]): Vec[] | null {
  if (cells.length !== 6) return null;
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const index = new Map(cells.map((c, i) => [key(c), i]));
  const orient: (Mat | null)[] = cells.map(() => null);
  orient[0] = I;
  const queue = [0];
  while (queue.length) {
    const i = queue.shift()!;
    const [x, y] = cells[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = index.get(`${x + dx},${y + dy}`);
      if (j === undefined || orient[j]) continue;
      orient[j] = mul(ROLL[`${dx},${dy}`], orient[i]!);
      queue.push(j);
    }
  }
  if (orient.some((o) => !o)) return null; // nicht zusammenhängend
  const faces = orient.map((o) => groundFace(o!));
  const distinct = new Set(faces.map((f) => f.join(',')));
  return distinct.size === 6 ? faces : null;
}

export function isCubeNet(cells: Cell[]): boolean {
  return foldCube(cells) !== null;
}

/** Index des Quadrats, das beim gefalteten Würfel gegenüber von `i` liegt. */
export function oppositeOf(cells: Cell[], i: number): number {
  const faces = foldCube(cells);
  if (!faces) return -1;
  const [a, b, c] = faces[i];
  return faces.findIndex((f) => f[0] === -a && f[1] === -b && f[2] === -c);
}

/** Zufällige zusammenhängende Figur aus 6 Quadraten, auf (0|0) verschoben. */
export function randomHexomino(rand: (n: number) => number = (n) => Math.floor(Math.random() * n)): Cell[] {
  const cells: Cell[] = [[0, 0]];
  const has = (x: number, y: number) => cells.some((c) => c[0] === x && c[1] === y);
  while (cells.length < 6) {
    const [x, y] = cells[rand(cells.length)];
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][rand(4)];
    if (!has(x + dx, y + dy)) cells.push([x + dx, y + dy]);
  }
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

/** Ein Würfelnetz oder (mit `valid = false`) eine Figur, die sich nicht falten lässt. */
export function randomNet(valid: boolean): Cell[] {
  for (let guard = 0; guard < 500; guard++) {
    const n = randomHexomino();
    // Sehr lange Streifen (7 breit) passen nicht gut auf den Bildschirm
    const w = Math.max(...n.map((c) => c[0])) + 1;
    const h = Math.max(...n.map((c) => c[1])) + 1;
    if (w > 5 || h > 5) continue;
    if (isCubeNet(n) === valid) return n;
  }
  return [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
}
