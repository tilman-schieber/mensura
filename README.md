# Mensura – Die sieben Urmaße

Ein Zelda-artiges 2D-Abenteuer im Browser, in dem Mathe das Werkzeug ist, mit dem man die Welt
verändert. Gedacht für ein Kind am Anfang von Klasse 5 (Gymnasium Baden-Württemberg); das Spiel
wächst mit dem Schuljahr mit und soll Klasse 5 und 6 begleiten.

**Online spielen:** <https://gh.tschieber.de/mensura/> (GitHub Pages, wird bei jedem Push auf `main`
neu gebaut, siehe `.github/workflows/deploy.yml`).

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

**Spielstände:** drei Speicherplätze im Browser (`localStorage`, Schlüssel `mensura.slot.1` bis `.3`).
Das Spiel speichert automatisch; im Menü kann man zusätzlich in einen anderen Platz speichern, laden
und zum Titelbild zurück. Unter „Spiel laden“ lässt sich jeder Spielstand als Datei sichern und wieder
einlesen, etwa für ein anderes Gerät. Ein Spielstand aus der Zeit vor den Speicherplätzen
(`mensura.save.v1`) wird beim ersten Start zu Platz 1.

**Bedienung:** Tippen oder Klicken, wohin die Figur laufen soll; Figuren und Dinge antippen. Pfeiltasten
gehen auch. Ein gelbes **!** zeigt, wo es etwas zu tun gibt, ein **?**, wo man etwas abgeben kann; was
man antippen kann, leuchtet auf, wenn man davorsteht. Die Orte öffnen sich der Reihe nach, in der
Reihenfolge des Schuljahrs. Das Menü oben rechts (oder Esc) zeigt Lernstand und Messbuch.

## Inhalt des Repos

| Pfad | Inhalt |
|---|---|
| [`game/`](game/) | das Spiel (TypeScript, Phaser 4, Vite); technische Details, Entwickler-Einstiege und Werkzeuge für Grafiken und Sprachaufnahmen in [`game/README.md`](game/README.md) |
| [`konzept/`](konzept/) | Lernziele Klasse 5/6 nach Bildungsplan, das Spielkonzept, die Abdeckungsmatrix und die Kritik mit Überarbeitungsplan der Spielwelt |

Einstieg ins Konzept: [`konzept/README.md`](konzept/README.md) (Lernziele) →
[`konzept/spielkonzept.md`](konzept/spielkonzept.md) (Spiel) →
[`konzept/spiel-abdeckung.md`](konzept/spiel-abdeckung.md) (jeder Skill → Mechanik) →
[`konzept/kritik.md`](konzept/kritik.md) (kritischer Pass: Was trägt die Welt, was nicht?)
