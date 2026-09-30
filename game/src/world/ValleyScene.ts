import Phaser from 'phaser';
import { getFlag, setFlag, topicDone } from '../save';
import { TILE, WorldScene, type GoblinVisit } from './WorldScene';
import type { Cell } from './pathfind';
import { Terrain, vertexGrid, type TilesetData } from './terrain';

// Das Riesental (Klasse 5, Sommer): Längen, Gewichte, Zeitspannen, Schätzen.
// Die Riesin Hanna leiht der Spielfigur ihre Skalenkappe. Vier Stationen, dann der
// Riesenkäfer; danach der Splitter des Urmaßes der Größe.

const COLS = 30;
const ROWS = 20;
const GRASS = 1;
const PATH = 0;

interface Station {
  flag: string;
  puzzle: string;
}

const ST = {
  boot: { flag: 'valley_len', puzzle: 'LengthPuzzle' },
  scale: { flag: 'valley_scale', puzzle: 'ScalePuzzle' },
  mushroom: { flag: 'valley_est', puzzle: 'EstimatePuzzle' },
  ferry: { flag: 'valley_ferry', puzzle: 'FerryPuzzle' },
} satisfies Record<string, Station>;
const STATIONS: Station[] = Object.values(ST);

const GOBLIN: GoblinVisit = {
  flag: 'goblin_valley',
  topic: 'groesse',
  intro: [
    { speaker: 'Pi-mal-Daumen', text: 'Hihi! Bei den Riesen ist sowieso alles zu groß. Da fällt keinem auf, wenn ich ein bisschen übertreibe.' },
  ],
  caught: [{ speaker: 'Pi-mal-Daumen', text: 'Au weia. Du kennst deine Größen ja wirklich.' }],
};

export class ValleyScene extends WorldScene {
  private stars: Record<string, Phaser.GameObjects.Text> = {};
  private hanna!: Phaser.GameObjects.Sprite;
  private beetle?: Phaser.GameObjects.Image;

  constructor() {
    super('Valley');
  }

  protected fogDensity(): number {
    return getFlag('valley_done') ? 0 : 1;
  }

  preload(): void {
    this.load.image('tiles-valley', 'assets/tiles/valley.png');
    this.load.json('tiles-valley-data', 'assets/tiles/valley.json');
    this.load.image('giant-boot', 'assets/objects/giant-boot.png');
    this.load.image('giant-mushroom', 'assets/objects/giant-mushroom.png');
    this.load.image('balance', 'assets/objects/balance.png');
    this.load.image('ferry-dock', 'assets/objects/ferry-dock.png');
    this.load.image('kaefer', 'assets/objects/kaefer.png');
    this.load.image('mouse-hole', 'assets/objects/mouse-hole.png');
    this.load.image('boat', 'assets/objects/boat.png');
    this.load.spritesheet('npc-hanna', 'assets/npcs/hanna.png', { frameWidth: 68, frameHeight: 68 });
  }

