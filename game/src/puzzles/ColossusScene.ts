import Phaser from 'phaser';
import { digitsOf, formatNumber, interestingNumber, randInt, roundTo } from '../learn/numbers';
import { getLevel, pickByLevel } from '../learn/progress';
import { GAME_WIDTH, button, text } from '../ui/theme';
import { BossScene, type BossConfig } from './BossScene';
import { Rail, type RailSpec } from './rail';

// Endgegner der äußeren Stellenstollen: der Erzkoloss.
// Drei Phasen, je drei Treffer, alles ohne Zeitdruck und ohne Fingerfertigkeit:
//  1. Rüstungsplatten (Stellenwert, Z1):  „Triff die Ziffer, die 70 wert ist!“
//  2. Felsbrocken (Runden, Z18):          Brocken 3 460 in die Rinne der gerundeten Zahl lenken
//  3. Stampfen (Zahlenstrahl, Z6):        die sichere Stelle auf dem Zahlenstrahl finden
// Fehler kosten ein Herz und werden erklärt. Ohne Herzen beginnt nur die Phase neu.

const PLACE = ['Einer', 'Zehner', 'Hunderter', 'Tausender', 'Zehntausender', 'Hunderttausender', 'Millionen'];

export class ColossusScene extends BossScene {
  protected config: BossConfig = {
    title: 'Der Erzkoloss',
    imageKey: 'koloss',
    imagePath: 'assets/objects/koloss.png',
    imageScale: 1.15,
    background: [0x1a1410, 0x07080a],
    phases: 3,
    hitsPerPhase: 3,
    phaseBreaks: ['Die Rüstung bricht! Jetzt reißt er Felsbrocken aus der Wand …', 'Er taumelt! Gleich stampft er mit aller Kraft …'],
    winText: 'Der Erzkoloss zerfällt zu Nebel und Staub!',
    regroupText: 'Der Koloss sammelt neue Kraft. Atme durch und versuch es noch einmal!',
    chipColor: 0xe0a93a,
    seconds: 30,
    regenText: 'Zu langsam! Der Koloss flickt seine Rüstung.',
  };

  constructor() {
    super('ColossusScene');
  }

  protected ask(phase: number): void {
    if (phase === 0) this.askPlates();
    else if (phase === 1) this.askBoulder();
    else this.askStomp();
  }

  // ---------- Phase 1: Rüstungsplatten (Stellenwert) ----------

