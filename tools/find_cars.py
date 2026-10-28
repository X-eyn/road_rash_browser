from PIL import Image
import numpy as np
import os, json

pal = open(r"Road_Rash\DATA\PALETTE.RAW", "rb").read()
palcols = [(pal[i * 4], pal[i * 4 + 1], pal[i * 4 + 2]) for i in range(256)]
rev = {}
for i, c in enumerate(palcols):
    rev.setdefault(c, i)

car = open(r"Road_Rash\DATA\CARS\CITY.CAR", "rb").read()
for name in ["GOLFG00", "TAXIG00", "TERCLC00", "PORCHC00", "MAZDAG00"]:
    im = Image.open(f"preview/ref_{name.lower()}.png").convert("RGBA") if os.path.exists(f"preview/ref_{name.lower()}.png") else None
    if im is None:
        print("missing ref", name)
        continue
    a = np.array(im)
    idx = np.zeros(a.shape[:2], dtype=np.uint8)
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] == 0:
                continue
            idx[y, x] = rev.get(tuple(a[y, x, :3]), 0)
    data = idx.tobytes()
    print(name, im.size, "raw bytes", len(data))
    pos = car.find(data)
    print("  exact full match", hex(pos) if pos >= 0 else None)
    # try first nontransparent row sequence
    for y in range(a.shape[0]):
        row = idx[y].tobytes()
        if row.count(0) == len(row):
            continue
        p = car.find(row)
        if p >= 0:
            print("  row", y, "at", hex(p))
            break
    # header search
    w, h = im.size
    pat = bytes([w, h])
    offs = []
    i = 0
    while True:
        i = car.find(pat, i)
        if i < 0:
            break
        offs.append(i)
        i += 1
    print("  header candidates", [hex(o) for o in offs[:12]], "count", len(offs))
