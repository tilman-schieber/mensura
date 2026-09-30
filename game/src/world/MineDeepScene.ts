import Phaser from 'phaser';
import { getFlag, setFlag } from '../save';
import type { DialogLine } from '../ui/dialog';
import { TILE, WorldScene } from './WorldScene';
import type { Cell } from './pathfind';
import { Terrain, vertexGrid, type TilesetData } from './terrain';

// Die Stellenstollen, tiefe Ebene (Klasse 5, Winter): das Zwergen-Rechenwerk.
// Seit der Nebel in den Zahnrädern steckt, schiebt die Maschine keine Überträge mehr.
// Tüftlerin Grete, vier Stationen (schriftlich addieren/subtrahieren, multiplizieren,
// dividieren mit Probe, Terme), danach der Zahlenautomat am alten Tor (Rückwärtsrechnen).
// Hinter dem Tor schläft der Primgolem: Er wartet auf Klasse 6 (Primzahlen).

const COLS = 26;
const ROWS = 18;
const WALL = 1;
const FLOOR = 0;

interface Station {
  flag: string;
  puzzle: string;
  done: DialogLine;
}

const ST = {
  rechenwerk: {
    flag: 'deep_column',
    puzzle: 'ColumnPuzzle',
    done: { speaker: 'Tüftlerin Grete', text: 'Rosalinde rattert wieder! So heißt das Rechenwerk. Sie mag es, wenn man die Überträge sauber schiebt.' },
  },
  waage: {
    flag: 'deep_multiply',
    puzzle: 'MultiplyPuzzle',
    done: { speaker: 'Tüftlerin Grete', text: 'Die Frachtwaage stimmt! Jetzt weiß jeder Zwerg, wie viel er tragen muss.' },
  },
  beute: {
    flag: 'deep_divide',
    puzzle: 'DividePuzzle',
    done: { speaker: 'Tüftlerin Grete', text: 'Gerecht geteilt, und mit Probe! So gibt es keinen Streit unter Zwergen.' },
  },
  runen: {
    flag: 'deep_terms',
    puzzle: 'TermPuzzle',
    done: { speaker: 'Tüftlerin Grete', text: 'Die Runen leuchten in der richtigen Reihenfolge. Klammer zuerst, dann Punkt, dann Strich.' },
  },
} satisfies Record<string, Station>;
const STATIONS: Station[] = Object.values(ST);

export class MineDeepScene extends WorldScene {
  private stars: Record<string, Phaser.GameObjects.Text> = {};
  private grete!: Phaser.GameObjects.Sprite;
  private gate!: Phaser.GameObjects.Image;

  constructor() {
    super('MineDeep');
  }

  protected fogDensity(): number {
    return getFlag('deep_done') ? 0 : 1;
  }

  preload(): void {
    this.load.image('tiles-mine', 'assets/tiles/mine.png');
    this.load.json('tiles-mine-data', 'assets/tiles/mine.json');
    for (const k of ['rechenwerk', 'freight-scale', 'rune-tablet', 'number-gate', 'elevator']) {
      this.load.image(k, `assets/objects/${k}.png`);
    }
    this.load.spritesheet('npc-grete', 'assets/npcs/grete.png', { frameWidth: 68, frameHeight: 68 });
  }

