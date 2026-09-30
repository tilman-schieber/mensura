#!/usr/bin/env python3
"""Lädt Kachelsets, Objekte und NPC-Figuren von PixelLab (IDs in tools/assets.json).

Ausgabe in public/assets/:
  tiles/<name>.png + tiles/<name>.json   Kachelbild und Auswahlmuster je Kachel
  objects/<name>.png                     Objekte mit transparentem Hintergrund
  npcs/<name>.png                        4 Standbilder nebeneinander: Süd, Ost, Nord, West

Kachel-JSON: {"size": 32, "tiles": [{"p": [16 Werte], "x": .., "y": ..}]}
  p = 4x4-Muster der Eckpunkte um die Kachel, zeilenweise; 0 = unteres Gelände,
  1 = oberes Gelände, 2 = Übergang (Felswand-Vorderseite), 255 = egal.

Aufruf:  python3 tools/fetch_assets.py [tiles|objects|npcs ...]
"""
import io, json, sys, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets"
CFG = json.loads((ROOT / "tools" / "assets.json").read_text())
API = "https://api.pixellab.ai/mcp"
BLOB = "https://backblaze.pixellab.ai/file/pixellab-characters/62e70f4a-aef2-4b60-8f04-e58e599bb27c"


def get(url: str) -> bytes:
    # Der Bildspeicher lehnt Pythons Standard-User-Agent ab (403).
    req = urllib.request.Request(url, headers={"User-Agent": "mensura-assets/1.0"})
    return urllib.request.urlopen(req).read()


def tiles() -> None:
    (OUT / "tiles").mkdir(parents=True, exist_ok=True)
    for name, tid in CFG["tilesets"].items():
        (OUT / "tiles" / f"{name}.png").write_bytes(get(f"{API}/tilesets/{tid}/image"))
        meta = json.loads(get(f"{API}/tilesets/{tid}/metadata"))
        out = []
        for t in meta["tileset_data"]["tiles"]:
            p = t["pattern_4x4"]
            b = t["bounding_box"]
            out.append({"p": p["row_0"] + p["row_1"] + p["row_2"] + p["row_3"], "x": b["x"], "y": b["y"]})
        size = meta["tile_size"]["width"]
        (OUT / "tiles" / f"{name}.json").write_text(json.dumps({"size": size, "tiles": out}))
        print(f"ok  tiles/{name} ({len(out)} Kacheln)")


def objects() -> None:
    (OUT / "objects").mkdir(parents=True, exist_ok=True)
    for name, oid in CFG["objects"].items():
        (OUT / "objects" / f"{name}.png").write_bytes(get(f"{API}/map-objects/{oid}/download"))
        print(f"ok  objects/{name}")


def npcs() -> None:
    (OUT / "npcs").mkdir(parents=True, exist_ok=True)
    for name, cid in CFG["npcs"].items():
        imgs = [Image.open(io.BytesIO(get(f"{BLOB}/{cid}/rotations/{d}.png"))).convert("RGBA") for d in ("south", "east", "north", "west")]
        w, h = imgs[0].size
        sheet = Image.new("RGBA", (w * 4, h))
        for i, im in enumerate(imgs):
            sheet.paste(im, (i * w, 0))
        sheet.save(OUT / "npcs" / f"{name}.png")
        print(f"ok  npcs/{name} ({w}x{h})")


if __name__ == "__main__":
    for part in sys.argv[1:] or ["tiles", "objects", "npcs"]:
        globals()[part]()
