# Grafik-Ideen: mehr Kacheln, mehr Deko, mehr Leben

Stand 17.10.2026. Befund nach einem Rundgang durch alle sechs Orte, dazu ein Satz neuer Grafiken
von PixelLab (in `game/tools/assets.json` eingetragen, nach `game/public/assets/` geholt und in die
Orte eingebaut; die Liste unten sagt, was wo steht).

## Befund

- **Ein Kachelset pro Ort, zwei Geländearten.** Jeder Ort ist eine einzige Fläche (Wiese/Weg,
  Boden/Wand). Es gibt keine Varianten, kein Wasser, keine Klippen, keine Plätze.
- **Eichstadt** ist eine flache grüne Fläche mit einem Haus. Vier zurückgekehrte Bewohner stehen im
  Gras neben einem Requisit, aber niemand hat ein Haus. Alle Bäume sind dieselbe Eiche.
- **Riesental**: Der Fluss ist ein im Code gezeichnetes blaues Rechteck; das „Tal“ hat keine Hänge.
- **Spiegeltempel**: Eine fast weiße, leere Halle. Keine Säulen, Statuen, Feuerschalen.
- **Würfelfestung**: Die Wand ist dieselbe Kachel wie der Boden, nur dunkler. Stationen sind
  Code-Grafik auf leerem Sandstein.
- **Stollen**: gute Deko, aber beide Ebenen sehen gleich aus (nur ein Farbfilter unterscheidet sie).
- Objekte werfen keine Schatten; außer dem Nebelwesen bewegt sich fast nichts.

## Technik: Kachelsets stapeln statt ersetzen

`Terrain` baut genau eine Tilemap-Ebene. Für mehr Geländearten reicht es, **ein zweites `Terrain`
mit eigenem Eckpunkt-Raster darüberzulegen** (`layer.setDepth(-999)`), dessen unteres Gelände die
Wiese des ersten Sets ist. PixelLab verkettet Sets über `base_tile_id`, daher ist die Wiesenkachel
pixelgleich und die Naht unsichtbar. Zellen, deren vier Ecken alle „Wiese“ sind, lässt man leer.
Wasser und Klippen zusätzlich mit `block()` sperren. Das Mockup unten ist genau so entstanden,
ohne Code-Änderung, nur zur Laufzeit im Browser.

Verkettungs-IDs (PixelLab `base_tile_id`): Dorf-Wiese `e2c4623b-493c-4a9d-abe4-f894028bd9b8`,
Dorf-Weg `2a0891be-9aa3-461b-821b-b49c90f124ad`, Tal-Gras `472ee3f5-c3bf-47b1-b82c-bd3785d87f23`,
Tempelboden `5ac2bb0a-81f0-4d9a-8058-e13f3753cea6`, Stollenboden `0626af84-22ea-4b63-95e3-73ed615df3b9`,
Festungsboden `58560ab1-d774-43fb-a55a-7c29a867e258`.

## Neue Grafiken und wo sie eingebaut sind

| Kachelset | Zweck |
|---|---|
| `village-water` | Teich am oberen Rand von Eichstadt (Wasser sehr hell, evtl. dunkler neu erzeugen) |
| `village-flowers` | Blumenwiesen-Flecken, erscheinen mit dem ersten Splitter (die Farben kehren zurück) |
| `village-cobble` | Pflaster auf dem Marktplatz, mit Brunnen |
| `valley-river` | Fluss am rechten Rand des Riesentals mit kleiner Bucht |
| `valley-cliff` | Felshänge oben und links im Tal (mit Wandfläche wie die Stollenwand) |
| `temple-pool` | zwei Spiegelbecken im Tempel, symmetrisch zur Mittelachse |
| `mine-water` | Grundwassertümpel mitten in der tiefen Ebene |

