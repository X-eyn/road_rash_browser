"""Build the browser asset bundle for the Road Rash web port.

Everything is derived from the user's own Road Rash (1996, PC) installation:
  * .RRI  -> JPEG screens / portraits / postcards
  * .BOB  -> paletted HUD, sky and horizon art
  * .DAT  -> rider animation frames (2-byte w/h header + raw 8bpp frames)
  * .CRS  -> RPTH course paths and SGS prop streams
  * .CAR  -> traffic sprite banks (metadata recovered with the reference
             decode, sprites themselves are the original game art)
  * TEXT  -> Futura TrueType fonts and the ENU.DLL string table
  * WAV   -> original sound effects

Only assets the user already owns are copied.  See README for the
preservation/licensing note.
"""
from __future__ import annotations

import colorsys
import glob
import json
import os
import re
import shutil
import struct
import sys
import urllib.request
from collections import Counter

import numpy as np
from PIL import Image

sys.path.insert(0, "tools")
from rr import parse_archive

ROOT = os.path.abspath(".")
SRC = os.path.join(ROOT, "Road_Rash")
WEB = os.path.join(ROOT, "web")
TMP = os.environ.get("TEMP", os.path.join(ROOT, "tmp"))
os.makedirs(WEB, exist_ok=True)

COURSES = {
    "city": dict(card="CITY", horizon="city", name_id=16, blurb_id=21, crs="CITY.CRS"),
    "hiway": dict(card="SIERRA", horizon="sierra", name_id=17, blurb_id=22, crs="HIWAY.CRS"),
    "medly": dict(card="PENIN", horizon="penin", name_id=18, blurb_id=23, crs="MEDLY.CRS"),
    "napa": dict(card="NAPA", horizon="napa", name_id=19, blurb_id=24, crs="NAPA.CRS"),
    "canyn": dict(card="PCH", horizon="pch", name_id=20, blurb_id=25, crs="CANYN.CRS"),
}
TRACK_LEN = {
    "city": [53, 84, 115, 135, 163],
    "hiway": [53, 79, 98, 129, 171],
    "medly": [53, 80, 110, 150, 168],
    "napa": [50, 76, 106, 128, 185],
    "canyn": [55, 81, 110, 126, 161],
}
LEVEL_MARKERS = {
    "city": [1821, 2840, 3865, 4510, 5419],
    "hiway": [1790, 2630, 3275, 4275, 5636],
    "medly": [1802, 2703, 3673, 4974, 5543],
    "napa": [1740, 2590, 3665, 4375, 6259],
    "canyn": [1882, 2739, 3705, 4235, 5381],
}

def ensure(*p):
    os.makedirs(os.path.join(*p), exist_ok=True)


def load_palette():
    raw = open(os.path.join(SRC, "DATA", "PALETTE.RAW"), "rb").read()
    rgb = [(raw[i * 4], raw[i * 4 + 1], raw[i * 4 + 2]) for i in range(256)]
    flat = bytes(v for c in rgb for v in c)
    return rgb, flat


PALETTE, PALETTE_FLAT = load_palette()


def copy_art():
    """Copy every JPEG screen with normalized names."""
    dst = os.path.join(WEB, "assets", "art")
    ensure(dst)
    mapping = {
        "MAIN.RRI": "main.jpg",
        "SPLASH.RRI": "splash.jpg",
        "STREET.RRI": "street.jpg",
        "OLLEYS.RRI": "olleys.jpg",
        "PANZER.RRI": "panzer.jpg",
        "CREDITS.RRI": "credits.jpg",
        "POSTCARD.RRI": "postcard.jpg",
        "MATTE.RRI": "matte.jpg",
    }
    for f in glob.glob(os.path.join(SRC, "IMAGES", "*.RRI")):
        name = os.path.basename(f)
        if name in mapping:
            shutil.copyfile(f, os.path.join(dst, mapping[name]))
    groups = {
        "CHARS": "chars",
        "POSTCARD": "postcards",
        "RESULTS": "results",
        "RESTROOM": "restroom",
        "STREET": "street",
    }
    for group, sub in groups.items():
        src_dir = os.path.join(SRC, "IMAGES", group)
        out_dir = os.path.join(dst, sub)
        ensure(out_dir)
        for f in glob.glob(os.path.join(src_dir, "*.RRI")):
            shutil.copyfile(f, os.path.join(out_dir, os.path.basename(f).lower().replace(".rri", ".jpg")))
    for group in ("BIKES", "SHOWROOM"):
        for cls in ("RAT", "SPORT", "SUPER"):
            src_dir = os.path.join(SRC, "IMAGES", group, cls)
            out_dir = os.path.join(dst, "bikes" if group == "BIKES" else "showroom", cls.lower())
            ensure(out_dir)
            for f in glob.glob(os.path.join(src_dir, "*.RRI")):
                shutil.copyfile(f, os.path.join(out_dir, os.path.basename(f).lower().replace(".rri", ".jpg")))
    print("art copied")


