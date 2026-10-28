import re, os

path = os.path.join(os.environ["TEMP"], "rr_app.js")
s = open(path, encoding="utf-8", errors="ignore").read()
paths = sorted(set(re.findall(r"""["'`]([^"'`]*assets/[^"'`]+)["'`]""", s)))
print("asset paths:", len(paths))
for p in paths[:250]:
    print(p)
print("--- key terms")
for k in ["CRS", "course", "track", "biker", "rider", "car", "horizon", "famil", "spec", "mip", "palette", "ROADRASH"]:
    print(k, s.lower().count(k.lower()))
print("--- asset dirs")
from collections import Counter
c = Counter(p.split("/")[1] for p in paths if p.startswith("assets/") and len(p.split("/")) > 1)
print(c)
