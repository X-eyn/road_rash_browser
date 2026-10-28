from PIL import Image
import numpy as np
import os, glob
from collections import Counter

# collect exact reference colours from the atlas
im = np.array(Image.open("preview/ref_rider0.png").convert("RGBA"))
cols = set(map(tuple, im[:, :, :3][im[:, :, 3] > 0].reshape(-1, 3).tolist()))
print("unique ref colours", len(cols))
rare = [(20, 20, 53), (5, 6, 53), (8, 3, 31), (54, 0, 0), (115, 26, 0)]
files = [r"Road_Rash\RoadRash.exe"] + glob.glob(r"Road_Rash\TEXT\*.DLL") + [
    r"Road_Rash\DATA\GLOBAL.RSC", r"Road_Rash\DATA\BIKESPEC.RSC",
    r"Road_Rash\DATA\FAMILIES.RSC",
]
files += glob.glob(r"Road_Rash\DATA\COURSES\*.CRS") + glob.glob(r"Road_Rash\DATA\CARS\*.CAR")
files += glob.glob(r"Road_Rash\DATA\BIKERS\*.DAT")

def score_block(block, fourcc, channel_order):
    n = len(block) // (4 if fourcc else 3)
    if n < 200:
        return 0
    score = 0
    for i in range(n):
        p = block[i * (4 if fourcc else 3) : i * (4 if fourcc else 3) + 3]
        if channel_order == "bgr":
            c = (p[2], p[1], p[0])
        else:
            c = tuple(p)
        if c in cols:
            score += 1
    return score

best = []
for f in files:
    data = open(f, "rb").read()
    for rc in rare:
        for order in ("rgb", "bgr"):
            pat = bytes(rc if order == "rgb" else rc[::-1])
            start = 0
            while True:
                i = data.find(pat, start)
                if i < 0:
                    break
                start = i + 1
                for four in (True, False):
                    esz = 4 if four else 3
                    base = i - (i % esz)
                    for delta in range(-256 * esz, 1, esz):
                        off = base + delta
                        if off < 0 or off + 256 * esz > len(data):
                            continue
                        blk = data[off : off + 256 * esz]
                        sc = score_block(blk, four, order)
                        if sc > 20:
                            best.append((sc, f, hex(off), four, order, rc, hex(i)))
                if len(best) > 200:
                    break
            if len(best) > 200:
                break
        if len(best) > 200:
            break
    if len(best) > 200:
        break

best.sort(reverse=True)
for b in best[:25]:
    print(b)