  protected buildWorld(entry?: string): Cell {
    // Sandwege durch hohes Gras: vom Eingang unten zum Platz, von dort zu den Stationen
    const v = vertexGrid(COLS, ROWS, GRASS, [
      [14, 10, 16, 20, PATH],
      [5, 9, 25, 11, PATH],
      [5, 5, 7, 16, PATH],
      [23, 5, 25, 16, PATH],
      [12, 3, 18, 6, PATH],
      [13, 5, 17, 11, PATH],
    ]);
    this.blockUpper = false;
    this.terrain = new Terrain(this, 'tiles-valley', this.cache.json.get('tiles-valley-data') as TilesetData, v);

    // Fluss am rechten Rand
    const river = this.add.graphics().setDepth(-900);
    river.fillStyle(0x3b7fb8, 1).fillRect(27 * TILE, 0, 3 * TILE, ROWS * TILE);
    river.fillStyle(0x6fb3e0, 0.5);
    for (let y = 0; y < ROWS * TILE; y += 18) river.fillRect(27 * TILE + ((y * 7) % 60), y, 26, 3);
    this.block(27, 0, 29, ROWS - 1);

    this.addExit(14, 19, 15, 19, () => this.goTo('Village', 'valley'));

    // Station 1: Riesenstiefel (Längen)
    const boot = this.placeObject('giant-boot', 6, 8.2, 0.8);
    this.block(4, 6, 7, 7);
    this.stars[ST.boot.flag] = this.addStar(ST.boot.flag, 6 * TILE, 4.2 * TILE);
    this.addInteractable({ target: boot, stand: { x: 6, y: 9 }, onInteract: () => this.station(ST.boot) });

    // Station 2: Riesenwaage (Gewichte)
    const bal = this.placeObject('balance', 24, 8.2);
    this.block(23, 7, 24, 7);
    this.stars[ST.scale.flag] = this.addStar(ST.scale.flag, 24 * TILE, 4.8 * TILE);
    this.addInteractable({ target: bal, stand: { x: 24, y: 9 }, onInteract: () => this.station(ST.scale) });

    // Station 3: Aussichtspilz (Schätzauge)
    const mush = this.placeObject('giant-mushroom', 6, 16.4, 0.9);
    this.block(5, 14, 6, 15);
    this.stars[ST.mushroom.flag] = this.addStar(ST.mushroom.flag, 6 * TILE, 12.2 * TILE);
    this.addInteractable({ target: mush, stand: { x: 6, y: 13 }, onInteract: () => this.station(ST.mushroom) });

    // Station 4: Fähranleger (Zeitspannen)
    const dock = this.placeObject('ferry-dock', 26.2, 15.6);
    this.block(25, 14, 26, 15);
    this.stars[ST.ferry.flag] = this.addStar(ST.ferry.flag, 26 * TILE, 12.4 * TILE);
    this.addInteractable({ target: dock, stand: { x: 24, y: 14 }, onInteract: () => this.station(ST.ferry) });

    // Fährboot hinüber zur Würfelfestung (mit dem Schulthema „Flächen und Körper“)
    const boat = this.placeObject('boat', 28.4, 13.4, 0.9);
    this.tweens.add({ targets: boat, y: boat.y + 3, duration: 1500, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.addInteractable({ target: boat, stand: { x: 26, y: 13 }, onInteract: () => this.boat() });

    // Deko: kleinere Pilze
    for (const [x, y] of [[10, 15], [20, 16], [11, 3], [20, 2], [2, 11]] as [number, number][]) {
      this.placeObject('giant-mushroom', x + 0.5, y + 1, 0.35);
      this.block(x, y, x, y);
    }

    // Stein mit Mauseloch: Mit der Skalenkappe wird man klein genug, um hineinzukriechen
    const stone = this.placeObject('mouse-hole', 11, 15, 1);
    this.block(10, 13, 11, 14);
    this.addInteractable({ target: stone, stand: { x: 11, y: 15 }, onInteract: () => this.mouseHole(stone) });

    this.addGoblin(GOBLIN, { x: 21, y: 13 }, 'west');
    this.addSign(13.5, 18.6, 'Fähre: 120 m');

    // Riesin Hanna auf dem Platz, dreimal so groß wie alle anderen
    this.hanna = this.addNpc('npc-hanna', { x: 15, y: 7 }, 'south');
    this.hanna.setScale(3);
    this.hanna.setDepth(8 * TILE);
    this.block(14, 5, 16, 7);
    this.addInteractable({ target: this.hanna, stand: { x: 15, y: 9 }, onInteract: () => this.talkToHanna() });

    if (this.stationsDone() === 4 && !getFlag('valley_boss')) this.spawnBeetle(false);
    if (getFlag('valley_boss')) this.addLadybug();

    this.updateGoal();
    if (!getFlag('valley_intro')) this.time.delayedCall(600, () => this.talkToHanna());
    return entry === 'fortress' ? { x: 26, y: 13 } : { x: 15, y: 17 };
  }

  private boat(): void {
    if (!topicDone('flaechen')) {
      this.say([
        { speaker: 'Riesin Hanna', text: 'Mit dem Boot kommst du zur Würfelfestung. Doch über dem Fluss hängt noch zu dichter Nebel.' },
        { speaker: 'Riesin Hanna', text: 'Frag Meisterin Elle, wann er sich lichtet. Sie weiß so etwas. Dann setze ich dich über.' },
      ]);
      return;
    }
    this.goTo('Fortress', 'valley');
  }

  private stationsDone(): number {
    return STATIONS.filter((s) => getFlag(s.flag)).length;
  }

  private talkToHanna(): void {
    if (!getFlag('valley_intro')) {
      this.say(
        [
          { speaker: 'Riesin Hanna', text: 'Hallo, Kleines! Pass auf, wo du hintrittst, sonst übersehe ich dich noch.' },
          { speaker: 'Riesin Hanna', text: 'Ich bin Hanna, und ich bin erst elf. Bei uns Riesen bin ich noch ganz klein, stell dir vor!' },
          { speaker: 'Riesin Hanna', text: 'Seit der Nebel im Tal liegt, stimmt hier kein Maß mehr. Meine Stiefel sind mal riesig, mal winzig!' },
          { speaker: 'Riesin Hanna', text: 'Hilf mir: Miss meinen Stiefel, gleich die Waage aus, schätze vom Aussichtspilz aus und bring die Fährenuhr am Fluss in Ordnung.' },
          { speaker: 'Riesin Hanna', text: 'Dafür leihe ich dir meine Skalenkappe. Damit wirst du so klein oder so groß, wie du willst.' },
        ],
        () => {
          setFlag('valley_intro');
          this.updateGoal();
        },
      );
      return;
    }
    if (this.stationsDone() < 4) {
      this.say([{ speaker: 'Riesin Hanna', text: 'Da fehlen noch Sterne! Von da unten siehst du Dinge, die ich glatt übersehe. Schau, wo noch keiner leuchtet.' }]);
    } else if (!getFlag('valley_boss')) {
      this.say([{ speaker: 'Riesin Hanna', text: 'Das ist Tupfi! Setz die Skalenkappe auf und hol ihn aus dem Nebel!' }]);
    } else if (!getFlag('valley_done')) {
      this.say([{ speaker: 'Riesin Hanna', text: 'Da, wo der Käfer saß, glitzert etwas! Heb es auf.' }]);
    } else {
      this.say([
        { speaker: 'Riesin Hanna', text: 'Komm jederzeit wieder, Kleines. Tupfi und ich messen inzwischen alles zweimal nach.' },
        ...(getFlag('page_valley')
          ? []
          : [{ speaker: 'Riesin Hanna', text: 'Ach, und meine Mäuse erzählen, im großen Stein liegt etwas Seltsames. Mit der Skalenkappe passt du ins Mauseloch!' }]),
      ]);
    }
  }

  private station(s: Station): void {
    if (!getFlag('valley_intro')) {
      this.talkToHanna();
      return;
    }
    this.startPuzzle(s.puzzle, (solved) => {
      if (!solved) return;
      const first = !getFlag(s.flag);
      setFlag(s.flag);
      this.stars[s.flag]?.setVisible(true);
      this.updateGoal();
      if (first && this.stationsDone() === 4) this.beetleAppears();
      else if (first) this.say([{ speaker: 'Riesin Hanna', text: 'Wunderbar! Meine Mama sagt immer, ich soll nicht so ungefähr sein. Jetzt kann ich es ihr zeigen.' }]);
    });
  }

  private spawnBeetle(dramatic: boolean): void {
    const b = this.placeObject('kaefer', 15, 4.6, 0.45);
    this.block(14, 3, 16, 4);
    this.tweens.add({ targets: b, angle: { from: -3, to: 3 }, duration: 700, yoyo: true, repeat: -1 });
    this.addInteractable({ target: b, stand: { x: 13, y: 5 }, onInteract: () => this.fightBeetle() });
    if (dramatic) {
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 1200 });
      this.cameras.main.shake(900, 0.008);
    }
    this.beetle = b;
  }

