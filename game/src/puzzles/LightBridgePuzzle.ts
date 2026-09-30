import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Die Lichtbrücken“ im Spiegeltempel (parallel und senkrecht, Bildungsplan 3.1.3 (1)).
//  - bauen:    Durch P eine Lichtbrücke ziehen, die zu einem Strahl parallel oder senkrecht ist:
//              Man tippt einen zweiten Gitterpunkt an.
//  - erkennen: Welcher der Strahlen b, c, d ist parallel (senkrecht) zu a?
// Erst waagerecht/senkrecht, dann schräg (1|1), zuletzt steiler (2|1).

type Kind = 'parallel' | 'senkrecht';
type Vec = [number, number];

const COLS = 11;
const ROWS = 8;
const GAP = 42;
const GX = 150;
const GY = 130;

const px = (c: number) => GX + c * GAP;
const py = (r: number) => GY + r * GAP;
const cross = (a: Vec, b: Vec) => a[0] * b[1] - a[1] * b[0];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];

function direction(level: number): Vec {
  const tier = pickByLevel(level, [0, 1, 2]);
  const dirs: Vec[][] = [
    [[1, 0], [0, 1]],
    [[1, 1], [1, -1]],
    [[2, 1], [1, 2], [2, -1], [1, -2]],
  ];
  const set = dirs[tier];
  return set[randInt(0, set.length - 1)];
}

export class LightBridgePuzzle extends PuzzleScene {
  protected title = 'Die Lichtbrücken';
  protected skills: SkillId[] = ['R1'];

  constructor() {
    super('LightBridgePuzzle');
  }

  protected buildRound(): void {
    const level = getLevel('R1');
    if (level > 0.25 && Math.random() < 0.35) this.buildRecognize(level);
    else this.buildConstruct(level);
  }

