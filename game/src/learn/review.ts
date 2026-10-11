import { loadSave, writeSave, getFlag } from '../save';
import { dueSkills, now, today } from './progress';
import type { SkillId } from './skills';

// Der Nebel kriecht zurück: verteilte Wiederholung in der Spielwelt.
//
// Jeden Tag sucht das Spiel die Skills heraus, die am längsten überfällig sind, und
// schickt an bis zu drei Orte, an denen man sie geübt hat, ein wenig Nebel zurück.
// Dort schwebt dann ein „≈“ (das Zeichen für „ungefähr“). Wer die Station löst,
// vertreibt den Nebel und bekommt Lichtfunken; damit baut man Eichstadt aus.
// Die Auswahl steht für den ganzen Tag fest, damit sie nicht beim Spielen springt.

export interface ReviewSpot {
  /** Szene und Rätsel, z. B. „Mine:RailPuzzle“ */
  id: string;
  /** wie der Ort heißt (für Pünktchens Überblick) */
  place: string;
  skills: SkillId[];
  /** erst wenn man die Station schon einmal geschafft hat */
  requires: string;
}

export const SPOTS: ReviewSpot[] = [
  { id: 'Mine:OreCartPuzzle', place: 'bei den Erzloren im Stollen', skills: ['Z1'], requires: 'mine_ore' },
  { id: 'Mine:RailPuzzle', place: 'an der Lorenbahn im Stollen', skills: ['Z6'], requires: 'mine_rail' },
  { id: 'Mine:RoundingPuzzle', place: 'an den Haltestellen im Stollen', skills: ['Z18'], requires: 'mine_round' },
  { id: 'Mine:VaultPuzzle', place: 'an König Durins Tresor', skills: ['Z2'], requires: 'mine_outer_done' },
  { id: 'Mine:CheatPuzzle', place: 'bei Pi-mal-Daumen im Stollen', skills: ['PLAUS'], requires: 'goblin_mine' },
  { id: 'MineDeep:ColumnPuzzle', place: 'am Rechenwerk', skills: ['Z12'], requires: 'deep_column' },
  { id: 'MineDeep:MultiplyPuzzle', place: 'an der Frachtwaage', skills: ['Z12'], requires: 'deep_multiply' },
  { id: 'MineDeep:DividePuzzle', place: 'bei der Zwergenbeute', skills: ['Z12', 'Z21'], requires: 'deep_divide' },
  { id: 'MineDeep:TermPuzzle', place: 'an der Runentafel', skills: ['Z22', 'Z23', 'Z24', 'Z25'], requires: 'deep_terms' },
  { id: 'MineDeep:AutomatonPuzzle', place: 'am Zahlenautomaten', skills: ['Z27'], requires: 'deep_done' },
  { id: 'Village:FogBattleScene', place: 'mitten in Eichstadt', skills: ['Z11'], requires: 'elle_intro' },
  { id: 'Village:MarketPuzzle', place: 'an Miras Marktstand', skills: ['Z11', 'M5G'], requires: 'market_done' },
  { id: 'Village:SurveyPuzzle', place: 'bei Bürgermeister Rudolf', skills: ['D1', 'D3', 'D4', 'D5'], requires: 'survey_done' },
  { id: 'Village:MapTablePuzzle', place: 'an Elles Kartentisch', skills: ['R12'], requires: 'map_done' },
  { id: 'Village:RomanPuzzle', place: 'an der Tafel der Alten', skills: ['Z1S'], requires: 'ruin_roman' },
  { id: 'Village:BinaryPuzzle', place: 'an den Leuchtsteinen der Alten', skills: ['Z1S'], requires: 'ruin_binary' },
  { id: 'Temple:MirrorWallPuzzle', place: 'an der Spiegelwand', skills: ['R13', 'R4'], requires: 'temple_wall' },
  { id: 'Temple:SymmetryPuzzle', place: 'am Siegel der Symmetrie', skills: ['R4'], requires: 'temple_seal' },
  { id: 'Temple:QuadPuzzle', place: 'im Haus der Vierecke', skills: ['R6'], requires: 'temple_quad' },
  { id: 'Temple:CoordinatePuzzle', place: 'an der Sternenkarte', skills: ['R12'], requires: 'temple_star' },
  { id: 'Temple:LightBridgePuzzle', place: 'am Prisma im Tempel', skills: ['R1'], requires: 'temple_light' },
  { id: 'Temple:CheatPuzzle', place: 'bei Pi-mal-Daumen im Tempel', skills: ['PLAUS'], requires: 'goblin_temple' },
  { id: 'Valley:LengthPuzzle', place: 'an Hannas Stiefel', skills: ['M5'], requires: 'valley_len' },
  { id: 'Valley:ScalePuzzle', place: 'an der Riesenwaage', skills: ['M5M'], requires: 'valley_scale' },
  { id: 'Valley:EstimatePuzzle', place: 'am Aussichtspilz', skills: ['M6'], requires: 'valley_est' },
  { id: 'Valley:FerryPuzzle', place: 'an der Fährenuhr', skills: ['M5Z'], requires: 'valley_ferry' },
  { id: 'Valley:CheatPuzzle', place: 'bei Pi-mal-Daumen im Riesental', skills: ['PLAUS'], requires: 'goblin_valley' },
  { id: 'Fortress:TilePuzzle', place: 'in der Fliesenhalle', skills: ['M13', 'M9'], requires: 'fort_tiles' },
  { id: 'Fortress:NetPuzzle', place: 'beim Faltstab', skills: ['R14'], requires: 'fort_nets' },
  { id: 'Fortress:VolumePuzzle', place: 'im Würfellager', skills: ['M15'], requires: 'fort_volume' },
  { id: 'Fortress:PaintPuzzle', place: 'in der Malerwerkstatt', skills: ['M15O'], requires: 'fort_paint' },
  { id: 'Fortress:CheatPuzzle', place: 'bei Pi-mal-Daumen in der Festung', skills: ['PLAUS'], requires: 'goblin_fort' },
];

