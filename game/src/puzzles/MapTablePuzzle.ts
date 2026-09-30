import Phaser from 'phaser';
import { randInt } from '../learn/numbers';
import type { SkillId } from '../learn/skills';
import { getFlag, setFlag } from '../save';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Elles Kartentisch“ (Koordinatensystem, Bildungsplan 3.1.3 (12), 3.1.4 (3)).
// Man zeichnet die eigene Karte von Eichstadt: Orte nach Koordinaten eintragen oder ihre
// Koordinaten ablesen. Was einmal eingetragen ist, bleibt auf der Karte (Merker map_<id>).
// Maßstab und selbst vermessen kommen in Klasse 6.

interface Place {
  id: string;
  name: string;
  /** „Sie liegt …“ / „Er liegt …“ / „Es liegt …“ */
  pron: string;
  /** Akkusativ, falls anders als name: „Trag den Weg … ein“ */
  acc?: string;
  x: number;
  y: number;
  color: number;
}

const PLACES: Place[] = [
  { id: 'haus', name: 'Elles Haus', pron: 'Es', x: 2, y: 6, color: 0xd9b25f },
  { id: 'mine', name: 'die Mine', pron: 'Sie', x: 9, y: 7, color: 0x8a8f96 },
  { id: 'ruine', name: 'die Ruine', pron: 'Sie', x: 1, y: 2, color: 0xa08a70 },
  { id: 'tempel', name: 'das Tempeltor', pron: 'Es', x: 5, y: 1, color: 0xbfe6ff },
  { id: 'tal', name: 'der Weg ins Riesental', acc: 'den Weg ins Riesental', pron: 'Er', x: 6, y: 8, color: 0xc8f0a8 },
  { id: 'markt', name: 'Miras Markt', pron: 'Er', x: 3, y: 3, color: 0xd96a5a },
  { id: 'brett', name: 'das Anschlagbrett', pron: 'Es', x: 5, y: 5, color: 0xd8c8f0 },
  { id: 'schaf', name: 'das Schaf', pron: 'Es', x: 6, y: 3, color: 0xf2ead8 },
];

const W = 10;
const H = 8;
const GAP = 33;
const OX = 150;
const OY = 405; // Ursprung unten links (y wächst nach oben, wie in der Schule)

const sx = (x: number) => OX + x * GAP;
const sy = (y: number) => OY - y * GAP;
const fmt = (x: number, y: number) => `(${x}|${y})`;

export class MapTablePuzzle extends PuzzleScene {
  protected title = 'Elles Kartentisch';
  protected skills: SkillId[] = ['R12'];

  constructor() {
    super('MapTablePuzzle');
  }

  protected buildRound(): void {
    const g = this.add.graphics();
    const r = this.round;
    r.add(g);
    // Pergament mit Gitter und Achsen
    g.fillStyle(0xe9dcbc, 1).fillRoundedRect(OX - 40, sy(H) - 30, W * GAP + 80, H * GAP + 80, 8);
    for (let x = 0; x <= W; x++) g.lineStyle(1, 0xb8a47a, 1).lineBetween(sx(x), sy(0), sx(x), sy(H));
    for (let y = 0; y <= H; y++) g.lineStyle(1, 0xb8a47a, 1).lineBetween(sx(0), sy(y), sx(W), sy(y));
    g.lineStyle(3, 0x3a2a18, 1).lineBetween(sx(0), sy(0), sx(W), sy(0)).lineBetween(sx(0), sy(0), sx(0), sy(H));
    for (let x = 1; x <= W; x++) r.add(text(this, sx(x), sy(0) + 14, String(x), 13, '#3a2a18'));
    for (let y = 1; y <= H; y++) r.add(text(this, sx(0) - 14, sy(y), String(y), 13, '#3a2a18'));
    r.add([text(this, sx(W) + 18, sy(0), 'x', 16, '#3a2a18'), text(this, sx(0), sy(H) - 16, 'y', 16, '#3a2a18')]);

    const mapped = PLACES.filter((p) => getFlag(`map_${p.id}`));
    for (const p of mapped) this.mark(g, p);

    // Noch nicht Eingetragenes zuerst eintragen, sonst abwechselnd eintragen und ablesen
    const todo = PLACES.filter((p) => !getFlag(`map_${p.id}`));
    if (todo.length && (mapped.length < 2 || Math.random() < 0.7)) this.buildPlace(todo[randInt(0, todo.length - 1)], g);
    else this.buildRead(mapped.length ? mapped[randInt(0, mapped.length - 1)] : PLACES[0], g);
  }

