import Phaser from 'phaser';
import { getFlag, loadSave, setFlag, topicDone } from '../save';
import { TILE, WorldScene } from './WorldScene';
import type { DialogLine } from '../ui/dialog';
import type { Cell } from './pathfind';
import { Terrain, vertexGrid, type TilesetData } from './terrain';

// Eichstadt, das Heimatdorf. Meisterin Elle schickt die Spielfigur in die Mine.
// Im Westen liegt die Ruine der Alten (Nebenaufgabe: römische Zahlen, Zweiersystem).

const COLS = 30;
const ROWS = 20;
const GRASS = 1;
const DIRT = 0;

/** Regionen der Oberwelt in Schulreihenfolge. */
interface Region {
  /** nötige Schulthemen (alle abgehakt) */
  topics: string[];
  done: string;
  reported: string;
  goGoal: string;
  lockedGoal: string;
  thanks: DialogLine[];
}

const REGIONS: Region[] = [
  {
    topics: [],
    done: 'mine_outer_done',
    reported: 'elle_splitter',
    goGoal: 'Geh zur Mine im Osten',
    lockedGoal: '',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Das ist er! Ein Splitter des Urmaßes der Zahl. Sieh nur, wie die Farben ins Dorf zurückkehren.' },
      { speaker: 'Meisterin Elle', text: 'Jedes Urmaß ist in zwei Hälften zerbrochen. Die andere Hälfte schläft tief unten in den Stollen. Dorthin gehen wir, wenn du in der Schule weitergekommen bist.' },
      { speaker: 'Meisterin Elle', text: 'Die nächste Spur führt nach Süden, zum Spiegeltempel. Dort ruht das Urmaß der Form.' },
      { speaker: 'Meisterin Elle', text: 'Ruh dich aus, Lehrling. Deine Reise hat gerade erst begonnen.' },
    ],
  },
  {
    topics: ['geometrie'],
    done: 'temple_done',
    reported: 'elle_form',
    goGoal: 'Folge dem Weg nach Süden zum Spiegeltempel',
    lockedGoal: 'Südweg öffnet sich mit dem Schulthema „Symmetrie“',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Der Splitter der Form! Zwei von vierzehn Splittern sind geborgen.' },
      { speaker: 'Meisterin Elle', text: 'Du siehst mich so seltsam an. Hat Lumen dir etwas in ihren Spiegeln gezeigt?' },
      { speaker: 'Meisterin Elle', text: 'Die Große Brücke. Ja, Vagor und ich waren einmal Freunde. Mehr will ich dazu jetzt nicht sagen.' },
      { speaker: 'Meisterin Elle', text: 'Im Norden liegt das Riesental. Dort hütet eine Riesin das Urmaß der Größe.' },
    ],
  },
  {
    topics: ['groessen'],
    done: 'valley_done',
    reported: 'elle_size',
    goGoal: 'Folge dem Weg nach Norden ins Riesental',
    lockedGoal: 'Nordweg öffnet sich mit dem Schulthema „Größen“',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Der Splitter der Größe! Drei von vierzehn.' },
      { speaker: 'Meisterin Elle', text: 'Vagor hat wieder mit dir gesprochen? Hanna hat recht, er klingt traurig. Er war nicht immer so.' },
      { speaker: 'Meisterin Elle', text: 'Hinter dem Fluss im Riesental steht die Würfelfestung. Dort ruht das Urmaß des Raums.' },
    ],
  },
  {
    topics: ['groessen', 'flaechen'],
    done: 'fort_done',
    reported: 'elle_space',
    goGoal: 'Fahr im Riesental mit dem Boot zur Würfelfestung',
    lockedGoal: 'Die Festung öffnet sich mit dem Schulthema „Flächen“',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Der Splitter des Raums! Vier von vierzehn. Das ganze erste Jahr hast du gemeistert.' },
      { speaker: 'Meisterin Elle', text: 'Und was ist das? Ein Grundriss von Quadro … Die Zitadelle steht dort, wo die Brücke war.' },
      { speaker: 'Meisterin Elle', text: 'Setz dich, Lehrling. Es ist Zeit, dass du die Wahrheit erfährst.' },
      { speaker: 'Meisterin Elle', text: 'Vagor und ich haben die Große Brücke zusammen geplant. Er hat gerechnet, und ich sollte die Probe machen.' },
      { speaker: 'Meisterin Elle', text: 'Ich habe ihm vertraut und die Probe weggelassen. Bei der Einweihung brach die Brücke. Alle fielen in den Fluss, und das ganze Land lachte über Vagor.' },
      { speaker: 'Meisterin Elle', text: 'Seitdem gehe ich am Stock. Und seitdem glaubt Vagor, die Urmaße hätten ihn belogen.' },
      { speaker: 'Meisterin Elle', text: 'Aber die Wahrheit ist: Ich hätte den Fehler finden können. Ich habe es nur nicht versucht.' },
      { speaker: 'Meisterin Elle', text: 'Die letzten drei Urmaße liegen weiter weg. Die Wege dorthin öffnen sich im nächsten Schuljahr. Dann finden wir heraus, was an der Brücke wirklich geschah.' },
    ],
  },
];

