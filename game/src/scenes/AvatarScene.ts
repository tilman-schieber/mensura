import Phaser from 'phaser';
import {
  CLOTH_TYPES,
  DEFAULT_LOOK,
  HAIR_TYPES,
  SHEET,
  buildAvatarTexture,
  type AvatarLook,
  type Direction,
} from '../avatar/avatar';
import { CLOTH_COLORS, HAIR_COLORS, type ColorOption } from '../avatar/palette';
import { loadSave, writeSave } from '../save';
import { COLORS, FONT, GAME_WIDTH, button, text } from '../ui/theme';

const PREVIEW_KEY = 'avatar-preview';

export class AvatarScene extends Phaser.Scene {
  private look: AvatarLook = { ...DEFAULT_LOOK };
  private preview!: Phaser.GameObjects.Sprite;
  private dirIndex = 0;
  private hairLabel!: Phaser.GameObjects.Text;
  private clothLabel!: Phaser.GameObjects.Text;
  private swatchRings: Record<'hair' | 'cloth', Phaser.GameObjects.Graphics[]> = { hair: [], cloth: [] };
  private nameInput!: HTMLInputElement;
  private returnTo = 'Village';

  constructor() {
    super('Avatar');
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data.returnTo ?? 'Village';
  }

  create(): void {
    this.look = { ...DEFAULT_LOOK, ...(loadSave().avatar ?? {}) };
    this.swatchRings = { hair: [], cloth: [] };
    this.cameras.main.setBackgroundColor(COLORS.night);

    text(this, GAME_WIDTH / 2, 38, 'Meisterin Elle fragt: Wer bist du, junger Lehrling?', 26, COLORS.goldText);

    // Vorschau links auf einem Sockel
    const px = 250;
    const py = 290;
    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 1).fillRoundedRect(px - 170, 80, 340, 420, 16);
    g.lineStyle(3, COLORS.panelEdge, 1).strokeRoundedRect(px - 170, 80, 340, 420, 16);
    g.fillStyle(0x0b1117, 0.6).fillEllipse(px, py + 118, 180, 40);

    this.preview = this.add.sprite(px, py, PREVIEW_KEY).setScale(4);
    this.preview.setInteractive({ useHandCursor: true }).on('pointerup', () => this.turn(1));
    button(this, px - 110, 460, '◀', () => this.turn(-1), { width: 56 });
    button(this, px + 110, 460, '▶', () => this.turn(1), { width: 56 });
    text(this, px, 460, 'drehen', 18, COLORS.muted);

    // Optionen rechts
    const ox = 700;
    this.hairLabel = this.optionRow(ox, 110, 'Frisur', () => this.cycleHair(-1), () => this.cycleHair(1));
    this.swatchRow(ox, 185, 'hair', HAIR_COLORS);
    this.clothLabel = this.optionRow(ox, 265, 'Kleidung', () => this.cycleCloth(-1), () => this.cycleCloth(1));
    this.swatchRow(ox, 340, 'cloth', CLOTH_COLORS);

    // Name
    text(this, ox, 405, 'Dein Name', 20, COLORS.muted);
    const dom = this.add.dom(ox, 443, 'input', {
      width: '300px',
      height: '40px',
      fontSize: '22px',
      fontFamily: FONT,
      textAlign: 'center',
      color: '#e9e4d8',
      background: '#0b1117',
      border: '3px solid #3c5566',
      borderRadius: '8px',
      outline: 'none',
    });
    this.nameInput = dom.node as HTMLInputElement;
    this.nameInput.maxLength = 14;
    this.nameInput.placeholder = 'Name eingeben';
    this.nameInput.value = this.look.name;
    this.nameInput.addEventListener('input', () => (this.look.name = this.nameInput.value));

    button(this, ox, 505, 'Aufbrechen!', () => this.confirm(), { width: 240 });

    this.refresh();
    this.time.addEvent({ delay: 2200, loop: true, callback: () => this.turn(1) });
  }

  private optionRow(x: number, y: number, title: string, prev: () => void, next: () => void) {
    text(this, x, y - 30, title, 20, COLORS.muted);
    button(this, x - 150, y + 5, '◀', prev, { width: 56 });
    button(this, x + 150, y + 5, '▶', next, { width: 56 });
    return text(this, x, y + 5, '', 26);
  }

  private swatchRow(x: number, y: number, kind: 'hair' | 'cloth', options: ColorOption[]) {
    text(this, x, y - 30, kind === 'hair' ? 'Haarfarbe' : 'Farbe der Kleidung', 20, COLORS.muted);
    const step = 40;
    const startX = x - ((options.length - 1) * step) / 2;
    options.forEach((opt, i) => {
      const cx = startX + i * step;
      const ring = this.add.graphics();
      this.swatchRings[kind].push(ring);
      const dot = this.add.circle(cx, y + 8, 15, Phaser.Display.Color.HexStringToColor(opt.hex).color);
      dot.setStrokeStyle(2, 0x000000);
      // Trefferfläche größer als der sichtbare Punkt, damit Finger gut treffen
      const hit = this.add.zone(cx, y + 8, step, 48).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (kind === 'hair') this.look.hairColor = opt.id;
        else this.look.clothColor = opt.id;
        this.refresh();
      });
      ring.setData('pos', { cx, cy: y + 8, id: opt.id });
    });
  }

  private cycleHair(delta: number) {
    const i = HAIR_TYPES.findIndex((h) => h.id === this.look.hairType);
    this.look.hairType = HAIR_TYPES[(i + delta + HAIR_TYPES.length) % HAIR_TYPES.length].id;
    this.refresh();
  }

  private cycleCloth(delta: number) {
    const i = CLOTH_TYPES.findIndex((c) => c.id === this.look.clothType);
    this.look.clothType = CLOTH_TYPES[(i + delta + CLOTH_TYPES.length) % CLOTH_TYPES.length].id;
    this.refresh();
  }

  private turn(delta: number) {
    this.dirIndex = (this.dirIndex + delta + SHEET.directions.length) % SHEET.directions.length;
    this.playPreview();
  }

  private playPreview() {
    const dir: Direction = SHEET.directions[this.dirIndex];
    this.preview.play(`${PREVIEW_KEY}-walk-${dir}`);
  }

  private refresh() {
    buildAvatarTexture(this, this.look, PREVIEW_KEY);
    this.preview.setTexture(PREVIEW_KEY, 'south-0');
    this.playPreview();

    this.hairLabel.setText(HAIR_TYPES.find((h) => h.id === this.look.hairType)!.name);
    this.clothLabel.setText(CLOTH_TYPES.find((c) => c.id === this.look.clothType)!.name);

    for (const kind of ['hair', 'cloth'] as const) {
      const selected = kind === 'hair' ? this.look.hairColor : this.look.clothColor;
      for (const ring of this.swatchRings[kind]) {
        const { cx, cy, id } = ring.getData('pos');
        ring.clear();
        if (id === selected) ring.lineStyle(3, COLORS.gold, 1).strokeCircle(cx, cy, 20);
      }
    }
  }

  private confirm() {
    this.look.name = this.nameInput.value.trim();
    if (!this.look.name) {
      this.nameInput.focus();
      this.nameInput.style.borderColor = '#d9b25f';
      return;
    }
    const save = loadSave();
    save.avatar = { ...this.look };
    writeSave(save);
    this.scene.stop('Hud');
    this.scene.start(this.returnTo);
  }
}