  private mark(g: Phaser.GameObjects.Graphics, p: Place): void {
    g.fillStyle(0x3a2a18, 1).fillCircle(sx(p.x), sy(p.y), 9);
    g.fillStyle(p.color, 1).fillCircle(sx(p.x), sy(p.y), 7);
  }

  private buildPlace(p: Place, g: Phaser.GameObjects.Graphics): void {
    const r = this.round;
    r.add(text(this, GAME_WIDTH / 2 + 60, 84, `Trag ${p.acc ?? p.name} ein: ${p.pron} liegt bei ${fmt(p.x, p.y)}.`, 21, COLORS.text));
    r.add(text(this, 780, 180, 'Tipp auf den\nKreuzungspunkt.', 17, COLORS.muted).setAlign('center'));
    const zone = this.add.zone(sx(0) - 20, sy(H) - 20, W * GAP + 40, H * GAP + 40).setOrigin(0).setInteractive({ useHandCursor: true });
    r.add(zone);
    zone.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      const x = Math.round((ptr.x - OX) / GAP);
      const y = Math.round((OY - ptr.y) / GAP);
      if (x < 0 || y < 0 || x > W || y > H) return;
      if (x === p.x && y === p.y) {
        this.mark(g, p);
        setFlag(`map_${p.id}`);
        this.solved(`${fmt(p.x, p.y)}: ${p.x} nach rechts, ${p.y} nach oben. ${p.name[0].toUpperCase()}${p.name.slice(1)} ist auf der Karte.`);
      } else if (x === p.y && y === p.x) this.wrong(`Vertauscht! Die erste Zahl geht nach rechts (x), die zweite nach oben (y).`);
      else this.wrong(`Du hast ${fmt(x, y)} getroffen. Gesucht ist ${fmt(p.x, p.y)}.`);
    });
    this.hints = ['Fang unten links bei (0|0) an.', `Erst ${p.x} Kästchen nach rechts, dann ${p.y} nach oben.`];
  }

  private buildRead(p: Place, g: Phaser.GameObjects.Graphics): void {
    const r = this.round;
    g.lineStyle(3, 0xd96a5a, 1).strokeCircle(sx(p.x), sy(p.y), 14);
    r.add(text(this, GAME_WIDTH / 2 + 60, 84, `Wo liegt ${p.name}? (rot eingekreist)`, 21, COLORS.text));
    const options = Phaser.Utils.Array.Shuffle([
      [p.x, p.y],
      [p.y, p.x],
      [p.x + 1, p.y],
      [p.x, Math.max(0, p.y - 1)],
    ].filter((o, i, all) => all.findIndex((q) => q[0] === o[0] && q[1] === o[1]) === i));
    options.forEach(([x, y], i) => {
      r.add(
        button(this, 780, 170 + i * 66, fmt(x, y), () => {
          if (x === p.x && y === p.y) this.solved(`Richtig, ${fmt(p.x, p.y)}.`);
          else if (x === p.y && y === p.x) this.wrong('Vertauscht! Erst x (nach rechts), dann y (nach oben).');
          else this.wrong('Zähl noch einmal die Kästchen von (0|0) aus.');
        }, { width: 150, height: 52, size: 22 }),
      );
    });
    this.hints = ['Erst nach rechts zählen (x), dann nach oben (y).'];
  }
}
