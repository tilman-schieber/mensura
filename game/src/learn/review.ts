import { loadSave, writeSave, getFlag } from '../save';
import { dueSkills, now, today } from './progress';
import type { SkillId } from './skills';

// Tagesaufgaben (wie Daily Quests): Die Geschichte schaltet einen Ort einmal frei,
// danach haben die Figuren dort jeden Tag etwas Neues zu tun.
//
// Jeden Tag bekommen bis zu DAILY_COUNT Figuren eine Bitte (blaues „!“). Die Aufgabe
// liegt an einer Station: Dort ist der Nebel zurückgekrochen (Schwaden und „≈“). Ist die
// Station gelöst, wartet die Figur auf die Abgabe (blaues „?“) und gibt Lichtfunken.
// Wer alle Aufgaben des Tages abgibt, bekommt einen Tagesbonus; Tage in Folge zählen mit.
//
// Welche Orte drankommen, entscheidet die verteilte Wiederholung: zuerst die Skills,
// die am längsten überfällig sind. Ist nichts fällig, füllt das Spiel mit anderen
// freigeschalteten Orten auf, damit es jeden Tag etwas zu tun gibt.
// Die Auswahl steht für den ganzen Tag fest, damit sie nicht beim Spielen springt.

export interface ReviewSpot {
  /** Szene und Rätsel, z. B. „Mine:RailPuzzle“ */
  id: string;
  /** wie der Ort heißt (für Pünktchens Überblick und das Menü) */
  place: string;
  skills: SkillId[];
  /** freigeschaltet, sobald die Geschichte an diesem Ort einmal durch ist */
  requires: string;
  /** wer um Hilfe bittet und wo man abgibt (Sprechername); ohne = sofort belohnt */
  giver?: string;
  /** die Bitte, mehrere Fassungen (abwechselnd nach Tag) */
  ask?: string[];
  /** Dank bei der Abgabe */
  thanks?: string;
}

const BROM = 'Vorarbeiter Brom';
const GRETE = 'Tüftlerin Grete';
const LUMEN = 'Hüterin Lumen';
const HANNA = 'Riesin Hanna';
const QUADRO = 'Baumeister Quadro';
const ELLE = 'Meisterin Elle';
const MIRA = 'Händlerin Mira';
const RUDOLF = 'Bürgermeister Rudolf';
const FLORA = 'Alchemistin Flora';
const HARALD = 'Schmied Harald';
const OWL = 'Eule Pünktchen';

