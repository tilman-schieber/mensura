import { music } from '../audio/music';
import Phaser from 'phaser';
import { makeBlockTextures, blockKey } from '../puzzles/blocks';
import { getFlag, setFlag, topicDone } from '../save';
import type { DialogLine } from '../ui/dialog';
import { FONT, smooth } from '../ui/theme';
import { TILE, WorldScene, type GoblinVisit } from './WorldScene';
import type { Cell } from './pathfind';
import { Terrain, vertexGrid, type TilesetData } from './terrain';

// Die Stellenstollen, äußere Ebene (Klasse 5, Herbst): Stellenwert, Zahlenstrahl,
// Runden, große Zahlen. Drei Stationen bei Vorarbeiter Brom, danach der Tresor
// von König Durin mit dem Splitter der Zahl.

const COLS = 26;
const ROWS = 18;
const WALL = 1;
const FLOOR = 0;

interface Station {
  flag: string;
  puzzle: string;
  name: string;
  done: DialogLine;
}

const STATIONS: Station[] = [
  { flag: 'mine_ore', puzzle: 'OreCartPuzzle', name: 'Erzloren', done: { speaker: 'Vorarbeiter Brom', text: 'Die Loren sind richtig beladen. Gute Arbeit!' } },
  { flag: 'mine_rail', puzzle: 'RailPuzzle', name: 'Lorenbahn', done: { speaker: 'Vorarbeiter Brom', text: 'Die Lorenbahn läuft wieder. Jede Lore steht, wo sie soll.' } },
  { flag: 'mine_round', puzzle: 'RoundingPuzzle', name: 'Haltestellen', done: { speaker: 'Vorarbeiter Brom', text: 'Die Loren halten wieder an den richtigen Haltestellen.' } },
];

const GOBLIN: GoblinVisit = {
  flag: 'goblin_mine',
  topic: 'zahl',
  intro: [
    { speaker: 'Pi-mal-Daumen', text: 'Hihi! Ich bin Pi-mal-Daumen. Genau rechnen ist was für Langweiler. Ich runde, wie es mir passt!' },
    { speaker: 'Pi-mal-Daumen', text: 'Die Plakate in Eichstadt? Die hab ich für Vagor geklebt. Wetten, du merkst nicht, wann ich schummle?' },
  ],
  caught: [{ speaker: 'Pi-mal-Daumen', text: 'Grrr! Erwischt. Das sag ich Vagor … nein, lieber doch nicht.' }],
};

export class MineScene extends WorldScene {
  private stars: Record<string, Phaser.GameObjects.Text> = {};
  private brom!: Phaser.GameObjects.Sprite;
  private koloss?: Phaser.GameObjects.Image;

  constructor() {
    super('Mine');
  }

  protected fogDensity(): number {
    return getFlag('mine_outer_done') ? 0 : 1;
  }

  preload(): void {
    this.load.image('tiles-mine', 'assets/tiles/mine.png');
    this.load.json('tiles-mine-data', 'assets/tiles/mine.json');
    this.load.image('vault-door', 'assets/objects/vault-door.png');
    this.load.spritesheet('npc-brom', 'assets/npcs/brom.png', { frameWidth: 68, frameHeight: 68 });
    this.load.image('koloss', 'assets/objects/koloss.png');
    this.load.image('elevator', 'assets/objects/elevator.png');
  }

