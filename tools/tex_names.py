import re, os
s = open(os.path.join(os.environ["TEMP"], "rr_race.js"), encoding="utf-8", errors="ignore").read()
names = sorted(set(re.findall(r"""tex\(["']([^"']+)["']\)""", s)))
print("tex names", len(names))
print(names)
print("atlas mats", sorted(set(re.findall(r"""atlasMat\(["']([^"']+)["']""", s))))
