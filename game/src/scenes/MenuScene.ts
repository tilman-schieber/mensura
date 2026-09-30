import Phaser from 'phaser';
import { getStat, levelCap, recordAttempt } from '../learn/progress';
import { PAGES, type MessbuchPage } from '../messbuch';
import { SKILLS, type SkillId } from '../learn/skills';
import { TOPICS } from '../learn/topics';
import { activeSlot, getFlag, loadSave, setFlag, writeSave } from '../save';
import { FONT, smooth } from '../ui/theme';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, button, text } from '../ui/theme';
import { goToTitle } from './flow';

type Page = 'lernstand' | 'schule' | 'messbuch';

/**
 * Menü über der Welt: weiterspielen, Lernstand (welche Skills sitzen), Schulthemen
 * (Schulmodus), Figur ändern, speichern, laden, Einstellungen, zurück zum Titelbild.
 * Die Welt ist solange pausiert. Esc öffnet und schließt es.
 */
export class MenuScene extends Phaser.Scene {
  private worldKey = '';
  private page!: Phaser.GameObjects.Container;

  constructor() {
    super('Menu');
  }

  init(data: { world: string }): void {
    this.worldKey = data.world;
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05080b, 0.85).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(30, 24, GAME_WIDTH - 60, GAME_HEIGHT - 48, 14);
    g.lineStyle(3, COLORS.gold, 1).strokeRoundedRect(30, 24, GAME_WIDTH - 60, GAME_HEIGHT - 48, 14);

    text(this, GAME_WIDTH / 2, 50, 'Menü', 26, COLORS.goldText);
    text(this, GAME_WIDTH - 60, 50, `Platz ${activeSlot() ?? '–'} · ${loadSave().avatar?.name ?? ''}`, 15, COLORS.muted).setOrigin(1, 0.5);

    const bx = 150;
    const opts = { width: 210, height: 44, size: 18 };
    const items: [string, () => void][] = [
      ['Weiterspielen', () => this.close()],
      ['Lernstand', () => this.show('lernstand')],
      ['Schulthemen', () => this.show('schule')],
      ['Messbuch', () => this.show('messbuch')],
      ['Figur ändern', () => this.editAvatar()],
      ['Speichern', () => this.overlay('Slots', { mode: 'save', from: 'Menu' })],
      ['Laden', () => this.overlay('Slots', { mode: 'load', from: 'Menu' })],
      ['Einstellungen', () => this.overlay('Settings', { from: 'Menu' })],
      ['Zum Titelbild', () => goToTitle(this)],
    ];
    items.forEach(([label, action], i) => button(this, bx, 90 + i * 49, label, action, opts));

    this.page = this.add.container(0, 0);
    this.show('lernstand');