  private beetleAppears(): void {
    this.spawnBeetle(true);
    this.updateGoal();
    this.say([
      { speaker: 'Riesin Hanna', text: 'Iiih! Ein Riesenkäfer! Der Nebel hat sich um irgendetwas zusammengeballt.' },
      { speaker: 'Riesin Hanna', text: 'Moment … unter dem Grau schimmern sieben Punkte. Das ist Tupfi, mein Marienkäfer! Er muss etwas Glänzendes verschluckt haben.' },
      { speaker: 'Riesin Hanna', text: 'Er rechnet in großen Einheiten, du misst in kleinen. Hol ihn aus dem Nebel, aber tu ihm nicht weh!' },
    ]);
  }

  private fightBeetle(): void {
    this.startPuzzle('BeetleScene', (won) => {
      if (!won) return;
      setFlag('valley_boss');
      this.beetle?.destroy();
      this.beetle = undefined;
      this.unblock(14, 3, 16, 4);
      this.showSplitter();
      setFlag('valley_done');
      this.clearFog();
      this.addLadybug();
      this.updateGoal();
      this.say(
        [
          { speaker: 'Riesin Hanna', text: 'Tupfi! Da bist du ja wieder, so winzig wie immer.' },
          { speaker: 'Riesin Hanna', text: 'Und schau, was er ausgespuckt hat: einen Splitter, der in allen Größen gleichzeitig glänzt! Der hat den Nebel angelockt.' },
          { speaker: 'Riesin Hanna', text: 'Das ist das Urmaß der Größe. Bring ihn deiner Meisterin, Kleines!' },
        ],
        () =>
          this.vagorSays([
            { speaker: 'Vagor', text: 'Ein Maß für alles. Und ein einziger Fehler, und das ganze Land lacht über dich.' },
            { speaker: 'Vagor', text: 'Ohne Maße lacht niemand. Denk darüber nach, Lehrling.' },
            { speaker: 'Riesin Hanna', text: 'Wer war das? Das klang gar nicht böse. Eher … traurig.' },
          ]),
      );
    });
  }