  protected buildWorld(entry?: string): Cell {
    makeBlockTextures(this);
    // Halle mit Nische für den Tresor oben, Gang nach unten zum Ausgang und zwei
    // Stollen links und rechts, durch die die Lorenbahn die Halle quert
    const v = vertexGrid(COLS, ROWS, WALL, [
      [2, 4, 23, 15, FLOOR],
      [11, 2, 14, 4, FLOOR],
      [12, 15, 14, 18, FLOOR],
      [0, 9, 2, 13, FLOOR],
      [23, 9, 26, 13, FLOOR],
    ]);
    this.terrain = new Terrain(this, 'tiles-mine', this.cache.json.get('tiles-mine-data') as TilesetData, v);
    this.cameras.main.setBackgroundColor(0x0b0d10);

    this.addExit(12, 16, 13, 17, () => this.goTo('Village', 'mine'));

    // --- Lorenbahn quer durch die Halle, von Stollen zu Stollen (Zellreihe 11)
    this.drawRail(0, COLS, 12);
    this.tunnelShade();
    this.block(0, 10, 1, 12);
    this.block(COLS - 2, 10, COLS - 1, 12);

    // --- Station 1: Erzloren, Verladestation links auf der Schiene
    const ore = this.placeObject('mine-cart', 5.5, 12.35, 1.2);
    this.block(5, 11, 5, 11);
    this.orePile(5.6, 10.3);
    this.stationStar(STATIONS[0], 5.5 * TILE, 8.9 * TILE);
    this.addInteractable({ target: ore, stand: { x: 5, y: 12 }, onInteract: () => this.station(STATIONS[0]) });

    // --- Station 2: Lorenbahn, Lore in der Mitte (die Schiene ist der Zahlenstrahl)
    const railCart = this.placeObject('mine-cart', 12.5, 12.35, 1);
    this.block(12, 11, 12, 11);
    this.stationStar(STATIONS[1], 12.5 * TILE, 10 * TILE);
    this.addInteractable({ target: railCart, stand: { x: 12, y: 12 }, onInteract: () => this.station(STATIONS[1]) });

    // --- Station 3: Haltestellen-Schilder rechts an der Schiene
    const signs = this.haltSigns(18, 10);
    this.stationStar(STATIONS[2], 19.5 * TILE, 9 * TILE);
    this.addInteractable({ target: signs, stand: { x: 19, y: 12 }, onInteract: () => this.station(STATIONS[2]) });

    // --- Tresor von König Durin (oben in der Nische)
    const vault = this.placeObject('vault-door', 13, 5.2, 0.85);
    this.block(11, 3, 13, 4);
    this.addInteractable({ target: vault, stand: { x: 12, y: 6 }, onInteract: () => this.vault() });

    // --- Der Erzkoloss bewacht den Tresor, sobald die Stationen geschafft sind
    if (this.stationsDone() === 3 && !getFlag('koloss_done')) this.spawnKoloss(false);

    // --- Aufzug hinunter zum Rechenwerk (tiefe Ebene, Klasse 5 Winter)
    const lift = this.placeObject('elevator', 21, 15.2, 0.85);
    this.block(20, 13, 21, 14);
    this.addInteractable({ target: lift, stand: { x: 19, y: 14 }, onInteract: () => this.lift() });

    // --- Nebenbei: Pi-mal-Daumen, eine Messbuch-Seite, ein Schild am Eingang
    this.addGoblin(GOBLIN, { x: 21, y: 6 }, 'west');
    this.addPage('page_mine', 4, 5);
    this.addSign(17.5, 15.2, 'Stollen 1 · 350 m tief');

    // --- Vorarbeiter Brom am Eingang
    this.brom = this.addNpc('npc-brom', { x: 15, y: 13 }, 'west');
    this.addInteractable({ target: this.brom, stand: { x: 14, y: 13 }, onInteract: () => { this.faceToPlayer(this.brom); this.talkToBrom(); } });

    this.updateGoal();
    if (!getFlag('brom_intro')) this.time.delayedCall(600, () => { this.faceToPlayer(this.brom); this.talkToBrom(); });
    return entry === 'deep' ? { x: 19, y: 14 } : { x: 12, y: 15 };
  }

  // ---------- Dekoration ----------

  private drawRail(x0: number, x1: number, y: number): void {
    const g = this.add.graphics().setDepth(y * TILE - 20);
    const py = y * TILE - 10;
    for (let x = x0 * TILE + 2; x < x1 * TILE; x += 8) g.fillStyle(0x5a3a1e, 1).fillRect(x, py - 7, 4, 16);
    g.fillStyle(0x8a8f96, 1).fillRect(x0 * TILE, py - 5, (x1 - x0) * TILE, 2);
    g.fillStyle(0x8a8f96, 1).fillRect(x0 * TILE, py + 5, (x1 - x0) * TILE, 2);
  }

  /** Die Schiene verschwindet links und rechts im Dunkel der Stollen. */
  private tunnelShade(): void {
    const g = this.add.graphics().setDepth(10_000);
    const top = 9.4 * TILE;
    const h = 3.8 * TILE;
    const w = 2.5 * TILE;
    const dark = 0x0b0d10;
    g.fillGradientStyle(dark, dark, dark, dark, 1, 0, 1, 0).fillRect(0, top, w, h);
    g.fillGradientStyle(dark, dark, dark, dark, 0, 1, 0, 1).fillRect(COLS * TILE - w, top, w, h);
  }

