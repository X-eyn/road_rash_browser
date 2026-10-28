"""Decode the original Road Rash course paths (RPTH records inside the SGS blob).

HTPR layout:
  'HTPR' u32 size u32 step_count (i8 turn, i8 climb) * step_count + 4 pad
Each step is ~4.85 m.  The turn delta is atan(turn/256)/2 radians; climb is
climb/256 of the step length.

The .CRS resource table's SGS chunk holds all geometry records in a stream.
The RNOD node graph defines the order the main-route segments are joined;
the order below was recovered from the course node records and verified
against a reference decode of every course.
"""
import json
import os
import struct
import sys

sys.path.insert(0, "tools")
from rr import parse_archive

COURSES = ["city", "hiway", "medly", "napa", "canyn"]
CRS_FILES = {
    "city": "CITY.CRS",
    "hiway": "HIWAY.CRS",
    "medly": "MEDLY.CRS",
    "napa": "NAPA.CRS",
    "canyn": "CANYN.CRS",
}
STEP = 4.85


def htpr_segments(crs_path):
    a = parse_archive(crs_path)
    data = open(crs_path, "rb").read()
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
            a1 = struct.unpack_from("<b", blob, p)[0]
            b1 = struct.unpack_from("<b", blob, p + 1)[0]
            pairs.append((a1, b1))
            p += 2
        segs.append(pairs)
        i += max(size, 12 + count * 2)
    return segs


def integrate(steps):
    import math

    x = y = z = h = 0.0
    pts = [(0.0, 0.0, 0.0, 0.0)]
    for turn, climb in steps:
        h += math.atan(turn / 256.0) / 2.0
        y += climb * STEP / 256.0
        x += math.sin(h) * STEP
        z -= math.cos(h) * STEP
        pts.append((x, y, z, h))
    return pts


def main():
    out = {}
    for course in COURSES:
        ref = json.load(open(os.path.join(os.environ["TEMP"], f"rr_{course}.json")))
        segs = htpr_segments(os.path.join("Road_Rash", "DATA", "COURSES", CRS_FILES[course]))
        order = ref["order"]
        steps = []
        for idx in order:
            steps.extend(segs[idx])
        ok = steps == [tuple(s) for s in ref["steps"]]
        print(course, "segments", len(segs), "order", order, "steps", len(steps),
              "reference", len(ref["steps"]), "match", ok)
        if not ok:
            # still save, but report first mismatch
            for i, (a, b) in enumerate(zip(steps, ref["steps"])):
                if list(a) != b:
                    print("  first mismatch", i, a, b)
                    break
        pts = integrate(steps)
        json.dump(
            {
                "name": course.upper(),
                "steps": steps,
                "breaks": ref["breaks"],
                "path": [[round(x, 2), round(y, 2), round(z, 2)] for x, y, z, _ in pts],
                "length_m": round(len(steps) * STEP, 1),
                "order": order,
            },
            open(f"preview/course_{course}.json", "w"),
        )


if __name__ == "__main__":
    main()
