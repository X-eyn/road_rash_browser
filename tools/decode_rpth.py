import struct, json, os, re

b = open(r"Road_Rash\DATA\COURSES\CITY.CRS", "rb").read()
ref = json.load(open(os.path.join(os.environ["TEMP"], "rr_city.json")))
refsteps = [tuple(s) for s in ref["steps"]]
print("ref steps", len(refsteps), "breaks", ref["breaks"][:20])

# find HTPR records
recs = []
for m in re.finditer(b"HTPR", b):
    off = m.start()
    size = struct.unpack_from("<I", b, off + 4)[0]
    f1 = struct.unpack_from("<I", b, off + 8)[0]
    f2 = struct.unpack_from("<H", b, off + 12)[0]
    f3 = struct.unpack_from("<H", b, off + 14)[0]
    recs.append((off, size, f1, f2, f3))
print("HTPR records", len(recs))
for r in recs:
    print(hex(r[0]), "size", hex(r[1]), "f1", r[2], "f2", r[3], "f3", r[4])

# try to locate each record's step data inside refsteps
for off, size, f1, f2, f3 in recs:
    found = False
    for hdr in range(8, 24):
        data = b[off + hdr : off + size]
        n = len(data) // 2
        steps = [(struct.unpack_from("<b", data, i * 2)[0], struct.unpack_from("<b", data, i * 2 + 1)[0]) for i in range(n)]
        # search for 30-step run
        for rev in (False, True):
            s = list(reversed(steps)) if rev else steps
            for start in range(0, len(s) - 30):
                key = s[start : start + 30]
                # find key in ref
                idx = next((i for i in range(len(refsteps) - 30) if refsteps[i : i + 30] == key), None)
                if idx is not None:
                    print(f"off {off:#x} hdr {hdr} rev {rev} matches ref at {idx} len {n}")
                    found = True
                    break
            if found:
                break
        if found:
            break
    if not found:
        print(f"off {off:#x} no match (first pairs)", end=" ")
        # print first few pairs at hdr 12/16
        for hdr in (12, 16):
            data = b[off + hdr : off + size]
            n = min(6, len(data) // 2)
            print(hdr, [(struct.unpack_from("<b", data, i * 2)[0], struct.unpack_from("<b", data, i * 2 + 1)[0]) for i in range(n)], end="; ")
        print()