  private orePile(cx: number, cy: number): void {
    const x = cx * TILE;
    const y = cy * TILE;
    const parts: [number, number, number, number][] = [
      [1000, -10, -6, 0.5], [100, 10, -2, 0.5], [10, 18, -4, 1], [10, 21, -4, 1], [1, -2, 6, 2], [1, 4, 8, 2],
    ];
    for (const [v, dx, dy, s] of parts) {
      this.add.image(x + dx, y + dy, blockKey(v as 1 | 10 | 100 | 1000)).setScale(s).setDepth(y);
    }
  }

  /** Zwei Wegweiser mit Haltestellen-Nummern; gibt ein Objekt zum Antippen zurück. */
  private haltSigns(cellX: number, cellY: number): Phaser.GameObjects.Container {
    const c = this.add.container(cellX * TILE, cellY * TILE);
    const g = this.add.graphics();
    const labels = ['3 400', '3 500'];
    labels.forEach((_l, i) => {
      const x = i * 64;
      g.fillStyle(0x4a3018, 1).fillRect(x + 14, 10, 4, 34);
      g.fillStyle(0x2a1a0c, 1).fillRoundedRect(x - 4, 0, 40, 18, 3);
      g.fillStyle(0xc9a15a, 1).fillRoundedRect(x - 3, 1, 38, 16, 3);
    });
    c.add(g);
    labels.forEach((l, i) => {
      const t = smooth(this.add.text(i * 64 + 16, 9, l, { fontFamily: FONT, fontSize: '11px', color: '#2a1a0c', resolution: 4 }).setOrigin(0.5));
      if (this.fogDensity() > 0) this.fogFlicker(t, l);
      c.add(t);
    });
    c.setSize(110, 46);
    c.setDepth((cellY + 1.4) * TILE);
    this.block(cellX, cellY, cellX, cellY);
    this.block(cellX + 2, cellY, cellX + 2, cellY);
    // Container-Bounds für das Antippen: Rechteck um die Schilder
    (c as unknown as { getBounds: () => Phaser.Geom.Rectangle }).getBounds = () =>
      new Phaser.Geom.Rectangle(cellX * TILE - 8, cellY * TILE - 4, 120, 52);
    return c;
  }

  private stationStar(s: Station, x: number, y: number): void {
    this.stars[s.flag] = this.addStar(s.flag, x, y);
  }

  // ---------- Handlung ----------

  private stationsDone(): number {
    return STATIONS.filter((s) => getFlag(s.flag)).length;
  }

  private talkToBrom(): void {
    if (!getFlag('brom_intro')) {
      this.say(
        [
          { speaker: 'Vorarbeiter Brom', text: 'Halt! Wer da? Ein Lehrling von Meisterin Elle? Dann bist du willkommen.' },
          { speaker: 'Vorarbeiter Brom', text: 'Seit der Nebel in die Stollen kriecht, zählen meine Leute falsch. Ich zähle alles zweimal, und trotzdem stimmt nichts mehr!' },
          { speaker: 'Vorarbeiter Brom', text: 'Hilf uns an drei Stellen: bei den Erzloren links, an der Lorenbahn in der Mitte und bei den Haltestellen rechts.' },
          { speaker: 'Vorarbeiter Brom', text: 'Schaffst du das, öffnet König Durin vielleicht seinen Tresor für dich. Tipp einfach auf die Dinge, die du untersuchen willst.' },
        ],
        () => {
          setFlag('brom_intro');
          this.updateGoal();
        },
      );
      return;
    }
    if (this.stationsDone() < 3) {
      this.say([{ speaker: 'Vorarbeiter Brom', text: 'Drei Sterne will ich über den Stationen sehen, ich zähle jeden Abend nach. Wo noch keiner leuchtet, gibt es zu tun.' }]);
    } else if (!getFlag('koloss_done')) {
      this.say([{ speaker: 'Vorarbeiter Brom', text: 'Der Koloss! Geh hin und zeig ihm, was du über Zahlen weißt!' }]);
    } else if (!getFlag('mine_outer_done')) {
      this.say([{ speaker: 'Vorarbeiter Brom', text: 'Alles läuft wieder! Geh zum Tresor oben. König Durin erwartet dich.' }]);
    } else {
      this.say([
        { speaker: 'Vorarbeiter Brom', text: 'Vierzehn Stufen zum Tresor, drei Stationen, drei Sterne. Alles stimmt, wie gestern. Komm jederzeit wieder und hilf mit.' },
        ...(getFlag('deep_done')
          ? []
          : [{ speaker: 'Vorarbeiter Brom', text: 'Der Aufzug rechts fährt hinunter zum großen Rechenwerk. Grete wartet dort schon lange auf Hilfe.' }]),
      ]);
    }
  }

