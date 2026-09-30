import Phaser from 'phaser';
import { buildAvatarTexture } from '../avatar/avatar';
import { SLOTS, activeSlot, deleteSlot, exportSlot, importSlot, newGame, readSlot, saveAs, setActiveSlot, type Slot } from '../save';
import { SPLINTER_TOTAL, formatPlaytime, formatSavedAt, placeName, splinters } from '../story';
import { confirmBox, fogBackdrop, panel, toast } from '../ui/screens';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, button, text } from '../ui/theme';
import { enterGame } from './flow';

type Mode = 'new' | 'load' | 'save';

interface SlotData {
  mode: Mode;
  /** Titelbild oder Menü im laufenden Spiel */
  from: 'Title' | 'Menu';
}

const HEADINGS: Record<Mode, string> = {
  new: 'Neues Spiel: Wo soll es gespeichert werden?',
  load: 'Spiel laden',
  save: 'Spiel speichern',
};

const CARD_W = 280;
const CARD_H = 318;
const CARD_Y = 86;

/**
 * Die drei Speicherplätze: neues Spiel anlegen, laden, speichern, löschen,
 * als Datei sichern und aus einer Datei einlesen.
 */
export class SlotScene extends Phaser.Scene {
  private mode: Mode = 'load';
  private from: SlotData['from'] = 'Title';

  constructor() {
    super('Slots');
  }

  init(data: SlotData): void {
    this.mode = data.mode;
    this.from = data.from;
  }

  create(): void {
    if (this.from === 'Title') fogBackdrop(this);
    else this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080b, 0.92).setOrigin(0).setInteractive();

    text(this, GAME_WIDTH / 2, 44, HEADINGS[this.mode], 28, COLORS.goldText);
    SLOTS.forEach((n, i) => this.card(n, 30 + i * (CARD_W + 30)));

