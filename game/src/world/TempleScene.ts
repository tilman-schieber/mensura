import { music } from '../audio/music';
import Phaser from 'phaser';
import { getFlag, setFlag } from '../save';
import { TILE, WorldScene, type GoblinVisit } from './WorldScene';
import type { Cell } from './pathfind';
import { Terrain, vertexGrid, type TilesetData } from './terrain';

// Der Spiegeltempel (Klasse 5, Frühjahr): Symmetrie, Spiegeln, Vierecke, Koordinaten.
// Vier Spiegel = vier Stationen. Danach erscheint im Heiligtum der Spiegel-Doppelgänger;
// wer ihn besiegt, erhält den Splitter des Urmaßes der Form.

const COLS = 26;
const ROWS = 18;
const WALL = 1;
const FLOOR = 0;

interface Mirror {
  flag: string;
  puzzle: string;
  cell: [number, number];
}

/** Die Lichtbrücken am Prisma in der Mitte (parallel und senkrecht) */
const PRISM = { flag: 'temple_light', puzzle: 'LightBridgePuzzle' };
const TOTAL = 5;

const MIRRORS: Mirror[] = [
  { flag: 'temple_wall', puzzle: 'MirrorWallPuzzle', cell: [5, 7] },
  { flag: 'temple_seal', puzzle: 'SymmetryPuzzle', cell: [20, 7] },
  { flag: 'temple_quad', puzzle: 'QuadPuzzle', cell: [5, 11] },
  { flag: 'temple_star', puzzle: 'CoordinatePuzzle', cell: [20, 11] },
];

const GOBLIN: GoblinVisit = {
  flag: 'goblin_temple',
  topic: 'form',
  intro: [
    { speaker: 'Pi-mal-Daumen', text: 'Psst, Lehrling! Ich kenne mich mit Figuren aus. Jedenfalls so ungefähr.' },
    { speaker: 'Pi-mal-Daumen', text: 'Hör gut zu, was ich über Spiegel und Vierecke weiß. Hihi.' },
  ],
  caught: [{ speaker: 'Pi-mal-Daumen', text: 'Pah! Die Spiegel haben mich verpetzt.' }],
};

export class TempleScene extends WorldScene {
  private stars: Record<string, Phaser.GameObjects.Text> = {};
  private lumen!: Phaser.GameObjects.Sprite;
  private shadow?: Phaser.GameObjects.Sprite;

  constructor() {
    super('Temple');
  }

  protected fogDensity(): number {
    return getFlag('temple_done') ? 0 : 1;
  }

  preload(): void {
    this.load.image('tiles-temple', 'assets/tiles/temple.png');
    this.load.json('tiles-temple-data', 'assets/tiles/temple.json');
    this.load.image('mirror', 'assets/objects/mirror.png');
    this.load.image('prism', 'assets/objects/prism.png');
    this.load.image('temple-gate', 'assets/objects/temple-gate.png');
    this.load.spritesheet('npc-lumen', 'assets/npcs/lumen.png', { frameWidth: 68, frameHeight: 68 });
  }

