#!/usr/bin/env python3
"""Nimmt alle festen Dialogzeilen aus dem Code auf (public/assets/audio/dialog/), mit Gemini-TTS.

Gesucht wird in src/**/*.ts nach  { speaker: '…', text: '…' }  mit festem Text.
Zeilen mit eingesetzten Werten (Template-Strings mit ${…}) werden übersprungen;
dafür nutzt das Spiel die Browser-Stimme.

Damit jede Figur immer gleich klingt:
  1. Feste Stimme und Charakter pro Figur, immer mit „Hochdeutsch ohne Akzent“.
  2. Jede Aufnahme hört ein zweites Modell an und prüft: stimmt der Text, gibt es einen
     Akzent, ist das Tempo normal? Fällt sie durch, wird neu aufgenommen (bis zu 4-mal),
     sonst bleibt die beste.
  3. Das Sprechtempo wird pro Figur auf einen festen Wert angeglichen (Zeichen pro Sekunde),
     damit niemand quälend langsam oder gehetzt spricht.
Ergebnis der Prüfung: tools/tts/qc-report.json (nicht im Git).

Dateiname = FNV-1a-Hash aus Sprecher und Text (wie in src/ui/dialogVoice.ts).
Vorhandene Aufnahmen werden nicht neu erzeugt; veraltete werden gelöscht.

Schlüssel: GEMINI_API_KEY in der Umgebung oder in tools/tts/.env (nicht im Git).
Braucht nur Python 3 und ffmpeg, keine Pakete.

Aufruf (aus dem Ordner game/):
  python3 tools/tts/make_dialog_audio.py                # fehlende Zeilen aufnehmen
  python3 tools/tts/make_dialog_audio.py --alle         # alles neu
  python3 tools/tts/make_dialog_audio.py --probe        # je Figur eine Zeile nach tools/tts/probe/
"""
import base64, io, json, os, re, subprocess, sys, tempfile, threading, time, urllib.error, urllib.request, wave
from concurrent.futures import ThreadPoolExecutor
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUT = ROOT / "public" / "assets" / "audio" / "dialog"
PROBE = HERE / "probe"
REPORT = HERE / "qc-report.json"
# 3.8-flash-tts liest jede Anweisung mit vor; das Pro-Modell hält sich daran und klingt am natürlichsten
MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-pro-preview-tts")
JUDGE = os.environ.get("GEMINI_JUDGE_MODEL", "gemini-3.8-flash")
API = "https://generativelanguage.googleapis.com/v1beta/models"
RATE = 24000
TRIES = 4

# Stimme pro Figur: (Gemini-Stimme, Charakter, Hall, Zieltempo in Zeichen pro Sekunde)
# Das Tempo ist das, was am Ende herauskommt; die Anweisung beschreibt nur den Charakter.
VOICES = {
    "Meisterin Elle": ("Gacrux", "eine alte, warmherzige Kartographin; ruhig und klug", False, 13.5),
    "Vorarbeiter Brom": ("Algenib", "ein grummeliger, aber gutmütiger Zwergen-Vorarbeiter; kräftig und bodenständig", False, 14.5),
    "König Durin": ("Alnilam", "ein eitler, gewichtiger Zwergenkönig; würdevoll", False, 13.5),
    "Stimme der Alten": ("Charon", "eine uralte, feierliche Stimme aus einer Ruine; ehrfürchtig", True, 12.0),
    "Inschrift": ("Iapetus", "ein ruhiger Erzähler, der eine alte Steininschrift vorliest", False, 13.5),
    "Hüterin Lumen": ("Achernar", "eine sanfte, geheimnisvolle Tempelhüterin", True, 13.0),
    "Riesin Hanna": ("Leda", "ein fröhliches, lebhaftes elfjähriges Mädchen", False, 15.0),
    "Baumeister Quadro": ("Puck", "ein pingeliger, eifriger Baumeister; etwas aufgeregt", False, 15.0),
    "Erzählerin": ("Sulafat", "eine warme Erzählerin, die ein Märchen vorliest; ein wenig geheimnisvoll", False, 13.0),
    "Eule Pünktchen": ("Zephyr", "eine kluge, etwas besserwisserische kleine Eule; hell und freundlich", False, 15.0),
    "Pi-mal-Daumen": ("Fenrir", "ein frecher, kichernder kleiner Kobold; schelmisch", False, 15.5),
    "Händlerin Mira": ("Autonoe", "eine herzliche, fröhliche Marktfrau", False, 14.5),
    "Bürgermeister Rudolf": ("Sadaltager", "ein gemütlicher, etwas wichtigtuerischer alter Bürgermeister", False, 14.0),
    "Alchemistin Flora": ("Laomedeia", "eine begeisterte junge Alchemistin; lebhaft", False, 15.0),
    "Schmied Harald": ("Orus", "ein kräftiger, ruhiger Schmied mit tiefer Stimme", False, 13.5),
    "Plakat": ("Schedar", "ein Marktschreier, der eine Werbeanzeige vorliest; übertrieben begeistert", False, 14.5),
    "Wegweiser": ("Iapetus", "ein ruhiger Erzähler", False, 13.5),
    "Tüftlerin Grete": ("Aoede", "eine fröhliche, handfeste Zwergen-Ingenieurin, die ihre Maschinen liebt", False, 15.0),
    "Vagor": ("Enceladus", "ein einsamer Mann, der aus dem Nebel spricht; leise, bitter und traurig, nicht brüllend", True, 12.5),
}
DEFAULT = ("Kore", "freundlich und klar", False, 14.0)

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


