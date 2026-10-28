import os, re, json

s = open(os.path.join(os.environ["TEMP"], "rr_race.js"), encoding="utf-8", errors="ignore").read()
for pat in [r'\./data/[^"\'`\s)]+', r'\./assets/[^"\'`\s)]+', r'raceJSON\([^)]*\)', r'fetch\([^)]*\)']:
    print("====", pat)
    for m in sorted(set(re.findall(pat, s)))[:120]:
        print(m)
print("=== string literals that look like asset ids")
for m in sorted(set(re.findall(r'"([A-Za-z0-9_\-/.]{4,60})"', s))):
    if any(k in m.lower() for k in ["png", "webp", "jpg", "json", "sfx", "dash", "rider", "bike", "horizon", "city", "napa", "hiway", "road", "sky"]):
        print(m)
print("=== texture loading section")
for m in re.finditer(r'loadTexture|TextureLoader|new THREE\.Texture|tex\(', s):
    a = max(0, m.start() - 200); b = min(len(s), m.end() + 400)
    print(s[a:b].replace("\n", " ")[:700])
    print("---")