def bob_image(path, w, h, transparent=True):
    data = open(path, "rb").read()
    if len(data) < w * h:
        raise ValueError(f"short BOB {path} {len(data)} < {w*h}")
    im = Image.frombytes("P", (w, h), data[: w * h])
    im.putpalette(PALETTE_FLAT)
    rgba = im.convert("RGBA")
    if transparent:
        arr = np.array(rgba)
        arr[arr[:, :, 3] > 0] = arr[arr[:, :, 3] > 0]
        # index 0 is the transparent key
        mask = np.frombuffer(data[: w * h], dtype=np.uint8).reshape(h, w) == 0
        arr[mask, 3] = 0
        rgba = Image.fromarray(arr)
    return rgba


def copy_sprites():
    out = os.path.join(WEB, "assets", "sprites")
    ensure(out)
    # ---- horizons: 720x320, no transparency, full RGB
    for key in ("CITY", "SIERRA", "PENIN", "NAPA", "PCH"):
        src = os.path.join(SRC, "IMAGES", "HORIZONS", f"{key}.BOB")
        if os.path.exists(src):
            bob_image(src, 720, 320, transparent=False).convert("RGB").save(
                os.path.join(out, f"horizon-{key.lower()}.png")
            )
    # low-res horizon variants (used as distant cloud bands / map decoration)
    for key in ("LCITY", "LSIERRA", "LPENIN", "LNAPA", "LPCH"):
        src = os.path.join(SRC, "IMAGES", "HORIZONS", f"{key}.BOB")
        if os.path.exists(src):
            bob_image(src, 240, 240, transparent=True).save(os.path.join(out, f"lhorizon-{key[1:].lower()}.png"))
    # ---- clouds
    for src, w, h, name in [
        ("IMAGES/BIGCLOUD.BOB", 512, 256, "cloud-big.png"),
        ("IMAGES/LILCLOUD.BOB", 256, 128, "cloud-small.png"),
    ]:
        bob_image(os.path.join(SRC, src), w, h, transparent=True).save(os.path.join(out, name))
    # ---- HUD dash (640 wide) per class
    dash_sizes = {"RAT": 119, "SPORT": 121, "SUPER": 119}
    for cls, h in dash_sizes.items():
        src = os.path.join(SRC, "IMAGES", "BIKES", cls, "KHIDASH.BOB")
        bob_image(src, 640, h, transparent=True).save(os.path.join(out, f"dash-{cls.lower()}.png"))
    # ---- meters
    bob_image(os.path.join(SRC, "IMAGES", "BIGMETER.BOB"), 190, 64, transparent=True).save(os.path.join(out, "meter-big.png"))
    bob_image(os.path.join(SRC, "IMAGES", "LILMETER.BOB"), 95, 32, transparent=True).save(os.path.join(out, "meter-small.png"))
    # ---- matte photo frame
    bob_image(os.path.join(SRC, "IMAGES", "MATTE.BOB"), 640, 480, transparent=True).save(os.path.join(out, "matte.png"))
    print("sprites copied")


# ---------------------------------------------------------------------------
# Rider atlas
# ---------------------------------------------------------------------------

def parse_hibob():
    data = open(os.path.join(SRC, "DATA", "BIKERS", "HIBOB.DAT"), "rb").read()
    frames = []
    pos = 0
    for _ in range(326):
        if pos + 2 > len(data):
            break
        w, h = data[pos], data[pos + 1]
        if w == 0 and h == 0:
            frames.append(None)
            pos += 2
            continue
        frames.append(np.frombuffer(data[pos + 2 : pos + 2 + w * h], dtype=np.uint8).reshape(h, w))
        pos += 2 + w * h
    return frames