  protected buildWorld(): Cell {
    const v = vertexGrid(COLS, ROWS, WALL, [
      [2, 4, 23, 15, FLOOR],
      [11, 2, 14, 4, FLOOR],
      [12, 15, 14, 18, FLOOR],
    ]);
    this.terrain = new Terrain(this, 'tiles-mine', this.cache.json.get('tiles-mine-data') as TilesetData, v);
    this.cameras.main.setBackgroundColor(0x0b0d10);
    // tiefer im Berg: etwas wärmeres, dunkleres Licht
    this.add.rectangle(0, 0, COLS * TILE, ROWS * TILE, 0xd8bc90, 1).setOrigin(0).setDepth(-950).setBlendMode(Phaser.BlendModes.MULTIPLY);

    // Aufzug zurück nach oben
    const lift = this.placeObject('elevator', 13, 17.6, 0.9);
    this.addExit(12, 16, 13, 17, () => this.goTo('Mine', 'deep'));
    this.addInteractable({ target: lift, stand: { x: 12, y: 15 }, onInteract: () => this.goTo('Mine', 'deep') });

    // Station 1: das Rechenwerk „Rosalinde“ (links oben)
    const machine = this.placeObject('rechenwerk', 6.5, 8.4, 0.75);
    this.block(5, 6, 8, 7);
    this.stars[ST.rechenwerk.flag] = this.addStar(ST.rechenwerk.flag, 6.5 * TILE, 4.6 * TILE);
    this.addInteractable({ target: machine, stand: { x: 6, y: 8 }, onInteract: () => this.station(ST.rechenwerk) });

    // Station 2: Frachtwaage (rechts oben)
    const scale = this.placeObject('freight-scale', 19.5, 8.2, 0.9);
    this.block(19, 7, 20, 7);
    this.stars[ST.waage.flag] = this.addStar(ST.waage.flag, 19.5 * TILE, 5.6 * TILE);
    this.addInteractable({ target: scale, stand: { x: 19, y: 8 }, onInteract: () => this.station(ST.waage) });

    // Station 3: Beute teilen (links unten)
    const chest = this.placeObject('treasure', 5.5, 13.3, 0.8);
    this.block(5, 12, 6, 12);
    this.stars[ST.beute.flag] = this.addStar(ST.beute.flag, 5.5 * TILE, 10.6 * TILE);
    this.addInteractable({ target: chest, stand: { x: 6, y: 13 }, onInteract: () => this.station(ST.beute) });

    // Station 4: Runentafel (rechts unten)
    const tablet = this.placeObject('rune-tablet', 19.5, 13.2, 0.9);
    this.block(19, 12, 19, 12);
    this.stars[ST.runen.flag] = this.addStar(ST.runen.flag, 19.5 * TILE, 10.4 * TILE);
    this.addInteractable({ target: tablet, stand: { x: 19, y: 13 }, onInteract: () => this.station(ST.runen) });

    // Das alte Tor in der Nische oben: Zahlenautomat
    this.gate = this.placeObject('number-gate', 13, 4.8, 0.8);
    this.block(11, 3, 14, 4);
    if (getFlag('deep_done')) this.gate.setAlpha(0.35);
    else if (this.stationsDone() === 4) this.gateGlow();
    this.addInteractable({ target: this.gate, stand: { x: 12, y: 5 }, onInteract: () => this.openGate() });

    this.addPage('page_deep', 22, 14);
    this.addSign(9.5, 15.2, 'Rechenwerk');

    // Tüftlerin Grete in der Mitte der Halle
    this.grete = this.addNpc('npc-grete', { x: 15, y: 10 }, 'west');
    this.addInteractable({ target: this.grete, stand: { x: 14, y: 10 }, onInteract: () => { this.faceToPlayer(this.grete); this.talkToGrete(); } });

    this.updateGoal();
    if (!getFlag('deep_intro')) this.time.delayedCall(600, () => { this.faceToPlayer(this.grete); this.talkToGrete(); });
    return { x: 12, y: 14 };
  }

  private stationsDone(): number {
    return STATIONS.filter((s) => getFlag(s.flag)).length;
  }

  private talkToGrete(): void {
    if (!getFlag('deep_intro')) {
      this.say(
        [
          { speaker: 'Tüftlerin Grete', text: 'Ein Lehrling, hier unten? Endlich Hilfe! Ich bin Grete, ich baue und pflege das Rechenwerk.' },
          { speaker: 'Tüftlerin Grete', text: 'Seit der Nebel in den Zahnrädern steckt, schiebt die Maschine keine Überträge mehr weiter. Das musst du jetzt von Hand machen.' },
          { speaker: 'Tüftlerin Grete', text: 'Hilf mir am Rechenwerk, an der Frachtwaage, beim Teilen der Beute und an der Runentafel.' },
          { speaker: 'Tüftlerin Grete', text: 'Dann öffnen wir zusammen das alte Tor da oben. Keiner weiß, was dahinter liegt.' },
        ],
        () => {
          setFlag('deep_intro');
          this.updateGoal();
        },
      );
      return;
    }
    if (this.stationsDone() < 4) {
      this.say([{ speaker: 'Tüftlerin Grete', text: 'Über jeder Maschine muss ein Stern leuchten. Vier Stück, nicht ungefähr vier. Genau vier!' }]);
    } else if (!getFlag('deep_done')) {
      this.say([{ speaker: 'Tüftlerin Grete', text: 'Das Tor will eine Zahl. Der Automat verrät nur, was er mit ihr macht. Rechne rückwärts!' }]);
    } else {
      this.say([{ speaker: 'Tüftlerin Grete', text: 'Rosalinde und ich rechnen jetzt jeden Tag. Komm zum Üben, wann du willst!' }]);
    }
  }

