from PIL import Image
from collections import Counter, defaultdict
import numpy as np
import json, os

b = open(r"Road_Rash\DATA\BIKERS\HIBOB.DAT", "rb").read()

# parse frames
frames = []
pos = 0
for idx in range(326):
    w, h = b[pos], b[pos + 1]
    if w == 0 and h == 0:
        frames.append(None)
        pos += 2
    else:
        frames.append((w, h, np.frombuffer(b[pos + 2 : pos + 2 + w * h], dtype=np.uint8).reshape(h, w)))
        pos += 2 + w * h
print("parsed frames", len(frames), "end", hex(pos), "file", hex(len(b)))

refatlas = Image.open("preview/ref_rider0.png").convert("RGBA")
rects = json.load(open(os.path.join(os.environ["TEMP"], "rr_riderrects.json")))["rects"]

# palette reverse map
pal = open(r"Road_Rash\DATA\PALETTE.RAW", "rb").read()
pal_bgr = [(pal[i * 4 + 2], pal[i * 4 + 1], pal[i * 4]) for i in range(256)]
rev = defaultdict(list)
for i, c in enumerate(pal_bgr):
    rev[c].append(i)

pairs = defaultdict(Counter)
for i, f in enumerate(frames):
    if f is None or rects[i] is None:
        continue
    w, h, idx = f
    r = rects[i]
    if (r["w"], r["h"]) != (w, h):
        print("rect mismatch", i)
        continue
    crop = np.array(refatlas.crop((r["x"], r["y"], r["x"] + w, r["y"] + h)))
    mask = crop[:, :, 3] > 0
    if mask.sum() == 0:
        continue
    for si in np.unique(idx[mask]):
        vals = crop[:, :, :3][mask & (idx == si)]
        c = Counter(map(tuple, vals))
        pairs[int(si)].update(dict(c))

print("source indices seen", len(pairs))
consistent = 0
for si in sorted(pairs):
    tot = sum(pairs[si].values())
    col, n = pairs[si].most_common(1)[0]
    share = n / tot
    if share > 0.999:
        consistent += 1
print("fully consistent", consistent)

# map each source index to dominant reference rgb; then to palette index if exact
remap = {}
exact = 0
for si in sorted(pairs):
    col = pairs[si].most_common(1)[0][0]
    if col in rev:
        remap[si] = rev[col][0]
        exact += 1
    else:
        # nearest palette colour
        best = min(range(256), key=lambda j: sum((pal_bgr[j][k] - col[k]) ** 2 for k in range(3)))
        remap[si] = best
print("exact palette matches", exact, "of", len(pairs))
# show mapping for first 40 source indices
for si in sorted(pairs)[:50]:
    col = pairs[si].most_common(1)[0][0]
    print(f"src {si:3d} -> pal {remap[si]:3d} {pal_bgr[remap[si]]} ref {col}")
json.dump(remap, open("preview/rider_remap.json", "w"))
