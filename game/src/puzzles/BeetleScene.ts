import Phaser from 'phaser';
import { formatDecimal, randInt } from '../learn/numbers';
import { GAME_WIDTH, button, text } from '../ui/theme';
import { BossScene, type BossConfig } from './BossScene';

// Endgegner des Riesentals: der Riesenkäfer. Man kämpft in der Milli-Welt:
// Seine Angaben sind in großen Einheiten, man selbst misst in kleinen.
//  1. Schwachstellen (Länge, M5):   „Schwachstelle bei 3,4 cm!“ → auf dem mm-Lineal treffen
//  2. Panzerdruck (Gewicht, M5M):   „2,5 kg Druck“ → das passende Gegengewicht in g wählen
//  3. Angriffstakt (Zeit, M5Z):     „alle 90 Sekunden“ → in Minuten und Sekunden

export class BeetleScene extends BossScene {
  protected config: BossConfig = {
    title: 'Der Riesenkäfer',
    imageKey: 'kaefer',
    imagePath: 'assets/objects/kaefer.png',
    imageScale: 1.05,
    background: [0x2a3a1c, 0x0b1208],
    phases: 3,
    hitsPerPhase: 3,
    phaseBreaks: ['Sein Panzer knackt! Jetzt drückt er mit ganzer Kraft …', 'Er wird wütend! Er greift im Takt an …'],
    winText: 'Der Riesenkäfer flüchtet ins hohe Gras!',
    regroupText: 'Der Käfer krabbelt zurück. Sammle dich und versuch es noch einmal!',
    seconds: 35,
    regenText: 'Zu langsam! Der Käfer saugt neuen Nebel auf und wird wieder größer.',
    chipColor: 0x9a6a2a,
  };

  constructor() {
    super('BeetleScene');
  }

  protected ask(phase: number): void {
    if (phase === 0) this.askRuler();
    else if (phase === 1) this.askWeight();
    else this.askTime();
  }

  // ---------- Phase 1: Schwachstelle auf dem mm-Lineal ----------