export class VillageScene extends WorldScene {
  private ruinStars: Record<string, Phaser.GameObjects.Text> = {};
  private wisps: { cell: Cell; count: number; sprite: Phaser.GameObjects.Image; calmUntil: number }[] = [];

  constructor() {
    super('Village');
  }

  /** Das Dorf wird mit jedem abgegebenen Splitter farbiger. */
  protected fogDensity(): number {
    const back = REGIONS.filter((r) => getFlag(r.reported)).length;
    return 0.8 * (1 - back / REGIONS.length);
  }

  preload(): void {
    this.load.image('tiles-village', 'assets/tiles/village.png');
    this.load.json('tiles-village-data', 'assets/tiles/village.json');
    this.load.image('house-elle', 'assets/objects/house-elle.png');
    this.load.image('tree-oak', 'assets/objects/tree-oak.png');
    this.load.image('mine-entrance', 'assets/objects/mine-entrance.png');
    this.load.spritesheet('npc-elle', 'assets/npcs/elle.png', { frameWidth: 68, frameHeight: 68 });
    this.load.image('ruin', 'assets/objects/ruin.png');
    this.load.image('stele', 'assets/objects/stele.png');
    this.load.image('rune-stones', 'assets/objects/rune-stones.png');
    this.load.image('nebelwesen', 'assets/objects/nebelwesen.png');
    this.load.image('temple-gate', 'assets/objects/temple-gate.png');
    this.load.image('giant-mushroom', 'assets/objects/giant-mushroom.png');
  }

  protected buildWorld(entry?: string): Cell {
    // Wiese mit Wegen: vom Haus nach Süden, dann nach Osten, dann hoch zur Mine
    const v = vertexGrid(COLS, ROWS, GRASS, [
      [7, 7, 9, 13, DIRT],
      [7, 12, 27, 14, DIRT],
      [25, 4, 27, 13, DIRT],
      [1, 12, 7, 14, DIRT],
      [15, 14, 17, 20, DIRT],
      [18, 0, 20, 12, DIRT],
    ]);
    this.blockUpper = false;
    this.terrain = new Terrain(this, 'tiles-village', this.cache.json.get('tiles-village-data') as TilesetData, v);

    // Haus von Meisterin Elle
    this.placeObject('house-elle', 7, 7);
    this.block(5, 3, 9, 6);

    // Mineneingang oben rechts
    const mine = this.placeObject('mine-entrance', 26, 4);
    this.block(23, 0, 29, 2);
    this.block(23, 3, 24, 3);
    this.block(28, 3, 29, 3);
    this.addExit(25, 3, 27, 3, () => this.enterMine());
    this.addInteractable({ target: mine, stand: { x: 26, y: 4 }, onInteract: () => this.enterMine() });

    // Bäume am Rand und verstreut
    const trees: [number, number][] = [
      [2, 3], [3, 9], [12, 4], [16, 3], [14, 9], [22, 7],
      [11, 18], [22, 18], [28, 17], [29, 9],
    ];
    for (const [x, y] of trees) {
      this.placeObject('tree-oak', x + 0.5, y + 1);
      this.block(x, y, x, y);
    }

    this.buildRuin();
    this.spawnWisps();
    this.buildTempleWay();
    this.buildValleyWay();

    // Meisterin Elle vor ihrem Haus
    const elle = this.addNpc('npc-elle', { x: 9, y: 8 }, 'south');
    this.addInteractable({ target: elle, stand: { x: 9, y: 9 }, onInteract: () => { this.faceToPlayer(elle); this.talkToElle(); } });

    this.updateGoal();
    if (!getFlag('elle_intro')) this.time.delayedCall(700, () => this.talkToElle());

    if (entry === 'mine') return { x: 26, y: 5 };
    if (entry === 'temple') return { x: 16, y: 16 };
    if (entry === 'valley') return { x: 19, y: 2 };
    const place = loadSave().place;
    if (!entry && place?.scene === 'Village') return { x: place.x, y: place.y };
    return { x: 8, y: 10 };
  }

