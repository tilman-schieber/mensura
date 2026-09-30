import Phaser from 'phaser';
import { buildAvatarTexture, type Direction } from '../avatar/avatar';
import { getFlag, loadSave, writeSave } from '../save';
import { COLORS, FONT, smooth } from '../ui/theme';
import type { HudScene } from '../scenes/HudScene';
import type { DialogLine } from '../ui/dialog';
import { findPath, nearestWalkable, type Cell } from './pathfind';
import type { Terrain } from './terrain';

export const TILE = 32;
const SPEED = 105; // Weltpixel pro Sekunde
const PLAYER_KEY = 'avatar-player';
const NPC_FRAME: Record<Direction, number> = { south: 0, east: 1, north: 2, west: 3 };

export interface Interactable {
  target: Phaser.GameObjects.GameObject & { getBounds(): Phaser.Geom.Rectangle };
  /** Zelle, von der aus man interagiert */
  stand: Cell;
  onInteract: () => void;
}

interface Exit {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  onEnter: () => void;
}

/**
 * Grundlage für begehbare Orte: Gelände, Spielfigur, Laufen per Tippen (mit Wegsuche)
 * oder Pfeiltasten, Figuren und Objekte zum Antippen, Ausgänge zu anderen Orten.
 */
export abstract class WorldScene extends Phaser.Scene {
  protected terrain!: Terrain;
  protected player!: Phaser.GameObjects.Sprite;
  /** Wenn true, sind Kacheln mit oberem Gelände (z. B. Felswand) nicht begehbar */
  protected blockUpper = true;

  private blocked = new Set<string>();
  private interactables: Interactable[] = [];
  private exits: Exit[] = [];
  private path: Cell[] = [];
  private pending: Interactable | null = null;
  private facing: Direction = 'south';
  private frozen = false;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private lastCell = { x: -1, y: -1 };

  /** Szene bauen: Gelände, Objekte, Figuren. Gibt die Startposition (Zelle) zurück. */
  protected abstract buildWorld(entry?: string): Cell;

