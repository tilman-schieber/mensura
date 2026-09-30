import Phaser from 'phaser';
import { getFlag, loadSave, setFlag } from '../save';
import { TILE, WorldScene } from './WorldScene';
import { FONT, smooth } from '../ui/theme';
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
  /** öffnet sich, sobald dieser Merker gesetzt ist (der vorige Ort geschafft), null = sofort */
  after: string | null;
  done: string;
  reported: string;
  goGoal: string;
  lockedGoal: string;
  thanks: DialogLine[];
}

const REGIONS: Region[] = [
  {
    after: null,
    done: 'mine_outer_done',
    reported: 'elle_splitter',
    goGoal: 'Geh zur Mine im Osten',
    lockedGoal: '',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Das ist er! Ein Splitter des Urmaßes der Zahl. Sieh nur, wie die Farben ins Dorf zurückkehren.' },
      { speaker: 'Meisterin Elle', text: 'Jedes Urmaß ist in zwei Hälften zerbrochen. Die andere Hälfte schläft tief unten in den Stollen. Dorthin gehen wir später, wenn du mehr gelernt hast.' },
      { speaker: 'Meisterin Elle', text: 'Und hörst du das? Unten auf dem Markt ruft wieder jemand. Mira ist zurück, und Bürgermeister Rudolf auch!' },
      { speaker: 'Meisterin Elle', text: 'Brom schreibt, das große Rechenwerk tief im Stollen steht still. Fahr mit dem Aufzug hinunter und hilf Grete, es wieder in Gang zu bringen.' },
      { speaker: 'Meisterin Elle', text: 'Ruh dich aus, Lehrling. Deine Reise hat gerade erst begonnen.' },
    ],
  },
  {
    after: 'mine_outer_done',
    done: 'deep_done',
    reported: 'elle_deep',
    goGoal: 'Fahr im Stellenstollen mit dem Aufzug zum Rechenwerk',
    lockedGoal: 'Öffne zuerst den Tresor im Stellenstollen',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Das Rechenwerk läuft wieder? Brom hat mir schon einen Brief geschickt. Zwölf Seiten, alles doppelt nachgezählt.' },
      { speaker: 'Meisterin Elle', text: 'Und unter dem Tor schläft ein Wächter aus Zahlen, die sich nicht teilen lassen? Das ist Vagors Werk. Dorthin gehen wir im nächsten Schuljahr.' },
      { speaker: 'Meisterin Elle', text: 'Die nächste Spur führt nach Süden, zum Spiegeltempel. Dort ruht das Urmaß der Form.' },
    ],
  },
  {
    after: 'deep_done',
    done: 'temple_done',
    reported: 'elle_form',
    goGoal: 'Folge dem Weg nach Süden zum Spiegeltempel',
    lockedGoal: 'Bring zuerst das Rechenwerk in Gang',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Der Splitter der Form! Zwei von vierzehn Splittern sind geborgen.' },
      { speaker: 'Meisterin Elle', text: 'Du siehst mich so seltsam an. Hat Lumen dir etwas in ihren Spiegeln gezeigt?' },
      { speaker: 'Meisterin Elle', text: 'Die Große Brücke. Ja, Vagor und ich waren einmal Freunde. Mehr will ich dazu jetzt nicht sagen.' },
      { speaker: 'Meisterin Elle', text: 'Im Norden liegt das Riesental. Dort hütet eine Riesin das Urmaß der Größe.' },
    ],
  },
  {
    after: 'temple_done',
    done: 'valley_done',
    reported: 'elle_size',
    goGoal: 'Folge dem Weg nach Norden ins Riesental',
    lockedGoal: 'Hol zuerst den Splitter aus dem Spiegeltempel',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Der Splitter der Größe! Drei von vierzehn.' },
      { speaker: 'Meisterin Elle', text: 'Vagor hat wieder mit dir gesprochen? Hanna hat recht, er klingt traurig. Er war nicht immer so.' },
      { speaker: 'Meisterin Elle', text: 'Flora, die Alchemistin, ist zurückgekommen. Hoffentlich explodiert diesmal nichts.' },
      { speaker: 'Meisterin Elle', text: 'Hinter dem Fluss im Riesental steht die Würfelfestung. Dort ruht das Urmaß des Raums.' },
    ],
  },
  {
    after: 'valley_done',
    done: 'fort_done',
    reported: 'elle_space',
    goGoal: 'Fahr im Riesental mit dem Boot zur Würfelfestung',
    lockedGoal: 'Hilf zuerst der Riesin Hanna',
    thanks: [
      { speaker: 'Meisterin Elle', text: 'Der Splitter des Raums! Vier von vierzehn. Das ganze erste Jahr hast du gemeistert.' },
      { speaker: 'Meisterin Elle', text: 'Hörst du den Hammer? Harald, der Schmied, ist wieder da. Jetzt ist Eichstadt fast wie früher.' },
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

/**
 * Dorfbewohner, die vor dem Nebel geflohen sind. Jeder abgegebene Splitter bringt einen zurück,
 * mit einem eigenen Ort im Dorf. So sieht man bei jeder Rückkehr, was man erreicht hat.
 */
interface Villager {
  key: string;
  /** zurück, sobald dieser Splitter bei Elle abgegeben ist */
  after: string;
  cell: Cell;
  facing: 'south' | 'east' | 'north' | 'west';
  stand: Cell;
  prop?: { key: string; x: number; y: number; block: [number, number, number, number] };
  first: DialogLine[];
  again: DialogLine[];
  /** Aufgabe, die die Figur stellt (Markt, Umfrage); danach jederzeit zum Üben */
  quest?: { puzzle: string; flag: string; intro: DialogLine[]; done: DialogLine[]; rounds?: number };
}

const VILLAGERS: Villager[] = [
  {
    key: 'mira',
    after: 'elle_splitter',
    cell: { x: 7, y: 16 },
    facing: 'east',
    stand: { x: 7, y: 15 },
    prop: { key: 'market-stall', x: 9.4, y: 18.2, block: [8, 16, 10, 17] },
    first: [
      { speaker: 'Händlerin Mira', text: 'Du bist also Elles Lehrling! Ich bin Mira. Als der Nebel kam, bin ich zu meiner Schwester geflohen.' },
      { speaker: 'Händlerin Mira', text: 'Im Nebel stimmten nicht einmal meine Preise. Jetzt kann ich wieder rechnen und verkaufen.' },
    ],
    again: [{ speaker: 'Händlerin Mira', text: 'Äpfel, Brot, Rüben! Alles genau abgewogen. Hilfst du mir wieder an der Kasse?' }],
    quest: {
      puzzle: 'MarketPuzzle',
      flag: 'market_done',
      intro: [{ speaker: 'Händlerin Mira', text: 'Hilfst du mir am Stand? Die Leute wollen wissen, ob ihr Geld reicht, und ich brauche jemanden fürs Wechselgeld.' }],
      done: [{ speaker: 'Händlerin Mira', text: 'Du rechnest ja schneller als meine Waage! Komm wieder, wann du willst.' }],
    },
  },
  {
    key: 'rudolf',
    after: 'elle_splitter',
    cell: { x: 16, y: 8 },
    facing: 'west',
    stand: { x: 16, y: 9 },
    first: [
      { speaker: 'Bürgermeister Rudolf', text: 'Ah, der Lehrling! Rudolf, Bürgermeister von Eichstadt. Endlich bin ich wieder zu Hause.' },
      { speaker: 'Bürgermeister Rudolf', text: 'Hast du die Plakate gesehen? „Seit es Maße gibt: 100 Prozent mehr Streit!“ Woher will Vagor das wissen?' },
      { speaker: 'Bürgermeister Rudolf', text: 'Irgendwann zählen wir nach. Mit echten Zahlen, nicht mit ungefähren.' },
    ],
    again: [{ speaker: 'Bürgermeister Rudolf', text: 'Glaub nicht alles, was auf einem Plakat steht. Frag immer: Woher kommt die Zahl? Machen wir noch eine Umfrage?' }],
    quest: {
      puzzle: 'SurveyPuzzle',
      flag: 'survey_done',
      rounds: 2,
      intro: [{ speaker: 'Bürgermeister Rudolf', text: 'Ich will wissen, was die Leute wirklich wollen. Mit einer echten Umfrage, nicht mit Vagors Fantasiezahlen. Hilfst du mir beim Zählen?' }],
      done: [{ speaker: 'Bürgermeister Rudolf', text: 'Das ist eine ehrliche Umfrage! Ich hänge sie gleich neben Vagors Plakate. Mal sehen, wem die Leute glauben.' }],
    },
  },
  {
    key: 'flora',
    after: 'elle_size',
    cell: { x: 22, y: 10 },
    facing: 'south',
    stand: { x: 22, y: 11 },
    prop: { key: 'alchemy-table', x: 24, y: 11, block: [23, 10, 24, 10] },
    first: [
      { speaker: 'Alchemistin Flora', text: 'Hallo! Ich bin Flora, die Alchemistin. Im Nebel wurden meine Rezepte zu: ein bisschen hiervon, ein bisschen davon.' },
      { speaker: 'Alchemistin Flora', text: 'Da ist mir ein Trank explodiert! Jetzt nehme ich wieder genau 250 Gramm, nicht ungefähr eine Handvoll.' },
    ],
    again: [{ speaker: 'Alchemistin Flora', text: 'Ein Rezept ist Mathe, die man trinken kann. Solange die Mengen stimmen.' }],
  },
  {
    key: 'harald',
    after: 'elle_space',
    cell: { x: 26, y: 16 },
    facing: 'west',
    stand: { x: 26, y: 15 },
    prop: { key: 'anvil', x: 24.6, y: 17, block: [24, 16, 24, 16] },
    first: [
      { speaker: 'Schmied Harald', text: 'Tag! Harald, der Schmied. Ohne Länge, Breite und Höhe kann ich keine Hufeisen schmieden.' },
      { speaker: 'Schmied Harald', text: 'Jetzt, wo das Urmaß des Raums zurück ist, stimmt wieder jedes Maß. Danke, Lehrling!' },
    ],
    again: [{ speaker: 'Schmied Harald', text: 'Zweimal messen, einmal schmieden. So macht man das.' }],
  },
];

/** Nebelwesen im Dorf und was aus ihnen wird, wenn man sie erlöst */
const WISPS: { cell: Cell; count: number; becomes: string; freed: DialogLine[]; greet: DialogLine[] }[] = [
  {
    cell: { x: 17, y: 13 },
    count: 2,
    becomes: 'sheep',
    freed: [{ speaker: 'Eule Pünktchen', text: 'Sieh nur! Aus dem Nebelwesen ist ein Schaf geworden. Es hatte nur sein Maß verloren.' }],
    greet: [{ speaker: 'Eule Pünktchen', text: 'Das Schaf grast zufrieden. Seit es sein Maß wiederhat, ist es nie mehr grau geworden.' }],
  },
  {
    cell: { x: 22, y: 12 },
    count: 3,
    becomes: 'fox',
    freed: [{ speaker: 'Eule Pünktchen', text: 'Ein Fuchs! Er hatte vergessen, wie groß er ist. Jetzt weiß er es wieder.' }],
    greet: [{ speaker: 'Eule Pünktchen', text: 'Der Fuchs blinzelt dich an. Er weiß jetzt genau, wie groß er ist, und ist mächtig stolz darauf.' }],
  },
  {
    cell: { x: 26, y: 8 },
    count: 3,
    becomes: 'lantern',
    freed: [{ speaker: 'Eule Pünktchen', text: 'Eine Laterne! Sie leuchtet wieder genau so hell, wie sie soll.' }],
    greet: [{ speaker: 'Eule Pünktchen', text: 'Die Laterne leuchtet warm und gleichmäßig. Kein Flackern mehr.' }],
  },
];

/** Wegweiser an der Kreuzung: nur die Namen, Pfeil in die Richtung */
const SIGNPOST: { label: string; dx: number; dy: number }[] = [
  { label: 'Mine', dx: 1, dy: 0 },
  { label: 'Riesental', dx: 0, dy: -1 },
  { label: 'Tempel', dx: 0, dy: 1 },
  { label: 'Ruine', dx: -1, dy: 0 },
];

export class VillageScene extends WorldScene {
  private ruinStars: Record<string, Phaser.GameObjects.Text> = {};
  private board?: Phaser.GameObjects.Image;
  private wisps: { index: number; cell: Cell; count: number; sprite: Phaser.GameObjects.Image; calmUntil: number }[] = [];

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
    for (const k of ['market-stall', 'notice-board', 'anvil', 'alchemy-table', 'fox', 'lantern', 'sheep', 'map-table']) {
      this.load.image(k, `assets/objects/${k}.png`);
    }
    for (const v of VILLAGERS) this.load.spritesheet(`npc-${v.key}`, `assets/npcs/${v.key}.png`, { frameWidth: 68, frameHeight: 68 });
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
    this.addInteractable({ target: mine, stand: { x: 26, y: 4 }, onInteract: () => this.enterMine(), marker: () => (getFlag('elle_intro') && (!getFlag('mine_outer_done') || !getFlag('deep_done')) ? '!' : null) });

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
    this.buildBoard();
    this.buildSignpost();
    this.buildVillagers();
    this.addPage('page_village', 10, 3);

    // Elles Kartentisch vor dem Haus (Koordinaten, Klasse 5 Frühjahr)
    const table = this.placeObject('map-table', 5.5, 9, 0.8);
    this.block(5, 8, 5, 8);
    this.addInteractable({ target: table, stand: { x: 5, y: 9 }, onInteract: () => this.mapTable(), marker: () => (getFlag('temple_done') && !getFlag('map_done') ? '!' : null) });

    // Eule Pünktchen sitzt auf Elles Dach
    const owl = this.placeObject('owl', 6.2, 3.4, 0.55).setDepth(8 * TILE);
    this.tweens.add({ targets: owl, angle: { from: -4, to: 4 }, duration: 1600, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.addInteractable({ target: owl, stand: { x: 6, y: 7 }, onInteract: () => this.talkToOwl(), marker: () => (!getFlag('met_owl') ? '!' : null) });
    this.buildTempleWay();
    this.buildValleyWay();

    // Meisterin Elle vor ihrem Haus
    const elle = this.addNpc('npc-elle', { x: 9, y: 8 }, 'south');
    this.addInteractable({ target: elle, stand: { x: 9, y: 9 }, onInteract: () => { this.faceToPlayer(elle); this.talkToElle(); }, marker: () => this.elleMarker() });

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
    if (getFlag('temple_done')) {
      this.addExit(18, 0, 19, 0, () => this.goTo('Valley', 'village'));
      this.addInteractable({ target: marker, stand: { x: 20, y: 1 }, onInteract: () => this.goTo('Valley', 'village'), marker: () => (!getFlag('valley_done') ? '!' : null) });
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
      { speaker: 'Meisterin Elle', text: 'Mit jedem Splitter weicht der Nebel ein Stück. Hol zuerst den Splitter aus dem Spiegeltempel.' },
    ]);
  }

  // ---------- Weg zum Spiegeltempel (Süden) ----------

  private buildTempleWay(): void {
    const gate = this.placeObject('temple-gate', 16, 20.3, 0.7);
    this.block(14, 17, 14, 19);
    this.block(17, 17, 18, 19);
    const open = getFlag('deep_done');
    if (open) {
      this.addExit(15, 19, 16, 19, () => this.goTo('Temple', 'village'));
      this.addInteractable({ target: gate, stand: { x: 15, y: 18 }, onInteract: () => this.goTo('Temple', 'village'), marker: () => (!getFlag('temple_done') ? '!' : null) });
      return;
    }
    // Dichter Nebel versperrt den Weg, bis das Rechenwerk wieder läuft
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
      { speaker: 'Meisterin Elle', text: 'Er weicht erst, wenn das große Rechenwerk tief im Stollen wieder läuft.' },
    ]);
  }

  // ---------- Nebelwesen (Kopfrechnen) ----------

  private spawnWisps(): void {
    this.wisps = [];
    WISPS.forEach((w, index) => {
      const { x, y } = w.cell;
      if (getFlag(`wisp_freed_${index}`)) {
        this.placeFreed(index);
        return;
      }
      const sprite = this.add.image((x + 0.5) * TILE, (y + 0.4) * TILE, 'nebelwesen').setAlpha(0.85).setDepth((y + 1) * TILE);
      this.tweens.add({ targets: sprite, y: sprite.y - 5, duration: 1400, yoyo: true, repeat: -1, ease: 'sine.inout' });
      const wisp = { index, cell: { x, y }, count: w.count, sprite, calmUntil: 0 };
      this.wisps.push(wisp);
      this.addInteractable({ target: sprite, stand: { x: x - 1, y }, onInteract: () => this.fightWisp(wisp) });
    });
  }

  /** Das erlöste Wesen bleibt im Dorf; antippen = ein freundlicher Satz, kein Kampf mehr */
  private placeFreed(index: number, appear = false): void {
    const w = WISPS[index];
    const img = this.placeObject(w.becomes, w.cell.x + 0.5, w.cell.y + 1, w.becomes === 'lantern' ? 0.75 : 0.7);
    this.block(w.cell.x, w.cell.y, w.cell.x, w.cell.y);
    if (appear) {
      img.setAlpha(0).setScale(0.2);
      this.tweens.add({ targets: img, alpha: 1, scale: 0.7, duration: 900, ease: 'back.out' });
    }
    this.addInteractable({
      target: img,
      stand: { x: w.cell.x - 1, y: w.cell.y },
      onInteract: () => this.say(w.greet),
    });
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
        // Erlöst: Das Nebelwesen bekommt seine Gestalt zurück und bleibt im Dorf
        this.tweens.killTweensOf(w.sprite);
        this.removeInteractable(w.sprite);
        // sofort aus der Liste, damit das verblassende Wesen keinen neuen Kampf auslöst
        this.wisps = this.wisps.filter((it) => it !== w);
        this.cameras.main.flash(400, 240, 240, 220);
        this.tweens.add({ targets: w.sprite, alpha: 0, scale: 1.8, duration: 700, onComplete: () => w.sprite.destroy() });
        setFlag(`wisp_freed_${w.index}`);
        this.placeFreed(w.index, true);
        this.time.delayedCall(900, () => this.say(WISPS[w.index].freed));
      } else {
        w.calmUntil = this.time.now + 4000;
      }
    }, w.count);
  }

  // ---------- Dorfleben ----------

  /** Wer schon zurück ist, steht an seinem Platz. */
  private buildVillagers(): void {
    for (const v of VILLAGERS) {
      if (v.prop) {
        this.placeObject(v.prop.key, v.prop.x, v.prop.y);
        const [x0, y0, x1, y1] = v.prop.block;
        this.block(x0, y0, x1, y1);
      }
      if (getFlag(v.after)) this.spawnVillager(v);
    }
  }

  private spawnVillager(v: Villager, appear = false): void {
    const npc = this.addNpc(`npc-${v.key}`, v.cell, v.facing);
    if (appear) {
      npc.setAlpha(0);
      this.tweens.add({ targets: npc, alpha: 1, duration: 1200 });
    }
    this.addInteractable({
      target: npc,
      stand: v.stand,
      marker: () => (!getFlag(`met_${v.key}`) || (v.quest && !getFlag(v.quest.flag)) ? '!' : null),
      onInteract: () => {
        this.faceToPlayer(npc);
        const met = `met_${v.key}`;
        const q = v.quest;
        const lines = getFlag(met) ? v.again : [...v.first, ...(q ? q.intro : [])];
        this.say(lines, () => {
          setFlag(met);
          if (!q) return;
          this.startPuzzle(q.puzzle, (solved) => {
            if (!solved || getFlag(q.flag)) return;
            setFlag(q.flag);
            if (q.flag === 'survey_done') this.drawSurveyPoster();
            this.say(q.done);
          }, q.rounds ?? 3);
        });
      },
    });
  }

  /** Anschlagbrett mit Vagors Plakaten (gefälschte Statistiken, aufgedeckt erst in Klasse 6) */
  private buildBoard(): void {
    const board = this.placeObject('notice-board', 14.8, 8.1, 0.8);
    this.block(14, 7, 15, 7);
    const g = this.add.graphics().setDepth(board.depth + 1);
    const posters: [number, number, number][] = [
      [-18, -38, 0xe8dcc0],
      [-2, -42, 0xd8c8f0],
      [13, -36, 0xf0d0c0],
    ];
    for (const [dx, dy, color] of posters) {
      g.fillStyle(color, 1).fillRect(board.x + dx - 6, board.y + dy - 8, 12, 15);
      g.fillStyle(0x4a2a6a, 1).fillRect(board.x + dx - 4, board.y + dy - 5, 8, 2).fillRect(board.x + dx - 4, board.y + dy - 1, 6, 1).fillRect(board.x + dx - 4, board.y + dy + 2, 7, 1);
    }
    this.board = board;
    if (getFlag('survey_done')) this.drawSurveyPoster();
    this.addInteractable({
      target: board,
      stand: { x: 15, y: 8 },
      onInteract: () =>
        this.say([
          { speaker: 'Plakat', text: 'Seit es Maße gibt: 100 Prozent mehr Streit! Gezeichnet, Vagor.' },
          { speaker: 'Plakat', text: 'Neun von zehn Nebelwesen sind zufrieden!' },
          { speaker: 'Plakat', text: 'Wer misst, der irrt. Wer nicht misst, irrt nie.' },
          { speaker: 'Eule Pünktchen', text: 'Hm. Wer hat die Nebelwesen denn gefragt? Und wer hat den Streit gezählt? Das prüfen wir irgendwann nach.' },
        ]),
    });
  }

  /** Rudolfs ehrliche Umfrage hängt neben Vagors Plakaten: ein kleines Säulendiagramm */
  private drawSurveyPoster(): void {
    const b = this.board;
    if (!b) return;
    const g = this.add.graphics().setDepth(b.depth + 2);
    const x = b.x + 22;
    const y = b.y - 30;
    g.fillStyle(0xf4f0e0, 1).fillRect(x - 8, y - 14, 17, 18);
    [5, 9, 3, 7].forEach((h, i) => g.fillStyle(0x3a7ab0, 1).fillRect(x - 6 + i * 4, y + 2 - h, 3, h));
  }

  /** Wegweiser an der Kreuzung: im Nebel nur ungefähr, nach dem Splitter genau */
  private buildSignpost(): void {
    const cx = 10.5 * TILE;
    const base = 11 * TILE;
    const c = this.add.container(cx, base).setDepth(base + 4);
    const g = this.add.graphics();
    g.fillStyle(0x4a3018, 1).fillRect(-2, -58, 4, 58);
    c.add(g);
    SIGNPOST.forEach((s, i) => {
      const y = -52 + i * 12;
      const dir = s.dx || (s.dy < 0 ? 1 : -1);
      const t = smooth(this.add.text(0, y, s.label, { fontFamily: FONT, fontSize: '8px', color: '#2a1a0c', resolution: 4 }).setOrigin(0.5));
      // Pfeil so lang wie der Name, nicht länger
      const w = Math.ceil(t.width) + 8;
      const x0 = dir > 0 ? 2 : -w - 2;
      t.setX(x0 + w / 2);
      const arrow = this.add.graphics();
      arrow.fillStyle(0x2a1a0c, 1).fillRect(x0 - 1, y - 6, w + 2, 12);
      arrow.fillStyle(0xc9a15a, 1).fillRect(x0, y - 5, w, 10);
      arrow.fillStyle(0xc9a15a, 1).fillTriangle(dir > 0 ? x0 + w : x0, y - 5, dir > 0 ? x0 + w + 6 : x0 - 6, y, dir > 0 ? x0 + w : x0, y + 5);
      c.add([arrow, t]);
    });
    this.block(10, 10, 10, 10);
    (c as unknown as { getBounds: () => Phaser.Geom.Rectangle }).getBounds = () => new Phaser.Geom.Rectangle(cx - 50, base - 64, 100, 64);
    this.addInteractable({
      target: c as unknown as Phaser.GameObjects.Image,
      stand: { x: 10, y: 11 },
      onInteract: () =>
        this.say([{ speaker: 'Wegweiser', text: 'Nach Osten zur Mine, nach Norden ins Riesental, nach Süden zum Tempel, nach Westen zur Ruine.' }]),
    });
  }

  private mapTable(): void {
    if (!getFlag('temple_done')) {
      this.say([{ speaker: 'Meisterin Elle', text: 'Mein Kartentisch. Wenn du im Spiegeltempel die Sternenkarte gelesen hast, zeichnen wir zusammen eine Karte von Eichstadt.' }]);
      return;
    }
    const first = !getFlag('map_done');
    this.say(
      first
        ? [{ speaker: 'Meisterin Elle', text: 'Mein Kartentisch! Eine gute Karte zeichnet man selbst. Trag ein, wo die Orte von Eichstadt liegen.' }]
        : [{ speaker: 'Meisterin Elle', text: 'Noch ein paar Orte eintragen? Eine Karte wird nie ganz fertig.' }],
      () =>
        this.startPuzzle('MapTablePuzzle', (solved) => {
          if (!solved || getFlag('map_done')) return;
          setFlag('map_done');
          this.say([{ speaker: 'Meisterin Elle', text: 'Eine saubere Karte! Wer seine Welt vermisst, verirrt sich nicht im Nebel.' }]);
        }),
    );
  }

  private talkToOwl(): void {
    const met = getFlag('met_owl');
    this.say(
      met
        ? [{ speaker: 'Eule Pünktchen', text: 'Huhu! Ich passe von hier oben auf dich auf.' }]
        : [
            { speaker: 'Eule Pünktchen', text: 'Huhu! Ich bin Pünktchen, Meisterin Elles Eule. Mir entgeht kein Komma.' },
            { speaker: 'Eule Pünktchen', text: 'Wenn du bei einem Rätsel nicht weiterkommst, tipp auf „Hinweis“. Dann flattere ich herbei.' },
          ],
      () => setFlag('met_owl'),
    );
  }

  // ---------- Ruine der Alten ----------

  private buildRuin(): void {
    // Das Tor der Alten südlich am Ende des Westwegs
    const ruin = this.placeObject('ruin', 3.5, 19.4);
    this.block(1, 16, 5, 18);
    this.addInteractable({ target: ruin, stand: { x: 3, y: 15 }, onInteract: () => this.ruinGate(), marker: () => (getFlag('ruin_roman') && getFlag('ruin_binary') && !getFlag('ruin_open') ? '!' : null) });

    // Steintafel und Runensteine nördlich am Weg davor
    const stele = this.placeObject('stele', 1.5, 12, 0.9);
    this.block(1, 11, 1, 11);
    this.ruinStars.ruin_roman = this.addStar('ruin_roman', 1.5 * TILE, 9.6 * TILE);
    this.addInteractable({ target: stele, stand: { x: 2, y: 12 }, onInteract: () => this.ruinStation('RomanPuzzle', 'ruin_roman'), marker: () => (getFlag('elle_intro') && !getFlag('ruin_roman') ? '!' : null) });

    const stones = this.placeObject('rune-stones', 4.6, 11.9, 0.7);
    this.ruinStars.ruin_binary = this.addStar('ruin_binary', 4.6 * TILE, 10.4 * TILE);
    this.addInteractable({ target: stones, stand: { x: 4, y: 12 }, onInteract: () => this.ruinStation('BinaryPuzzle', 'ruin_binary'), marker: () => (getFlag('elle_intro') && !getFlag('ruin_binary') ? '!' : null) });
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
      for (const v of VILLAGERS) if (v.after === carried.reported) this.spawnVillager(v, true);
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

  private elleMarker(): '!' | '?' | null {
    if (!getFlag('elle_intro')) return '!';
    return REGIONS.some((r) => getFlag(r.done) && !getFlag(r.reported)) ? '?' : null;
  }

  private updateGoal(): void {
    if (!getFlag('elle_intro')) {
      this.setGoal('Sprich mit Meisterin Elle');
      return;
    }
    const carried = REGIONS.find((r) => getFlag(r.done) && !getFlag(r.reported));
    if (carried) {
      this.setGoal(carried.done === 'deep_done' ? 'Erzähl Meisterin Elle vom Rechenwerk' : 'Bring den Splitter zu Meisterin Elle');
      return;
    }
    const open = REGIONS.find((r) => !getFlag(r.done) && (!r.after || getFlag(r.after)));
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