  // ---------- Weg ins Riesental (Norden) ----------

  private buildValleyWay(): void {
    const marker = this.placeObject('giant-mushroom', 21.6, 2, 0.45);
    this.block(21, 1, 21, 1);
    if (topicDone('groessen')) {
      this.addExit(18, 0, 19, 0, () => this.goTo('Valley', 'village'));
      this.addInteractable({ target: marker, stand: { x: 20, y: 1 }, onInteract: () => this.goTo('Valley', 'village') });
      return;
    }
    this.block(18, 0, 19, 1);
    const fog: Phaser.GameObjects.Ellipse[] = [];
    for (let i = 0; i < 7; i++) {
      const e = this.add
        .ellipse((18 + Math.random() * 2) * TILE, (Math.random() * 2.5) * TILE, 90 + Math.random() * 40, 40 + Math.random() * 20, 0xc9d4de, 0.55)
        .setDepth(3 * TILE);
      this.tweens.add({ targets: e, x: e.x + 12, alpha: 0.35, duration: 1800 + i * 150, yoyo: true, repeat: -1, ease: 'sine.inout' });
      fog.push(e);
    }
    this.addInteractable({ target: fog[0], stand: { x: 19, y: 3 }, onInteract: () => this.foggedValley() });
  }

  private foggedValley(): void {
    this.say([
      { speaker: 'Meisterin Elle', text: 'Dieser Weg führt ins Riesental. Noch liegt dort zu dichter Nebel.' },
      { speaker: 'Meisterin Elle', text: 'Er lichtet sich, wenn ihr in der Schule Größen und Einheiten durchnehmt. Dann hakt ihr das Thema im Menü ab.' },
    ]);
  }

  // ---------- Weg zum Spiegeltempel (Süden) ----------

  private buildTempleWay(): void {
    const gate = this.placeObject('temple-gate', 16, 20.3, 0.7);
    this.block(14, 17, 14, 19);
    this.block(17, 17, 18, 19);
    const open = topicDone('geometrie');
    if (open) {
      this.addExit(15, 19, 16, 19, () => this.goTo('Temple', 'village'));
      this.addInteractable({ target: gate, stand: { x: 15, y: 18 }, onInteract: () => this.goTo('Temple', 'village') });
      return;
    }
    // Dichter Nebel versperrt den Weg, bis das Schulthema abgehakt ist
    this.block(15, 16, 16, 19);
    const fog: Phaser.GameObjects.Ellipse[] = [];
    for (let i = 0; i < 9; i++) {
      const e = this.add
        .ellipse((15 + Math.random() * 2) * TILE, (15.5 + Math.random() * 4) * TILE, 90 + Math.random() * 50, 40 + Math.random() * 20, 0xc9d4de, 0.55)
        .setDepth(19 * TILE);
      this.tweens.add({ targets: e, x: e.x + 12, alpha: 0.35, duration: 1800 + i * 150, yoyo: true, repeat: -1, ease: 'sine.inout' });
      fog.push(e);
    }
    this.addInteractable({ target: fog[0], stand: { x: 16, y: 15 }, onInteract: () => this.foggedWay() });
    this.addInteractable({ target: gate, stand: { x: 16, y: 15 }, onInteract: () => this.foggedWay() });
  }