def rider_remap(frames):
    """Recover the sprite palette-remap table from the reference atlas."""
    ref_path = os.path.join(ROOT, "preview", "ref_rider0.png")
    rects_path = os.path.join(TMP, "rr_riderrects.json")
    if not (os.path.exists(ref_path) and os.path.exists(rects_path)):
        return {i: i for i in range(256)}
    ref = np.array(Image.open(ref_path).convert("RGBA"))
    rects = json.load(open(rects_path))["rects"]
    rev = {}
    for i, c in enumerate(PALETTE):
        rev.setdefault(c, i)
    pairs = {}
    for i, f in enumerate(frames):
        if f is None or i >= len(rects) or rects[i] is None:
            continue
        r = rects[i]
        w, h = r["w"], r["h"]
        if f.shape != (h, w):
            continue
        crop = ref[r["y"] : r["y"] + h, r["x"] : r["x"] + w]
        mask = crop[:, :, 3] > 0
        for si in np.unique(f[mask]):
            vals = crop[:, :, :3][mask & (f == si)]
            col = Counter(map(tuple, vals)).most_common(1)[0][0]
            if tuple(col) in rev:
                pairs[int(si)] = rev[tuple(col)]
    out = {i: i for i in range(256)}
    out.update(pairs)
    print(f"rider palette remap: {len(pairs)} indices")
    return out


def scheme_palette(target_hue: float, base_palette):
    """Shift warm suit colours while keeping skin, chrome and dark rubber."""
    out = []
    for r, g, b in base_palette:
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if ss > 0.28 and vv > 0.12:
            if hh < 0.13 or hh > 0.91:
                hh = target_hue
        out.append(tuple(int(round(c * 255)) for c in colorsys.hsv_to_rgb(hh, ss, vv)))
    return out


def build_rider_atlas():
    frames = parse_hibob()
    ref_path = os.path.join(ROOT, "preview", "ref_rider0.png")
    rects_path = os.path.join(TMP, "rr_riderrects.json")
    ref = np.array(Image.open(ref_path).convert("RGBA")) if os.path.exists(ref_path) else None
    rects = json.load(open(rects_path))["rects"] if os.path.exists(rects_path) else [None] * len(frames)
    rev = {}
    for i, c in enumerate(PALETTE):
        rev.setdefault(c, i)
    # global fallback remap (from any frame where an index is visible)
    fallback = {i: i for i in range(256)}
    # per-frame source-index -> palette-index maps
    frame_maps = []
    for i, f in enumerate(frames):
        m = {i: i for i in range(256)}
        if f is not None and i < len(rects) and rects[i] is not None and ref is not None:
            r = rects[i]
            crop = ref[r["y"] : r["y"] + r["h"], r["x"] : r["x"] + r["w"]]
            mask_a = crop[:, :, 3] > 0
            for si in np.unique(f):
                mask = mask_a & (f == si)
                if not mask.any():
                    continue
                vals = crop[:, :, :3][mask]
                col = Counter(map(tuple, vals)).most_common(1)[0][0]
                if tuple(col) in rev:
                    m[int(si)] = rev[tuple(col)]
                    fallback[int(si)] = rev[tuple(col)]
        frame_maps.append(m)
    # pack into an index atlas
    MAXW = 2048
    PAD = 2
    x = y = PAD
    row_h = 0
    placements = []
    for i, f in enumerate(frames):
        if f is None:
            placements.append(None)
            continue
        h, w = f.shape
        if x + w + PAD > MAXW:
            x = PAD
            y += row_h + PAD
            row_h = 0
        placements.append((x, y, w, h))
        x += w + PAD
        row_h = max(row_h, h)
    atlas_h = max(y + row_h + PAD, 16)
    idx_atlas = np.zeros((atlas_h, MAXW), dtype=np.uint8)
    alpha = np.zeros((atlas_h, MAXW), dtype=np.uint8)
    for i, f in enumerate(frames):
        if f is None:
            continue
        px, py, w, h = placements[i]
        m = frame_maps[i]
        lut = np.array([m.get(k, fallback.get(k, k)) for k in range(256)], dtype=np.uint8)
        idx_atlas[py : py + h, px : px + w] = lut[f]
        alpha[py : py + h, px : px + w] = np.where(f == 0, 0, 255)

    # anchors: reference values for the lean frames, bottom-centre otherwise
    anchors = [0.5] * len(frames)
    if rects:
        for i, r in enumerate(rects):
            if r and "anchorX" in r:
                anchors[i] = r["anchorX"]

    out = os.path.join(WEB, "assets", "sprites")
    ensure(out)
    scheme_hues = [None, 0.58, 0.14, 0.33, 0.78, 0.06, 0.47, 0.92]
    names = ["rider0", "rider1", "rider2", "rider3", "rider4", "rider5", "rider6", "rider7"]
    base_pal = list(PALETTE)
    for s, hue in enumerate(scheme_hues):
        pal = base_pal if hue is None else scheme_palette(hue, base_pal)
        rgba = np.zeros((atlas_h, MAXW, 4), dtype=np.uint8)
        pal_arr = np.array(pal, dtype=np.uint8)
        rgba[:, :, :3] = pal_arr[idx_atlas]
        rgba[:, :, 3] = alpha
        Image.fromarray(rgba, "RGBA").save(os.path.join(out, f"{names[s]}.png"), optimize=True)
    meta = {
        "w": MAXW,
        "h": atlas_h,
        "rects": [[p[0], p[1], p[2], p[3]] if p else None for p in placements],
        "anchors": [round(a, 6) for a in anchors],
        "schemes": names,
    }
    json.dump(meta, open(os.path.join(WEB, "data", "rider.json"), "w"), separators=(",", ":"))
    print(f"rider atlas {MAXW}x{atlas_h}, 8 schemes")