export const SPOTS: ReviewSpot[] = [
  {
    id: 'Mine:OreCartPuzzle', place: 'bei den Erzloren im Stollen', skills: ['Z1'], requires: 'mine_outer_done', giver: BROM,
    ask: ['Heute Nacht ist Nebel in die Erzloren gekrochen. Jetzt liegen Hunderter, wo Zehner hingehören. Hilfst du beim Beladen?', 'Eine neue Lieferung Erz! Bündle sie richtig, zehn Zehner sind ein Hunderter, das weißt du ja.'],
    thanks: 'Siebzehn Loren, alle richtig beladen. Ich habe zweimal nachgezählt. Dreimal.',
  },
  {
    id: 'Mine:RailPuzzle', place: 'an der Lorenbahn im Stollen', skills: ['Z6'], requires: 'mine_outer_done', giver: BROM,
    ask: ['Die Lorenbahn spinnt wieder. Die Loren halten irgendwo, nur nicht an ihrer Zahl. Schaust du nach?', 'Neue Schienen, neue Skala! Kannst du die Loren an die richtige Stelle schieben?'],
    thanks: 'Jede Lore steht, wo sie soll. So mag ich meinen Stollen.',
  },
  {
    id: 'Mine:RoundingPuzzle', place: 'an den Haltestellen im Stollen', skills: ['Z18'], requires: 'mine_outer_done', giver: BROM,
    ask: ['An den Haltestellen streiten die Zwerge, wo eine Lore halten soll. Runden ist nicht ihre Stärke. Hilfst du?'],
    thanks: 'Kein Streit mehr an den Haltestellen. Fast. Zwerge streiten immer ein bisschen.',
  },
  {
    id: 'Mine:VaultPuzzle', place: 'an König Durins Tresor', skills: ['Z2'], requires: 'mine_outer_done', giver: BROM,
    ask: ['König Durin hat den Tresorcode geändert. Er will ihn dir selbst diktieren. Er liebt es, große Zahlen vorzulesen.'],
    thanks: 'Der König sagt, du hörst besser zu als sein ganzer Hofstaat.',
  },
  { id: 'Mine:CheatPuzzle', place: 'bei Pi-mal-Daumen im Stollen', skills: ['PLAUS'], requires: 'goblin_mine' },
  {
    id: 'MineDeep:ColumnPuzzle', place: 'am Rechenwerk', skills: ['Z12'], requires: 'deep_done', giver: GRETE,
    ask: ['Rosalinde, mein Rechenwerk, hat heute Morgen geklemmt. Ich glaube, sie vermisst dich. Schiebst du ein paar Überträge?'],
    thanks: 'Rosalinde schnurrt wieder. Ja, Rechenwerke können schnurren.',
  },
  {
    id: 'MineDeep:MultiplyPuzzle', place: 'an der Frachtwaage', skills: ['Z12'], requires: 'deep_done', giver: GRETE,
    ask: ['Eine große Ladung für die Frachtwaage! Ohne schriftliches Malnehmen kommen wir da nicht weiter.'],
    thanks: 'Gewogen und gerechnet. Die Träger wissen jetzt genau, was sie schleppen.',
  },
  {
    id: 'MineDeep:DividePuzzle', place: 'bei der Zwergenbeute', skills: ['Z12', 'Z21'], requires: 'deep_done', giver: GRETE,
    ask: ['Neue Beute, neuer Streit! Teilst du sie gerecht? Und mach die Probe, sonst glaubt es keiner.'],
    thanks: 'Gerecht geteilt und mit Probe. Niemand hat gemeckert. Das gab es noch nie.',
  },
  {
    id: 'MineDeep:TermPuzzle', place: 'an der Runentafel', skills: ['Z22', 'Z23', 'Z24', 'Z25'], requires: 'deep_done', giver: GRETE,
    ask: ['Auf der Runentafel sind die Klammern verrutscht. Bringst du die Rechenreihenfolge wieder in Ordnung?'],
    thanks: 'Klammer zuerst, dann Punkt, dann Strich. Die Runen leuchten wieder.',
  },
  {
    id: 'MineDeep:AutomatonPuzzle', place: 'am Zahlenautomaten', skills: ['Z27'], requires: 'deep_done', giver: GRETE,
    ask: ['Der Zahlenautomat am alten Tor rattert wieder. Er will wissen, mit welcher Zahl er angefangen hat. Rechnest du rückwärts?'],
    thanks: 'Rückwärts gerechnet und richtig! Der Automat ist zufrieden, und der Wächter dahinter schläft weiter.',
  },
  {
    id: 'Village:FogBattleScene', place: 'mitten in Eichstadt', skills: ['Z11'], requires: 'elle_splitter', giver: OWL,
    ask: ['Huhu! Ein Nebelfetzen ist ins Dorf zurückgekrochen, unten am Weg. Vertreibst du ihn mit Kopfrechnen?'],
    thanks: 'Weg ist er! Schnell gerechnet ist halb gewonnen, sage ich immer.',
  },
  {
    id: 'Village:MarketPuzzle', place: 'am Marktstand', skills: ['Z11', 'M5G'], requires: 'market_done', giver: MIRA,
    ask: ['Heute ist Markttag, und meine Kasse ist voller Kunden! Hilfst du mir beim Wechselgeld?', 'Die Leute wollen wissen, ob ihr Geld reicht. Stell dich doch kurz an meinen Stand!'],
    thanks: 'Alles stimmt auf den Cent genau. Hier, ein kleiner Lohn für dich!',
  },
  {
    id: 'Village:SurveyPuzzle', place: 'bei der Umfrage im Rathaus', skills: ['D1', 'D3', 'D4', 'D5'], requires: 'survey_done', giver: RUDOLF,
    ask: ['Vagor hat ein neues Plakat aufgehängt! Wir halten mit einer ehrlichen Umfrage dagegen. Zählst du mit?'],
    thanks: 'Eine ehrliche Umfrage, sauber gezählt. Vagors Plakat sieht daneben ganz schön alt aus.',
  },
  {
    id: 'Village:MapTablePuzzle', place: 'am Kartentisch', skills: ['R12'], requires: 'map_done', giver: ELLE,
    ask: ['Der Nebel hat ein paar Orte auf meiner Karte verwischt. Trägst du sie neu ein?'],
    thanks: 'Eine saubere Karte. Wer seine Welt vermisst, verirrt sich nicht.',
  },
  {
    id: 'Village:RomanPuzzle', place: 'an der Tafel der Alten', skills: ['Z1S'], requires: 'ruin_open', giver: OWL,
    ask: ['Huhu! Auf der Tafel der Alten sind neue Zeichen aufgetaucht. Kannst du sie lesen?'],
    thanks: 'Die Alten wären stolz auf dich. Ich bin es jedenfalls.',
  },
  {
    id: 'Village:BinaryPuzzle', place: 'an den Leuchtsteinen der Alten', skills: ['Z1S'], requires: 'ruin_open', giver: OWL,
    ask: ['Huhu! Die Leuchtsteine an der Ruine flackern. Bringst du sie zum Leuchten, eins, zwei, vier, acht?'],
    thanks: 'Die Steine leuchten wieder. Zweiersystem, ganz einfach, wenn man es kann.',
  },
  {
    id: 'Temple:MirrorWallPuzzle', place: 'an der Spiegelwand', skills: ['R13', 'R4'], requires: 'temple_done', giver: LUMEN,
    ask: ['Die Spiegelwand ist trüb geworden. Ergänzt du die Bilder? Links wie rechts, oben wie unten.'],
    thanks: 'Klar ist das Bild, und das Bild ist klar.',
  },
  {
    id: 'Temple:SymmetryPuzzle', place: 'am Siegel der Symmetrie', skills: ['R4'], requires: 'temple_done', giver: LUMEN,
    ask: ['Die Siegel haben ihre Achsen vergessen. Zählst du sie für mich?'],
    thanks: 'Ordnung, die man sieht. Sieht man sie, ist Ordnung.',
  },
  {
    id: 'Temple:QuadPuzzle', place: 'im Haus der Vierecke', skills: ['R6'], requires: 'temple_done', giver: LUMEN,
    ask: ['Im Haus der Vierecke passen die Schlüssel nicht mehr. Welches Viereck ist welches?'],
    thanks: 'Jedes Viereck an seinem Platz, und jeder Platz hat sein Viereck.',
  },
  {
    id: 'Temple:CoordinatePuzzle', place: 'an der Sternenkarte', skills: ['R12'], requires: 'temple_done', giver: LUMEN,
    ask: ['Heute Nacht sind Sterne von der Karte gefallen. Setzt du sie zurück an ihre Koordinaten?'],
    thanks: 'Die Sterne stehen richtig. Erst nach rechts, dann nach oben, so ist es.',
  },
  {
    id: 'Temple:LightBridgePuzzle', place: 'am Prisma im Tempel', skills: ['R1'], requires: 'temple_done', giver: LUMEN,
    ask: ['Das Prisma wirft schiefe Lichtbrücken. Machst du sie wieder parallel und senkrecht?'],
    thanks: 'Gerade Brücken aus Licht. Licht aus geraden Brücken.',
  },
  { id: 'Temple:CheatPuzzle', place: 'bei Pi-mal-Daumen im Tempel', skills: ['PLAUS'], requires: 'goblin_temple' },
  {
    id: 'Valley:LengthPuzzle', place: 'an Hannas Stiefel', skills: ['M5'], requires: 'valley_done', giver: HANNA,
    ask: ['Ich hab neue Stiefel bestellt, aber der Schuster schreibt alles in Millimetern! Rechnest du mir das um?'],
    thanks: 'Sie passen! Genau richtig für eine Elfjährige wie mich.',
  },
  {
    id: 'Valley:ScalePuzzle', place: 'an der Riesenwaage', skills: ['M5M'], requires: 'valley_done', giver: FLORA,
    ask: ['Für meinen Heiltrank brauche ich ganz genaue Mengen. Wiegst du sie mir auf der Riesenwaage im Riesental ab?'],
    thanks: 'Genau abgewogen! Diesmal explodiert bestimmt nichts. Ziemlich bestimmt.',
  },
  {
    id: 'Valley:EstimatePuzzle', place: 'am Aussichtspilz', skills: ['M6'], requires: 'valley_done', giver: HANNA,
    ask: ['Vom Aussichtspilz sieht man heute so weit! Schätzt du mit mir, wie groß die Dinge da unten sind?'],
    thanks: 'Gut geschätzt! Für mich ist ja alles klein, da verschätze ich mich dauernd.',
  },
  {
    id: 'Valley:FerryPuzzle', place: 'an der Fährenuhr', skills: ['M5Z'], requires: 'valley_done', giver: HANNA,
    ask: ['Die Fährenuhr geht wieder falsch, und alle verpassen die Fähre. Rechnest du die Zeiten aus?'],
    thanks: 'Alle haben die Fähre erwischt. Sogar Tupfi, und der ist sonst immer zu spät.',
  },
  { id: 'Valley:CheatPuzzle', place: 'bei Pi-mal-Daumen im Riesental', skills: ['PLAUS'], requires: 'goblin_valley' },
  {
    id: 'Fortress:TilePuzzle', place: 'in der Fliesenhalle', skills: ['M13', 'M9'], requires: 'fort_done', giver: QUADRO,
    ask: ['In der Fliesenhalle sind über Nacht Fliesen verrutscht. Ich kann so nicht schlafen. Hilfst du?'],
    thanks: 'Jede Fliese gerade. Ich schlafe heute Nacht wie ein Stein. Ein gerader Stein.',
  },
  {
    id: 'Fortress:NetPuzzle', place: 'beim Faltstab', skills: ['R14'], requires: 'fort_done', giver: QUADRO,
    ask: ['Eine Kiste voller Würfelnetze ist angekommen, und die Hälfte davon faltet sich zu nichts. Sortierst du?'],
    thanks: 'Nur echte Würfelnetze. Elf gibt es, nicht mehr und nicht weniger.',
  },
  {
    id: 'Fortress:VolumePuzzle', place: 'im Würfellager', skills: ['M15'], requires: 'fort_done', giver: QUADRO,
    ask: ['Im Würfellager stimmt die Inventur nicht. Wie viele Würfel sind es wirklich?'],
    thanks: 'Inventur gemacht, auf den Würfel genau.',
  },
  {
    id: 'Fortress:PaintPuzzle', place: 'in der Malerwerkstatt', skills: ['M15O'], requires: 'fort_done', giver: HARALD,
    ask: ['Quadro will neue Kisten angemalt haben, und ich soll die Farbe besorgen. Rechnest du in seiner Malerwerkstatt aus, wie viel?'],
    thanks: 'Genau so viel Farbe, wie gebraucht wird. Zweimal messen, einmal streichen!',
  },
  { id: 'Fortress:CheatPuzzle', place: 'bei Pi-mal-Daumen in der Festung', skills: ['PLAUS'], requires: 'goblin_fort' },
];