  private station(s: Station): void {
    if (!getFlag('deep_intro')) {
      this.talkToGrete();
      return;
    }
    this.startPuzzle(s.puzzle, (solved) => {
      if (!solved) return;
      const first = !getFlag(s.flag);
      setFlag(s.flag);
      this.stars[s.flag]?.setVisible(true);
      this.updateGoal();
      if (!first) return;
      if (this.stationsDone() === 4) {
        this.say(
          [
            s.done,
            { speaker: 'Tüftlerin Grete', text: 'Alle vier Maschinen laufen! Hörst du das Summen? Das alte Tor erwacht.' },
            { speaker: 'Tüftlerin Grete', text: 'Es will eine Zahl. Aber welche? Der Automat verrät nur, was er mit ihr macht.' },
          ],
          () => this.gateGlow(),
        );
      } else this.say([s.done]);
    });
  }

  private gateGlow(): void {
    this.tweens.add({ targets: this.gate, alpha: { from: 1, to: 0.7 }, duration: 700, yoyo: true, repeat: -1 });
    this.gate.setTint(0xffe6a0);
  }

  private openGate(): void {
    if (getFlag('deep_done')) {
      this.say([{ speaker: 'Tüftlerin Grete', text: 'Dahinter geht es noch tiefer hinab. Aber das ist etwas fürs nächste Schuljahr.' }]);
      return;
    }
    if (this.stationsDone() < 4) {
      this.say([{ speaker: 'Tüftlerin Grete', text: 'Das Tor rührt sich nicht. Erst müssen alle vier Maschinen laufen.' }]);
      return;
    }
    this.startPuzzle('AutomatonPuzzle', (solved) => {
      if (!solved) return;
      setFlag('deep_done');
      this.tweens.killTweensOf(this.gate);
      this.gate.clearTint();
      this.clearFog();
      this.cameras.main.shake(900, 0.008);
      this.tweens.add({ targets: this.gate, alpha: 0.35, duration: 1200 });
      this.updateGoal();
      this.say(
        [
          { speaker: 'Tüftlerin Grete', text: 'Das Tor ist offen! Dahinter führt eine Treppe noch tiefer hinab.' },
          { speaker: 'Tüftlerin Grete', text: 'Hörst du das? Da unten schnarcht etwas Großes. Das ist nichts für heute.' },
        ],
        () =>
          this.vagorSays(
            [
              { speaker: 'Vagor', text: 'Rechne nur, Lehrling. Ganz unten wartet mein Wächter.' },
              { speaker: 'Vagor', text: 'Er ist aus Zahlen gebaut, die sich nicht teilen lassen. Die kannst du noch nicht spalten.' },
            ],
            () =>
              this.say([
                { speaker: 'Tüftlerin Grete', text: 'Zahlen, die sich nicht teilen lassen? Das klingt nach Primzahlen. Die lernst du im nächsten Schuljahr.' },
                { speaker: 'Tüftlerin Grete', text: 'Bring Meisterin Elle die Nachricht. Sie wird wissen wollen, was hier unten schläft.' },
              ]),
          ),
      );
    });
  }

  private updateGoal(): void {
    if (!getFlag('deep_intro')) this.setGoal('Sprich mit Tüftlerin Grete');
    else if (this.stationsDone() < 4) this.setGoal(`Bring die Maschinen zum Laufen (${this.stationsDone()} von 4)`);
    else if (!getFlag('deep_done')) this.setGoal('Öffne das alte Tor mit dem Zahlenautomaten');
    else if (!getFlag('elle_deep')) this.setGoal('Erzähl Meisterin Elle, was unter dem Rechenwerk schläft');
    else this.setGoal('Weiter üben oder Fortsetzung abwarten …');
  }
}