  private grid(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(0x0b1117, 1).fillRoundedRect(GX - 24, GY - 24, (COLS - 1) * GAP + 48, (ROWS - 1) * GAP + 48, 10);
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) g.fillStyle(0x3c5566, 1).fillCircle(px(c), py(r), 3);
    this.round.add(g);
    return g;
  }

  private beam(g: Phaser.GameObjects.Graphics, a: Vec, b: Vec, color: number, width = 5): void {
    g.lineStyle(width + 6, color, 0.25).lineBetween(px(a[0]), py(a[1]), px(b[0]), py(b[1]));
    g.lineStyle(width, color, 1).lineBetween(px(a[0]), py(a[1]), px(b[0]), py(b[1]));
  }

  // ---------- Brücke bauen ----------

  private buildConstruct(level: number): void {
    const kind: Kind = Math.random() < 0.5 ? 'parallel' : 'senkrecht';
    const d = direction(level);
    // Strahl AB irgendwo links, P rechts daneben
    const len = d[0] === 0 || d[1] === 0 ? 3 : 2;
    const ax = randInt(1, 3);
    const ay = d[1] < 0 ? randInt(len * -d[1] + 1, ROWS - 2) : randInt(1, ROWS - 2 - len * d[1]);
    const A: Vec = [ax, ay];
    const B: Vec = [ax + d[0] * len, ay + d[1] * len];
    // P rechts vom Strahl, nie auf seiner Verlängerung
    const P: Vec = [randInt(8, 9), randInt(2, 5)];
    if (cross(d, [P[0] - A[0], P[1] - A[1]]) === 0) P[1] = P[1] === 5 ? 4 : P[1] + 1;
    const g = this.grid();
    this.beam(g, A, B, 0x5ab0e0);
    const r = this.round;
    r.add(text(this, px(A[0]) - 16, py(A[1]) - 16, 'a', 18, '#bfe6ff'));
    g.fillStyle(0xe8c877, 1).fillCircle(px(P[0]), py(P[1]), 8);
    r.add(text(this, px(P[0]) + 16, py(P[1]) - 16, 'P', 18, COLORS.goldText));
    r.add(text(this, GAME_WIDTH / 2, 88, `Zieh durch P eine Lichtbrücke, die ${kind} zu a ist.`, 21, COLORS.text));
    r.add(text(this, 820, 200, 'Tipp auf einen\nzweiten Punkt.', 17, COLORS.muted).setAlign('center'));

    const user = this.add.graphics();
    r.add(user);
    const hit = this.add.zone(GX - 21, GY - 21, (COLS - 1) * GAP + 42, (ROWS - 1) * GAP + 42).setOrigin(0).setInteractive({ useHandCursor: true });
    r.add(hit);
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      const Q: Vec = [Math.round((p.x - GX) / GAP), Math.round((p.y - GY) / GAP)];
      if (Q[0] < 0 || Q[1] < 0 || Q[0] >= COLS || Q[1] >= ROWS) return;
      if (Q[0] === P[0] && Q[1] === P[1]) return;
      user.clear();
      this.beam(user, P, Q, 0xe8c877, 4);
      const v: Vec = [Q[0] - P[0], Q[1] - P[1]];
      const par = cross(d, v) === 0;
      const perp = dot(d, v) === 0;
      if ((kind === 'parallel' && par) || (kind === 'senkrecht' && perp)) {
        this.solved(kind === 'parallel' ? 'Parallel: Die Brücke hat überall denselben Abstand zu a. Sie treffen sich nie.' : 'Senkrecht: Die Brücke steht im rechten Winkel auf a, wie die Ecke vom Geodreieck.');
        return;
      }
      if (kind === 'parallel' && perp) this.wrong('Das ist senkrecht zu a, nicht parallel. Parallele Linien laufen in dieselbe Richtung.');
      else if (kind === 'senkrecht' && par) this.wrong('Das ist parallel zu a. Senkrecht heißt: im rechten Winkel, wie ein Kreuz.');
      else this.wrong(`Noch nicht ${kind}. Strahl a geht ${this.stepText(d)}. ${kind === 'parallel' ? 'Eine Parallele geht genauso.' : 'Eine Senkrechte geht quer dazu.'}`);
    });

    const perpDir: Vec = [-d[1], d[0]];
    this.hints = [
      kind === 'parallel' ? 'Parallel heißt: gleiche Richtung, nie schneiden, wie Schienen.' : 'Senkrecht heißt: rechter Winkel, wie die Ecke eines Blatts Papier.',
      `Zähl die Kästchen: a geht ${this.stepText(d)}.`,
      kind === 'parallel' ? `Von P aus: ebenfalls ${this.stepText(d)}.` : `Von P aus zum Beispiel ${this.stepText(perpDir)}.`,
    ];
  }

  private stepText(v: Vec): string {
    const parts: string[] = [];
    if (v[0]) parts.push(`${Math.abs(v[0])} nach ${v[0] > 0 ? 'rechts' : 'links'}`);
    if (v[1]) parts.push(`${Math.abs(v[1])} nach ${v[1] > 0 ? 'unten' : 'oben'}`);
    return parts.join(' und ');
  }

  // ---------- erkennen ----------

  private buildRecognize(level: number): void {
    const kind: Kind = Math.random() < 0.5 ? 'parallel' : 'senkrecht';
    const d = direction(level);
    const perp: Vec = [-d[1], d[0]];
    const other: Vec = d[0] !== 0 && d[1] !== 0 ? [d[0], 0] : [1, 1];
    const target = kind === 'parallel' ? d : perp;
    const decoys: Vec[] = [kind === 'parallel' ? perp : d, other];
    const g = this.grid();
    const r = this.round;
    // a oben links, dann b, c, d an festen Plätzen, in zufälliger Reihenfolge
    const spots: Vec[] = [[1, 1], [6, 1], [1, 5], [6, 5]];
    const len = d[0] === 0 || d[1] === 0 ? 2 : 1;
    const place = (at: Vec, v: Vec, color: number, label: string) => {
      const s: Vec = [at[0] + (v[0] < 0 ? len * -v[0] : 0), at[1] + (v[1] < 0 ? len * -v[1] : 0)];
      const e: Vec = [s[0] + v[0] * len, s[1] + v[1] * len];
      this.beam(g, s, e, color);
      r.add(text(this, px(s[0]) - 16, py(s[1]) - 14, label, 18, '#bfe6ff'));
    };
    place(spots[0], d, 0x5ab0e0, 'a');
    const options = Phaser.Utils.Array.Shuffle([target, ...decoys]);
    const labels = ['b', 'c', 'd'];
    options.forEach((v, i) => place(spots[i + 1], v, 0x8a9aa8, labels[i]));
    r.add(text(this, GAME_WIDTH / 2, 88, `Welcher Strahl ist ${kind} zu a?`, 21, COLORS.text));
    options.forEach((v, i) => {
      r.add(
        button(this, 830, 180 + i * 70, labels[i], () => {
          if (v === target) this.solved(kind === 'parallel' ? `${labels[i]} läuft in dieselbe Richtung wie a: parallel.` : `${labels[i]} steht im rechten Winkel zu a: senkrecht.`);
          else this.wrong(v === decoys[0] ? `${labels[i]} ist ${kind === 'parallel' ? 'senkrecht' : 'parallel'} zu a. Gesucht ist ${kind}.` : `${labels[i]} ist weder parallel noch senkrecht zu a.`);
        }, { width: 90, height: 56, size: 26 }),
      );
    });
    this.hints = [
      kind === 'parallel' ? 'Parallel: Würde man beide verlängern, träfen sie sich nie.' : 'Senkrecht: Legt man die Ecke vom Geodreieck an, passt sie genau.',
      `Zähl bei jedem Strahl die Kästchen nach rechts und nach unten. a geht ${this.stepText(d)}.`,
    ];
  }
}