/** Höchstens so viele Orte pro Tag: eine kurze Runde, keine Pflichtliste */
export const MAX_SPOTS = 3;
/** Lichtfunken für einen vertriebenen Nebel */
export const SPOT_REWARD = 5;

const spotById = (id: string) => SPOTS.find((s) => s.id === id);
const ALL_SKILLS = [...new Set(SPOTS.flatMap((s) => s.skills))];

/** Tageszahl seit 1970, damit sich geteilte Skills (Z12 an drei Stationen) abwechseln */
function dayIndex(): number {
  return Math.floor(now() / 86_400_000);
}

/** Die Orte für heute auswählen: für jeden fälligen Skill einer, an dem er geübt wurde. */
function plan(): string[] {
  const chosen: string[] = [];
  for (const skill of dueSkills(ALL_SKILLS)) {
    if (chosen.length >= MAX_SPOTS) break;
    if (chosen.some((id) => spotById(id)!.skills.includes(skill))) continue;
    const options = SPOTS.filter((s) => s.skills.includes(skill) && getFlag(s.requires) && !chosen.includes(s.id));
    if (!options.length) continue;
    chosen.push(options[dayIndex() % options.length].id);
  }
  return chosen;
}

let lastEmptyPlan = 0;

/** Plan für heute (wird beim ersten Aufruf des Tages angelegt). */
export function todaysReview(): NonNullable<ReturnType<typeof loadSave>['review']> {
  const save = loadSave();
  const day = today();
  const stale = !save.review || save.review.day !== day;
  // War heute noch nichts fällig, ab und zu nachsehen (etwa nachdem man etwas falsch hatte)
  const retry = save.review?.spots.length === 0 && now() - lastEmptyPlan > 60_000;
  if (stale || retry) {
    const spots = plan();
    if (!spots.length) lastEmptyPlan = now();
    save.review = { day, spots, cleared: [], told: false };
    writeSave(save);
  }
  return save.review!;
}

/** Orte, an denen heute noch Nebel liegt */
export function pendingSpots(): ReviewSpot[] {
  const r = todaysReview();
  return r.spots.filter((id) => !r.cleared.includes(id)).map((id) => spotById(id)!).filter(Boolean);
}

export function isPending(spotId: string): boolean {
  return pendingSpots().some((s) => s.id === spotId);
}

/** Nebel an einem Ort vertrieben: merken und Lichtfunken gutschreiben. */
export function clearSpot(spotId: string): void {
  const save = loadSave();
  const r = todaysReview();
  if (!r.spots.includes(spotId) || r.cleared.includes(spotId)) return;
  r.cleared.push(spotId);
  save.review = r;
  save.funken = (save.funken ?? 0) + SPOT_REWARD;
  writeSave(save);
}

/** Pünktchen hat den Überblick für heute schon erzählt */
export function markTold(): void {
  const save = loadSave();
  const r = todaysReview();
  r.told = true;
  save.review = r;
  writeSave(save);
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
