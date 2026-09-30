import { formatNumber, randInt } from '../learn/numbers';
import type { SkillId } from '../learn/skills';
import { COLORS, FONT, GAME_WIDTH, button, smooth, text } from '../ui/theme';
import { PuzzleScene, type PuzzleData } from './PuzzleScene';

// Rätsel „Pi-mal-Daumens Schummelei“ (Ergebnisse prüfen, 2.2.13; dazu je nach Region
// Runden/Überschlag, Symmetrie, Größen oder Flächen). Der Nebelkobold behauptet etwas,
// man entscheidet: stimmt oder geschummelt? Etwa die Hälfte der Behauptungen ist falsch.

export type CheatTopic = 'zahl' | 'form' | 'groesse' | 'raum';

interface Claim {
  text: string;
  cheat: boolean;
  /** Die Wahrheit, als Rückmeldung */
  truth: string;
}

const pick = <T,>(xs: T[]): T => xs[randInt(0, xs.length - 1)];

function zahl(): Claim {
  const kind = randInt(0, 2);
  if (kind === 0) {
    const n = randInt(1_050, 9_949);
    const right = Math.round(n / 100) * 100;
    const wrong = Math.round(n / 1000) * 1000 === right ? right + 100 : Math.round(n / 1000) * 1000;
    const cheat = Math.random() < 0.5;
    return {
      text: `${formatNumber(n)} auf Hunderter gerundet ist ${formatNumber(cheat ? wrong : right)}.`,
      cheat,
      truth: `${formatNumber(n)} auf Hunderter gerundet ist ${formatNumber(right)}.`,
    };
  }
  if (kind === 1) {
    const a = randInt(2, 6) * 100 + randInt(-4, 4);
    const b = randInt(2, 6) * 100 + randInt(-4, 4);
    const est = Math.round(a / 100) * 100 + Math.round(b / 100) * 100;
    const cheat = Math.random() < 0.5;
    const shown = cheat ? est + pick([-300, 300, 500]) : est;
    return {
      text: `${a} + ${b} ist ungefähr ${formatNumber(shown)}.`,
      cheat,
      truth: `Überschlag: ${Math.round(a / 100) * 100} + ${Math.round(b / 100) * 100} = ${formatNumber(est)}.`,
    };
  }
  const digits = [randInt(1, 9), randInt(1, 9), randInt(1, 9), randInt(1, 9)];
  const n = Number(digits.join(''));
  const pos = randInt(0, 2);
  const d = digits[pos];
  const value = d * 10 ** (3 - pos);
  const cheat = Math.random() < 0.5;
  const shown = cheat ? (pos === 2 ? value * 10 : value / 10) : value;
  return {
    text: `In ${formatNumber(n)} ist die Ziffer ${d} an der ${pos + 1}. Stelle ${formatNumber(shown)} wert.`,
    cheat,
    truth: `Die ${d} an der ${pos + 1}. Stelle von ${formatNumber(n)} ist ${formatNumber(value)} wert.`,
  };
}

const FORM: Claim[] = [
  { text: 'Ein Quadrat hat 4 Symmetrieachsen.', cheat: false, truth: 'Ein Quadrat hat 4 Achsen: 2 durch die Seitenmitten, 2 durch die Ecken.' },
  { text: 'Ein Rechteck hat 4 Symmetrieachsen.', cheat: true, truth: 'Ein Rechteck, das kein Quadrat ist, hat nur 2 Achsen. Die Diagonalen sind keine.' },
  { text: 'Ein gleichseitiges Dreieck hat 3 Symmetrieachsen.', cheat: false, truth: 'Genau 3, eine durch jede Ecke.' },
  { text: 'Ein Kreis hat genau 2 Symmetrieachsen.', cheat: true, truth: 'Ein Kreis hat unendlich viele: jede Linie durch den Mittelpunkt.' },
  { text: 'Jedes Quadrat ist auch ein Rechteck.', cheat: false, truth: 'Ein Quadrat hat vier rechte Winkel, also ist es ein besonderes Rechteck.' },
  { text: 'Jedes Rechteck ist auch ein Quadrat.', cheat: true, truth: 'Nur wenn alle vier Seiten gleich lang sind.' },
  { text: 'Beim Punkt (3|5) geht man 5 nach rechts und 3 nach oben.', cheat: true, truth: 'Erst x, dann y: 3 nach rechts, 5 nach oben.' },
  { text: 'Eine Raute hat vier gleich lange Seiten.', cheat: false, truth: 'Genau das macht eine Raute aus.' },
];

const GROESSE: Claim[] = [
  { text: 'Ein voller Schulranzen wiegt 300 kg.', cheat: true, truth: 'Eher 5 kg. 300 kg wiegen vier Erwachsene zusammen.' },
  { text: 'Eine Haustür ist 20 m hoch.', cheat: true, truth: 'Eine Tür ist etwa 2 m hoch.' },
  { text: 'Ein Apfel wiegt 2 kg.', cheat: true, truth: 'Ein Apfel wiegt etwa 150 g.' },
  { text: 'Die große Pause dauert 15 Stunden.', cheat: true, truth: 'Eher 15 Minuten.' },
  { text: 'Ein neuer Bleistift ist etwa 17 cm lang.', cheat: false, truth: 'Stimmt, etwa so lang wie deine Hand.' },
  { text: 'Eine Tüte Milch wiegt etwa 1 kg.', cheat: false, truth: '1 Liter Milch wiegt etwa 1 kg.' },
  { text: 'Ein Fußballspiel dauert 90 Minuten.', cheat: false, truth: 'Zweimal 45 Minuten.' },
  { text: '3 m sind 300 cm.', cheat: false, truth: '1 m sind 100 cm, also 3 m = 300 cm.' },
  { text: '5 kg sind 50 g.', cheat: true, truth: '1 kg sind 1 000 g, also 5 kg = 5 000 g.' },
  { text: '2 Stunden sind 200 Minuten.', cheat: true, truth: 'Eine Stunde hat 60 Minuten, also 2 h = 120 min.' },
];