    this.input.keyboard?.on('keydown-ESC', () => {
      // Esc gehört dem obersten Fenster
      if (!this.scene.isActive('Slots') && !this.scene.isActive('Settings')) this.close();
    });
  }

  /** Spielstände oder Einstellungen über dem Menü öffnen */
  private overlay(key: string, data: object): void {
    this.scene.launch(key, data);
    this.scene.bringToTop(key);
  }

  private show(page: Page): void {
    this.page.removeAll(true);
    if (page === 'lernstand') this.learningReport(290, 100);
    else if (page === 'schule') this.schoolTopics(290, 100);
    else this.messbuch(290, 100);
  }

  /** Lernstand: pro Skill ein Balken (0–5 Kristalle) und wie oft richtig. */
  private learningReport(x: number, y: number): void {
    const p = this.page;
    p.add(text(this, x, y, 'Was du schon kannst', 22, COLORS.goldText).setOrigin(0, 0.5));
    // Nur Skills zeigen, die schon geübt wurden oder zu einem abgehakten Thema gehören
    const ids = (Object.keys(SKILLS) as SkillId[]).filter((id) => getStat(id).attempts > 0 || levelCap(id) === 1).slice(0, 7);
    if (!ids.length) {
      p.add(text(this, x, y + 50, 'Noch nichts geübt. Auf ins Abenteuer!', 17, COLORS.muted).setOrigin(0, 0.5));
    }
    ids.forEach((id, i) => {
      const s = getStat(id);
      const row = y + 44 + i * 52;
      p.add(text(this, x, row, SKILLS[id].name, 17, COLORS.text).setOrigin(0, 0.5));
      const seg = 5;
      const filled = Math.round(s.level * seg);
      const g = this.add.graphics();
      for (let k = 0; k < seg; k++) {
        g.fillStyle(k < filled ? 0xe0a93a : 0x2a3844, 1).fillRoundedRect(x + k * 30, row + 13, 24, 12, 4);
      }
      p.add(g);
      let info = s.attempts === 0 ? 'noch nicht geübt' : `${s.correct} von ${s.attempts} Aufgaben richtig`;
      if (levelCap(id) < 1) info += '  ·  nur Einstieg (Schulthema nicht abgehakt)';
      p.add(text(this, x + 170, row + 19, info, 14, COLORS.muted).setOrigin(0, 0.5));
    });
  }

  /** Schulmodus: Themen abhaken, die im Unterricht schon dran waren. */
  private schoolTopics(x: number, y: number): void {
    const p = this.page;
    p.add(text(this, x, y, 'Was war in der Schule schon dran?', 22, COLORS.goldText).setOrigin(0, 0.5));
    p.add(
      text(this, x, y + 28, 'Nicht abgehakte Themen gibt es im Spiel nur zum Reinschnuppern.', 14, COLORS.muted).setOrigin(0, 0.5),
    );
    TOPICS.forEach((t, i) => {
      const row = y + 64 + i * 36;
      const box = this.add.graphics();
      const draw = (checked: boolean) => {
        box.clear();
        box.lineStyle(2, t.later ? 0x3c5566 : COLORS.gold, 1).strokeRoundedRect(x, row - 11, 22, 22, 4);
        if (checked) box.fillStyle(COLORS.gold, 1).fillRoundedRect(x + 5, row - 6, 12, 12, 2);
      };
      draw(!!loadSave().settings.topics[t.id]);
      const name = text(this, x + 34, row, t.name, 16, t.later ? '#5d6b76' : COLORS.text).setOrigin(0, 0.5);
      const term = text(this, x + 380, row, t.later ? `${t.term} · kommt später` : t.term, 14, COLORS.muted).setOrigin(0, 0.5);
      p.add([box, name, term]);
      if (t.later) return;
      const hit = this.add.zone(x - 6, row - 16, 560, 32).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        const save = loadSave();
        save.settings.topics[t.id] = !save.settings.topics[t.id];
        writeSave(save);
        draw(save.settings.topics[t.id]);
      });
      p.add(hit);
    });
  }

  /** Vagors Messbuch: gefundene Seiten lesen und die Rechnungen prüfen */
  private messbuch(x: number, y: number): void {
    const p = this.page;
    p.add(text(this, x, y, 'Vagors Messbuch', 22, COLORS.goldText).setOrigin(0, 0.5));
    const found = PAGES.filter((pg) => getFlag(pg.id));
    p.add(
      text(this, x, y + 28, `${found.length} von ${PAGES.length} Seiten gefunden. Sie liegen gut versteckt, an jedem Ort eine.`, 14, COLORS.muted).setOrigin(0, 0.5),
    );
    PAGES.forEach((pg, i) => {
      const row = y + 70 + i * 52;
      if (!getFlag(pg.id)) {
        p.add(text(this, x + 10, row, `Seite ${i + 1}: ???  (${pg.place})`, 17, '#5d6b76').setOrigin(0, 0.5));
        return;
      }
      const checked = getFlag(`${pg.id}_checked`);
      p.add(button(this, x + 190, row, `Seite ${i + 1}: ${pg.title}`, () => this.readPage(pg), { width: 380, height: 44, size: 17 }));
      if (checked) p.add(text(this, x + 400, row, '✓ geprüft', 16, COLORS.goldText).setOrigin(0, 0.5));
    });
  }

  private readPage(pg: MessbuchPage): void {
    const p = this.page;
    p.removeAll(true);
    const x = 290;
    const g = this.add.graphics();
    g.fillStyle(0xe9dcbc, 1).fillRoundedRect(x, 84, 600, 330, 8);
    g.lineStyle(2, 0x8a6a3a, 1).strokeRoundedRect(x, 84, 600, 330, 8);
    p.add(g);
    const ink = '#3a2a18';
    p.add(text(this, x + 300, 110, pg.title, 22, ink));
    const checked = getFlag(`${pg.id}_checked`);
    const feedback = text(this, x + 300, 340, checked ? pg.explain : 'Stimmt die Rechnung? Tipp auf eine falsche Zeile oder auf „Alles richtig“.', 15, ink);
    feedback.setWordWrapWidth(560).setAlign('center');
    const check = (choice: number | null) => {
      const right = choice === pg.error;
      recordAttempt(['PLAUS'], right);
      if (right) setFlag(`${pg.id}_checked`);
      feedback.setText(right ? `Richtig! ${pg.explain}` : choice === null ? 'Schau noch einmal genau hin. Rechne jede Zeile selbst nach.' : 'Diese Zeile stimmt. Rechne sie nach!');
    };
    pg.lines.forEach((line, i) => {
      const t = smooth(this.add.text(x + 300, 160 + i * 44, line, { fontFamily: FONT, fontSize: '21px', color: ink, resolution: 2 }).setOrigin(0.5));
      t.setInteractive({ useHandCursor: true }).on('pointerup', () => check(i));
      p.add(t);
    });
    p.add(
      smooth(
        this.add
          .text(x + 300, 300, `„${pg.note.text}“  (Vagor)`, { fontFamily: FONT, fontSize: '15px', fontStyle: 'italic', color: '#6a4a2a', align: 'center', wordWrap: { width: 560 }, resolution: 2 })
          .setOrigin(0.5),
      ),
    );
    p.add(feedback);
    p.add(button(this, x + 120, 455, 'Alles richtig', () => check(null), { width: 200, height: 46, size: 18 }));
    p.add(button(this, x + 480, 455, 'Zurück', () => this.show('messbuch'), { width: 160, height: 46, size: 18 }));
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.worldKey);
  }

  private editAvatar(): void {
    this.scene.stop('Hud');
    this.scene.stop(this.worldKey);
    // start() beendet dieses Menü selbst
    this.scene.start('Avatar', { returnTo: this.worldKey });
  }
}