  private station(s: Station): void {
    if (!getFlag('brom_intro')) {
      this.talkToBrom();
      return;
    }
    this.startPuzzle(s.puzzle, (solved) => {
      if (!solved) return;
      const first = !getFlag(s.flag);
      setFlag(s.flag);
      this.stars[s.flag]?.setVisible(true);
      this.updateGoal();
      if (first) {
        const rest = 3 - this.stationsDone();
        const next: DialogLine =
          rest === 2
            ? { speaker: 'Vorarbeiter Brom', text: 'Noch zwei Stationen, dann gehen wir zu König Durin.' }
            : rest === 1
              ? { speaker: 'Vorarbeiter Brom', text: 'Nur noch eine Station, dann gehen wir zu König Durin.' }
              : { speaker: 'Vorarbeiter Brom', text: 'Alle drei geschafft! Jetzt zum Tresor, oben in der Nische …' };
        this.say([s.done, next], () => {
          if (this.stationsDone() === 3) this.kolossAppears();
        });
      }
    });
  }

  // ---------- Erzkoloss ----------

  private spawnKoloss(dramatic: boolean): void {
    const k = this.placeObject('koloss', 13, 9.3, 0.55);
    this.block(11, 7, 14, 8);
    this.tweens.add({ targets: k, y: k.y - 3, duration: 1200, yoyo: true, repeat: -1, ease: 'sine.inout' });
    this.addInteractable({ target: k, stand: { x: 12, y: 10 }, onInteract: () => this.fightKoloss() });
    this.koloss = k;
    if (dramatic) {
      k.setAlpha(0);
      this.tweens.add({ targets: k, alpha: 1, duration: 1500 });
    }
  }

  private kolossAppears(): void {
    this.cameras.main.shake(1200, 0.01);
    this.time.delayedCall(700, () => {
      this.spawnKoloss(true);
      this.updateGoal();
      this.say([
        { speaker: 'Vorarbeiter Brom', text: 'Was ist das? Der Boden bebt!' },
        { speaker: 'König Durin', text: 'Der Nebel ballt sich zusammen, ausgerechnet vor meinem Tresor! Ein Erzkoloss!' },
        { speaker: 'Vorarbeiter Brom', text: 'Warum gerade dort, mein König? Was liegt in diesem Tresor?' },
        { speaker: 'König Durin', text: 'Das … geht dich nichts an, Brom. Erst muss das Ungetüm weg.' },
        { speaker: 'Vorarbeiter Brom', text: 'Du kennst dich jetzt mit Zahlen aus wie ein Zwerg. Zeig dem Ungetüm, was du gelernt hast!' },
      ]);
    });
  }

  private fightKoloss(): void {
    this.startPuzzle('ColossusScene', (won) => {
        if (!won) return;
        setFlag('koloss_done');
        this.koloss?.destroy();
        this.koloss = undefined;
        this.unblock(11, 7, 14, 8);
        this.updateGoal();
        this.say([
          { speaker: 'König Durin', text: 'Er ist fort! Nie hat ein Lehrling so mutig gerechnet.' },
          { speaker: 'König Durin', text: 'Komm zum Tresor. Ich öffne ihn für dich.' },
        ], () => this.vagorSpeaks());
    });
  }

