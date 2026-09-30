# Eigene Musik als MIDI-Datei

Eine Datei `<id>.mid` in diesem Ordner ersetzt das eingebaute Lied gleichen Namens
(`src/audio/songs.ts`). Mögliche Namen:

`title`, `prologue`, `village`, `mine`, `deep`, `temple`, `valley`, `fortress`, `boss`, `fanfare`

Die Instrumente wählt das Spiel nach dem General-MIDI-Programm jeder Spur (Flöte, Bass,
Streicher → Fläche, Kanal 10 → Schlagzeug). Das Lied läuft in Schleife; die Länge wird auf
ganze Takte aufgerundet. Der Nebel wirkt auch auf MIDI-Lieder.
