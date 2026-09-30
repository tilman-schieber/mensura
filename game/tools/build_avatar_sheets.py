#!/usr/bin/env python3
"""Lädt die Avatar-Figuren von PixelLab und baut daraus Spritesheets.

Aufbau je Sheet (passt zu SHEET in src/avatar/avatar.ts):
  Zeilen:  south, east, north, west
  Spalte 0: Stand-Bild (Rotation), Spalten 1..6: Lauf-Frames
  Jede Zelle FRAME x FRAME Pixel, Figur zentriert.

Bereinigung: Bildgeneratoren malen manchmal Streupixel oder ganze Nebenobjekte
ins Bild. Behalten wird die größte zusammenhängende Fläche (die Figur) und alles,
was deren Umriss-Rechteck berührt. Der Rest wird gelöscht.

Aufruf:  python3 tools/build_avatar_sheets.py [name ...]
"""
import io, json, sys, urllib.request, zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "avatar"
DIRS = ["south", "east", "north", "west"]
FRAME = 80
WALK = 6


def components(img: Image.Image):
    """Zusammenhängende Flächen nicht-transparenter Pixel (8er-Nachbarschaft)."""
    w, h = img.size
    alpha = img.getchannel("A").load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or alpha[x, y] == 0:
                continue
            stack, pts = [(x, y)], []
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop()
                pts.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and alpha[nx, ny] > 0:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            comps.append(pts)
    return comps


def clean(img: Image.Image) -> Image.Image:
    comps = components(img)
    if len(comps) <= 1:
        return img
    main = max(comps, key=len)
    x0 = min(p[0] for p in main); x1 = max(p[0] for p in main)
    y0 = min(p[1] for p in main); y1 = max(p[1] for p in main)
    px = img.load()
    for c in comps:
        if c is main:
            continue
        touches = any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in c)
        if not touches:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    return img


def trim_spikes(img: Image.Image, passes: int = 4, head_fraction: float = 0.5) -> Image.Image:
    """Entfernt dünne, abstehende Konturspitzen im Kopfbereich (z. B. „Hörnchen“ am Strubbelkopf).

    Ein dunkles Pixel mit höchstens einem undurchsichtigen 4er-Nachbarn ist eine Spitze.
    Mehrere Durchgänge tragen eine Spitze von außen nach innen ab. Normale Konturen haben
    überall mindestens zwei Nachbarn und bleiben unberührt.
    """
    px = img.load()
    w, h = img.size
    limit = int(h * head_fraction)

    def dark(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and max(r, g, b) < 64

    def opaque(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][3] > 0

    for _ in range(passes):
        tips = [
            (x, y)
            for y in range(limit)
            for x in range(w)
            if dark(x, y) and sum(opaque(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1
        ]
        if not tips:
            break
        for x, y in tips:
            px[x, y] = (0, 0, 0, 0)
    return img


def fit(img: Image.Image) -> Image.Image:
    """Zentriert ein Bild beliebiger Größe auf eine FRAME x FRAME-Zelle."""
    cell = Image.new("RGBA", (FRAME, FRAME))
    ox = (FRAME - img.width) // 2
    oy = (FRAME - img.height) // 2
    if ox < 0 or oy < 0:
        img = img.crop((-min(ox, 0), -min(oy, 0), img.width + min(ox, 0), img.height + min(oy, 0)))
        ox, oy = max(ox, 0), max(oy, 0)
    cell.paste(img, (ox, oy))
    return cell


def build(name: str, cfg: dict) -> None:
    url = f"https://api.pixellab.ai/mcp/characters/{cfg['id']}/download"
    z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url).read()))
    files = set(z.namelist())
    walk = cfg.get("walk", "walk")
    sheet = Image.new("RGBA", (FRAME * (WALK + 1), FRAME * len(DIRS)))
    for row, d in enumerate(DIRS):
        anim = sorted(f for f in files if f.startswith(f"Idle/animations/{walk}/{d}/") and f.endswith(".png"))
        # v3-Animationen beginnen mit dem Referenzbild als frame_000; das ist schon das Standbild.
        if len(anim) == WALK + 1:
            anim = anim[1:]
        if len(anim) != WALK:
            raise SystemExit(f"{name}: {walk}/{d} hat {len(anim)} Frames, erwartet {WALK}")
        frames = [f"Idle/rotations/{d}.png"] + anim
        for col, f in enumerate(frames):
            img = trim_spikes(clean(Image.open(z.open(f)).convert("RGBA")))
            sheet.paste(fit(img), (col * FRAME, row * FRAME))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f"{name}.png", optimize=True)
    print(f"ok  {name}.png")


def main() -> None:
    chars = json.loads((ROOT / "tools" / "avatar_characters.json").read_text())
    for n in sys.argv[1:] or list(chars):
        try:
            build(n, chars[n])
        except SystemExit as e:
            print(f"--  {e}")


if __name__ == "__main__":
    main()
