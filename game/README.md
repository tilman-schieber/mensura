# Mensura – Die sieben Urmaße (Spiel)

Web-Spiel zum [Spielkonzept](../konzept/spielkonzept.md). TypeScript + Phaser 4 + Vite.

## Starten

Voraussetzung: Node.js 20.19 oder neuer (getestet mit Node 22).

```sh
npm install
npm run dev        # Entwicklungsserver (mit --host, also auch vom Tablet im WLAN erreichbar)
npm run build      # Typprüfung + Produktions-Build nach dist/
```

Entwickler-Einstiege (nur im Entwicklungsmodus):

- `?puzzle=OreCartPuzzle` (oder `RailPuzzle`, `RoundingPuzzle`, `VaultPuzzle`, `ColossusScene`, `RomanPuzzle`, `BinaryPuzzle`, `FogBattleScene`, `MirrorWallPuzzle`, `SymmetryPuzzle`, `QuadPuzzle`, `CoordinatePuzzle`, `DoppelgangerScene`, `LengthPuzzle`, `ScalePuzzle`, `EstimatePuzzle`, `FerryPuzzle`, `BeetleScene`, `TilePuzzle`, `NetPuzzle`, `VolumePuzzle`, `PaintPuzzle`, `KubusScene`) startet ein Rätsel direkt, endlos viele Runden
- `?test` lässt die Spielschleife auch in einem unsichtbaren Browser-Tab laufen (für automatisierte Tests)
- `window.game` ist die Phaser-Instanz

## Stand

Erster spielbarer Ausschnitt für Klasse 5, Herbst (Bildungsplan 3.1.1: Dezimalsystem, große Zahlen,
Zahlenstrahl, Runden):

1. **Avatar-Editor**: Frisur, Haarfarbe, Kleidung, Kleidungsfarbe, Name
2. **Eichstadt**: Meisterin Elle schickt die Spielfigur zur Mine
3. **Stellenstollen, äußere Ebene**: Vorarbeiter Brom und drei Stationen
   - **Erzloren** (Z1): Stellenwert-Blöcke laden; später bündeln und mit dem Spalthammer entbündeln
   - **Lorenbahn** (Z6): Lore an eine Zahl schieben oder ablesen, Skalen von 0–100 bis 0–1 000 000
   - **Haltestellen** (Z18): Runden auf Zehner bis Zehntausender, erst mit Bild, später ohne
4. **Der Erzkoloss** (Endgegner, `src/puzzles/ColossusScene.ts`): erscheint nach den drei Stationen.
   Drei Phasen ohne Zeitdruck: Rüstungsplatten (Stellenwert einer Ziffer), Felsbrocken (Runden),
   Stampfen (sichere Stelle am Zahlenstrahl). 3 Herzen; ohne Herzen beginnt nur die Phase neu.
5. **Tresor von König Durin** (Z2): Zahlen-Diktat mit eigenen Sprachaufnahmen, bis in die Billionen
6. Zurück zu Elle mit dem ersten Splitter, „Fortsetzung folgt“

**Nebenaufgabe Ruine der Alten** (Eichstadt, Westweg; Z1: anderes Zahlsystem):
- **Tafel der Alten** (`RomanPuzzle`): römische Zahlen lesen und meißeln, bis 20 → 100 → 3 999
- **Leuchtsteine** (`BinaryPuzzle`): Zweiersystem mit Steinen 1, 2, 4, 8 …, erst mit, dann ohne Wertangabe
- Sind beide gelöst, erzählt die Stimme der Alten, wie das Urmaß der Zahl entstand.

**Nebelwesen** (Eichstadt, Ostweg; Z11 Kopfrechnen, `FogBattleScene`): Kommt man ihnen nahe,
beginnt ein kurzer Kampf. Jede Aufgabe hat vier Antworten, die falschen sind typische Fehler.
Zeitdruck ist im Menü abschaltbar. Besiegte Wesen kehren beim nächsten Betreten des Dorfs zurück.

**Spiegeltempel** (Klasse 5, Frühjahr; Südweg aus Eichstadt, `TempleScene`): öffnet sich erst, wenn das
Schulthema „Figuren, Symmetrie, Koordinaten“ abgehakt ist (sonst Nebel). Hüterin Lumen, vier Spiegel:
- **Spiegelwand** (`MirrorWallPuzzle`, R13): Spiegelbild auf dem Raster ergänzen; Achse senkrecht → waagerecht → schräg
- **Siegel der Symmetrie** (`SymmetryPuzzle`, R4): Achsen zählen, symmetrische Figuren finden, Punktsymmetrie
- **Haus der Vierecke** (`QuadPuzzle`, R6): benennen, Eigenschaften, Schlüssel/Schloss nach der Viereck-Hierarchie
- **Sternenkarte** (`CoordinatePuzzle`, R12): Punkte setzen/ablesen (mit Tauschfehler als Ablenker), Achsen in 2er/5er-Schritten, Viereck aus Punkten
- **Endgegner Spiegel-Doppelgänger** (`DoppelgangerScene`, R13): Spiegelbild vorhersagen, senkrechte/waagerechte Achse, Punktspiegelung
- Belohnung: Splitter der Form

