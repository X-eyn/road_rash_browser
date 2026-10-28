import os, re, json

s = open(os.path.join(os.environ["TEMP"], "rr_race.js"), encoding="utf-8", errors="ignore").read()
print("race.js len", len(s))
print(s[:3500])
print("--- asset strings")
paths = sorted(set(re.findall(r"""["'`]([^"'`]*assets/[^"'`]+)["'`]""", s)))
for p in paths[:150]:
    print(p)
print("--- terms")
for k in ["CRS", "course", "track", "horizon", "famil", "biker", "rider", "sprite", "terrain", "road", "sky", "texture", "city", "napa", "hiway"]:
    print(k, s.lower().count(k.lower()))
print("--- bikes.json keys")
b = json.load(open(os.path.join(os.environ["TEMP"], "rr_bikes.json")))
print(json.dumps(b, indent=1)[:3500])
print("--- text.json sample")
t = json.load(open(os.path.join(os.environ["TEMP"], "rr_text.json")))
for i in [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 40, 58, 59, 60, 61, 62, 63, 96, 112, 128, 144]:
    print(i, t.get(str(i)))
