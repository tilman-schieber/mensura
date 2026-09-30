import Phaser from 'phaser';
import { drawCuboid } from '../puzzles/cuboid';
import { getFlag, setFlag } from '../save';
import { TILE, WorldScene } from './WorldScene';
import type { Cell } from './pathfind';
import { Terrain, vertexGrid, type TilesetData } from './terrain';

// Die Würfelfestung (Klasse 5, Sommer): Umfang, Flächen, Würfelnetze, Volumen, Oberfläche.
// Erreichbar mit der Fähre aus dem Riesental. Baumeister Quadro, vier Stationen,
// danach der Kubus-Wächter; Belohnung: der Splitter des Urmaßes des Raums.

const COLS = 26;
const ROWS = 18;
const WALL = 1;
const FLOOR = 0;

interface Station {
  flag: string;
  puzzle: string;
}

const ST = {
  tiles: { flag: 'fort_tiles', puzzle: 'TilePuzzle' },
  nets: { flag: 'fort_nets', puzzle: 'NetPuzzle' },
  volume: { flag: 'fort_volume', puzzle: 'VolumePuzzle' },
  paint: { flag: 'fort_paint', puzzle: 'PaintPuzzle' },
} satisfies Record<string, Station>;
const STATIONS: Station[] = Object.values(ST);

export class FortressScene extends WorldScene {
  private stars: Record<string, Phaser.GameObjects.Text> = {};
  private quadro!: Phaser.GameObjects.Sprite;
  private kubus?: Phaser.GameObjects.Image;

  constructor() {
    super('Fortress');
  }

  protected fogDensity(): number {
    return getFlag('fort_done') ? 0 : 1;
  }

  preload(): void {
    this.load.image('tiles-fortress', 'assets/tiles/fortress.png');
    this.load.json('tiles-fortress-data', 'assets/tiles/fortress.json');
    this.load.image('kubus', 'assets/objects/kubus.png');
    this.load.image('paint-bench', 'assets/objects/paint-bench.png');
    this.load.image('splitter', 'assets/objects/splitter.png');
    this.load.spritesheet('npc-quadro', 'assets/npcs/quadro.png', { frameWidth: 68, frameHeight: 68 });
  }