  private askRuler(): void {
    // Nur auf den kleinen Millimeterstrichen: keine beschrifteten Zentimeter (3,0 cm)
    // und keine halben Zentimeter (3,5 cm), die man ohne Zählen an den langen Strichen findet.
    let mm: number;
    do mm = randInt(11, 94);
    while (mm % 5 === 0);
    const cm = mm / 10;
    this.prompt.setText(`Schwachstelle bei ${formatDecimal(cm)} cm! Triff sie auf deinem Millimeter-Lineal.`);
    this.hint = `1 cm = 10 mm. Wie viele Millimeter sind ${formatDecimal(cm)} cm?`;

    const x0 = 130;
    const w = 700;
    const y = 420;
    const g = this.add.graphics();
    g.fillStyle(0xe8d9a8, 1).fillRoundedRect(x0 - 20, y - 36, w + 40, 60, 6);
    for (let i = 0; i <= 100; i++) {
      const x = x0 + (i / 100) * w;
      const h = i % 10 === 0 ? 30 : i % 5 === 0 ? 20 : 11;
      g.fillStyle(0x3a2a18, 1).fillRect(x - 0.75, y - 36, 1.5, h);
    }
    this.area.add(g);
    for (let i = 0; i <= 100; i += 10) this.area.add(text(this, x0 + (i / 100) * w, y + 6, String(i), 14, '#3a2a18'));
    this.area.add(text(this, x0 + w + 36, y + 6, 'mm', 14, '#e9e4d8'));
    const marker = this.add.triangle(0, y - 50, 0, 0, 16, 0, 8, 14, 0xf0d78a).setVisible(false);
    const zone = this.add.zone(x0 - 20, y - 60, w + 40, 90).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const v = Phaser.Math.Clamp(Math.round(((p.x - x0) / w) * 100), 0, 100);
      marker.setPosition(x0 + (v / 100) * w, y - 50).setVisible(true);
      if (v === mm) this.right(['M5'], `Treffer bei ${mm} mm = ${formatDecimal(cm)} cm!`);
      else if (v === Math.round(cm)) this.wrong(['M5'], `Das war ${v} mm. Denk dran: 1 cm = 10 mm!`);
      else this.wrong(['M5'], `Das war ${v} mm = ${formatDecimal(v / 10)} cm. Gesucht: ${formatDecimal(cm)} cm = ${mm} mm.`);
    });
    this.area.add([zone, marker]);
  }

  // ---------- Phase 2: Gegengewicht wählen ----------

  private askWeight(): void {
    // keine glatten Kilogramm (2 kg = 2000 g wäre zu leicht)
    let g: number;
    do g = randInt(11, 49) * 100 + (randInt(0, 1) ? 50 : 0);
    while (g % 1000 === 0);
    const kg = g / 1000;
    this.prompt.setText(`Sein Panzer drückt mit ${formatDecimal(kg)} kg! Welches Gegengewicht hält genau dagegen?`);
    this.hint = '1 kg = 1000 g. Das Komma rückt drei Stellen nach rechts.';
    const options = Phaser.Utils.Array.Shuffle([g, g / 10, g * 10, g + 500].filter((v) => Number.isInteger(v)));
    options.slice(0, 4).forEach((v, i) => {
      const x = GAME_WIDTH / 2 + (i - 1.5) * 200;
      this.area.add(
        button(this, x, 420, `${formatDecimal(v)} g`, () => {
          if (v === g) this.right(['M5M'], `Genau: ${formatDecimal(kg)} kg = ${formatDecimal(g)} g!`);
          else this.wrong(['M5M'], `${formatDecimal(v)} g = ${formatDecimal(v / 1000)} kg. Gesucht sind ${formatDecimal(kg)} kg.`);
        }, { width: 180, height: 64, size: 22 }),
      );
    });
  }

  // ---------- Phase 3: Angriffstakt ----------

  private askTime(): void {
    const kind = randInt(0, 1);
    if (kind === 0) {
      // 105 … 225 s, aber keine ganzen Minuten (120 s = 2 min 0 s wäre zu leicht)
      let s: number;
      do s = randInt(3, 11) * 15 + 60;
      while (s % 60 === 0);
      const m = Math.floor(s / 60);
      const r = s % 60;
      this.prompt.setText(`Er greift alle ${s} Sekunden an! Wie lange ist das?`);
      this.hint = '1 Minute hat 60 Sekunden. Wie oft passt 60 in die Zahl, und was bleibt übrig?';
      const correct = `${m} min ${r} s`;
      const opts = Phaser.Utils.Array.Shuffle([correct, `${Math.floor(s / 100)} min ${s % 100} s`, `${m + 1} min ${r} s`, `${m} min ${(r + 30) % 60} s`]);
      [...new Set(opts)].forEach((o, i, arr) => {
        const x = GAME_WIDTH / 2 + (i - (arr.length - 1) / 2) * 200;
        this.area.add(button(this, x, 420, o, () => {
          if (o === correct) this.right(['M5Z'], `Richtig: ${s} s = ${correct}.`);
          else this.wrong(['M5Z'], `${s} s = ${correct}. Eine Minute hat 60 Sekunden, nicht 100!`);
        }, { width: 180, height: 64, size: 20 }));
      });
    } else {
      const h = randInt(1, 3);
      const min = h * 60 + randInt(1, 5) * 10;
      this.prompt.setText(`Er schläft gleich ${Math.floor(min / 60)} h ${min % 60} min lang. Wie viele Minuten sind das?`);
      this.hint = '1 Stunde = 60 Minuten.';
      const opts = Phaser.Utils.Array.Shuffle([min, h * 100 + (min % 60), min + 60, min - 10]);
      opts.forEach((o, i) => {
        const x = GAME_WIDTH / 2 + (i - 1.5) * 200;
        this.area.add(button(this, x, 420, `${o} min`, () => {
          if (o === min) this.right(['M5Z'], `Richtig: ${min} Minuten!`);
          else this.wrong(['M5Z'], `${h} h = ${h * 60} min, dazu ${min % 60} min: zusammen ${min} min.`);
        }, { width: 180, height: 64, size: 22 }));
      });
    }
  }
}

