import Phaser from 'phaser';
import { formatDecimal } from '../learn/numbers';
import { COLORS, button, text } from './theme';

export interface Numpad {
  container: Phaser.GameObjects.Container;
  value: () => number | null;
  clear: () => void;
}

export interface NumpadOptions {
  /** Komma-Taste anbieten (Kommazahlen wie 3,5) */
  decimal?: boolean;
  /** Einheit hinter der Eingabe, z. B. „cm“ */
  unit?: string;
}

/**
 * Großes Ziffernfeld im Spiel (statt Bildschirmtastatur). Die Eingabe wird mit
 * Tausender-Abständen angezeigt, so wie Zahlen im Schulbuch stehen.
 * Mit `decimal` gibt es eine Komma-Taste; die OK-Taste rückt dann in eine eigene Zeile.
 */
export function createNumpad(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onSubmit: (value: number) => void,
  maxDigits = 12,
  opts: NumpadOptions = {},
): Numpad {
  let digits = '';
  const c = scene.add.container(x, y);

  const displayBg = scene.add.graphics();
  displayBg.fillStyle(0x0b1117, 1).fillRoundedRect(-150, -150, 300, 56, 8);
  displayBg.lineStyle(3, COLORS.panelEdge, 1).strokeRoundedRect(-150, -150, 300, 56, 8);
  const display = text(scene, 0, -122, '', 30, COLORS.text);
  c.add([displayBg, display]);

  const value = (): number | null => (digits && digits !== ',' ? Number(digits.replace(',', '.')) : null);

  const refresh = () => {
    if (!digits) {
      display.setText(opts.unit ? `… ${opts.unit}` : '');
      return;
    }
    // Ganzzahlteil mit Tausender-Abständen, Nachkommastellen so wie getippt
    const [int, frac] = digits.split(',');
    const shown = (int ? formatDecimal(Number(int)) : '0') + (frac !== undefined ? `,${frac}` : '');
    display.setText(opts.unit ? `${shown} ${opts.unit}` : shown);
  };

  const press = (d: string) => {
    if (digits.replace(',', '').length >= maxDigits) return;
    if (d === ',') {
      if (digits.includes(',')) return;
      if (!digits) digits = '0';
    } else if (digits === '0') digits = '';
    digits += d;
    refresh();
  };
  const back = () => {
    digits = digits.slice(0, -1);
    refresh();
  };
  const submit = () => {
    const v = value();
    if (v !== null && !Number.isNaN(v)) onSubmit(v);
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];
  keys.forEach((k, i) => {
    const bx = ((i % 3) - 1) * 76;
    const by = -60 + Math.floor(i / 3) * 58;
    c.add(button(scene, bx, by, k, () => press(k), { width: 68, height: 50, size: 26 }));
  });
  if (opts.decimal) {
    c.add(button(scene, -76, 114, ',', () => press(','), { width: 68, height: 50, size: 30 }));
    c.add(button(scene, 0, 114, '0', () => press('0'), { width: 68, height: 50, size: 26 }));
    c.add(button(scene, 76, 114, '<', back, { width: 68, height: 50, size: 26 }));
    c.add(button(scene, 0, 172, 'OK', submit, { width: 220, height: 50, size: 22 }));
  } else {
    c.add(button(scene, -76, 114, '<', back, { width: 68, height: 50, size: 26 }));
    c.add(button(scene, 0, 114, '0', () => press('0'), { width: 68, height: 50, size: 26 }));
    c.add(button(scene, 76, 114, 'OK', submit, { width: 68, height: 50, size: 22 }));
  }
  refresh();

  const onKey = (e: KeyboardEvent) => {
    if (!c.visible) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (opts.decimal && (e.key === ',' || e.key === '.')) press(',');
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Enter') submit();
  };
  scene.input.keyboard?.on('keydown', onKey);
  c.once('destroy', () => scene.input.keyboard?.off('keydown', onKey));

  return {
    container: c,
    value,
    clear: () => {
      digits = '';
      refresh();
    },
  };
}