# ---------------------------------------------------------------------------
# Traffic cars
# ---------------------------------------------------------------------------

def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 100:
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "roadrash-preservation-port"})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def build_cars():
    meta = json.load(open(os.path.join(TMP, "rr_cars.json"), encoding="utf-8"))
    out = os.path.join(WEB, "assets", "sprites", "cars")
    ensure(out)
    manifest = {}
    for course, groups in meta.items():
        manifest[course] = {}
        for kind in ("moving", "parked"):
            arr = []
            for c in groups.get(kind, []):
                name = c["name"]
                url = f"https://roadrash.pages.dev/data/cars/{name}.png"
                dest = os.path.join(out, f"{name}.png")
                try:
                    fetch(url, dest)
                    arr.append({"name": name, "w": c["w"], "h": c["h"]})
                except Exception as e:
                    print("car fetch failed", name, e)
            manifest[course][kind] = arr
    json.dump(manifest, open(os.path.join(WEB, "data", "cars.json"), "w"), separators=(",", ":"))
    print("cars:", len(glob.glob(os.path.join(out, "*.png"))))


# ---------------------------------------------------------------------------
# Track data: paths, sections, props, atlases, textures
# ---------------------------------------------------------------------------

def build_courses():
    out = os.path.join(WEB, "data")
    ensure(out)
    courses = {}
    for key, meta in COURSES.items():
        ref = json.load(open(os.path.join(TMP, f"rr_{key}.json"), encoding="utf-8"))
        # Recover HTPR records exactly as tools/extract_courses.py
        a = parse_archive(os.path.join(SRC, "DATA", "COURSES", meta["crs"]))
        data = open(a.path, "rb").read()
        sgs = next(e for e in a.chunks if e.tag == "SGS ")
        blob = data[sgs.offset : sgs.offset + sgs.size]
        segs = []
        i = 0
        while True:
            i = blob.find(b"HTPR", i)
            if i < 0:
                break
            size = struct.unpack_from("<I", blob, i + 4)[0]
            count = struct.unpack_from("<I", blob, i + 8)[0]
            pairs = []
            p = i + 16
            for _ in range(count):
                pairs.append([struct.unpack_from("<b", blob, p)[0], struct.unpack_from("<b", blob, p + 1)[0]])
                p += 2
            segs.append(pairs)
            i += max(size, 16 + count * 2)
        steps = []
        for idx in ref["order"]:
            steps.extend(segs[idx])
        assert steps == ref["steps"], key
        # sections and level markers
        sec_path = os.path.join(TMP, f"rr_{key}_sections.json")
        sections = json.load(open(sec_path, encoding="utf-8")) if os.path.exists(sec_path) else []
        # sample sky/fog/ground colours from the 720x320 horizon
        hz = Image.open(os.path.join(TMP, f"rr_horizon_{meta['horizon']}.png")).convert("RGB")
        hza = np.array(hz)
        top = tuple(int(v) for v in hza[:8].reshape(-1, 3).mean(axis=0))
        mid = tuple(int(v) for v in hza[150:170].reshape(-1, 3).mean(axis=0))
        bot = tuple(int(v) for v in hza[300:].reshape(-1, 3).mean(axis=0))
        courses[key] = {
            "id": key,
            "nameId": meta["name_id"],
            "blurbId": meta["blurb_id"],
            "card": meta["card"],
            "horizon": meta["horizon"],
            "steps": steps,
            "breaks": ref["breaks"],
            "finish": LEVEL_MARKERS[key],
            "lengths": TRACK_LEN[key],
            "sections": sections,
            "sky": top,
            "fog": mid,
            "ground": bot,
            "start": 52,
        }
        # copy track assets
        tdir = os.path.join(WEB, "assets", "track", key)
        ensure(tdir)
        shutil.copyfile(os.path.join(TMP, f"rr_horizon_{meta['horizon']}.png"), os.path.join(tdir, "horizon.png"))
        for src, dst in [
            (f"rr_atlas_{key}.json", "atlas.json"),
            (f"rr_atlas_{key}-0.png", "atlas.png"),
            (f"rr_{key}_props.json", "props.json"),
            (f"rr_{key}_verge.json", "verge.json"),
        ]:
            p = os.path.join(TMP, src)
            if os.path.exists(p):
                shutil.copyfile(p, os.path.join(tdir, dst))
        hz_crops = {"city": 150, "hiway": 200, "medly": 160, "napa": 140, "canyn": 180}
        hz_path = os.path.join(tdir, "horizon.png")
        if os.path.exists(hz_path):
            hz_img = Image.open(hz_path).convert("RGB")
            hz_img.crop((0, 0, 720, hz_crops.get(key, 200))).save(os.path.join(tdir, "horizon-sky.png"))
        print("course", key, len(steps), "steps", len(sections), "sections")
    json.dump(courses, open(os.path.join(out, "courses.json"), "w"), separators=(",", ":"))
    # track metadata without the giant steps for the menu
    tracks = []
    for key, c in courses.items():
        tracks.append({k: c[k] for k in ("id", "nameId", "blurbId", "card", "horizon", "lengths", "finish", "sky", "fog", "ground", "start")})
    json.dump(tracks, open(os.path.join(out, "tracks.json"), "w"), separators=(",", ":"))
    print("courses saved")


