# Mensura – Die sieben Urmaße

Ein Zelda-artiges 2D-Abenteuer im Browser, in dem Mathe das Werkzeug ist, mit dem man die Welt
verändert. Gedacht für ein Kind am Anfang von Klasse 5 (Gymnasium Baden-Württemberg); das Spiel
wächst mit dem Schuljahr mit und soll Klasse 5 und 6 begleiten.

## Spiel starten

Voraussetzung: [Node.js](https://nodejs.org) 20.19 oder neuer (getestet mit Node 22).

```sh
cd game
npm install      # nur beim ersten Mal
npm run dev
```

Dann im Browser <http://localhost:5173> öffnen. Der Server lauscht auch im WLAN; die Adresse für
Tablet oder Handy steht in der Konsole unter „Network“.

Als fertige Version ohne Entwicklungsserver:

```sh
cd game
npm run build    # Typprüfung + Build nach game/dist/
npm run preview  # den Build lokal ansehen
```

`game/dist/` ist eine rein statische Seite und lässt sich auf jeden Webspace kopieren.

**Spielstand:** liegt im Browser (`localStorage`, Schlüssel `mensura.save.v1`). Neu anfangen: in den
Entwicklerwerkzeugen des Browsers den Eintrag löschen oder ein privates Fenster benutzen.

**Bedienung:** Tippen oder Klicken, wohin die Figur laufen soll; Figuren und Dinge antippen. Pfeiltasten
gehen auch. Das Menü oben rechts zeigt den Lernstand und die **Schulthemen**: Dort hakt man ab, was
im Unterricht schon dran war. Erst dann öffnen sich die passenden Regionen.

## Inhalt des Repos

| Pfad | Inhalt |
|---|---|
| [`game/`](game/) | das Spiel (TypeScript, Phaser 4, Vite); technische Details, Entwickler-Einstiege und Werkzeuge für Grafiken und Sprachaufnahmen in [`game/README.md`](game/README.md) |
| [`konzept/`](konzept/) | Lernziele Klasse 5/6 nach Bildungsplan, das Spielkonzept, die Abdeckungsmatrix und die Kritik mit Überarbeitungsplan der Spielwelt |

Einstieg ins Konzept: [`konzept/README.md`](konzept/README.md) (Lernziele) →
[`konzept/spielkonzept.md`](konzept/spielkonzept.md) (Spiel) →
[`konzept/spiel-abdeckung.md`](konzept/spiel-abdeckung.md) (jeder Skill → Mechanik) →
[`konzept/kritik.md`](konzept/kritik.md) (kritischer Pass: Was trägt die Welt, was nicht?)