function raum(): Claim {
  const kind = randInt(0, 3);
  const a = randInt(3, 9);
  const b = randInt(2, 8);
  const cheat = Math.random() < 0.5;
  if (kind === 0) {
    return {
      text: `Ein Raum ist ${a} m lang und ${b} m breit. Seine Fläche ist ${cheat ? a + b : a * b} m².`,
      cheat,
      truth: `Fläche = Länge · Breite = ${a} · ${b} = ${a * b} m².`,
    };
  }
  if (kind === 1) {
    return {
      text: `Ein Beet ist ${a} m lang und ${b} m breit. Sein Zaun ist ${cheat ? a * b : 2 * (a + b)} m lang.`,
      cheat: cheat && a * b !== 2 * (a + b),
      truth: `Umfang = 2 · (${a} + ${b}) = ${2 * (a + b)} m.`,
    };
  }
  if (kind === 2) {
    const c = randInt(2, 5);
    return {
      text: `Eine Kiste ist ${a} cm lang, ${b} cm breit und ${c} cm hoch. Sie fasst ${cheat ? a + b + c : a * b * c} cm³.`,
      cheat,
      truth: `Volumen = ${a} · ${b} · ${c} = ${a * b * c} cm³.`,
    };
  }
  return pick([
    { text: 'Ein Würfel hat 8 Flächen.', cheat: true, truth: 'Ein Würfel hat 6 Flächen, 8 Ecken und 12 Kanten.' },
    { text: 'Ein Würfel hat 12 Kanten.', cheat: false, truth: '12 Kanten, 8 Ecken, 6 Flächen.' },
    { text: 'Jedes Kreuz aus sechs Quadraten lässt sich zu einem Würfel falten.', cheat: true, truth: 'Nur 11 Netze aus sechs Quadraten ergeben einen Würfel.' },
  ]);
}

const TOPIC_SKILL: Record<CheatTopic, SkillId> = { zahl: 'Z11', form: 'R4', groesse: 'M6', raum: 'M13' };
const TIPS: Record<CheatTopic, string> = {
  zahl: 'Rechne grob nach: Runde die Zahlen zuerst auf Hunderter.',
  form: 'Stell dir die Figur vor oder zeichne sie auf. Wo könntest du sie falten?',
  groesse: 'Vergleiche mit etwas, das du kennst: Tür 2 m, Milchtüte 1 kg, Pause 15 Minuten.',
  raum: 'Fläche ist Länge mal Breite, Umfang einmal ganz außen herum. Beim Würfel: Stell dir einen Spielwürfel vor und zähle nach.',
};

export class CheatPuzzle extends PuzzleScene {
  protected title = 'Pi-mal-Daumens Schummelei';
  protected skills: SkillId[] = ['PLAUS'];
  private topic: CheatTopic = 'zahl';
  private used = new Set<string>();

  constructor() {
    super('CheatPuzzle');
  }

  init(data: PuzzleData & { topic?: CheatTopic }): void {
    super.init(data);
    this.topic = data.topic ?? 'zahl';
    this.skills = ['PLAUS', TOPIC_SKILL[this.topic]];
    this.used.clear();
  }

  private claim(): Claim {
    for (let i = 0; i < 20; i++) {
      const c =
        this.topic === 'zahl' ? zahl() : this.topic === 'raum' ? raum() : pick(this.topic === 'form' ? FORM : GROESSE);
      if (!this.used.has(c.text)) {
        this.used.add(c.text);
        return c;
      }
    }
    return zahl();
  }

  protected buildRound(): void {
    const c = this.claim();
    const r = this.round;
    const goblin = this.add.sprite(170, 250, 'npc-pimal', 0).setScale(3);
    this.tweens.add({ targets: goblin, y: 244, duration: 700, yoyo: true, repeat: -1, ease: 'sine.inout' });
    r.add(goblin);

    // Sprechblase
    const bubble = this.add.graphics();
    bubble.fillStyle(0xf2ead8, 1).fillRoundedRect(300, 120, 580, 150, 16);
    bubble.fillTriangle(300, 200, 270, 225, 312, 225);
    r.add(bubble);
    r.add(
      smooth(
        this.add
          .text(590, 195, `„${c.text}“`, { fontFamily: FONT, fontSize: '25px', color: '#2a1a0c', align: 'center', wordWrap: { width: 540 }, resolution: 2 })
          .setOrigin(0.5),
      ),
    );
    r.add(text(this, GAME_WIDTH / 2 + 110, 300, 'Stimmt das, oder schummelt er?', 20, COLORS.muted));

    const answer = (saysCheat: boolean) => {
      if (saysCheat === c.cheat) this.solved(c.cheat ? `Erwischt! ${c.truth}` : `Stimmt tatsächlich. ${c.truth}`);
      else this.wrong(c.cheat ? `Da hat er dich reingelegt. ${c.truth}` : `Diesmal hat er nicht geschummelt. ${c.truth}`);
    };
    r.add(button(this, 480, 375, 'Stimmt!', () => answer(false), { width: 220, height: 60, size: 24 }));
    r.add(button(this, 740, 375, 'Geschummelt!', () => answer(true), { width: 220, height: 60, size: 24 }));

    this.hints = [TIPS[this.topic], 'Rechne es selbst aus oder stell es dir vor, und vergleiche dann mit seiner Behauptung.'];
  }
}