/** So viele Tagesaufgaben gibt es höchstens: eine kurze Runde, keine Pflichtliste */
export const DAILY_COUNT = 3;
/** Lichtfunken bei der Abgabe (oder sofort, wenn niemand darum gebeten hat) */
export const SPOT_REWARD = 5;
/** Tagesbonus, wenn alles abgegeben ist */
export const DAY_BONUS = 5;

export const spotById = (id: string) => SPOTS.find((s) => s.id === id);
const ALL_SKILLS = [...new Set(SPOTS.flatMap((s) => s.skills))];

export interface DailyState {
  day: string;
  spots: string[];
  cleared: string[];
  turnedIn: string[];
  told: boolean;
  /** Tagesbonus schon vergeben */
  bonus: boolean;
  /** Tage in Folge mit allen Aufgaben erledigt, und der letzte solche Tag */
  streak: number;
  lastFullDay: string;
}

function dayIndex(): number {
  return Math.floor(now() / 86_400_000);
}

/** kleiner, fester Zufall pro Tag (gleicher Tag = gleiche Auswahl) */
function seeded(n: number): number {
  const x = Math.sin(dayIndex() * 9301 + n * 49297) * 233280;
  return x - Math.floor(x);
}

/** Freigeschaltet: die Geschichte ist an diesem Ort durch (und die Station kennt man) */
function unlocked(s: ReviewSpot): boolean {
  return getFlag(s.requires);
}

