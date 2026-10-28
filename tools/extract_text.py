import json
import os
import pefile

path = r"Road_Rash\TEXT\ENU.DLL"
pe = pefile.PE(path)
strings = {}
for entry in pe.DIRECTORY_ENTRY_RESOURCE.entries:
    if entry.id != 6:  # RT_STRING
        continue
    for block in entry.directory.entries:
        block_id = block.id
        for lang in block.directory.entries:
            data = pe.get_data(lang.data.struct.OffsetToData, lang.data.struct.Size)
            p = 0
            for i in range(16):
                if p + 2 > len(data):
                    break
                n = int.from_bytes(data[p : p + 2], "little")
                p += 2
                raw = data[p : p + n * 2]
                p += n * 2
                if n:
                    strings[(block_id - 1) * 16 + i] = raw.decode("utf-16le", "replace").replace("\x00", "")
print("strings", len(strings))
ref = json.load(open(os.path.join(os.environ["TEMP"], "rr_text.json"), encoding="utf-8"))
refi = {int(k): v for k, v in ref.items()}
same = 0
for k, v in refi.items():
    if strings.get(k) == v:
        same += 1
print("reference ids", len(refi), "exact matches", same)
for k in [1, 2, 4, 6, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 40, 58, 59, 60, 61, 62, 63, 96, 112, 128, 144, 358, 359]:
    print(k, repr(strings.get(k))[:100], "| ref", repr(refi.get(k))[:100])
json.dump({str(k): v for k, v in strings.items()}, open("preview/text_ours.json", "w"), ensure_ascii=False, indent=1)