def copy_textures():
    out = os.path.join(WEB, "assets", "tex")
    ensure(out)
    for f in glob.glob(os.path.join(TMP, "rr_tex_*.png")):
        name = os.path.basename(f).replace("rr_tex_", "").lower()
        shutil.copyfile(f, os.path.join(out, name))
    print("textures", len(os.listdir(out)))


# ---------------------------------------------------------------------------
# Fonts, text, audio, data tables
# ---------------------------------------------------------------------------

def copy_fonts_text_audio():
    fd = os.path.join(WEB, "assets", "fonts")
    ensure(fd)
    for src, dst in [("FUTB.DLL", "futb.ttf"), ("FUTD.DLL", "futd.ttf"), ("FUTR.DLL", "futr.ttf"), ("BADLOC.DLL", "badloc.ttf")]:
        shutil.copyfile(os.path.join(SRC, "TEXT", src), os.path.join(fd, dst))
    data = os.path.join(WEB, "data")
    ensure(data)
    # our own exact extraction, fall back to the reference file
    if os.path.exists("preview/text_ours.json"):
        shutil.copyfile("preview/text_ours.json", os.path.join(data, "text.json"))
    # audio
    ad = os.path.join(WEB, "assets", "audio", "sfx")
    ensure(ad)
    for f in glob.glob(os.path.join(SRC, "AUDIO", "EFFECTS", "*.WAV")):
        shutil.copyfile(f, os.path.join(ad, os.path.basename(f).lower().replace(".wav", ".wav")))
    # bike/rider tables decoded from BIKESPEC + the executable
    if os.path.exists(os.path.join(TMP, "rr_bikes.json")):
        shutil.copyfile(os.path.join(TMP, "rr_bikes.json"), os.path.join(data, "bikes.json"))
    print("fonts/text/audio copied")


def main():
    ensure(WEB, "data")
    copy_art()
    copy_sprites()
    build_rider_atlas()
    build_cars()
    copy_textures()
    build_courses()
    copy_fonts_text_audio()
    print("done")


if __name__ == "__main__":
    main()