**Riesental** (Klasse 5, Sommer; Nordweg aus Eichstadt, `ValleyScene`): öffnet sich mit dem Schulthema
„Größen und Einheiten“. Riesin Hanna (dreifache Größe), vier Stationen:
- **Skalenkappe** (`LengthPuzzle`, M5): Längen umrechnen, mm bis km, später Kommazahlen und gemischte Angaben; Einheitentreppe als Hinweis
- **Riesenwaage** (`ScalePuzzle`, M5M): Gewichtsstücke auflegen, bis die Waage im Gleichgewicht ist; g → kg → t
- **Schätzauge** (`EstimatePuzzle`, M6): Größenordnung schätzen (16 Alltagsdinge, Symbole in `public/assets/icons/estimate.png`)
- **Fährenuhr** (`FerryPuzzle`, M5Z): Wartezeiten und Ankunftszeiten, Eingabe in Stunden und Minuten
- **Endgegner Riesenkäfer** (`BeetleScene`): Schwachstelle in cm auf dem mm-Lineal treffen, kg ↔ g, Sekunden ↔ Minuten
- Belohnung: Splitter der Größe

**Würfelfestung** (Klasse 5, Sommer; mit dem Boot aus dem Riesental, `FortressScene`): öffnet sich mit
dem Schulthema „Umfang, Flächen, Netze, Volumen“. Baumeister Quadro, vier Stationen:
- **Fliesenhalle** (`TilePuzzle`, M13/M9): Fläche und Umfang von Rechtecken und L-Räumen, mit und ohne Raster
- **Faltstab** (`NetPuzzle`, R14): Würfelnetze erkennen, gegenüberliegende Flächen (`src/learn/cubeNets.ts` rollt einen Würfel übers Netz; findet genau die 11 Würfelnetze)
- **Würfellager** (`VolumePuzzle`, M15): Einheitswürfel zählen, a · b · c, Liter
- **Malerwerkstatt** (`PaintPuzzle`, M15): Oberfläche von Würfel und Quader, auch ohne Deckel; Netz als Hinweis
- **Endgegner Kubus-Wächter** (`KubusScene`): Schild-Fläche/Umfang, Schwachstelle gegenüber im Netz, Volumen
- Belohnung: Splitter des Raums. Damit ist der Stoff von Klasse 5 vollständig.

Endgegner mit Phasen erben von `BossScene` (Herzen, Lebensbalken, Treffer, Sieg).
Das Ziffernfeld kann Kommazahlen (`createNumpad(…, { decimal: true, unit: 'cm' })`).

**Schulmodus** (Menü → Schulthemen, `src/learn/topics.ts`): Themen abhaken, die im Unterricht dran waren.
Nicht abgehakte Themen sind nur auf Einstiegsniveau spielbar (`levelCap` in `progress.ts`), Regionen
öffnen sich erst mit ihrem Thema.

**Menü** (oben rechts): Lernstand pro Skill, Schulthemen, Figur ändern, Zeitdruck im Kampf an/aus (`src/scenes/MenuScene.ts`).