/** Die Aufgaben für heute: zuerst fällige Skills, dann auffüllen. */
function plan(): string[] {
  const chosen: string[] = [];
  const free = SPOTS.filter(unlocked);
  const takenSkill = (skill: SkillId) => chosen.some((id) => spotById(id)!.skills.includes(skill));
  for (const skill of dueSkills(ALL_SKILLS)) {
    if (chosen.length >= DAILY_COUNT) break;
    if (takenSkill(skill)) continue;
    const options = free.filter((s) => s.skills.includes(skill) && !chosen.includes(s.id));
    if (options.length) chosen.push(options[dayIndex() % options.length].id);
  }
  // Auffüllen: jeden Tag andere Orte, möglichst bei verschiedenen Figuren
  const rest = free
    .filter((s) => !chosen.includes(s.id))
    .map((s, i) => ({ s, r: seeded(i) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.s);
  const givers = () => chosen.map((id) => spotById(id)!.giver);
  for (const s of rest) {
    if (chosen.length >= DAILY_COUNT) break;
    if (s.giver && givers().includes(s.giver)) continue;
    chosen.push(s.id);
  }
  for (const s of rest) {
    if (chosen.length >= DAILY_COUNT) break;
    if (!chosen.includes(s.id)) chosen.push(s.id);
  }
  return chosen;
}

function yesterday(): string {
  return today(now() - 86_400_000);
}

/** Plan für heute (wird beim ersten Aufruf des Tages angelegt). */
export function todaysReview(): DailyState {
  const save = loadSave();
  const day = today();
  const old = save.review as Partial<DailyState> | null;
  const stale = !old || old.day !== day;
  // Neu freigeschaltete Orte noch am selben Tag einplanen, solange heute nichts geplant war
  const empty = !stale && (old?.spots?.length ?? 0) === 0 && SPOTS.some(unlocked);
  if (stale || empty) {
    const streak = old?.lastFullDay === yesterday() || old?.lastFullDay === day ? (old?.streak ?? 0) : 0;
    save.review = { day, spots: plan(), cleared: [], turnedIn: [], told: false, bonus: false, streak, lastFullDay: old?.lastFullDay ?? '' };
    writeSave(save);
  }
  const r = save.review as DailyState;
  // ältere Spielstände
  r.turnedIn ??= [];
  r.bonus ??= false;
  r.streak ??= 0;
  r.lastFullDay ??= '';
  return r;
}

function store(r: DailyState): void {
  const save = loadSave();
  save.review = r;
  writeSave(save);
}

/** Orte, an denen heute noch Nebel liegt */
export function pendingSpots(): ReviewSpot[] {
  const r = todaysReview();
  return r.spots.filter((id) => !r.cleared.includes(id)).map((id) => spotById(id)!).filter(Boolean);
}

export function isPending(spotId: string): boolean {
  return pendingSpots().some((s) => s.id === spotId);
}

/** Tagesaufgaben einer Figur: was sie heute erbittet und was abzugeben ist */
export function giverState(giver: string): { ask?: ReviewSpot; turnIn?: ReviewSpot } {
  const r = todaysReview();
  const mine = r.spots.map((id) => spotById(id)!).filter((s) => s?.giver === giver && !r.turnedIn.includes(s.id));
  return {
    turnIn: mine.find((s) => r.cleared.includes(s.id)),
    ask: mine.find((s) => !r.cleared.includes(s.id) && !wasAsked(s.id)),
  };
}

/** Text der Bitte für heute (abwechselnd nach Tag) */
export function askText(s: ReviewSpot): string {
  const asks = s.ask ?? [];
  return asks[dayIndex() % Math.max(1, asks.length)] ?? '';
}

/** Hat die Figur heute schon gefragt? (Merker, damit das „!“ nach dem Gespräch verschwindet) */
export function wasAsked(spotId: string): boolean {
  return !!loadSave().flags[`asked_${todaysReview().day}_${spotId}`];
}

export function markAsked(spotId: string): void {
  const save = loadSave();
  // nur die Merker von heute behalten
  for (const k of Object.keys(save.flags)) if (k.startsWith('asked_') && !k.startsWith(`asked_${todaysReview().day}_`)) delete save.flags[k];
  save.flags[`asked_${todaysReview().day}_${spotId}`] = true;
  writeSave(save);
}

/**
 * Station gelöst: Nebel weg. Ohne Auftraggeber gibt es die Funken gleich,
 * sonst bei der Abgabe. Gibt zurück, wie viele Funken es sofort gab.
 */
export function clearSpot(spotId: string): number {
  const r = todaysReview();
  if (!r.spots.includes(spotId) || r.cleared.includes(spotId)) return 0;
  r.cleared.push(spotId);
  const spot = spotById(spotId);
  let gained = 0;
  if (!spot?.giver) {
    r.turnedIn.push(spotId);
    gained = SPOT_REWARD + dayBonus(r);
  }
  store(r);
  if (gained) addFunken(gained);
  return gained;
}

/** Bei der Figur abgeben: Funken, und vielleicht der Tagesbonus. */
export function turnIn(spotId: string): { funken: number; bonus: boolean; streak: number } {
  const r = todaysReview();
  if (!r.cleared.includes(spotId) || r.turnedIn.includes(spotId)) return { funken: 0, bonus: false, streak: r.streak };
  r.turnedIn.push(spotId);
  const bonus = dayBonus(r);
  store(r);
  addFunken(SPOT_REWARD + bonus);
  return { funken: SPOT_REWARD + bonus, bonus: bonus > 0, streak: r.streak };
}

/** Alles abgegeben? Dann Tagesbonus und Tage in Folge (verändert r) */
function dayBonus(r: DailyState): number {
  if (r.bonus || r.turnedIn.length < r.spots.length) return 0;
  r.bonus = true;
  r.streak = r.lastFullDay === yesterday() ? r.streak + 1 : 1;
  r.lastFullDay = r.day;
  return DAY_BONUS;
}

/** Pünktchen hat den Überblick für heute schon erzählt */
export function markTold(): void {
  const r = todaysReview();
  r.told = true;
  store(r);
}

// ---------- Lichtfunken ----------

export function funken(): number {
  return loadSave().funken ?? 0;
}

export function addFunken(n: number): void {
  const save = loadSave();
  save.funken = Math.max(0, (save.funken ?? 0) + n);
  writeSave(save);
}

/** Bezahlen; false, wenn es nicht reicht */
export function spendFunken(n: number): boolean {
  const save = loadSave();
  if ((save.funken ?? 0) < n) return false;
  save.funken -= n;
  writeSave(save);
  return true;
}
