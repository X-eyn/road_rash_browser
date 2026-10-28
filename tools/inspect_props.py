import re, os
s = open(os.path.join(os.environ["TEMP"], "rr_race.js"), encoding="utf-8", errors="ignore").read()
for key in ["RROB", "propSpot", "props", "PROP_PX", "terrainY"]:
    print("=" * 20, key)
    for m in list(re.finditer(key, s))[:4]:
        a = max(0, m.start() - 600)
        b = min(len(s), m.end() + 1200)
        print(s[a:b].replace("\n", " ")[:1800])
        print("---")