  private askPlates(): void {
    const digits = pickByLevel(getLevel('Z1'), [4, 4, 5, 6, 7]);
    // Zahl mit lauter verschiedenen Ziffern ungleich 0 an der gefragten Stelle
    const n = interestingNumber(digits);
    const ds = digitsOf(n, digits);
    const candidates = ds.map((d, i) => ({ d, i })).filter((c) => c.d !== 0 && ds.filter((x) => x === c.d).length === 1);
    if (!candidates.length) {
      this.askPlates();
      return;
    }
    const target = candidates[randInt(0, candidates.length - 1)];
    const value = target.d * 10 ** target.i;
    const byName = randInt(0, 1) === 1;
    this.prompt.setText(
      byName ? `Seine Rüstung zeigt ${formatNumber(n)}. Triff die ${PLACE[target.i]}-Ziffer!` : `Seine Rüstung zeigt ${formatNumber(n)}. Triff die Ziffer, die ${formatNumber(value)} wert ist!`,
    );
    this.hint = byName
      ? 'Zähl die Stellen von rechts ab: Einer, Zehner, Hunderter, Tausender …'
      : `Welche Stelle ist ${formatNumber(10 ** target.i)} wert? Dort muss die ${target.d} stehen.`;

    // Platten nebeneinander, von links (höchste Stelle) nach rechts
    const w = 64;
    const x0 = GAME_WIDTH / 2 - ((digits - 1) * (w + 8)) / 2;
    for (let k = digits - 1; k >= 0; k--) {
      const pos = digits - 1 - k;
      const x = x0 + pos * (w + 8);
      const g = this.add.graphics();
      g.fillStyle(0x4a4f57, 1).fillRoundedRect(x - w / 2, 380, w, 80, 8);
      g.lineStyle(3, 0x2a2d33, 1).strokeRoundedRect(x - w / 2, 380, w, 80, 8);
      const t = text(this, x, 420, String(ds[k]), 44, '#f0d78a');
      const hit = this.add.zone(x, 420, w, 80).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (k === target.i) this.right(['Z1'], `Treffer! Die ${ds[k]} ist ${formatNumber(value)} wert.`);
        else this.wrong(['Z1'], `Das war die ${PLACE[k]}-Ziffer, sie ist ${formatNumber(ds[k] * 10 ** k)} wert.`);
      });
      this.area.add([g, t, hit]);
    }
  }

  // ---------- Phase 2: Felsbrocken (Runden) ----------

  private askBoulder(): void {
    const tier = pickByLevel(getLevel('Z18'), [
      { step: 10, digits: 3 },
      { step: 100, digits: 3 },
      { step: 100, digits: 4 },
      { step: 1000, digits: 4 },
      { step: 1000, digits: 5 },
    ]);
    let v = interestingNumber(tier.digits);
    if (v % tier.step === 0) v += randInt(1, tier.step - 1);
    // entscheidende Ziffer nie 0 (7 003 auf Tausender wäre geschenkt)
    const decisive = (x: number) => Math.floor(x / (tier.step / 10)) % 10;
    while (decisive(v) === 0) v = Math.floor(v / tier.step) * tier.step + randInt(1, 9) * (tier.step / 10) + (v % (tier.step / 10));
    const correct = roundTo(v, tier.step);
    const lower = Math.floor(v / tier.step) * tier.step;
    const wrongNear = correct === lower ? lower + tier.step : lower;
    // typischer Fehler: auf die falsche Stufe gerundet
    const wrongStep = roundTo(v, tier.step * 10) === correct ? roundTo(v, tier.step / 10 || 1) : roundTo(v, tier.step * 10);
    const options = Phaser.Utils.Array.Shuffle([...new Set([correct, wrongNear, wrongStep])]);
    const name = { 10: 'Zehner', 100: 'Hunderter', 1000: 'Tausender' }[tier.step as 10 | 100 | 1000];
    this.prompt.setText(`Ein Brocken mit ${formatNumber(v)} fliegt heran! Lenk ihn in die Rinne, auf ${name} gerundet!`);
    this.hint = `Zwischen welchen vollen ${name}n liegt ${formatNumber(v)}? Welcher ist näher?`;

    const boulder = this.add.circle(GAME_WIDTH / 2, 150, 26, 0x7a6a58).setStrokeStyle(3, 0x2a2016);
    const label = text(this, GAME_WIDTH / 2, 150, formatNumber(v), 16, '#fff4d8');
    this.area.add([boulder, label]);
    this.tweens.add({ targets: [boulder, label], y: 275, duration: 900, ease: 'quad.in' });

    options.forEach((o, i) => {
      const x = GAME_WIDTH / 2 + (i - (options.length - 1) / 2) * 230;
      const b = button(this, x, 420, formatNumber(o), () => {
        if (o === correct) this.right(['Z18'], `Richtig! ${formatNumber(v)} ≈ ${formatNumber(correct)}. Der Brocken prallt zurück!`);
        else if (o === wrongNear)
          this.wrong(['Z18'], `${formatNumber(v)} liegt näher an ${formatNumber(correct)} als an ${formatNumber(o)}.`);
        else this.wrong(['Z18'], `${formatNumber(o)} ist auf eine andere Stelle gerundet. Gefragt sind ${name}.`);
      }, { width: 200, height: 70, size: 26 });
      this.area.add(b);
    });
  }

  // ---------- Phase 3: Stampfen (Zahlenstrahl) ----------

  private askStomp(): void {
    const spec: RailSpec = pickByLevel(getLevel('Z6'), [
      { from: 0, to: 100, major: 10, minor: 5, labels: 'all' },
      { from: 0, to: 1000, major: 100, minor: 50, labels: 'all' },
      { from: 0, to: 10000, major: 1000, minor: 500, labels: 'ends+middle' },
      { from: 0, to: 10000, major: 1000, minor: 250, labels: 'ends' },
    ]);
    const step = spec.minor;
    const steps = Math.round((spec.to - spec.from) / step);
    // Die sichere Stelle liegt nie auf einer großen Marke (sonst zu leicht)
    let safe = spec.from + randInt(1, steps - 1) * step;
    while (safe % spec.major === 0) safe = spec.from + randInt(1, steps - 1) * step;
    this.prompt.setText(`„Ich zertrampele alles!“ Nur bei ${formatNumber(safe)} bist du sicher. Tipp auf die Stelle!`);
    this.hint = `Jede große Marke ist ${formatNumber(spec.major)} weiter, jede kleine ${formatNumber(spec.minor)}.`;

    const rail = new Rail(this, this.area, spec, 110, 850, 430);
    const zone = this.add.zone(80, 380, 800, 100).setOrigin(0).setInteractive({ useHandCursor: true });
    const marker = this.add.triangle(0, 395, 0, 0, 18, 0, 9, 16, 0xf0d78a).setVisible(false);
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      const v = rail.snap(p.x);
      marker.setPosition(rail.xOf(v), 395).setVisible(true);
      if (v === safe) this.right(['Z6'], `Genau bei ${formatNumber(safe)}! Der Fuß kracht daneben, du schlägst zu!`);
      else this.wrong(['Z6'], `Das war ${formatNumber(v)}. Die sichere Stelle ${formatNumber(safe)} liegt weiter ${v < safe ? 'rechts' : 'links'}.`);
    });
    this.area.add([zone, marker]);
  }
}

