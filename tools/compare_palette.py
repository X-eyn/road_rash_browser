from PIL import Image
from collections import Counter
import numpy as np

b = open(r"Road_Rash\DATA\BIKERS\HIBOB.DAT", "rb").read()
w, h = b[0], b[1]
idx = np.frombuffer(b[2 : 2 + w * h], dtype=np.uint8).reshape(h, w)
ref = np.array(Image.open("preview/ref_rider0.png").convert("RGBA").crop((0, 0, w, h)))
pal = open(r"Road_Rash\DATA\PALETTE.RAW", "rb").read()


def palcol(i, mode):
    q = pal[i * 4 : i * 4 + 4]
    if mode == "bgr":
        return (q[2], q[1], q[0])
    return (q[0], q[1], q[2])


print("used indices", len(np.unique(idx)))
mapping = {}
for i in np.unique(idx):
    m = idx == i
    vals = ref[m][:, :3]
    al = ref[m][:, 3]
    good = vals[al > 0]
    if len(good) == 0:
        continue
    c = Counter(map(tuple, good))
    mapping[int(i)] = c.most_common(1)[0][0]
for i in sorted(mapping):
    c = Counter(map(tuple, ref[idx == i][:, :3][ref[idx == i][:, 3] > 0]))
    total = max(1, (ref[idx == i][:, 3] > 0).sum())
    share = c.most_common(1)[0][1] / total
    print(f"{i:3d} ref={mapping[i]} share={share:.2f} palBGR={palcol(i,'bgr')} palRGB={palcol(i,'rgb')}")
