#!/usr/bin/env python3
"""Nimmt alle festen Dialogzeilen aus dem Code auf (public/assets/audio/dialog/), mit Gemini-TTS.

Gesucht wird in src/**/*.ts nach  { speaker: '…', text: '…' }  mit festem Text.
Zeilen mit eingesetzten Werten (Template-Strings mit ${…}) werden übersprungen;
dafür nutzt das Spiel die Browser-Stimme.

Dateiname = FNV-1a-Hash aus Sprecher und Text (wie in src/ui/dialogVoice.ts).
Vorhandene Aufnahmen werden nicht neu erzeugt; veraltete werden gelöscht.
Bricht ein Lauf ab (z. B. Anfragelimit), setzt der nächste Aufruf dort fort.

Schlüssel: GEMINI_API_KEY in der Umgebung oder in tools/tts/.env (nicht im Git).
Braucht nur Python 3 und ffmpeg, keine Pakete.

Aufruf (aus dem Ordner game/):
  python3 tools/tts/make_dialog_audio.py                # fehlende Zeilen aufnehmen
  python3 tools/tts/make_dialog_audio.py --alle         # alles neu
  python3 tools/tts/make_dialog_audio.py --probe        # je Figur eine Zeile nach tools/tts/probe/
"""
import base64, json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "public" / "assets" / "audio" / "dialog"
PROBE = HERE / "probe"
MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
API = "https://generativelanguage.googleapis.com/v1beta/models"

# Stimme pro Figur: (Gemini-Stimme, Regieanweisung, Hall)
VOICES = {
    "Meisterin Elle": ("Gacrux", "eine alte, warmherzige Kartographin; ruhig, klug, ein wenig müde", False),
    "Vorarbeiter Brom": ("Algenib", "ein grummeliger, aber gutmütiger Zwergen-Vorarbeiter; kräftig und bodenständig", False),
    "König Durin": ("Alnilam", "ein eitler, gewichtiger Zwergenkönig; langsam und würdevoll", False),
    "Stimme der Alten": ("Charon", "eine uralte, feierliche Stimme aus einer Ruine; sehr langsam und ehrfürchtig", True),
    "Inschrift": ("Iapetus", "ein ruhiger Erzähler, der eine alte Steininschrift vorliest", False),
    "Hüterin Lumen": ("Achernar", "eine sanfte, geheimnisvolle Tempelhüterin; schwebend und ruhig", True),
    "Riesin Hanna": ("Leda", "ein fröhliches, lebhaftes elfjähriges Mädchen", False),
    "Baumeister Quadro": ("Puck", "ein pingeliger, eifriger Baumeister; schnell und etwas aufgeregt", False),
    "Erzählerin": ("Sulafat", "eine warme Erzählerin, die ein Märchen vorliest; ruhig und ein wenig geheimnisvoll", False),
    "Eule Pünktchen": ("Zephyr", "eine kluge, etwas besserwisserische kleine Eule; hell, flink und freundlich", False),
    "Pi-mal-Daumen": ("Fenrir", "ein frecher, kichernder kleiner Kobold; schnell und schelmisch", False),
    "Händlerin Mira": ("Autonoe", "eine herzliche, fröhliche Marktfrau", False),
    "Bürgermeister Rudolf": ("Sadaltager", "ein gemütlicher, etwas wichtigtuerischer alter Bürgermeister", False),
    "Alchemistin Flora": ("Laomedeia", "eine begeisterte junge Alchemistin; lebhaft und etwas chaotisch", False),
    "Schmied Harald": ("Orus", "ein kräftiger, ruhiger Schmied mit tiefer Stimme", False),
    "Plakat": ("Schedar", "ein Marktschreier, der eine Werbeanzeige vorliest; übertrieben begeistert", False),
    "Wegweiser": ("Iapetus", "ein ruhiger Erzähler", False),
    "Vagor": ("Enceladus", "ein einsamer Mann, der aus dem Nebel spricht; leise, bitter und traurig, nicht brüllend", True),
}
DEFAULT = ("Kore", "freundlich und klar", False)

LINE = re.compile(r"\{\s*speaker:\s*'([^'\\]+)',\s*text:\s*'((?:[^'\\]|\\.)*)'\s*\}")


def fnv1a(s: str) -> str:
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def collect() -> dict[str, tuple[str, str]]:
    lines: dict[str, tuple[str, str]] = {}
    for path in (ROOT / "src").rglob("*.ts"):
        for m in LINE.finditer(path.read_text()):
            speaker, text = m.group(1), m.group(2).replace("\\'", "'")
            lines[fnv1a(f"{speaker}\0{text}")] = (speaker, text)
    return lines


