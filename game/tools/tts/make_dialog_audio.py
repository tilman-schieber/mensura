#!/usr/bin/env python3
"""Nimmt alle festen Dialogzeilen aus dem Code auf (public/assets/audio/dialog/).

Gesucht wird in src/**/*.ts nach  { speaker: '…', text: '…' }  mit festem Text.
Zeilen mit eingesetzten Werten (Template-Strings mit ${…}) werden übersprungen;
dafür nutzt das Spiel die Browser-Stimme.

Dateiname = FNV-1a-Hash aus Sprecher und Text (wie in src/ui/dialogVoice.ts).
Vorhandene Aufnahmen werden nicht neu erzeugt; veraltete werden gelöscht.

Aufruf (aus dem Ordner game/):
  tools/tts/.venv/bin/python tools/tts/make_dialog_audio.py [--alle]
"""
import json, re, subprocess, sys, tempfile, wave
from pathlib import Path

from piper import PiperVoice
from piper.config import SynthesisConfig

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "tools" / "tts" / "models"
OUT = ROOT / "public" / "assets" / "audio" / "dialog"

# Stimme pro Figur: (Modell, Sprechtempo [>1 = langsamer], Tonhöhe [<1 = tiefer], Hall)
VOICES = {
    "Meisterin Elle": ("de_DE-kerstin-low", 1.0, 1.0, False),
    "Vorarbeiter Brom": ("de_DE-karlsson-low", 1.0, 0.92, False),
    "König Durin": ("de_DE-thorsten-high", 1.1, 0.86, False),
    "Stimme der Alten": ("de_DE-thorsten-high", 1.2, 0.8, True),
    "Inschrift": ("de_DE-thorsten-high", 1.05, 1.0, False),
    "Hüterin Lumen": ("de_DE-ramona-low", 1.05, 1.0, True),
    "Riesin Hanna": ("de_DE-ramona-low", 1.0, 0.82, False),
    "Baumeister Quadro": ("de_DE-karlsson-low", 0.95, 1.12, False),
}
DEFAULT = ("de_DE-thorsten-high", 1.0, 1.0, False)

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


def main() -> None:
    redo = "--alle" in sys.argv
    lines = collect()
    OUT.mkdir(parents=True, exist_ok=True)
    # veraltete Aufnahmen entfernen
    for f in OUT.glob("*.mp3"):
        if f.stem not in lines:
            f.unlink()
    voices: dict[str, PiperVoice] = {}
    made = 0
    with tempfile.TemporaryDirectory() as t:
        wav = Path(t) / "x.wav"
        for h, (speaker, text) in sorted(lines.items()):
            target = OUT / f"{h}.mp3"
            if target.exists() and not redo:
                continue
            model, speed, pitch, echo = VOICES.get(speaker, DEFAULT)
            if model not in voices:
                voices[model] = PiperVoice.load(str(MODELS / f"{model}.onnx"))
            voice = voices[model]
            with wave.open(str(wav), "wb") as w:
                voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=speed))
            rate = voice.config.sample_rate
            filters = []
            if pitch != 1.0:
                # tiefer, ohne langsamer zu werden
                filters.append(f"asetrate={int(rate * pitch)},aresample={rate},atempo={1 / pitch:.4f}")
            if echo:
                filters.append("aecho=0.8:0.6:90|180:0.35|0.2")
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav)]
            if filters:
                cmd += ["-af", ",".join(filters)]
            cmd += ["-ac", "1", "-codec:a", "libmp3lame", "-b:a", "40k", str(target)]
            subprocess.run(cmd, check=True)
            made += 1
            print(f"  {speaker}: {text[:60]}")
    (OUT / "index.json").write_text(json.dumps(sorted(lines)))
    print(f"ok  {len(lines)} Zeilen, {made} neu aufgenommen")


if __name__ == "__main__":
    main()