Jede Station besteht aus 3 Aufgaben mit zufälligen Zahlen. Die Schwierigkeit richtet sich nach dem
gespeicherten Können pro Skill (`src/learn/progress.ts`). Stationen lassen sich jederzeit wiederholen.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/main.ts` | Phaser-Konfiguration, Boot-Szene (lädt gemeinsame Assets, wählt Startszene) |
| `src/scenes/AvatarScene.ts` | Avatar-Editor |
| `src/scenes/HudScene.ts` | Ziel-Anzeige und Dialoge über der Welt (ohne Kamera-Zoom) |
| `src/world/WorldScene.ts` | Grundlage aller Orte: Laufen per Tippen mit Wegsuche oder Pfeiltasten, Figuren/Objekte antippen, Ausgänge, Rätsel starten |
| `src/world/terrain.ts` | Gelände aus PixelLab-Wang-Kachelsets (auch Felswände mit Vorderseite) |
| `src/world/pathfind.ts` | A*-Wegsuche |
| `src/world/VillageScene.ts`, `MineScene.ts`, `TempleScene.ts`, `ValleyScene.ts`, `FortressScene.ts` | die Orte mit ihrer Handlung: Eichstadt, Stellenstollen, Spiegeltempel, Riesental, Würfelfestung |
| `src/puzzles/PuzzleScene.ts` | Grundgerüst der Rätsel: Runden, Hinweis-Leiter, Lernfortschritt |
| `src/puzzles/*Puzzle.ts` | die Rätsel-Stationen |
| `src/puzzles/BossScene.ts`, `*Scene.ts` | Endgegner (Erzkoloss, Doppelgänger, Riesenkäfer, Kubus-Wächter) und Nebelwesen-Kampf |
| `src/puzzles/blocks.ts` | Stellenwert-Blöcke (im Code gezeichnet, damit jedes Kästchen stimmt) |
| `src/puzzles/rail.ts` | Lorenschiene als Zahlenstrahl |
| `src/learn/` | Skill-Katalog, Könnensstand, Zahl-Hilfen (Zahlwörter, Runden, Formatierung) |
| `src/avatar/` | Avatar-Varianten, Palettentausch |
| `src/ui/` | Schrift/Farben/Knöpfe, Dialogbox, Ziffernfeld, Sprachausgabe |
| `src/save.ts` | Spielstand im Browser (Avatar, Lernstand, Story-Merker, Ort) |
| `tools/build_avatar_sheets.py` + `avatar_characters.json` | Avatar-Spritesheets aus PixelLab bauen |
| `tools/fetch_assets.py` + `assets.json` | Kachelsets, Objekte und NPCs von PixelLab holen |

## Grafiken

Alles Pixelart von PixelLab, außer den Stellenwert-Blöcken und der Schiene (im Code gezeichnet).
Die Schrift ist **Andika**, gemacht für Leseanfänger, mit eindeutigen Ziffern (2 ≠ Z).

### Avatar

Alle 12 Kombinationen aus Frisur (kurz, Strubbelkopf, kurze Locken, lang, Zöpfe, große Locken) und
Kleidung (Tunika & Hose, Robe) sind eigene PixelLab-Figuren. Die Laufanimationen sind mit dem Modus
`skeleton-v3` erzeugt (die einfachen Vorlagen-Animationen hatten Fehlbilder). Die Figuren wurden mit
**Schlüsselfarben** erzeugt: Haare magenta, Kleidung grün. Im Spiel erkennt `palette.ts` diese Pixel
am Farbton und färbt sie in die gewählte Farbe um. Eine neue Farbe braucht deshalb keine neuen
Grafiken, nur einen Eintrag in `HAIR_COLORS` oder `CLOTH_COLORS`.

Spritesheet-Format: 4 Zeilen (Süd, Ost, Nord, West), Spalte 0 = Stehen, Spalten 1–6 = Laufen,
je 80 × 80 px (Figur zentriert).

```sh
python3 tools/build_avatar_sheets.py            # alle Avatar-Sheets
python3 tools/build_avatar_sheets.py kurz_robe  # eines
python3 tools/fetch_assets.py                   # Kacheln, Objekte, NPCs
```

## Sprachaufnahmen

Die Browser-Sprachausgabe fehlt auf manchen Systemen ganz (z. B. Chrome unter Linux ohne
speech-dispatcher). Der Tresor liest seine Codes deshalb mit **eigenen Aufnahmen** vor
(`public/assets/audio/codes/`, `src/ui/numberVoice.ts`). Jede Zahl ist am Stück gesprochen,
einmal normal und einmal langsam mit Pausen („drei Millionen, vierzigtausend, fünf“).
Aus Einzelwörtern zusammengesetzte Zahlen klangen unnatürlich, weil jedes Wort wie ein eigener
Satz betont wird. Deshalb gibt es einen festen Vorrat: 30 Codes je Stufe (`src/learn/vaultCodes.ts`),
aus dem der Tresor zufällig wählt.

Erzeugt mit der freien Offline-Stimme Piper (`de_DE-thorsten-high`). Neu erzeugen:

```sh
cd tools/tts
uv venv .venv && uv pip install --python .venv/bin/python piper-tts
mkdir -p models && cd models
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx
curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json
cd ../../..
tools/tts/.venv/bin/python tools/tts/make_number_audio.py        # optional: Codes pro Stufe, z. B. 50
```

### Dialoge

Alle festen Dialogzeilen (`{ speaker: '…', text: '…' }` im Code) sind vertont, eine Stimme pro Figur
(`tools/tts/make_dialog_audio.py`, Stimmen in `VOICES`): Elle „kerstin“, Brom „karlsson“ (etwas tiefer),
Durin und die Alten „thorsten“ tiefer, die Alten mit Hall. Nach Textänderungen einfach neu ausführen;
es werden nur neue Zeilen aufgenommen, veraltete gelöscht. Zeilen mit eingesetzten Werten haben keine
Aufnahme; dafür springt die Browser-Stimme ein. Zusätzliche Stimmen laden wie oben (`kerstin/low`,
`karlsson/low` statt `thorsten/high`).

```sh
tools/tts/.venv/bin/python tools/tts/make_dialog_audio.py
```