  private vault(): void {
    if (this.stationsDone() < 3) {
      this.say([{ speaker: 'König Durin', text: 'Erst wenn die Stollen wieder richtig zählen, öffne ich.' }]);
      return;
    }
    if (!getFlag('koloss_done')) {
      this.say([{ speaker: 'König Durin', text: 'Der Koloss versperrt den Weg! Besiege ihn zuerst.' }]);
      return;
    }
    if (getFlag('mine_outer_done')) {
      this.startPuzzle('VaultPuzzle', () => {}, 3);
      return;
    }
    this.say(
      [
        { speaker: 'König Durin', text: 'Du hast meinen Stollen die Ordnung zurückgegeben. Nun zeig mir, dass du auch große Zahlen beherrschst.' },
        { speaker: 'König Durin', text: 'Ich nenne dir den Code. Hör genau hin und stell ihn am Tresor ein.' },
      ],
      () =>
        this.startPuzzle('VaultPuzzle', (solved) => {
          if (!solved) return;
          setFlag('mine_outer_done');
          this.updateGoal();
          this.cameras.main.flash(600, 255, 240, 200);
          this.showSplitter();
          this.clearFog();
          this.say([
            { speaker: 'König Durin', text: 'Der Tresor ist offen. Ich muss dir etwas gestehen, Lehrling.' },
            { speaker: 'König Durin', text: 'Als die Urmaße zerbrachen, fiel ein Splitter in meinen Stollen. Ich habe ihn weggeschlossen. Was glänzt, gibt ein Zwerg nicht her.' },
            { speaker: 'König Durin', text: 'Aber Splitter ziehen den Nebel an. Darum zählten meine Leute falsch, und darum stand der Koloss vor meinem Tresor.' },
            { speaker: 'König Durin', text: 'Nimm ihn. Bring ihn zu Meisterin Elle, dort gehört er hin.' },
          ]);
        }),
    );
  }

  /** Aufzug zur tiefen Ebene: erst nach dem Tresor und mit dem Schulthema „Schriftlich rechnen“ */
  private lift(): void {
    if (!getFlag('mine_outer_done')) {
      this.say([{ speaker: 'Vorarbeiter Brom', text: 'Der Aufzug fährt hinunter zum Rechenwerk. Aber erst bringen wir hier oben alles in Ordnung.' }]);
      return;
    }
    if (!topicDone('schriftlich')) {
      this.say([
        { speaker: 'Vorarbeiter Brom', text: 'Da unten steht das große Rechenwerk. Aber der Aufzug steckt im Nebel fest.' },
        { speaker: 'Vorarbeiter Brom', text: 'Frag Meisterin Elle, wann er sich lichtet. Sie weiß so etwas.' },
      ]);
      return;
    }
    this.goTo('MineDeep', 'mine');
  }

  /** Vagors Stimme aus dem Nebel, zum ersten Mal */
  private vagorSpeaks(): void {
    if (getFlag('vagor_mine')) return;
    this.vagorSays(
      [
        { speaker: 'Vagor', text: 'Sieh an. Elles neuer Lehrling.' },
        { speaker: 'Vagor', text: 'Wozu so genau, Kind? Genau heißt: Man kann sich irren. Im Nebel irrt sich niemand.' },
        { speaker: 'Vorarbeiter Brom', text: 'Diese Stimme … Das war Vagor. Er hat noch nie zu jemandem gesprochen.' },
      ],
      () => setFlag('vagor_mine'),
    );
  }

  /** Der Splitter schwebt über der Figur und verschwindet in der Tasche. */
  private showSplitter(): void {
    void music.sting('fanfare');
    const s = this.add.image(this.player.x, this.player.y - 60, 'splitter').setDepth(20_000).setScale(0.2);
    this.tweens.add({ targets: s, scale: 1, y: s.y - 20, duration: 900, ease: 'back.out' });
    this.tweens.add({ targets: s, alpha: 0, scale: 0.3, y: this.player.y - 20, delay: 3200, duration: 700, onComplete: () => s.destroy() });
  }

  private updateGoal(): void {
    if (!getFlag('brom_intro')) this.setGoal('Sprich mit Vorarbeiter Brom');
    else if (this.stationsDone() < 3) this.setGoal(`Hilf an den Stationen (${this.stationsDone()} von 3)`);
    else if (!getFlag('koloss_done')) this.setGoal('Besiege den Erzkoloss');
    else if (!getFlag('mine_outer_done')) this.setGoal('Öffne den Tresor von König Durin');
    else if (!getFlag('elle_splitter')) this.setGoal('Bring den Splitter zu Meisterin Elle');
    else this.setGoal('Weiter üben oder Fortsetzung abwarten …');
  }
}
