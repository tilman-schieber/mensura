import Phaser from 'phaser';
import { formatDecimal, randInt } from '../learn/numbers';
import { getLevel } from '../learn/progress';
import type { SkillId } from '../learn/skills';
import { COLORS, GAME_WIDTH, button, text } from '../ui/theme';
import { PuzzleScene } from './PuzzleScene';

// Rätsel „Das Schätzauge“ (Größen schätzen mit Alltags-Referenzen, M6).
// Ein Gegenstand, vier Antworten. Die falschen liegen um Faktor 10 oder 100 daneben:
// Beim Schätzen geht es um die Größenordnung, nicht um die genaue Zahl.
// Symbole: public/assets/icons/estimate.png (16 Stück, 48 px, Reihenfolge wie ITEMS).

interface Item {
  icon: number;
  question: string;
  /** Wert in mm (Länge) oder g (Gewicht) */
  value: number;
  kind: 'laenge' | 'gewicht';
  /** Merkhilfe für die Rückmeldung */
  tip: string;
}

const ITEMS: Item[] = [
  { icon: 0, question: 'Wie hoch ist eine Haustür?', value: 2000, kind: 'laenge', tip: 'Eine Tür ist etwas höher als ein Erwachsener.' },
  { icon: 1, question: 'Wie schwer ist ein Fahrrad?', value: 15_000, kind: 'gewicht', tip: 'Ein Fahrrad kann man gerade noch tragen.' },
  { icon: 2, question: 'Wie lang ist ein neuer Bleistift?', value: 170, kind: 'laenge', tip: 'Ein Bleistift ist etwa so lang wie deine Hand.' },
  { icon: 3, question: 'Wie schwer ist ein Elefant?', value: 5_000_000, kind: 'gewicht', tip: 'So schwer wie etwa drei Autos.' },
  { icon: 4, question: 'Wie schwer ist ein Apfel?', value: 150, kind: 'gewicht', tip: 'Etwa so schwer wie eineinhalb Tafeln Schokolade.' },
  { icon: 5, question: 'Wie schwer ist ein voller Schulranzen?', value: 5000, kind: 'gewicht', tip: 'So schwer wie fünf Tüten Milch.' },
  { icon: 6, question: 'Wie hoch ist eine große Eiche?', value: 20_000, kind: 'laenge', tip: 'So hoch wie ein Haus mit sechs Stockwerken.' },
  { icon: 7, question: 'Wie lang ist ein Schulbus?', value: 12_000, kind: 'laenge', tip: 'Etwa so lang wie drei Autos hintereinander.' },
  { icon: 8, question: 'Wie lang ist eine Ameise?', value: 5, kind: 'laenge', tip: 'Kleiner als dein Fingernagel.' },
  { icon: 9, question: 'Wie hoch ist ein kleines Haus?', value: 8000, kind: 'laenge', tip: 'Etwa vier Türen übereinander.' },
  { icon: 10, question: 'Wie schwer ist ein Auto?', value: 1_500_000, kind: 'gewicht', tip: 'Ein Auto wiegt etwa eineinhalb Tonnen.' },
  { icon: 11, question: 'Wie schwer ist eine Tüte Milch (1 Liter)?', value: 1000, kind: 'gewicht', tip: '1 Liter Wasser oder Milch wiegt etwa 1 kg.' },
  { icon: 12, question: 'Wie schwer ist eine Tafel Schokolade?', value: 100, kind: 'gewicht', tip: 'Das steht meistens auf der Packung: 100 g.' },
  { icon: 13, question: 'Wie breit ist ein Fußball?', value: 220, kind: 'laenge', tip: 'Etwas länger als ein Bleistift.' },
  { icon: 14, question: 'Wie schwer ist eine Katze?', value: 4000, kind: 'gewicht', tip: 'Etwa so schwer wie ein Schulranzen.' },
  { icon: 15, question: 'Wie groß ist ein Kind in der 5. Klasse?', value: 1400, kind: 'laenge', tip: 'Etwas kleiner als eine Tür.' },
];

/** Wert in einer passenden Einheit: 2000 mm → „2 m“, 150 g → „150 g“, 1 500 000 g → „1,5 t“. */
function nice(value: number, kind: Item['kind']): string {
  if (kind === 'laenge') {
    if (value < 10) return `${formatDecimal(value)} mm`;
    if (value < 1000) return `${formatDecimal(value / 10)} cm`;
    if (value < 1_000_000) return `${formatDecimal(value / 1000)} m`;
    return `${formatDecimal(value / 1_000_000)} km`;
  }
  if (value < 1000) return `${formatDecimal(value)} g`;
  if (value < 1_000_000) return `${formatDecimal(value / 1000)} kg`;
  return `${formatDecimal(value / 1_000_000)} t`;
}

export class EstimatePuzzle extends PuzzleScene {
  protected title = 'Das Schätzauge';
  protected skills: SkillId[] = ['M6'];

  private used = new Set<number>();

  constructor() {
    super('EstimatePuzzle');
  }

  preload(): void {
    this.load.spritesheet('estimate-icons', 'assets/icons/estimate.png', { frameWidth: 48, frameHeight: 48 });
  }

  protected buildRound(): void {
    // Anfangs die vertrauten Dinge, später auch die großen und kleinen Extreme
    const pool = ITEMS.filter((it) => !this.used.has(it.icon) && (getLevel('M6') > 0.3 || ![3, 6, 8, 10].includes(it.icon)));
    const item = (pool.length ? pool : ITEMS)[randInt(0, (pool.length ? pool : ITEMS).length - 1)];
    this.used.add(item.icon);
    const r = this.round;

    r.add(this.add.image(250, 250, 'estimate-icons', item.icon).setScale(4));
    r.add(text(this, GAME_WIDTH / 2, 92, item.question, 24, COLORS.text));

    const factors = Phaser.Utils.Array.Shuffle([0.01, 0.1, 10, 100]).slice(0, 3);
    const options = Phaser.Utils.Array.Shuffle([item.value, ...factors.map((f) => item.value * f)]);
    options.forEach((v, i) => {
      r.add(
        button(this, 690, 160 + i * 72, nice(v, item.kind), () => {
          if (v === item.value) this.solved(`Richtig, etwa ${nice(item.value, item.kind)}. ${item.tip}`);
          else this.wrong(`${nice(v, item.kind)} wäre ${v > item.value ? 'viel zu groß' : 'viel zu klein'}. ${item.tip}`);
        }, { width: 220, height: 58, size: 24 }),
      );
    });

    this.hints = [
      item.kind === 'laenge'
        ? 'Vergleiche mit Dingen, die du kennst: Ein Finger ist etwa 1 cm breit, eine Tür etwa 2 m hoch.'
        : 'Vergleiche mit Dingen, die du kennst: Eine Tafel Schokolade wiegt 100 g, eine Tüte Milch etwa 1 kg.',
      'Die Antworten unterscheiden sich um das Zehnfache. Welche passt ungefähr?',
      item.tip,
    ];
  }
}