  private foggedWay(): void {
    this.say([
      { speaker: 'Meisterin Elle', text: 'Der Nebel ist hier noch zu dicht. Dieser Weg führt zum Spiegeltempel.' },
      { speaker: 'Meisterin Elle', text: 'Er lichtet sich, wenn ihr in der Schule Figuren und Symmetrie durchnehmt. Dann hakt ihr das Thema im Menü unter Schulthemen ab.' },
    ]);
  }

  // ---------- Nebelwesen (Kopfrechnen) ----------

  private spawnWisps(): void {
    this.wisps = [];
    const groups: [number, number, number][] = [
      [17, 13, 2],
      [22, 12, 3],
      [26, 8, 3],
    ];
    for (const [x, y, count] of groups) {
      const sprite = this.add.image((x + 0.5) * TILE, (y + 0.4) * TILE, 'nebelwesen').setAlpha(0.85).setDepth((y + 1) * TILE);
      this.tweens.add({ targets: sprite, y: sprite.y - 5, duration: 1400, yoyo: true, repeat: -1, ease: 'sine.inout' });
      const wisp = { cell: { x, y }, count, sprite, calmUntil: 0 };
      this.wisps.push(wisp);
      this.addInteractable({ target: sprite, stand: { x: x - 1, y }, onInteract: () => this.fightWisp(wisp) });
    }
  }

  protected onEnterCell(c: Cell): void {
    if (!getFlag('elle_intro')) return;
    const w = this.wisps.find(
      (it) => it.sprite.active && this.time.now > it.calmUntil && Math.abs(it.cell.x - c.x) <= 1 && Math.abs(it.cell.y - c.y) <= 1,
    );
    if (w) this.fightWisp(w);
  }

  private fightWisp(w: (typeof this.wisps)[number]): void {
    if (!w.sprite.active) return;
    this.startPuzzle('FogBattleScene', (won) => {
      if (won) {
        this.tweens.killTweensOf(w.sprite);
        this.tweens.add({ targets: w.sprite, alpha: 0, scale: 1.8, duration: 700, onComplete: () => w.sprite.destroy() });
      } else {
        w.calmUntil = this.time.now + 4000;
      }
    }, w.count);
  }

  // ---------- Ruine der Alten ----------

  private buildRuin(): void {
    // Das Tor der Alten südlich am Ende des Westwegs
    const ruin = this.placeObject('ruin', 3.5, 19.4);
    this.block(1, 16, 5, 18);
    this.addInteractable({ target: ruin, stand: { x: 3, y: 15 }, onInteract: () => this.ruinGate() });

    // Steintafel und Runensteine nördlich am Weg davor
    const stele = this.placeObject('stele', 1.5, 12, 0.9);
    this.block(1, 11, 1, 11);
    this.ruinStars.ruin_roman = this.addStar('ruin_roman', 1.5 * TILE, 9.6 * TILE);
    this.addInteractable({ target: stele, stand: { x: 2, y: 12 }, onInteract: () => this.ruinStation('RomanPuzzle', 'ruin_roman') });

    const stones = this.placeObject('rune-stones', 4.6, 11.9, 0.7);
    this.ruinStars.ruin_binary = this.addStar('ruin_binary', 4.6 * TILE, 10.4 * TILE);
    this.addInteractable({ target: stones, stand: { x: 4, y: 12 }, onInteract: () => this.ruinStation('BinaryPuzzle', 'ruin_binary') });
  }

  private ruinStation(puzzle: string, flag: string): void {
    this.startPuzzle(puzzle, (solved) => {
      if (!solved) return;
      setFlag(flag);
      this.ruinStars[flag]?.setVisible(true);
    });
  }