    button(this, 100, GAME_HEIGHT - 40, 'Zurück', () => this.back(), { width: 150, height: 48, size: 20 });
    text(
      this,
      GAME_WIDTH / 2 + 80,
      GAME_HEIGHT - 40,
      'Das Spiel speichert automatisch. „Sichern“ legt eine Datei\nauf dem Gerät ab, „Einlesen“ holt sie zurück.',
      14,
      COLORS.muted,
    );
    this.input.keyboard?.on('keydown-ESC', () => this.back());
  }

  /** Läuft gerade ein Spiel in diesem Platz? (dann nicht löschen oder überschreiben) */
  private inUse(n: Slot): boolean {
    return this.from === 'Menu' && activeSlot() === n;
  }

  private card(n: Slot, x: number): void {
    const save = readSlot(n);
    const cx = x + CARD_W / 2;
    panel(this, x, CARD_Y, CARD_W, CARD_H, 0.96);
    if (activeSlot() === n && save) {
      this.add.graphics().lineStyle(3, 0xf2e3b0, 1).strokeRoundedRect(x - 4, CARD_Y - 4, CARD_W + 8, CARD_H + 8, 16);
    }
    text(this, cx, CARD_Y + 24, `Platz ${n}`, 18, COLORS.muted);

    if (save?.avatar) {
      const key = `slot-avatar-${n}`;
      buildAvatarTexture(this, save.avatar, key);
      this.add.sprite(cx, CARD_Y + 86, key, 'south-0').setScale(1.5);
      text(this, cx, CARD_Y + 140, save.avatar.name, 24, COLORS.text);
      text(this, cx, CARD_Y + 170, placeName(save), 17, COLORS.goldText);
      text(this, cx, CARD_Y + 195, `Splitter: ${splinters(save)} von ${SPLINTER_TOTAL}`, 16, COLORS.text);
      text(this, cx, CARD_Y + 218, `Spielzeit: ${formatPlaytime(save.playtime)}`, 15, COLORS.muted);
      if (save.savedAt) text(this, cx, CARD_Y + 240, `Gespeichert: ${formatSavedAt(save.savedAt)}`, 15, COLORS.muted);
    } else if (save) {
      text(this, cx, CARD_Y + 140, 'Neues Spiel,\nnoch keine Figur', 20, COLORS.muted);
    } else {
      text(this, cx, CARD_Y + 140, 'leer', 24, COLORS.muted);
    }

    const main = this.mainAction(n, save !== null, save?.avatar?.name ?? '');
    if (main) button(this, cx, CARD_Y + CARD_H - 30, main[0], main[1], { width: CARD_W - 40, height: 46, size: 19 });

    // Kleine Schaltflächen unter der Karte, mittig
    const extras: [string, () => void][] = [];
    const name = save?.avatar?.name;
    if (name && !this.inUse(n)) extras.push(['Löschen', () => this.remove(n, name)]);
    if (name) extras.push(['Sichern', () => this.download(n, name)]);
    if (!this.inUse(n)) extras.push(['Einlesen', () => this.upload(n, name)]);
    extras.forEach(([label, action], i) => {
      const bx = cx + (i - (extras.length - 1) / 2) * 94;
      button(this, bx, CARD_Y + CARD_H + 32, label, action, { width: 86, height: 44, size: 15 });
    });
  }

  private mainAction(n: Slot, filled: boolean, name: string): [string, () => void] | null {
    const who = name || 'dem neuen Spiel';
    if (this.mode === 'new') {
      if (!filled) return ['Hier beginnen', () => this.startNew(n)];
      return ['Überschreiben', () => confirmBox(this, `Der Spielstand von ${who} wird gelöscht.\nWirklich neu beginnen?`, 'Ja, neu', () => this.startNew(n))];
    }
    if (this.mode === 'load') {
      if (!filled) return null;
      if (this.inUse(n)) return ['Weiterspielen', () => this.back()];
      return ['Laden', () => this.loadSlot(n)];
    }
    // speichern
    if (this.inUse(n) || !filled) return ['Hier speichern', () => this.store(n)];
    return ['Überschreiben', () => confirmBox(this, `Der Spielstand von ${who} wird überschrieben.`, 'Überschreiben', () => this.store(n))];
  }

  private startNew(n: Slot): void {
    newGame(n);
    enterGame(this);
  }

  private loadSlot(n: Slot): void {
    setActiveSlot(n);
    enterGame(this);
  }

  private store(n: Slot): void {
    // Die Welt schreibt ihren Ort ohnehin laufend; hier zusätzlich sofort speichern.
    this.game.events.emit('save-now');
    saveAs(n);
    this.back(`Gespeichert in Platz ${n}`);
  }

  private remove(n: Slot, name: string): void {
    confirmBox(this, `Den Spielstand von ${name} löschen?\nDas lässt sich nicht rückgängig machen.`, 'Löschen', () => {
      deleteSlot(n);
      this.scene.restart({ mode: this.mode, from: this.from });
    });
  }

  private download(n: Slot, name: string): void {
    const content = exportSlot(n);
    if (!content) return;
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    a.download = `mensura-${name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}-${date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(this, 'Datei gesichert');
  }

  private upload(n: Slot, current?: string): void {
    const pick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file || !this.sys.isActive()) return;
        const ok = importSlot(n, await file.text());
        if (!ok) {
          toast(this, 'Diese Datei ist kein Mensura-Spielstand.');
          return;
        }
        this.scene.restart({ mode: this.mode, from: this.from });
      });
      input.click();
    };
    if (current) confirmBox(this, `Der Spielstand von ${current} wird durch die Datei ersetzt.`, 'Datei wählen', pick);
    else pick();
  }

  private back(message?: string): void {
    if (this.from === 'Title') {
      this.scene.start('Title');
      return;
    }
    const menu = this.scene.get('Menu');
    this.scene.stop();
    if (!message || !menu.sys.isActive()) return;
    // Menü neu aufbauen (Platz-Anzeige), dann die Meldung zeigen
    menu.events.once('create', () => toast(menu, message));
    menu.scene.restart();
  }
}