Objekte: `house-townhall` (Rathaus, kommt mit Rudolf), `house-alchemist` (kommt mit Flora),
`house-forge` (Schmiede, kommt mit Harald; Harald und Amboss stehen jetzt davor),
`tree-birch/pine/apple/autumn` (Dorf, Obstwiese, Talhang), `fountain` (Marktplatz), `deco-garden`
(Bauprojekt Gemüsegarten), `deco-stone-wall`, `chicken`, `cat` (Dorf), `temple-column`,
`temple-brazier`, `temple-statue` (Tempel), `giant-daisy`, `giant-snail`, `giant-acorn` (Tal),
`fort-cube-stack`, `fort-banner`, `fort-scaffold` (Festung), `mine-stalagmites`,
`mine-glow-mushrooms` (beide Stollen-Ebenen).

Dazu `house-cottage` (Miras Haus am rechten Dorfrand, dafür ist das Dorf vier Spalten breiter) und
`bridge` (über den Bach im Riesental), `mine-rail` (die Lorenschiene als Kachel statt Code-Linie),
ein zweites `valley-cliff` (flaches Felsplateau statt gestreiftem Rand) und ein neues `fortress`-Set
(Würfelmauer mit Wehrgang).

## Ideen je Ort

**Eichstadt**
1. *(eingebaut)* Häuser für die Rückkehrer: Jeder abgegebene Splitter stellt nicht nur eine Figur,
   sondern ihr Haus hin (Rathaus, Schmiede, Alchemistenhütte, Miras Haus).
2. *(eingebaut)* Pflasterplatz mit Brunnen, Blumenwiesen-Flecken, Teich, Steinmauer, Gemüsegarten,
   Hühner (picken) und Katze (atmet).
3. *(eingebaut)* Baumsorten gemischt; die Obstwiese pflanzt Apfelbäume.
4. *(eingebaut)* Die Karte ist auf 34×20 Zellen gewachsen; rechts stehen Miras Haus und ein paar Bäume.
   Weiter vergrößern (etwa 40×28) bleibt möglich, die Kamera folgt ohnehin.
5. *(eingebaut)* Die Blumenwiese erscheint erst mit dem ersten Splitter, mit den Farben.

**Riesental** *(eingebaut)*: Fluss aus Kacheln, Bach mit Brücke unten rechts, Klippen oben und links,
Riesengänseblümchen, Schnecke, Eicheln, Kiefern am Hang. Weiterführend: Klippen auch als Terrassen.

**Spiegeltempel** *(eingebaut)*: Säulen in den Ecken, zwei Spiegelbecken, zwei Statuen mit Waage am
Heiligtum, vier blaue Feuerschalen mit Flackern, Lichtbahnen von oben, Boden leicht lavendel.

**Würfelfestung** *(eingebaut)*: neues Wand-Set (Würfelmauer mit Wehrgang), Würfelstapel, Gerüst,
Banner mit Würfelwappen.

**Stollen** *(eingebaut)*: Tümpel in der tiefen Ebene, Stalagmiten und Leuchtpilze (glimmen) auf beiden
Ebenen, Schiene aus Kacheln. Weiterführend: Kurven und Weichen, falls die Bahn je abbiegt.

## Querschnitt

- *(eingebaut)* Schatten-Ellipse unter stehenden Dingen, Figuren und der Spielfigur (`SHADOW_KEYS`
  in `deco.ts`, `groundShadow` in `WorldScene`).
- *(eingebaut)* Stimmung je Ort (`WorldScene.ambient`): Blätter im Dorf, Pollen im Tal, Staub im
  Stollen, goldene Stäubchen und Lichtbahnen im Tempel, Sand in der Festung.
- *(eingebaut)* Kleine Dauerbewegung für Deko (`DECO_ANIM`): Flackern, Picken, Atmen.
- Animierte Kacheln: Wasser mit 2–3 Bildern, PixelLab `animate_image` auf die Wasserkachel.
- Deko-Zufall: `DECO` bekommt pro Ort eine zweite Liste, aus der beim Betreten zufällig gewählt wird.

Lehre aus dem ersten Klippen-Set: Ein Plateau, das als „mossy top“ beschrieben ist, kommt gestreift
wie Gras zurück und wirkt als schmaler Rand unruhig. „flat weathered grey rock plateau top, even
texture“ ergab eine ruhige Fläche.
