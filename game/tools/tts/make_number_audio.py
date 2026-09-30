#!/usr/bin/env python3
"""Erzeugt den Vorrat an gesprochenen Tresor-Codes (public/assets/audio/codes/).

Jede Zahl wird am Stück gesprochen (natürliche Betonung), einmal normal und
einmal langsam mit Pausen an den Gruppen („drei Millionen, vierzigtausend, fünf“).
index.json listet die Codes je Stellenzahl; das Spiel wählt daraus.

Stimme: Piper „de_DE-thorsten-high“ (offline, frei); Einrichtung siehe README.

Aufruf (aus dem Ordner game/):
  tools/tts/.venv/bin/python tools/tts/make_number_audio.py [Codes pro Stufe, Standard 30]
"""
import json, subprocess, sys, tempfile, wave
from pathlib import Path

from piper import PiperVoice
from piper.config import SynthesisConfig

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "tools" / "tts" / "models" / "de_DE-thorsten-high.onnx"
OUT = ROOT / "public" / "assets" / "audio" / "codes"


def synth(voice: PiperVoice, text: str, cfg: SynthesisConfig, target: Path, tmp: Path) -> None:
    wav = tmp / "x.wav"
    with wave.open(str(wav), "wb") as w:
        voice.synthesize_wav(text, w, syn_config=cfg)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1",
         "-codec:a", "libmp3lame", "-b:a", "32k", str(target)],
        check=True,
    )


def main() -> None:
    per_tier = sys.argv[1] if len(sys.argv) > 1 else "30"
    codes = json.loads(subprocess.check_output(["node", str(ROOT / "tools" / "tts" / "codes.mts"), per_tier], text=True))
    if OUT.exists():
        for f in OUT.glob("*.mp3"):
            f.unlink()
    OUT.mkdir(parents=True, exist_ok=True)
    voice = PiperVoice.load(str(MODEL))
    normal = SynthesisConfig(length_scale=1.0)
    slow = SynthesisConfig(length_scale=1.3)
    index: dict[str, list[int]] = {}
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for c in codes:
            synth(voice, c["words"], normal, OUT / f"{c['n']}.mp3", tmp)
            synth(voice, c["slow"], slow, OUT / f"{c['n']}_langsam.mp3", tmp)
            index.setdefault(str(c["digits"]), []).append(c["n"])
    (OUT / "index.json").write_text(json.dumps(index))
    print(f"ok  {len(codes)} Codes in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