def post(key: str, model: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{API}/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            if e.code in (429, 500, 503) and attempt < 5:
                time.sleep(15 * (attempt + 1))
                continue
            raise RuntimeError(f"{model} {e.code}: {detail[:300]}")
        except (urllib.error.URLError, TimeoutError):
            if attempt < 5:
                time.sleep(5)
                continue
            raise
    raise RuntimeError("unerreichbar")


def synthesize(key: str, speaker: str, text: str) -> bytes:
    """Rohes PCM (16 Bit, 24 kHz, mono)."""
    voice, character, _, _ = VOICES.get(speaker, DEFAULT)
    prompt = (
        "Lies den folgenden Satz auf Deutsch vor, als deutsche Muttersprachlerin bzw. deutscher Muttersprachler, "
        f"in klarem Hochdeutsch ohne Akzent und in natürlichem Tempo. Sprich wie {character}.\n\n{text}"
    )
    data = post(key, MODEL, {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    })
    part = data["candidates"][0]["content"]["parts"][0]
    pcm = base64.b64decode(part["inlineData"]["data"])
    if len(pcm) < RATE * 2 * len(text) / 30:
        raise ValueError(f"nur {len(pcm)} Bytes Audio")
    return pcm[: len(pcm) // 2 * 2]


def wav_bytes(pcm: bytes) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)
    return buf.getvalue()


def norm(s: str) -> str:
    """Kleinbuchstaben, ohne Satzzeichen: für den Textvergleich"""
    return " ".join(re.sub(r"[^a-zäöüß0-9 ]", " ", s.lower()).split())


def judge(key: str, pcm: bytes, text: str) -> dict:
    """Ein zweites Modell hört zu: Text, Akzent, Tempo."""
    prompt = (
        "Du prüfst eine Sprachaufnahme für ein deutsches Kinder-Lernspiel. "
        f"Erwarteter Text: „{text}“\n"
        "Antworte nur mit JSON: {\"transkript\": \"…\", "
        "\"akzent\": \"keiner\" | \"leicht\" | \"stark\" (klingt die Stimme nach ausländischem, z. B. englischem Akzent?), "
        "\"muttersprache\": 1 bis 5 (5 = eindeutig deutsche Muttersprache, jede Silbe wie von einem deutschen Sprecher; "
        "schon ein leichter Einschlag, falsch betonte Wörter oder fremd klingende Vokale ergeben höchstens 3), "
        "\"tempo\": \"zu langsam\" | \"normal\" | \"zu schnell\", "
        "\"zusatz\": true | false (wird etwas gesprochen, das nicht im Text steht, z. B. eine Anweisung?)}"
    )
    data = post(key, JUDGE, {
        "contents": [{"parts": [
            {"inlineData": {"mimeType": "audio/wav", "data": base64.b64encode(wav_bytes(pcm)).decode()}},
            {"text": prompt},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
    })
    v = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
    same = SequenceMatcher(None, norm(v.get("transkript", "")), norm(text)).ratio()
    v["text_ok"] = same > 0.85 and not v.get("zusatz", False)
    v["aehnlichkeit"] = round(same, 2)
    return v


def score(v: dict) -> int:
    """Höher ist besser; 100 = alles in Ordnung."""
    s = 100
    if not v.get("text_ok"):
        s -= 60
    s -= {"keiner": 0, "leicht": 15, "stark": 50}.get(v.get("akzent", "stark"), 50)
    s -= {5: 0, 4: 15, 3: 30}.get(int(v.get("muttersprache", 1) or 1), 50)
    s -= 0 if v.get("tempo") == "normal" else 10
    return s


def speech_seconds(pcm: bytes) -> float:
    """Dauer ohne Stille am Anfang und Ende"""
    samples = memoryview(pcm).cast("h")
    thresh = 600
    first = next((i for i in range(len(samples)) if abs(samples[i]) > thresh), 0)
    last = next((i for i in range(len(samples) - 1, -1, -1) if abs(samples[i]) > thresh), len(samples) - 1)
    return max(0.3, (last - first) / RATE)


def to_mp3(pcm: bytes, target: Path, speaker: str, text: str) -> float:
    """Stille kürzen, Tempo auf das Ziel der Figur bringen, ggf. Hall, als MP3 speichern."""
    _, _, echo, rate = VOICES.get(speaker, DEFAULT)
    actual = len(text) / speech_seconds(pcm)
    tempo = min(1.6, max(0.8, rate / actual))
    filters = [
        "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
        f"atempo={tempo:.3f}",
    ]
    if echo:
        filters.append("aecho=0.8:0.6:90|180:0.35|0.2")
    # feste Blockgröße für den MP3-Encoder (sonst scheitert er gelegentlich nach Hall + Stille-Kürzen)
    filters.append("aformat=sample_fmts=s16p,asetnsamples=n=1152:p=0")
    with tempfile.NamedTemporaryFile(suffix=".pcm") as f:
        f.write(pcm)
        f.flush()
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-i", f.name,
               "-af", ",".join(filters), "-codec:a", "libmp3lame", "-b:a", "48k", str(target)]
        subprocess.run(cmd, check=True)
    return tempo


def record(key: str, speaker: str, text: str, target: Path) -> dict:
    """Aufnehmen und prüfen, bis eine Aufnahme durchkommt; sonst die beste behalten."""
    best: tuple[int, bytes, dict] | None = None
    attempt = 0
    for attempt in range(1, TRIES + 1):
        try:
            pcm = synthesize(key, speaker, text)
            verdict = judge(key, pcm, text)
        except (RuntimeError, ValueError, KeyError, IndexError, json.JSONDecodeError):
            continue
        s = score(verdict)
        if best is None or s > best[0]:
            best = (s, pcm, verdict)
        if s >= 90:
            break
    if best is None:
        raise RuntimeError(f"keine Aufnahme für {speaker}: {text[:40]}")
    s, pcm, verdict = best
    tempo = to_mp3(pcm, target, speaker, text)
    return {"speaker": speaker, "text": text, "score": s, "versuche": attempt, "tempo_faktor": round(tempo, 2), **verdict}


def main() -> None:
    key = api_key()
    lines = collect()
    probe = "--probe" in sys.argv
    redo = "--alle" in sys.argv or probe
    if probe:
        PROBE.mkdir(exist_ok=True)
        longest: dict[str, str] = {}
        for sp, t in lines.values():
            if len(t) > len(longest.get(sp, "")):
                longest[sp] = t
        jobs = [(sp, t, PROBE / f"{sp.replace(' ', '_')}.mp3") for sp, t in sorted(longest.items())]
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for f in OUT.glob("*.mp3"):
            if f.stem not in lines:
                f.unlink()
        jobs = [(sp, t, OUT / f"{h}.mp3") for h, (sp, t) in sorted(lines.items()) if redo or not (OUT / f"{h}.mp3").exists()]

    report: list[dict] = []
    lock = threading.Lock()

    def run(job):
        sp, t, target = job
        try:
            r = record(key, sp, t, target)
        except Exception as e:  # eine kaputte Zeile hält den Rest nicht auf
            r = {"speaker": sp, "text": t, "score": -1, "fehler": str(e)[:200]}
        with lock:
            report.append(r)
            flag = "" if r.get("score", -1) >= 90 else "  <-- prüfen"
            print(f"  {r.get('score', -1):>4}  {sp}: {t[:55]}{flag}", flush=True)

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(run, jobs))

    REPORT.write_text(json.dumps(sorted(report, key=lambda r: r.get("score", -1)), ensure_ascii=False, indent=1))
    if not probe:
        have = sorted(h for h in lines if (OUT / f"{h}.mp3").exists())
        (OUT / "index.json").write_text(json.dumps(have))
        print(f"ok  {len(have)} von {len(lines)} Zeilen vertont")
    bad = [r for r in report if r.get("score", -1) < 90]
    print(f"{len(report)} aufgenommen, {len(bad)} unter 90 Punkten (siehe {REPORT.name})")


if __name__ == "__main__":
    main()
