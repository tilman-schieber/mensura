import Phaser from 'phaser';
import { getStat, levelCap } from '../learn/progress';
import { SKILLS, type SkillId } from '../learn/skills';
import { TOPICS } from '../learn/topics';
import { loadSave, writeSave } from '../save';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, button, text } from '../ui/theme';

type Page = 'lernstand' | 'schule';

/**
 * Menü über der Welt: weiterspielen, Figur ändern, Zeitdruck im Kampf,
 * Lernstand (welche Skills sitzen) und Schulthemen (Schulmodus).
 * Die Welt ist solange pausiert.
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

    text(this, GAME_WIDTH / 2, 52, 'Menü', 28, COLORS.goldText);

    const bx = 150;
    button(this, bx, 110, 'Weiterspielen', () => this.close(), { width: 210, height: 50, size: 20 });
    button(this, bx, 172, 'Lernstand', () => this.show('lernstand'), { width: 210, height: 50, size: 20 });
    button(this, bx, 234, 'Schulthemen', () => this.show('schule'), { width: 210, height: 50, size: 20 });
    button(this, bx, 296, 'Figur ändern', () => this.editAvatar(), { width: 210, height: 50, size: 20 });

    const label = () => `Zeitdruck im Kampf: ${loadSave().settings.battleTimer ? 'an' : 'aus'}`;
    const timerBtn = button(this, bx, 358, label(), () => {
      const save = loadSave();
      save.settings.battleTimer = !save.settings.battleTimer;
      writeSave(save);
      (timerBtn.list[1] as Phaser.GameObjects.Text).setText(label());
    }, { width: 210, height: 50, size: 15 });

    this.page = this.add.container(0, 0);
    this.show('lernstand');
  }

  private show(page: Page): void {
    this.page.removeAll(true);
    if (page === 'lernstand') this.learningReport(290, 100);
    else this.schoolTopics(290, 100);
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