  protected buildWorld(): Cell {
    const v = vertexGrid(COLS, ROWS, WALL, [
      [2, 4, 23, 15, FLOOR],
      [11, 1, 14, 4, FLOOR],
      [12, 15, 14, 18, FLOOR],
    ]);
    this.terrain = new Terrain(this, 'tiles-temple', this.cache.json.get('tiles-temple-data') as TilesetData, v);
    this.cameras.main.setBackgroundColor(0x1a1c24);
    this.addExit(12, 16, 13, 17, () => this.goTo('Village', 'temple'));

    // Läufer als Mittelachse des Tempels (der ganze Raum ist spiegelsymmetrisch)
    const carpet = this.add.graphics().setDepth(-500);
    carpet.fillStyle(0x2a3f7a, 1).fillRect(12 * TILE + 4, 4 * TILE, 2 * TILE - 8, 14 * TILE);
    carpet.fillStyle(0xd9b25f, 1).fillRect(12 * TILE + 4, 4 * TILE, 3, 14 * TILE).fillRect(14 * TILE - 7, 4 * TILE, 3, 14 * TILE);
    for (let y = 5; y < 17; y += 2) carpet.fillStyle(0xd9b25f, 0.6).fillRect(13 * TILE - 3, y * TILE, 6, 6);

    // Vier Spiegel, symmetrisch angeordnet
    for (const m of MIRRORS) {
      const [x, y] = m.cell;
      const img = this.placeObject('mirror', x + 0.5, y + 1);
      this.block(x, y, x, y);
      this.stars[m.flag] = this.addStar(m.flag, (x + 0.5) * TILE, (y - 2.2) * TILE);
      this.addInteractable({ target: img, stand: { x, y: y + 1 }, onInteract: () => this.mirrorStation(m) });
    }

    // Das Prisma in der Mitte des Läufers: Lichtbrücken
    const prism = this.placeObject('prism', 13, 10.2, 0.9);
    this.block(12, 9, 13, 9);
    this.stars[PRISM.flag] = this.addStar(PRISM.flag, 13 * TILE, 7.4 * TILE);
    this.addInteractable({ target: prism, stand: { x: 12, y: 10 }, onInteract: () => this.mirrorStation({ ...PRISM, cell: [12, 9] }) });

    // Heiligtum oben
    const gate = this.placeObject('temple-gate', 13, 4.6, 0.8);
    this.addInteractable({ target: gate, stand: { x: 12, y: 5 }, onInteract: () => this.sanctum() });
    if (this.mirrorsDone() === TOTAL && !getFlag('temple_boss')) this.spawnShadow(false);

    this.addGoblin(GOBLIN, { x: 21, y: 14 }, 'west');
    this.addPage('page_temple', 3, 13);
    this.addSign(8.5, 15.2, 'Spiegeltempel · 4 Spiegel');

    // Hüterin Lumen am Eingang
    this.lumen = this.addNpc('npc-lumen', { x: 15, y: 13 }, 'west');
    this.lumen.setAlpha(0.9);
    this.tweens.add({ targets: this.lumen, y: this.lumen.y - 3, duration: 1600, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.addInteractable({ target: this.lumen, stand: { x: 14, y: 13 }, onInteract: () => { this.faceToPlayer(this.lumen); this.talkToLumen(); } });

    this.updateGoal();
    if (!getFlag('temple_intro')) this.time.delayedCall(600, () => this.talkToLumen());
    return { x: 12, y: 15 };
  }

  /** Erledigte Stationen: vier Spiegel und das Prisma */
  private mirrorsDone(): number {
    return MIRRORS.filter((m) => getFlag(m.flag)).length + (getFlag(PRISM.flag) ? 1 : 0);
  }

  private talkToLumen(): void {
    if (!getFlag('temple_intro')) {
      this.say(
        [
          { speaker: 'Hüterin Lumen', text: 'Willkommen im Spiegeltempel, Lehrling. Ich bin Lumen, die Hüterin der Formen.' },
          { speaker: 'Hüterin Lumen', text: 'Seit der Nebel des Ungefähren hier liegt, zeigen die Spiegel nur noch ungefähre Bilder. Und ein ungefähres Bild ist kein Bild.' },
          { speaker: 'Hüterin Lumen', text: 'Bring die vier Spiegel wieder zum Leuchten: die Spiegelwand, die Siegel, das Haus der Vierecke und die Sternenkarte.' },
          { speaker: 'Hüterin Lumen', text: 'Und in der Mitte steht das Prisma. Seine Lichtbrücken müssen wieder gerade laufen: parallel und senkrecht.' },
          { speaker: 'Hüterin Lumen', text: 'Dann öffnet sich das Heiligtum. Dort ruht der zweite Splitter, das Urmaß der Form.' },
        ],
        () => {
          setFlag('temple_intro');
          this.updateGoal();
        },
      );
      return;
    }
    if (this.mirrorsDone() < TOTAL) {
      this.say([{ speaker: 'Hüterin Lumen', text: 'Ein Spiegel ohne Stern ist ein Spiegel ohne Licht. Such die Spiegel, über denen noch keiner leuchtet.' }]);
    } else if (!getFlag('temple_boss')) {
      this.say([{ speaker: 'Hüterin Lumen', text: 'Im Heiligtum wartet dein Spiegelbild aus Nebel. Sieh voraus, wo es erscheint!' }]);
    } else {
      this.say([{ speaker: 'Hüterin Lumen', text: 'Die Spiegel zeigen wieder wahre Bilder. Komm zum Üben, so oft du willst.' }]);
    }
  }

  private mirrorStation(m: Mirror): void {
    if (!getFlag('temple_intro')) {
      this.talkToLumen();
      return;
    }
    this.startPuzzle(m.puzzle, (solved) => {
      if (!solved) return;
      const first = !getFlag(m.flag);
      setFlag(m.flag);
      this.stars[m.flag]?.setVisible(true);
      this.updateGoal();
      if (first && this.mirrorsDone() === TOTAL) this.shadowAppears();
      else if (first && m.flag === PRISM.flag)
        this.say([{ speaker: 'Hüterin Lumen', text: 'Die Lichtbrücken laufen wieder gerade. Was parallel ist, trifft sich nie, und was sich nie trifft, ist parallel.' }]);
      else if (first) this.say([{ speaker: 'Hüterin Lumen', text: 'Der Spiegel leuchtet wieder. Was wahr ist, ist klar, und was klar ist, ist wahr.' }]);
    });
  }

  private spawnShadow(dramatic: boolean): void {
    // Das dunkle Spiegelbild der eigenen Figur vor dem Heiligtum
    const s = this.add.sprite(12.5 * TILE, 6.2 * TILE, 'avatar-player', 'south-0').setOrigin(0.5, 0.78).setTint(0x6a4aa8).setDepth(6.2 * TILE);
    this.block(12, 5, 12, 5);
    this.tweens.add({ targets: s, alpha: { from: 0.6, to: 0.95 }, duration: 900, yoyo: true, repeat: -1 });
    this.addInteractable({ target: s, stand: { x: 12, y: 7 }, onInteract: () => this.fightShadow() });
    if (dramatic) {
      s.setAlpha(0);
      this.cameras.main.flash(600, 180, 160, 255);
    }
    this.shadow = s;
  }

  private shadowAppears(): void {
    this.spawnShadow(true);
    this.updateGoal();
    this.say([
      { speaker: 'Hüterin Lumen', text: 'Alle Spiegel und das Prisma leuchten! Doch sieh … vor dem Heiligtum steht jemand.' },
      { speaker: 'Hüterin Lumen', text: 'Es sieht aus wie du! Der Splitter im Heiligtum zieht den Nebel an, und der Nebel hat sich dein Gesicht geliehen.' },
      { speaker: 'Hüterin Lumen', text: 'Es tut alles gespiegelt. Sieh voraus, wo es auftaucht!' },
    ]);
  }

  private fightShadow(): void {
    if (getFlag('temple_boss')) return;
    this.startPuzzle('DoppelgangerScene', (won) => {
      if (!won) return;
      setFlag('temple_boss');
      if (this.shadow) this.removeInteractable(this.shadow);
      this.shadow?.destroy();
      this.shadow = undefined;
      this.unblock(12, 5, 12, 5);
      this.updateGoal();
      this.say(
        [{ speaker: 'Hüterin Lumen', text: 'Das Spiegelbild ist zersprungen. Es war nur Nebel, du aber bist echt.' }],
        () => this.bridgeVision(),
      );
    });
  }

  /** Vagor meldet sich, dann zeigen die Spiegel zum ersten Mal die Große Brücke. */
  private bridgeVision(): void {
    this.vagorSays(
      [
        { speaker: 'Vagor', text: 'Du bist schneller als dein Spiegelbild, Lehrling. Aber Spiegel zeigen nicht nur, was ist.' },
        { speaker: 'Vagor', text: 'Frag deine Meisterin, was sie gesehen hat. Damals, an der Brücke.' },
      ],
      () => {
        this.cameras.main.flash(900, 200, 190, 255);
        this.say(
          [
            { speaker: 'Hüterin Lumen', text: 'Sieh nur, die Spiegel! Sie zeigen ein Bild aus der Vergangenheit.' },
            { speaker: 'Hüterin Lumen', text: 'Eine große Brücke über einem Fluss. Darauf zwei Vermesser: ein Mann im dunklen Mantel und eine junge Frau mit einem Messstab.' },
            { speaker: 'Hüterin Lumen', text: 'Die Frau … das ist Meisterin Elle. Und der Mann ist Vagor. Sie lachen zusammen. Sie waren einmal Freunde.' },
            { speaker: 'Hüterin Lumen', text: 'Das Bild verblasst. Geh ins Heiligtum, Lehrling. Dort wartet der Splitter.' },
          ],
          () => setFlag('vision_bridge'),
        );
      },
    );
  }

  private sanctum(): void {
    if (this.mirrorsDone() < TOTAL) {
      this.say([{ speaker: 'Hüterin Lumen', text: 'Das Heiligtum öffnet sich erst, wenn alle Spiegel und das Prisma leuchten.' }]);
      return;
    }
    if (!getFlag('temple_boss')) {
      this.say([{ speaker: 'Hüterin Lumen', text: 'Dein Spiegelbild versperrt den Weg!' }]);
      return;
    }
    if (getFlag('temple_done')) {
      this.say([{ speaker: 'Hüterin Lumen', text: 'Das Heiligtum ist leer. Den Splitter trägst du bei dir.' }]);
      return;
    }
    setFlag('temple_done');
    this.updateGoal();
    this.cameras.main.flash(700, 255, 250, 220);
    this.clearFog();
    void music.sting('fanfare');
    const s = this.add.image(this.player.x, this.player.y - 60, 'splitter').setDepth(20_000).setScale(0.2).setTint(0xbfe6ff);
    this.tweens.add({ targets: s, scale: 1, y: s.y - 20, duration: 900, ease: 'back.out' });
    this.tweens.add({ targets: s, alpha: 0, scale: 0.3, y: this.player.y - 20, delay: 3200, duration: 700, onComplete: () => s.destroy() });
    this.say([
      { speaker: 'Hüterin Lumen', text: 'Der Splitter der Form! Mit ihm haben Linien wieder ihre Richtung und Figuren ihre Gestalt.' },
      { speaker: 'Hüterin Lumen', text: 'Bring ihn zu Meisterin Elle. Symmetrie ist Ordnung, die man sieht, und was man sieht, ist Ordnung.' },
    ]);
  }

  private updateGoal(): void {
    if (!getFlag('temple_intro')) this.setGoal('Sprich mit Hüterin Lumen');
    else if (this.mirrorsDone() < TOTAL) this.setGoal(`Bring den Tempel zum Leuchten (${this.mirrorsDone()} von ${TOTAL})`);
    else if (!getFlag('temple_boss')) this.setGoal('Besiege den Spiegel-Doppelgänger');
    else if (!getFlag('temple_done')) this.setGoal('Betritt das Heiligtum');
    else if (!getFlag('elle_form')) this.setGoal('Bring den Splitter der Form zu Meisterin Elle');
    else this.setGoal('Weiter üben oder Fortsetzung abwarten …');
  }
}