  private ruinGate(): void {
    const done = getFlag('ruin_roman') && getFlag('ruin_binary');
    if (!done) {
      this.say([
        { speaker: 'Inschrift', text: 'Ein Tor, versiegelt mit Zeichen der Alten. Davor eine Steintafel und eine Reihe Runensteine.' },
        { speaker: 'Inschrift', text: 'Löse die Rätsel der Tafel und der Steine, dann öffnet sich das Siegel.' },
      ]);
      return;
    }
    if (getFlag('ruin_open')) {
      this.say([{ speaker: 'Stimme der Alten', text: 'Hüte, was du gelernt hast, Wanderer.' }]);
      return;
    }
    this.cameras.main.flash(500, 150, 210, 255);
    this.say(
      [
        { speaker: 'Stimme der Alten', text: 'Wanderer. Du hast gelesen, wie wir einst zählten.' },
        { speaker: 'Stimme der Alten', text: 'Mit Zeichen, die überall gleich viel galten. Mit Steinen, die wir immer zu zweit bündelten.' },
        { speaker: 'Stimme der Alten', text: 'Dann schmiedeten wir das Urmaß der Zahl: zehn Ziffern, und jede Stelle zehnmal so viel wert wie ihre rechte Nachbarin.' },
        { speaker: 'Stimme der Alten', text: 'Vagor war der Einzige, der unsere Zeichen noch lesen konnte. Er hat sie gelesen und trotzdem zerbrochen, was allen gehörte.' },
      ],
      () => setFlag('ruin_open'),
    );
  }

  private talkToElle(): void {
    if (!getFlag('elle_intro')) {
      this.say(
        [
          { speaker: 'Meisterin Elle', text: 'Da bist du ja. Heute Nacht ist der Nebel wieder näher gekommen.' },
          { speaker: 'Meisterin Elle', text: 'Vagor hat die sieben Urmaße zerbrochen. Seitdem verliert alles sein Maß: Wege, Brücken, sogar die Zahlen.' },
          { speaker: 'Meisterin Elle', text: 'Der erste Splitter, das Urmaß der Zahl, liegt bei den Zwergen in den Stellenstollen.' },
          { speaker: 'Meisterin Elle', text: 'Folge dem Weg nach Osten zur Mine. Vorarbeiter Brom braucht Hilfe. Hilf ihm, dann hilft er dir.' },
        ],
        () => {
          setFlag('elle_intro');
          this.updateGoal();
        },
      );
      return;
    }
    // Splitter abgeben, falls einer im Gepäck ist
    const carried = REGIONS.find((r) => getFlag(r.done) && !getFlag(r.reported));
    if (carried) {
      setFlag(carried.reported);
      this.clearFog();
      this.say(carried.thanks, () => this.updateGoal());
      return;
    }
    if (getFlag('elle_splitter')) {
      this.say([{ speaker: 'Meisterin Elle', text: 'Überall, wo du schon warst, kannst du jederzeit weiter üben.' }]);
      return;
    }
    const ruinHint = getFlag('ruin_open')
      ? []
      : [{ speaker: 'Meisterin Elle', text: 'Und wenn du Zeit hast: Im Westen steht die Ruine der Alten. Ihre Zeichen hat seit Jahren niemand mehr gelesen.' }];
    this.say([{ speaker: 'Meisterin Elle', text: 'Die Mine liegt im Osten. Folge einfach dem Weg.' }, ...ruinHint]);
  }

  private updateGoal(): void {
    if (!getFlag('elle_intro')) {
      this.setGoal('Sprich mit Meisterin Elle');
      return;
    }
    const carried = REGIONS.find((r) => getFlag(r.done) && !getFlag(r.reported));
    if (carried) {
      this.setGoal('Bring den Splitter zu Meisterin Elle');
      return;
    }
    const open = REGIONS.find((r) => !getFlag(r.done) && r.topics.every((t) => topicDone(t)));
    if (open) {
      this.setGoal(open.goGoal);
      return;
    }
    const locked = REGIONS.find((r) => !getFlag(r.done));
    this.setGoal(locked ? locked.lockedGoal : 'Fortsetzung folgt …');
  }

  private enterMine(): void {
    if (!getFlag('elle_intro')) {
      this.say([{ speaker: 'Meisterin Elle', text: 'Warte! Komm erst zu mir, bevor du losziehst.' }]);
      return;
    }
    this.goTo('Mine', 'village');
  }
}