  protected buildWorld(): Cell {
    const v = vertexGrid(COLS, ROWS, WALL, [
      [2, 4, 23, 15, FLOOR],
      [12, 15, 14, 18, FLOOR],
    ]);
    this.terrain = new Terrain(this, 'tiles-fortress', this.cache.json.get('tiles-fortress-data') as TilesetData, v);
    this.cameras.main.setBackgroundColor(0x14161c);
    // Der Boden ist sehr hell: warmer Sandstein-Ton darüber (Multiplizieren)
    this.add
      .rectangle(0, 0, COLS * TILE, ROWS * TILE, 0xd9b88a, 1)
      .setOrigin(0)
      .setDepth(-950)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.addExit(12, 16, 13, 17, () => this.goTo('Valley', 'fortress'));

    // Station 1: Fliesenfeld (Fläche und Umfang)
    const tiles = this.add.graphics().setDepth(-400);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 3; y++) {
        tiles.fillStyle((x + y) % 2 ? 0x8aa4c8 : 0xd8c7a0, 1).fillRect((4 + x) * TILE + 2, (6 + y) * TILE + 2, TILE - 4, TILE - 4);
      }
    }
    tiles.lineStyle(3, 0xf0d78a, 1).strokeRect(4 * TILE, 6 * TILE, 5 * TILE, 3 * TILE);
    const tileZone = this.add.zone(4 * TILE, 6 * TILE, 5 * TILE, 3 * TILE).setOrigin(0);
    this.stars[ST.tiles.flag] = this.addStar(ST.tiles.flag, 6.5 * TILE, 5.2 * TILE);
    this.addInteractable({ target: tileZone, stand: { x: 6, y: 9 }, onInteract: () => this.station(ST.tiles) });

    // Station 2: Würfelnetz auf dem Boden (Faltstab)
    const net = this.add.graphics().setDepth(-400);
    const cross: [number, number][] = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
    for (const [x, y] of cross) {
      net.fillStyle(0x9a86c8, 1).fillRect((18 + x) * TILE + 2, (5 + y) * TILE + 2, TILE - 4, TILE - 4);
      net.lineStyle(2, 0x3a2a60, 1).strokeRect((18 + x) * TILE + 2, (5 + y) * TILE + 2, TILE - 4, TILE - 4);
    }
    const netZone = this.add.zone(18 * TILE, 5 * TILE, 4 * TILE, 3 * TILE).setOrigin(0);
    this.stars[ST.nets.flag] = this.addStar(ST.nets.flag, 19.5 * TILE, 4.4 * TILE);
    this.addInteractable({ target: netZone, stand: { x: 19, y: 8 }, onInteract: () => this.station(ST.nets) });

    // Station 3: Würfelstapel (Volumen)
    const stack = this.add.graphics().setDepth(13 * TILE);
    drawCuboid(stack, 4 * TILE, 13 * TILE, 3, 2, 2, 20, true, { front: 0xb89a6a, top: 0xd8bc8a, side: 0x8a6a3a, line: 0x2a1a08 });
    drawCuboid(stack, 7.2 * TILE, 13 * TILE, 1, 1, 3, 20, true, { front: 0xb89a6a, top: 0xd8bc8a, side: 0x8a6a3a, line: 0x2a1a08 });
    this.block(4, 11, 8, 12);
    const stackZone = this.add.zone(4 * TILE, 10.5 * TILE, 5 * TILE, 2.5 * TILE).setOrigin(0);
    this.stars[ST.volume.flag] = this.addStar(ST.volume.flag, 6 * TILE, 9.6 * TILE);
    this.addInteractable({ target: stackZone, stand: { x: 6, y: 13 }, onInteract: () => this.station(ST.volume) });

    // Station 4: Malerwerkstatt (Oberfläche)
    const bench = this.placeObject('paint-bench', 20.5, 13);
    this.block(19, 12, 21, 12);
    this.stars[ST.paint.flag] = this.addStar(ST.paint.flag, 20.5 * TILE, 10.4 * TILE);
    this.addInteractable({ target: bench, stand: { x: 20, y: 13 }, onInteract: () => this.station(ST.paint) });

    // Baumeister Quadro am Eingang
    this.quadro = this.addNpc('npc-quadro', { x: 14, y: 13 }, 'west');
    this.addInteractable({ target: this.quadro, stand: { x: 13, y: 13 }, onInteract: () => { this.faceToPlayer(this.quadro); this.talkToQuadro(); } });

    if (this.stationsDone() === 4 && !getFlag('fort_boss')) this.spawnKubus(false);

    this.updateGoal();
    if (!getFlag('fort_intro')) this.time.delayedCall(600, () => this.talkToQuadro());
    return { x: 12, y: 15 };
  }

  private stationsDone(): number {
    return STATIONS.filter((s) => getFlag(s.flag)).length;
  }

  private talkToQuadro(): void {
    if (!getFlag('fort_intro')) {
      this.say(
        [
          { speaker: 'Baumeister Quadro', text: 'Ein Besucher! Willkommen in der Würfelfestung. Ich bin Quadro, der Baumeister.' },
          { speaker: 'Baumeister Quadro', text: 'Hier ist alles genau vermessen: jede Fliese, jede Kiste, jeder Stein. Doch der Nebel hat meine Pläne verwischt, und nun ist alles nur noch ungefähr. Ungefähr! Ich kann das Wort nicht hören.' },
          { speaker: 'Baumeister Quadro', text: 'Hilf mir beim Fliesenfeld, beim Würfelnetz, im Würfellager und in der Malerwerkstatt.' },
          { speaker: 'Baumeister Quadro', text: 'Dann zeige ich dir, was in der Mitte der Festung verborgen liegt.' },
        ],
        () => {
          setFlag('fort_intro');
          this.updateGoal();
        },
      );
      return;
    }
    if (this.stationsDone() < 4) {
      this.say([{ speaker: 'Baumeister Quadro', text: 'Es fehlen noch Sterne. Eine Festung mit Lücken ist keine Festung, das stört mich mehr als ein schiefes Bild.' }]);
    } else if (!getFlag('fort_boss')) {
      this.say([{ speaker: 'Baumeister Quadro', text: 'Der Kubus-Wächter ist erwacht! Nur wer Flächen und Körper versteht, kann ihn bezwingen.' }]);
    } else {
      this.say([{ speaker: 'Baumeister Quadro', text: 'Meine Festung steht wieder gerade. Bis auf die Fackel dort drüben, die rücke ich gleich zurecht. Komm jederzeit zum Üben vorbei!' }]);
    }
  }

  private station(s: Station): void {
    if (!getFlag('fort_intro')) {
      this.talkToQuadro();
      return;
    }
    this.startPuzzle(s.puzzle, (solved) => {
      if (!solved) return;
      const first = !getFlag(s.flag);
      setFlag(s.flag);
      this.stars[s.flag]?.setVisible(true);
      this.updateGoal();
      if (first && this.stationsDone() === 4) this.kubusAppears();
      else if (first) this.say([{ speaker: 'Baumeister Quadro', text: 'Genau so! Auf den Millimeter. Ah, das tut gut, wenn etwas wieder stimmt.' }]);
    });
  }

  private spawnKubus(dramatic: boolean): void {
    const k = this.placeObject('kubus', 13, 9.4, 0.6);
    this.block(12, 7, 13, 8);
    this.tweens.add({ targets: k, y: k.y - 6, duration: 1300, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.addInteractable({ target: k, stand: { x: 13, y: 10 }, onInteract: () => this.fightKubus() });
    if (dramatic) {
      k.setAlpha(0);
      this.tweens.add({ targets: k, alpha: 1, duration: 1400 });
      this.cameras.main.flash(500, 120, 160, 255);
    }
    this.kubus = k;
  }

  private kubusAppears(): void {
    this.spawnKubus(true);
    this.updateGoal();
    this.say([
      { speaker: 'Baumeister Quadro', text: 'Alle Pläne stimmen wieder! Aber hörst du das Summen? Der Kubus-Wächter erwacht!' },
      { speaker: 'Baumeister Quadro', text: 'Der Nebel hat sich um etwas in seinem Inneren gesammelt. Zeig ihm, dass du Flächen, Netze und Volumen verstehst!' },
    ]);
  }

  private fightKubus(): void {
    this.startPuzzle('KubusScene', (won) => {
      if (!won) return;
      setFlag('fort_boss');
      this.kubus?.destroy();
      this.kubus = undefined;
      this.unblock(12, 7, 13, 8);
      setFlag('fort_done');
      this.clearFog();
      this.updateGoal();
      const s = this.add.image(this.player.x, this.player.y - 60, 'splitter').setDepth(20_000).setScale(0.2).setTint(0xb8c8ff);
      this.tweens.add({ targets: s, scale: 1, y: s.y - 20, duration: 900, ease: 'back.out' });
      this.tweens.add({ targets: s, alpha: 0, scale: 0.3, y: this.player.y - 20, delay: 3200, duration: 700, onComplete: () => s.destroy() });
      this.say(
        [
          { speaker: 'Baumeister Quadro', text: 'Der Wächter ist frei! Und sieh: In seinem Inneren lag ein Splitter, das Urmaß des Raums.' },
          { speaker: 'Baumeister Quadro', text: 'Mit ihm hat alles wieder Länge, Breite und Höhe.' },
        ],
        () => this.citadelReveal(),
      );
    });
  }

  /** Vagor dankt Quadro, und Quadro begreift, was er gebaut hat. */
  private citadelReveal(): void {
    this.vagorSays(
      [
        { speaker: 'Vagor', text: 'Quadro, mein treuer Baumeister. Deine beste Arbeit steht längst. Du weißt nur nicht, wo.' },
        { speaker: 'Vagor', text: 'Komm nur, Lehrling. Ich warte dort, wo alles angefangen hat.' },
      ],
      () =>
        this.say(
          [
            { speaker: 'Baumeister Quadro', text: 'Vagor? Das war … Oh nein.' },
            { speaker: 'Baumeister Quadro', text: 'Vor Jahren bestellte ein Fremder im dunklen Mantel eine Zitadelle bei mir. Er zahlte in Gold, und ich habe gebaut, ohne zu fragen.' },
            { speaker: 'Baumeister Quadro', text: 'Hier, der Grundriss. Die Zitadelle steht am großen Fluss, genau dort, wo früher die Große Brücke war.' },
            { speaker: 'Baumeister Quadro', text: 'Bring den Splitter zu Meisterin Elle. Und zeig ihr diesen Plan. Sie wird wissen, was er bedeutet.' },
          ],
          () => setFlag('citadel_plan'),
        ),
    );
  }

  private updateGoal(): void {
    if (!getFlag('fort_intro')) this.setGoal('Sprich mit Baumeister Quadro');
    else if (this.stationsDone() < 4) this.setGoal(`Hilf Quadro an vier Stellen (${this.stationsDone()} von 4)`);
    else if (!getFlag('fort_boss')) this.setGoal('Bezwinge den Kubus-Wächter');
    else if (!getFlag('elle_space')) this.setGoal('Bring den Splitter des Raums zu Meisterin Elle');
    else this.setGoal('Weiter üben oder Fortsetzung abwarten …');
  }
}
