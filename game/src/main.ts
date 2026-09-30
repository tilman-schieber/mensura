import Phaser from 'phaser';
import { preloadAvatarSheets } from './avatar/avatar';
import { setRecordedLines } from './ui/dialogVoice';
import { AvatarScene } from './scenes/AvatarScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { PrologueScene } from './scenes/PrologueScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SlotScene } from './scenes/SlotScene';
import { TitleScene } from './scenes/TitleScene';
import { MineScene } from './world/MineScene';
import { VillageScene } from './world/VillageScene';
import { TempleScene } from './world/TempleScene';
import { ValleyScene } from './world/ValleyScene';
import { FortressScene } from './world/FortressScene';
import { OreCartPuzzle } from './puzzles/OreCartPuzzle';
import { RailPuzzle } from './puzzles/RailPuzzle';
import { RoundingPuzzle } from './puzzles/RoundingPuzzle';
import { VaultPuzzle } from './puzzles/VaultPuzzle';
import { ColossusScene } from './puzzles/ColossusScene';
import { RomanPuzzle } from './puzzles/RomanPuzzle';
import { BinaryPuzzle } from './puzzles/BinaryPuzzle';
import { FogBattleScene } from './puzzles/FogBattleScene';
import { MirrorWallPuzzle } from './puzzles/MirrorWallPuzzle';
import { SymmetryPuzzle } from './puzzles/SymmetryPuzzle';
import { QuadPuzzle } from './puzzles/QuadPuzzle';
import { CoordinatePuzzle } from './puzzles/CoordinatePuzzle';
import { DoppelgangerScene } from './puzzles/DoppelgangerScene';
import { LengthPuzzle } from './puzzles/LengthPuzzle';
import { ScalePuzzle } from './puzzles/ScalePuzzle';
import { EstimatePuzzle } from './puzzles/EstimatePuzzle';
import { FerryPuzzle } from './puzzles/FerryPuzzle';
import { BeetleScene } from './puzzles/BeetleScene';
import { TilePuzzle } from './puzzles/TilePuzzle';
import { NetPuzzle } from './puzzles/NetPuzzle';
import { VolumePuzzle } from './puzzles/VolumePuzzle';
import { PaintPuzzle } from './puzzles/PaintPuzzle';
import { KubusScene } from './puzzles/KubusScene';
import { CheatPuzzle } from './puzzles/CheatPuzzle';
import { ColumnPuzzle } from './puzzles/ColumnPuzzle';
import { MultiplyPuzzle } from './puzzles/MultiplyPuzzle';
import { DividePuzzle } from './puzzles/DividePuzzle';
import { TermPuzzle } from './puzzles/TermPuzzle';
import { AutomatonPuzzle } from './puzzles/AutomatonPuzzle';
import { MineDeepScene } from './world/MineDeepScene';
import { SurveyPuzzle } from './puzzles/SurveyPuzzle';
import { MarketPuzzle } from './puzzles/MarketPuzzle';
import { LightBridgePuzzle } from './puzzles/LightBridgePuzzle';
import { MapTablePuzzle } from './puzzles/MapTablePuzzle';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, text } from './ui/theme';
import { music } from './audio/music';
import './audio/songs';

class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    text(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Der Nebel lichtet sich …', 24, COLORS.goldText);
    preloadAvatarSheets(this);
    // von mehreren Szenen und Rätseln genutzt
    this.load.image('mine-cart', 'assets/objects/mine-cart.png');
    this.load.image('splitter', 'assets/objects/splitter.png');
    this.load.image('owl', 'assets/objects/owl.png');
    this.load.image('messbuch-page', 'assets/objects/messbuch-page.png');
    this.load.image('treasure', 'assets/objects/treasure.png');
    this.load.spritesheet('npc-pimal', 'assets/npcs/pimal.png', { frameWidth: 68, frameHeight: 68 });
    this.load.json('dialog-voice-index', 'assets/audio/dialog/index.json');
  }

  create(): void {
    setRecordedLines(this.cache.json.get('dialog-voice-index'));
    // Entwickler-Einstieg: ?puzzle=OreCartPuzzle startet ein Rätsel direkt
    const puzzle = new URLSearchParams(location.search).get('puzzle');
    if (import.meta.env.DEV && puzzle && this.scene.get(puzzle)) {
      this.scene.start(puzzle, { rounds: 99 });
      return;
    }
    this.scene.start('Title');
  }
}

const TEST_MODE = import.meta.env.DEV && new URLSearchParams(location.search).has('test');

async function start() {
  // Schrift laden, bevor Phaser Texte rendert
  try {
    await Promise.all([document.fonts.load('24px Andika'), document.fonts.load('bold 24px Andika'), document.fonts.load('600 24px Cinzel')]);
  } catch {
    // Fallback-Schrift reicht
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS.night,
    pixelArt: true,
    dom: { createContainer: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    // Im Testmodus (?test) läuft die Spielschleife per Timer, damit sie auch in einem
    // unsichtbaren Browser-Tab weiterläuft (requestAnimationFrame pausiert dort).
    // smoothStep aus: die echte verstrichene Zeit zählt, auch wenn der Tab gedrosselt wird.
    fps: TEST_MODE ? { forceSetTimeOut: true, smoothStep: false } : {},
    scene: [BootScene, TitleScene, SlotScene, SettingsScene, PrologueScene, AvatarScene, VillageScene, MineScene, MineDeepScene, TempleScene, ValleyScene, FortressScene, HudScene, MenuScene, OreCartPuzzle, RailPuzzle, RoundingPuzzle, VaultPuzzle, ColossusScene, RomanPuzzle, BinaryPuzzle, FogBattleScene,
      MirrorWallPuzzle, SymmetryPuzzle, QuadPuzzle, CoordinatePuzzle, DoppelgangerScene,
      LengthPuzzle, ScalePuzzle, EstimatePuzzle, FerryPuzzle, BeetleScene,
      TilePuzzle, NetPuzzle, VolumePuzzle, PaintPuzzle, KubusScene, CheatPuzzle,
      ColumnPuzzle, MultiplyPuzzle, DividePuzzle, TermPuzzle, AutomatonPuzzle,
      SurveyPuzzle, MarketPuzzle, LightBridgePuzzle, MapTablePuzzle],
  });
  // Zum Debuggen im Browser-Terminal erreichbar (nur im Entwicklungsmodus)
  if (import.meta.env.DEV) Object.assign(window, { game, music });
}

// Browser spielen erst nach der ersten Berührung Ton ab
const unlock = () => music.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

start();
