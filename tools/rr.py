"""Road Rash (1996 PC) asset format helpers.

CRSR container layout (little-endian):
  0x00  'CRSR0\\0\\0\\0'
  0x08  u32 top-level chunk count
  0x0C  top-level chunk descriptors (44/52 bytes, see below)
  ...
The useful directory is a 'LBTR' (reversed 'RTBL') chunk:
  tag 'LBTR'
  u32 total_chunk_size (header included)
  u32 entry_count
  u32 0
  entries: tag[4], u32 index, u32 offset, u32 size, 16 reserved bytes

Tags are stored byte-reversed: 'LBTR'->RTBL, 'CEPS'->SPEC, 'MINA'->ANIM,
' LEC'-> CEL, ' DON'-> NOD.
"""
from __future__ import annotations

import os
import struct
import re
from dataclasses import dataclass


def rev4(tag: bytes) -> str:
    return tag[::-1].decode("latin-1")


@dataclass
class Entry:
    tag: str
    index: int
    offset: int
    size: int
    reserved: bytes


@dataclass
class Archive:
    path: str
    size: int
    chunks: list[Entry]
    table_offset: int
    table_end: int


def parse_archive(path: str) -> Archive:
    data = open(path, "rb").read()
    if data[:4] != b"CRSR":
        raise ValueError(f"not a CRSR file: {path}")
    # Locate the resource table: an LBTR chunk whose size/count/entries match.
    table = None
    search = 8
    while True:
        pos = data.find(b"LBTR", search)
        if pos < 0:
            raise ValueError(f"no LBTR table: {path}")
        search = pos + 1
        body = struct.unpack_from("<I", data, pos + 4)[0]
        count = struct.unpack_from("<I", data, pos + 8)[0]
        if 0 < count < 4096 and pos + 16 + count * 32 <= len(data):
            ok = True
            for i in range(count):
                _, _, off, sz = struct.unpack_from("<4sIII", data, pos + 16 + i * 32)
                if off >= len(data) or sz > len(data):
                    ok = False
                    break
            if ok and (body == 8 + count * 32 or body == count * 32):
                table = (pos, count)
                break
    pos, count = table
    entries = []
    p = pos + 16
    for _ in range(count):
        tag, index, off, sz = struct.unpack_from("<4sIII", data, p)
        entries.append(Entry(rev4(tag), index, off, sz, data[p + 16 : p + 32]))
        p += 32
    return Archive(path, len(data), entries, pos, p)


def chunk_header(data: bytes, offset: int):
    tag = rev4(data[offset : offset + 4])
    size = struct.unpack_from("<I", data, offset + 4)[0]
    return tag, size


TAG_RE = re.compile(rb"[A-Z ]{4}")


def scan_tags(data: bytes):
    """Yield plausible reversed FourCC records with their following u32."""
    for m in TAG_RE.finditer(data):
        tag = rev4(m.group())
        if tag in {
            "RTBL", "SPEC", "ANIM", "CEL ", "NOD ", "RSEC", "RNOD", "OFST",
            "PCCB", "PAL ", "FONT", "TEXT", "SPRT", "MUS ", "SOUN", "SND ",
        }:
            n = struct.unpack_from("<I", data, m.start() + 4)[0]
            if n < len(data):
                yield m.start(), tag, n


if __name__ == "__main__":
    import sys

    for path in sys.argv[1:]:
        a = parse_archive(path)
        print(f"== {os.path.basename(path)} size={a.size} table@{a.table_offset:#x}")
        for e in a.chunks:
            data = open(path, "rb").read()
            tag, sz = chunk_header(data, e.offset)
            print(
                f"   {e.tag:4s} {e.index:3d} off={e.offset:#08x} size={e.size:#08x}"
                f"  hdr={tag!r} {sz:#x}"
            )