def api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY")
    env = HERE / ".env"
    if not key and env.exists():
        for row in env.read_text().splitlines():
            name, _, value = row.partition("=")
            if name.strip() == "GEMINI_API_KEY":
                key = value.strip().strip('"').strip("'")
    if not key:
        sys.exit("GEMINI_API_KEY fehlt: in die Umgebung oder in tools/tts/.env eintragen.")
    return key


def synthesize(key: str, speaker: str, text: str) -> bytes:
    """Gibt rohes PCM zurück (16 Bit, 24 kHz, mono)."""
    voice, direction, _ = VOICES.get(speaker, DEFAULT)
    prompt = f"Lies den folgenden Satz auf Deutsch vor. Sprich wie {direction}.\n\n{text}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    req = urllib.request.Request(
        f"{API}/{MODEL}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            part = data["candidates"][0]["content"]["parts"][0]
            pcm = base64.b64decode(part["inlineData"]["data"])
            # Manchmal kommt leere oder abgeschnittene Audio zurück: dann noch einmal
            if len(pcm) < 24000 * 2 * len(text) / 30:
                raise ValueError(f"nur {len(pcm)} Bytes Audio")
            return pcm[: len(pcm) // 2 * 2]
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            if e.code in (429, 500, 503) and attempt < 5:
                wait = 20 * (attempt + 1)
                print(f"  … {e.code}, warte {wait} s")
                time.sleep(wait)
                continue
            sys.exit(f"Gemini-Fehler {e.code}: {detail[:500]}")
        except (KeyError, IndexError, ValueError):
            if attempt < 5:
                time.sleep(3)
                continue
            raise
    raise RuntimeError("unerreichbar")


def to_mp3(pcm: bytes, target: Path, echo: bool) -> None:
    with tempfile.NamedTemporaryFile(suffix=".pcm") as f:
        f.write(pcm)
        f.flush()
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", f.name]
        # Stille am Anfang und Ende abschneiden
        filters = ["silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"]
        if echo:
            filters.append("aecho=0.8:0.6:90|180:0.35|0.2")
        cmd += ["-af", ",".join(filters), "-codec:a", "libmp3lame", "-b:a", "48k", str(target)]
        subprocess.run(cmd, check=True)


def probe(key: str, lines: dict[str, tuple[str, str]]) -> None:
    """Je Figur die längste Zeile, zum Probehören."""
    PROBE.mkdir(exist_ok=True)
    best: dict[str, str] = {}
    for speaker, text in lines.values():
        if len(text) > len(best.get(speaker, "")):
            best[speaker] = text
    for speaker, text in sorted(best.items()):
        target = PROBE / f"{speaker.replace(' ', '_')}.mp3"
        to_mp3(synthesize(key, speaker, text), target, VOICES.get(speaker, DEFAULT)[2])
        print(f"  {target.name}: {text[:60]}")


def main() -> None:
    key = api_key()
    lines = collect()
    if "--probe" in sys.argv:
        probe(key, lines)
        return
    redo = "--alle" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    # veraltete Aufnahmen entfernen
    for f in OUT.glob("*.mp3"):
        if f.stem not in lines:
            f.unlink()
    made = 0
    failed = []
    try:
        for h, (speaker, text) in sorted(lines.items()):
            target = OUT / f"{h}.mp3"
            if target.exists() and not redo:
                continue
            error = None
            # Gemini liefert selten fast stumme Audio; die Stille-Kürzung lässt dann nichts übrig
            # und ffmpeg scheitert. Dann die Zeile neu anfragen.
            for _ in range(3):
                try:
                    to_mp3(synthesize(key, speaker, text), target, VOICES.get(speaker, DEFAULT)[2])
                    error = None
                    break
                except (RuntimeError, ValueError, KeyError, IndexError, subprocess.CalledProcessError) as e:
                    target.unlink(missing_ok=True)
                    error = e
            if error:
                failed.append(f"{speaker}: {text[:60]} ({error})")
                continue
            made += 1
            print(f"  {speaker}: {text[:60]}")
    finally:
        # Nur vorhandene Aufnahmen eintragen, damit ein abgebrochener Lauf nichts Fehlendes verspricht
        have = sorted(h for h in lines if (OUT / f"{h}.mp3").exists())
        (OUT / "index.json").write_text(json.dumps(have))
        print(f"ok  {len(have)} von {len(lines)} Zeilen vertont, {made} neu aufgenommen")
        for f in failed:
            print(f"  FEHLER {f}")


if __name__ == "__main__":
    main()