  /** Das Mauseloch: Skalenkappe auf, klein werden, hineinkriechen, Messbuch-Seite finden. */
  private mouseHole(stone: Phaser.GameObjects.Image): void {
    if (!getFlag('valley_intro')) {
      this.say([{ speaker: 'Eule Pünktchen', text: 'Ein winziges Mauseloch. Da passt nicht einmal ein Finger hinein.' }]);
      return;
    }
    if (getFlag('page_valley')) {
      this.say([{ speaker: 'Eule Pünktchen', text: 'Im Mauseloch liegen nur noch Körner und Federn. Die Seite hast du schon.' }]);
      return;
    }
    this.say(
      [{ speaker: 'Eule Pünktchen', text: 'Ein Mauseloch! Setz Hannas Skalenkappe auf, dann wirst du so klein wie eine Maus.' }],
      () => {
        const p = this.player;
        const home = { x: p.x, y: p.y };
        const hole = { x: stone.x + 8, y: stone.y - 8 };
        this.setFrozen(true);
        this.cameras.main.flash(300, 200, 240, 200);
        // schrumpfen, hineinkrabbeln, drinnen suchen, wieder heraus und groß werden
        this.tweens.chain({
          targets: p,
          tweens: [
            { scale: 0.25, duration: 700, ease: 'back.in' },
            { x: hole.x, y: hole.y, duration: 700 },
            { alpha: 0, duration: 250 },
          ],
          onComplete: () =>
            this.say([{ speaker: 'Eule Pünktchen', text: 'Drinnen ist es warm und trocken. Zwischen Körnern und Federn liegt ein zusammengefaltetes Blatt …' }], () =>
              this.findPage('page_valley', undefined, () => {
                this.setFrozen(true);
                this.tweens.chain({
                  targets: p,
                  tweens: [
                    { alpha: 1, duration: 250 },
                    { x: home.x, y: home.y, duration: 700 },
                    { scale: 1, duration: 600, ease: 'back.out' },
                  ],
                  onComplete: () => this.setFrozen(false),
                });
              }),
            ),
        });
      },
    );
  }

  /** Tupfi, Hannas Marienkäfer, krabbelt wieder winzig neben ihr (im Code gezeichnet). */
  private addLadybug(): void {
    const g = this.add.graphics();
    g.fillStyle(0x1a1a1a, 1).fillCircle(0, -4, 2.5);
    g.fillStyle(0xd8322a, 1).fillEllipse(0, 1, 8, 9);
    g.lineStyle(1, 0x1a1a1a, 1).lineBetween(0, -3, 0, 5.5);
    g.fillStyle(0x1a1a1a, 1);
    for (const [x, y] of [[-2, -1], [2, -1], [-2.3, 3], [2.3, 3], [0, 4.6]]) g.fillCircle(x, y, 0.9);
    const x0 = 16.9 * TILE;
    const y0 = 8.3 * TILE;
    g.setPosition(x0, y0).setDepth(y0);
    this.tweens.add({ targets: g, x: x0 + 14, duration: 2600, yoyo: true, repeat: -1, ease: 'sine.inout', hold: 600 });
  }

  private showSplitter(): void {
    const s = this.add.image(this.player.x, this.player.y - 60, 'splitter').setDepth(20_000).setScale(0.2).setTint(0xc8f0a8);
    this.tweens.add({ targets: s, scale: 1, y: s.y - 20, duration: 900, ease: 'back.out' });
    this.tweens.add({ targets: s, alpha: 0, scale: 0.3, y: this.player.y - 20, delay: 3200, duration: 700, onComplete: () => s.destroy() });
  }

  private updateGoal(): void {
    if (!getFlag('valley_intro')) this.setGoal('Sprich mit der Riesin Hanna');
    else if (this.stationsDone() < 4) this.setGoal(`Hilf Hanna an vier Stellen (${this.stationsDone()} von 4)`);
    else if (!getFlag('valley_boss')) this.setGoal('Verjage den Riesenkäfer');
    else if (!getFlag('elle_size')) this.setGoal('Bring den Splitter der Größe zu Meisterin Elle');
    else this.setGoal('Weiter üben oder Fortsetzung abwarten …');
  }
}