  create(data: { entry?: string } = {}): void {
    this.blocked.clear();
    this.interactables = [];
    this.exits = [];
    this.path = [];
    this.pending = null;
    this.frozen = false;

    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    const hud = this.hud();
    hud.world = this.scene.key;
    hud.canOpenMenu = () => !this.frozen;

    // Figur-Textur zuerst bauen: Szenen dürfen sie beim Aufbau schon nutzen (z. B. Doppelgänger)
    const look = loadSave().avatar!;
    buildAvatarTexture(this, look, PLAYER_KEY);
    const start = this.buildWorld(data.entry);

    this.player = this.add.sprite(0, 0, PLAYER_KEY, 'south-0').setOrigin(0.5, 0.78);
    this.placePlayer(start);
    this.rememberPlace();
    this.time.addEvent({ delay: 3000, loop: true, callback: () => this.rememberPlace() });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.terrain.cols * TILE, this.terrain.rows * TILE);
    cam.setZoom(2);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setRoundPixels(true);
    cam.fadeIn(300);

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.keys = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on('keydown-SPACE', () => this.interactNearby());
  }

  // ---------- Aufbau-Helfer für Unterklassen ----------

  protected hud(): HudScene {
    return this.scene.get('Hud') as HudScene;
  }

  protected say(lines: DialogLine[], onDone?: () => void): void {
    this.frozen = true;
    this.path = [];
    this.hud().dialog(lines, () => this.thaw(onDone));
  }

  protected setGoal(message: string): void {
    this.hud().setGoal(message);
  }

  /** Blockiert ein Rechteck von Zellen (inklusive). */
  protected block(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.blocked.add(`${x},${y}`);
  }

  protected unblock(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.blocked.delete(`${x},${y}`);
  }

  /** Objektbild mit Fußpunkt auf einer Zellkante; Tiefe nach y sortiert. */
  protected placeObject(key: string, cellX: number, cellY: number, scale = 1): Phaser.GameObjects.Image {
    const img = this.add.image(cellX * TILE, cellY * TILE, key).setOrigin(0.5, 1).setScale(scale);
    img.setDepth(img.y);
    return img;
  }

  protected addNpc(key: string, cell: Cell, facing: Direction = 'south'): Phaser.GameObjects.Sprite {
    const s = this.add
      .sprite((cell.x + 0.5) * TILE, (cell.y + 1) * TILE, key, NPC_FRAME[facing])
      .setOrigin(0.5, 0.78);
    s.setDepth(s.y);
    this.block(cell.x, cell.y, cell.x, cell.y);
    return s;
  }

  /** Schwebender goldener Stern über einer erledigten Station; sichtbar, sobald `flag` gesetzt ist. */
  protected addStar(flag: string, x: number, y: number): Phaser.GameObjects.Text {
    const t = smooth(this.add.text(x, y, '★', { fontFamily: FONT, fontSize: '16px', color: COLORS.goldText, resolution: 4 }).setOrigin(0.5));
    t.setDepth(10_000).setVisible(getFlag(flag));
    this.tweens.add({ targets: t, y: y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inout' });
    return t;
  }

  protected addInteractable(i: Interactable): void {
    this.interactables.push(i);
  }

  /** Lässt eine Figur zur Spielfigur schauen. */
  protected faceToPlayer(npc: Phaser.GameObjects.Sprite): void {
    const dx = this.player.x - npc.x;
    const dy = this.player.y - npc.y;
    const dir: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
    npc.setFrame(NPC_FRAME[dir]);
  }

  protected addExit(x0: number, y0: number, x1: number, y1: number, onEnter: () => void): void {
    this.exits.push({ x0, y0, x1, y1, onEnter });
  }

  protected goTo(sceneKey: string, entry: string): void {
    this.frozen = true;
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(sceneKey, { entry }));
  }

  /** Friert die Welt ein, startet ein Rätsel und taut danach wieder auf. */
  protected startPuzzle(key: string, onDone: (solved: boolean) => void, rounds = 3): void {
    this.frozen = true;
    this.path = [];
    this.scene.launch(key, {
      rounds,
      onDone: (solved: boolean) => this.thaw(() => onDone(solved)),
    });
    this.scene.bringToTop(key);
  }

  /** Welt kurz verzögert wieder freigeben, damit der Tipp, der einen Dialog beendet, nicht zusätzlich die Figur losschickt. */
  private thaw(then?: () => void): void {
    this.time.delayedCall(80, () => {
      this.frozen = false;
      then?.();
    });
  }

  // ---------- Bewegung ----------

  protected walkable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= this.terrain.cols || y >= this.terrain.rows) return false;
    if (this.blocked.has(`${x},${y}`)) return false;
    return this.blockUpper ? this.terrain.isFloor(x, y) : true;
  };

  private cellOf(x: number, y: number): Cell {
    return { x: Math.floor(x / TILE), y: Math.floor((y - 1) / TILE) };
  }

  private placePlayer(cell: Cell): void {
    this.player.setPosition((cell.x + 0.5) * TILE, (cell.y + 1) * TILE - 4);
  }

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.frozen) return;
    const wx = p.worldX;
    const wy = p.worldY;
    const here = this.cellOf(this.player.x, this.player.y);

    const hit = this.interactables.find((i) => i.target.getBounds().contains(wx, wy));
    if (hit) {
      this.pending = hit;
      if (here.x === hit.stand.x && here.y === hit.stand.y) this.arrive();
      else this.pathTo(hit.stand);
      return;
    }
    this.pending = null;
    const goal = this.cellOf(wx, wy + 1);
    const target = this.walkable(goal.x, goal.y) ? goal : nearestWalkable(this.walkable, goal, here);
    if (target) this.pathTo(target);
  }

  private pathTo(goal: Cell): void {
    const here = this.cellOf(this.player.x, this.player.y);
    const p = findPath(this.walkable, here, goal);
    this.path = p ? p.slice(1) : [];
    if (!p) this.pending = null;
  }

  private arrive(): void {
    const i = this.pending;
    this.pending = null;
    if (!i) return;
    // zur Sache hin drehen
    const b = i.target.getBounds();
    this.face(b.centerX - this.player.x, b.centerY - this.player.y);
    this.player.stop().setFrame(`${this.facing}-0`);
    i.onInteract();
  }

  private interactNearby(): void {
    if (this.frozen) return;
    const here = this.cellOf(this.player.x, this.player.y);
    const i = this.interactables.find((it) => Math.abs(it.stand.x - here.x) <= 1 && Math.abs(it.stand.y - here.y) <= 1);
    if (i) {
      this.pending = i;
      this.arrive();
    }
  }

  private face(dx: number, dy: number): void {
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
  }

  update(_t: number, delta: number): void {
    if (!this.player) return;
    const step = (SPEED * delta) / 1000;
    let dx = 0;
    let dy = 0;

    if (!this.frozen) {
      if (this.keys.left.isDown) dx = -1;
      else if (this.keys.right.isDown) dx = 1;
      if (this.keys.up.isDown) dy = -1;
      else if (this.keys.down.isDown) dy = 1;
    }

    if (dx || dy) {
      this.path = [];
      this.pending = null;
      const len = Math.hypot(dx, dy);
      const mx = (dx / len) * step;
      const my = (dy / len) * step;
      this.face(dx, dy);
      // Achsenweise bewegen, damit man an Wänden entlangrutscht
      const nx = this.player.x + mx;
      const cx = this.cellOf(nx + Math.sign(mx) * 8, this.player.y);
      if (this.walkable(cx.x, cx.y)) this.player.x = nx;
      const ny = this.player.y + my;
      const cy = this.cellOf(this.player.x, ny + (my > 0 ? 2 : -6));
      if (this.walkable(cy.x, cy.y)) this.player.y = ny;
      this.animateWalk();
    } else if (this.path.length && !this.frozen) {
      const next = this.path[0];
      const tx = (next.x + 0.5) * TILE;
      const ty = (next.y + 1) * TILE - 4;
      const vx = tx - this.player.x;
      const vy = ty - this.player.y;
      const dist = Math.hypot(vx, vy);
      if (dist <= step) {
        this.player.setPosition(tx, ty);
        this.path.shift();
        if (!this.path.length && this.pending) this.arrive();
      } else {
        this.player.x += (vx / dist) * step;
        this.player.y += (vy / dist) * step;
        this.face(vx, vy);
      }
      this.animateWalk();
    } else {
      this.player.stop();
      this.player.setFrame(`${this.facing}-0`);
    }
    this.player.setDepth(this.player.y);

    // Ausgänge prüfen
    const c = this.cellOf(this.player.x, this.player.y);
    if (c.x !== this.lastCell.x || c.y !== this.lastCell.y) {
      this.lastCell = c;
      const exit = this.exits.find((e) => c.x >= e.x0 && c.x <= e.x1 && c.y >= e.y0 && c.y <= e.y1);
      if (exit && !this.frozen) exit.onEnter();
      else if (!this.frozen) this.onEnterCell(c);
    }
  }

  private animateWalk(): void {
    const anim = `${PLAYER_KEY}-walk-${this.facing}`;
    if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) this.player.play(anim);
  }

  /** Wird aufgerufen, wenn die Figur eine neue Kachel betritt (z. B. für Begegnungen). */
  protected onEnterCell(_cell: Cell): void {}

  /** Aktuelle Kachel der Spielfigur */
  protected playerCell(): Cell {
    return this.cellOf(this.player.x, this.player.y);
  }

  /** Merkt sich den Ort für den nächsten Spielstart. */
  protected rememberPlace(): void {
    const save = loadSave();
    const c = this.cellOf(this.player.x, this.player.y);
    save.place = { scene: this.scene.key, x: c.x, y: c.y };
    writeSave(save);
  }
}
