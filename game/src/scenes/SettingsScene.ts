import { music } from '../audio/music';
import Phaser from 'phaser';
import { activeSlot, loadPrefs, loadSave, writePrefs, writeSave } from '../save';
import { speakLine } from '../ui/dialogVoice';
import { panel, setButtonLabel } from '../ui/screens';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, button, text } from '../ui/theme';

/**
 * Einstellungen, über Titelbild oder Menü erreichbar: Stimmen, Lautstärke, Vollbild,
 * und im laufenden Spiel der Zeitdruck im Kampf (gehört zum Spielstand).
 */
export class SettingsScene extends Phaser.Scene {
  private from: 'Title' | 'Menu' = 'Title';

  constructor() {
    super('Settings');
  }

  init(data: { from: 'Title' | 'Menu' }): void {
    this.from = data.from;
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080b, 0.8).setOrigin(0).setInteractive();
    const w = 600;
    const x = (GAME_WIDTH - w) / 2;
    panel(this, x, 40, w, GAME_HEIGHT - 80);
    text(this, GAME_WIDTH / 2, 78, 'Einstellungen', 28, COLORS.goldText);

    const labelX = x + 40;
    const ctrlX = x + w - 150;
    let row = 150;
    const label = (s: string) => text(this, labelX, row, s, 21, COLORS.text).setOrigin(0, 0.5);

    // Stimmen
    label('Dialoge vorlesen');
    const voiceBtn = button(this, ctrlX, row, this.onOff(loadPrefs().voice), () => {
      const p = loadPrefs();
      p.voice = !p.voice;
      writePrefs(p);
      setButtonLabel(voiceBtn, this.onOff(p.voice));
      if (p.voice) this.sample();
    }, { width: 150, height: 48, size: 20 });

    // Lautstärke in fünf Stufen
    row += 54;
    label('Lautstärke Stimmen');
    const bars = this.add.graphics();
    const drawBars = () => {
      const steps = Math.round(loadPrefs().volume * 5);
      bars.clear();
      for (let i = 0; i < 5; i++) {
        const h = 10 + i * 5;
        bars.fillStyle(i < steps ? COLORS.gold : 0x2a3844, 1).fillRoundedRect(ctrlX - 42 + i * 18, row + 14 - h, 12, h, 3);
      }
    };
    const change = (d: number) => {
      const p = loadPrefs();
      p.volume = Math.min(1, Math.max(0, Math.round(p.volume * 5 + d) / 5));
      writePrefs(p);
      drawBars();
      this.sample();
    };
    button(this, ctrlX - 90, row, '−', () => change(-1), { width: 48, height: 48 });
    button(this, ctrlX + 90, row, '+', () => change(1), { width: 48, height: 48 });
    drawBars();

    // Musik in fünf Stufen
    row += 54;
    label('Musik');
    const mbars = this.add.graphics();
    const mrow = row;
    const drawMusic = () => {
      const steps = Math.round(loadPrefs().music * 5);
      mbars.clear();
      for (let i = 0; i < 5; i++) {
        const h = 10 + i * 5;
        mbars.fillStyle(i < steps ? COLORS.gold : 0x2a3844, 1).fillRoundedRect(ctrlX - 42 + i * 18, mrow + 14 - h, 12, h, 3);
      }
    };
    const changeMusic = (d: number) => {
      const p = loadPrefs();
      p.music = Math.min(1, Math.max(0, Math.round(p.music * 5 + d) / 5));
      writePrefs(p);
      music.setVolume(p.music);
      drawMusic();
    };
    button(this, ctrlX - 90, row, '−', () => changeMusic(-1), { width: 48, height: 48 });
    button(this, ctrlX + 90, row, '+', () => changeMusic(1), { width: 48, height: 48 });
    drawMusic();

    // Vollbild
    if (this.scale.fullscreen.available) {
      row += 54;
      label('Vollbild');
      const fsBtn = button(this, ctrlX, row, this.onOff(this.scale.isFullscreen), () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
        this.time.delayedCall(300, () => setButtonLabel(fsBtn, this.onOff(this.scale.isFullscreen)));
      }, { width: 150, height: 48, size: 20 });
    }

    // Zeitdruck gehört zum Spielstand, darum nur im laufenden Spiel
    if (this.from === 'Menu' && activeSlot()) {
      row += 54;
      label('Zeitdruck im Kampf');
      const timerBtn = button(this, ctrlX, row, this.onOff(loadSave().settings.battleTimer), () => {
        const save = loadSave();
        save.settings.battleTimer = !save.settings.battleTimer;
        writeSave(save);
        setButtonLabel(timerBtn, this.onOff(save.settings.battleTimer));
      }, { width: 150, height: 48, size: 20 });
      text(this, labelX, row + 22, 'Aus: Nebelwesen warten, bis du fertig gerechnet hast.', 13, COLORS.muted).setOrigin(0, 0.5);
    }

    // Wie in der Grundschule gelernt: Der Bildungsplan BW lässt „Abziehen oder Ergänzen“ offen
    if (this.from === 'Menu' && activeSlot()) {
      row += 54;
      label('Minus schriftlich');
      const names = { abziehen: 'Abziehen', ergaenzen: 'Ergänzen' } as const;
      const current = () => names[loadSave().settings.subtraction ?? 'abziehen'];
      const subBtn = button(this, ctrlX, row, current(), () => {
        const save = loadSave();
        save.settings.subtraction = save.settings.subtraction === 'ergaenzen' ? 'abziehen' : 'ergaenzen';
        writeSave(save);
        setButtonLabel(subBtn, current());
      }, { width: 150, height: 48, size: 20 });
    }

    button(this, GAME_WIDTH / 2, GAME_HEIGHT - 72, 'Fertig', () => this.scene.stop(), { width: 200, height: 50, size: 21 });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.stop());
  }

  private onOff(on: boolean): string {
    return on ? 'an' : 'aus';
  }

  /** Hörprobe mit einer aufgenommenen Zeile */
  private sample(): void {
    speakLine('Meisterin Elle', 'Die Mine liegt im Osten. Folge einfach dem Weg.');
  }
}
