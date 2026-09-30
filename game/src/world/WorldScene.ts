import Phaser from 'phaser';
import { buildAvatarTexture, type Direction } from '../avatar/avatar';
import { PAGES, pageById } from '../messbuch';
import { getFlag, loadSave, setFlag, writeSave } from '../save';
import { COLORS, FONT, smooth } from '../ui/theme';
import type { HudScene } from '../scenes/HudScene';
import type { DialogLine } from '../ui/dialog';
import type { CheatTopic } from '../puzzles/CheatPuzzle';
import { findPath, nearestWalkable, type Cell } from './pathfind';
import type { Terrain } from './terrain';

export const TILE = 32;

/** Ein Auftritt von Pi-mal-Daumen in einer Region */
export interface GoblinVisit {
  flag: string;
  topic: CheatTopic;
  intro: DialogLine[];
  caught: DialogLine[];
}

const GOBLIN_AGAIN: DialogLine[] = [
  { speaker: 'Pi-mal-Daumen', text: 'Du schon wieder! Noch eine Runde? Diesmal merkst du es bestimmt nicht.' },
];
const GOBLIN_WON: DialogLine[] = [{ speaker: 'Pi-mal-Daumen', text: 'Hihi! Ungefähr ist doch genau genug!' }];
const GOBLIN_CAUGHT_AGAIN: DialogLine[] = [{ speaker: 'Pi-mal-Daumen', text: 'Schon wieder erwischt. Wie machst du das bloß?' }];
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
  private fog?: Phaser.Filters.ColorMatrix;
  /** Schilder, deren Zahlen im Nebel flackern (siehe addSign) */
  private fogSigns: { text: Phaser.GameObjects.Text; exact: string; timer: Phaser.Time.TimerEvent }[] = [];

  /** Szene bauen: Gelände, Objekte, Figuren. Gibt die Startposition (Zelle) zurück. */
  protected abstract buildWorld(entry?: string): Cell;

  /**
   * Wie dicht der Nebel des Ungefähren über dem Ort liegt: 1 = grau, 0 = volle Farbe.
   * Regionen werden farbig, sobald ihr Splitter geborgen ist.
   */
  protected fogDensity(): number {
    return 0;
  }

  create(data: { entry?: string } = {}): void {
    this.blocked.clear();
    this.interactables = [];
    this.exits = [];
    this.fogSigns = [];
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
    // Laufend speichern; die Zeitgeber stehen, solange das Menü offen ist, also zählt nur echte Spielzeit
    this.time.addEvent({ delay: 3000, loop: true, callback: () => this.rememberPlace(3) });
    const saveNow = () => this.rememberPlace();
    this.game.events.on('save-now', saveNow);
    this.events.once('shutdown', () => this.game.events.off('save-now', saveNow));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.terrain.cols * TILE, this.terrain.rows * TILE);
    cam.setZoom(2);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setRoundPixels(true);
    cam.fadeIn(300);
    this.fog = undefined;
    this.setFog(this.fogDensity());

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

  /** Nebel sofort setzen (Szenenaufbau) */
  private setFog(density: number): void {
    if (density <= 0 && !this.fog) return;
    if (!this.fog) {
      this.fog = this.cameras.main.filters.internal.addColorMatrix();
      this.fog.colorMatrix.saturate(-0.85).brightness(0.9, true);
    }
    this.fog.colorMatrix.alpha = density;
  }

  /** Nebel langsam auf eine neue Dichte bringen, z. B. wenn ein Splitter geborgen ist. */
  protected clearFog(density = this.fogDensity(), duration = 2500): void {
    if (density <= 0) {
      // Schilder zeigen wieder genaue Zahlen
      for (const s of this.fogSigns) {
        s.timer.remove();
        s.text.setText(s.exact).setAlpha(1);
      }
      this.fogSigns = [];
    }
    if (!this.fog) return;
    const cm = this.fog.colorMatrix;
    this.tweens.addCounter({ from: cm.alpha, to: density, duration, ease: 'sine.inout', onUpdate: (t) => (cm.alpha = t.getValue() ?? density) });
  }

  /** Vagor spricht aus dem Nebel: Die Welt verdunkelt sich, solange er redet. */
  protected vagorSays(lines: DialogLine[], onDone?: () => void): void {
    const veil = this.add
      .rectangle(0, 0, this.terrain.cols * TILE, this.terrain.rows * TILE, 0x241e3a, 0)
      .setOrigin(0)
      .setDepth(30_000);
    this.cameras.main.shake(500, 0.004);
    this.tweens.add({ targets: veil, fillAlpha: 0.6, duration: 700 });
    this.say(lines, () => {
      this.tweens.add({ targets: veil, fillAlpha: 0, duration: 900, onComplete: () => veil.destroy() });
      onDone?.();
    });
  }

  /** Welt anhalten, z. B. während einer Zwischensequenz (Laufen und Antippen gesperrt). */
  protected setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    this.path = [];
    this.pending = null;
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

  protected removeInteractable(target: Interactable['target']): void {
    this.interactables = this.interactables.filter((i) => i.target !== target);
  }

  /**
   * Holzschild mit Text. Liegt über dem Ort noch Nebel, flackern die Zahlen darauf
   * („≈ 4?0 m“), bis der Nebel weicht. So sieht man, was „Nebel des Ungefähren“ heißt.
   */
  protected addSign(cellX: number, cellY: number, exact: string, onTap?: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(cellX * TILE, cellY * TILE);
    const t = smooth(this.add.text(0, -30, exact, { fontFamily: FONT, fontSize: '10px', color: '#2a1a0c', align: 'center', resolution: 4 }).setOrigin(0.5));
    const w = Math.max(44, t.width + 14);
    const h = t.height + 10;
    const g = this.add.graphics();
    g.fillStyle(0x4a3018, 1).fillRect(-2, -30, 4, 30);
    g.fillStyle(0x2a1a0c, 1).fillRoundedRect(-w / 2 - 1, -30 - h / 2 - 1, w + 2, h + 2, 3);
    g.fillStyle(0xc9a15a, 1).fillRoundedRect(-w / 2, -30 - h / 2, w, h, 3);
    c.add([g, t]).setDepth(cellY * TILE + 8);
    this.block(Math.floor(cellX), Math.floor(cellY) - 1, Math.floor(cellX), Math.floor(cellY) - 1);
    if (this.fogDensity() > 0) this.fogFlicker(t, exact);
    if (onTap) {
      (c as unknown as { getBounds: () => Phaser.Geom.Rectangle }).getBounds = () =>
        new Phaser.Geom.Rectangle(c.x - w / 2, c.y - 30 - h / 2, w, h + 30);
      this.addInteractable({ target: c as Interactable['target'], stand: { x: Math.floor(cellX), y: Math.floor(cellY) }, onInteract: onTap });
    }
    return c;
  }

  /** Ziffern flackern und werden zu „≈ …“, solange der Nebel liegt. */
  protected fogFlicker(t: Phaser.GameObjects.Text, exact: string): void {
    const fuzzy = () =>
      Math.random() < 0.4
        ? `≈ ${exact.replace(/\d/g, (d) => (Math.random() < 0.5 ? '?' : d))}`
        : exact.replace(/\d[\d ]*/g, () => '≈ ?? ');
    t.setText(fuzzy());
    const timer = this.time.addEvent({
      delay: 650,
      loop: true,
      callback: () => t.setText(fuzzy()).setAlpha(0.65 + Math.random() * 0.35),
    });
    this.fogSigns.push({ text: t, exact, timer });
  }

  /** Versteckte Seite aus Vagors Messbuch; glitzert leise, verschwindet beim Aufheben. */
  protected addPage(id: string, cellX: number, cellY: number): void {
    if (getFlag(id)) return;
    const img = this.placeObject('messbuch-page', cellX + 0.5, cellY + 0.9, 0.8);
    this.tweens.add({ targets: img, alpha: { from: 1, to: 0.55 }, duration: 900, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.addInteractable({ target: img, stand: { x: cellX, y: cellY }, onInteract: () => this.findPage(id, img) });
  }

  protected findPage(id: string, img?: Phaser.GameObjects.Image, onDone?: () => void): void {
    const page = pageById(id);
    if (!page || getFlag(id)) return;
    if (img) {
      this.removeInteractable(img);
      this.tweens.killTweensOf(img);
      this.tweens.add({ targets: img, y: img.y - 30, alpha: 0, duration: 600, onComplete: () => img.destroy() });
    }
    const first = !PAGES.some((p) => getFlag(p.id));
    setFlag(id);
    this.say(
      [
        { speaker: 'Eule Pünktchen', text: 'Huhu! Eine Seite aus einem alten Messbuch. Da steht Vagors Name drauf!' },
        page.note,
        first
          ? { speaker: 'Eule Pünktchen', text: 'Ich lege sie ins Messbuch. Im Menü kannst du sie in Ruhe lesen. Ob Vagors Rechnung stimmt?' }
          : { speaker: 'Eule Pünktchen', text: 'Noch eine Seite! Ich lege sie zu den anderen ins Messbuch.' },
      ],
      onDone,
    );
  }

  /** Pi-mal-Daumen, Vagors Nebelkobold: behauptet etwas, man erwischt ihn beim Schummeln. */
  protected addGoblin(g: GoblinVisit, cell: Cell, facing: Direction = 'south'): void {
    const sprite = this.addNpc('npc-pimal', cell, facing);
    this.tweens.add({ targets: sprite, y: sprite.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'sine.inout' });
    const stand = { x: cell.x - 1, y: cell.y };
    this.addInteractable({
      target: sprite,
      stand,
      onInteract: () => {
        this.faceToPlayer(sprite);
        const caught = getFlag(g.flag);
        this.say(caught ? GOBLIN_AGAIN : g.intro, () =>
          this.startPuzzle(
            'CheatPuzzle',
            (solved) => {
              if (!solved) {
                this.say(GOBLIN_WON);
                return;
              }
              const first = !getFlag(g.flag);
              setFlag(g.flag);
              this.say(first ? g.caught : GOBLIN_CAUGHT_AGAIN);
            },
            3,
            { topic: g.topic },
          ),
        );
      },
    });
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
  protected startPuzzle(key: string, onDone: (solved: boolean) => void, rounds = 3, extra: object = {}): void {
    this.frozen = true;
    this.path = [];
    this.scene.launch(key, {
      ...extra,
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

  /** Merkt sich den Ort für den nächsten Spielstart und zählt die Spielzeit. */
  protected rememberPlace(seconds = 0): void {
    const save = loadSave();
    const c = this.cellOf(this.player.x, this.player.y);
    save.place = { scene: this.scene.key, x: c.x, y: c.y };
    save.playtime += seconds;
    writeSave(save);
  }
}
