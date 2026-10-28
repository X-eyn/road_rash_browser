# Road Rash '96 — Browser Port

A fan-made, non-commercial **preservation port of Road Rash (1996, PC)** that runs in Chrome/Edge. It uses the original game's five courses, artwork, rider sprites, fonts, text, HUD and sound effects, driven by a small Three.js engine.

> **Repository note:** the public GitHub repo contains source code and tools
> only. The original game install and extracted EA assets are intentionally
> not committed. See [SETUP.md](SETUP.md) for the full local build.

No build step, no npm, no network calls at runtime.

---

## Play

1. Make sure **Python 3** is installed.
2. Double-click **`play.bat`**, or run:

```bat
python -m http.server 8080 --directory web
```

3. Open <http://localhost:8080/> in Chrome or Edge.

A local HTTP server is required because the game uses ES modules and `fetch()`; opening `index.html` directly will not work.

> The first click is also the browser audio-unlock gesture. Turn your volume up.

---

## What's in the port

- **Five original courses**: The City, Sierra Nevada, The Peninsula, Napa Valley, Pacific Highway — decoded from the original `.CRS` `RPTH` road paths (5,606 / 6,075 / 5,645 / 6,319 / 5,443 steps).
- **Original 640×480 art**: title splash, shop/bar/street screens, postcards, character portraits, result screens, weather/horizon panoramas.
- **Original rider animation bank**: 326 frames from `HIBOB.DAT`, including lean, punches, kicks, chain/club swings, crash/tumble, get-up, walk and remount.
- **Original HUD**: dashboard art, gauges, condition LEDs, cloud layers, meters.
- **Original fonts and copy**: Futura Condensed from `FUTB/FUTD/FUTR.DLL`, 1,364 strings from `ENU.DLL`.
- **Original sound effects**: engine loops, crashes, punches, skids, sirens, voices.
- **Career mode**: choose one of eight riders, race five levels on each course, qualify in the top three, earn cash, buy/equip all 15 Rat/Sport/Super bikes.
- **Quick Race**: any course, any level, any bike.
- **Traffic, rivals, combat, police, damage, nitro, crashes, remount**.
- **Keyboard, gamepad and touch controls**.
- **Procedural soundtrack** (the RIP copy contains no CD audio).

---

## Controls

| Action | Keyboard |
|---|---|
| Throttle | `↑` / `W` |
| Brake | `↓` / `S` |
| Steer / lean | `←` `→` / `A` `D` |
| Punch | `J` / `Z` / left click |
| Kick | `K` / `X` / right click |
| Nitro | `Shift` |
| Camera | `C` |
| Pause | `P` / `Esc` |
| Mute | `M` |
| Fullscreen | `F` |

**Touch:** left/right arrows on the left; GAS, BRAKE, PUNCH, KICK and NITRO on the right.

**Gamepad:** left stick steers, A accelerates, B brakes, X punches, Y kicks, RB nitro.

### Race tips

- Stay on the asphalt. Dirt kills your top speed.
- Rivals can be punched or kicked when you are alongside them. A club or chain (character-dependent) hits harder.
- Traffic is solid. Weave through it.
- Police join at level 3+. Lose them or get busted.
- Finish in the top three to unlock the next level in Career.

---

## Structural notes

```
web/                    the playable app (serve this directory)
  index.html
  ui.css
  js/                   data, assets, audio, input, UI, race engine
  assets/
    art/                original JPEG screens, portraits, postcards, results
    sprites/            rider atlases, cars, HUD, horizons, clouds
    track/<course>/     original prop atlas + placements
    tex/                original road/verge textures
    fonts/              Futura TrueType
    audio/sfx/          original WAV effects
  data/                 decoded courses, text, bikes, cars, rider metadata
  lib/three.module.js   Three.js r160 (MIT)

tools/                  reverse-engineering and asset extraction tools
  rr.py                 CRSR/LBTR container parser
  extract_courses.py    RPTH path decoder
  build_web_assets.py   builds web/ from the original game folder
  extract_text.py       ENU.DLL RT_STRING reader
  cdp_test*.mjs         real-time Chrome DevTools smoke tests
Road_Rash/              the user's original game files (not modified)
```

### Formats recovered

- `CRSR0` resource containers with an `LBTR`/`RTBL` table (reversed FourCC tags: `SPEC`, `ANIM`, `CEL `, `NOD `, `SGS `).
- `HTPR` road-path records: `u32 count` + signed `(turn, climb)` bytes. One step ≈ 4.85 m; heading delta `atan(turn/256)/2`; climb `climb/256` of the step. Course segment order comes from the RNOD node graph.
- `HIBOB.DAT`: `[u8 width][u8 height]` + raw 8-bit paletted frame; 326 frames; a per-frame palette remap recovers the original painted colours.
- `*.BOB`: raw paletted screens with `PALETTE.RAW` (RGBX, not BGRX).
- `ENU.DLL`: 1,364 UTF-16 resource strings.
- `BIKESPEC.RSC`: 15 original bike specs (price, gearing, power, braking, steering, weight, tyre, condition).
- `CARS/*.CAR` and prop atlases: original traffic/rider/scenery art.

Three.js is used only for rendering; the gameplay, physics, camera, AI, combat, HUD and audio are implemented here.

---

## Regenerating the web assets

The extracted assets are already included. To rebuild them from your own copy of the game:

```bat
python tools\build_web_assets.py
```

Requires Python 3, Pillow and NumPy. The script reads `Road_Rash/` and rewrites `web/`. It also expects the reference rider-rectangle file used to recover the per-frame rider palette; the built atlas is already checked in.

The original analysis used **REA** (`npx rea-agents`) for PE import/resource inspection; the game's native PE structure is documented in the tool output. No REA install is needed to play.

---

## Debug routes

Append these to the local URL:

- `?boot=skip` — skip the splash click (handy for automated screenshots).
- `?noaudio=1` — disable WebAudio.
- `?screen=tracks|levels|chars|career|shop|options|credits|help|bike|results` — open a screen directly.
- `?autostart=city|hiway|medly|napa|canyn&level=1&bike=4` — start a quick race.
- `?skipcount=1&sim=12` — skip the countdown and synchronously simulate N seconds.
- `?debug=1` — race telemetry overlay.
- `?touch=1` — force touch controls.

---

## Legal / credits

This is a **non-commercial fan preservation project**. It is not affiliated with or endorsed by Electronic Arts.

- **Road Rash** (1996, PC) and all original artwork, audio, text, characters, fonts and bike data are © Electronic Arts. The PC version was developed by Papyrus Design Group.
- The game files under `Road_Rash/` and the extracted assets under `web/assets/` are included only because this is a local preservation build using the user's own copy. **Do not redistribute the extracted original assets.**
- No original CD music is included. The soundtrack is a procedural tribute generated in the browser.
- Three.js is © three.js authors, MIT licensed.
- Reverse-engineering/format work was assisted by **REA** (morluto/rea).

If you enjoy this, support the original creators and buy a legitimate copy of Road Rash.
