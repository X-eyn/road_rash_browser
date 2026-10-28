# Local setup for the public GitHub repo

This repository contains the **port source code and extraction tools only**.
The original Road Rash (1996) game files and the extracted EA assets are
intentionally not committed to a public repository.

## To get the full playable build

You need the local working copy or the `road_rash_browser_FULL.zip` archive
created alongside this project. It contains:

- `Road_Rash/` — the user's original game installation
- `web/assets/` — extracted sprites, art, fonts, audio and track assets
- `web/data/` — decoded course paths, bike/rider tables, text and metadata

Copy those three folders into the repository root, then run:

```bat
play.bat
```

or:

```bat
python -m http.server 8080 --directory web
```

## Rebuilding assets from the original game

1. Put your legally owned Road Rash (1996, PC) installation in `Road_Rash/`.
2. Install Python 3, Pillow and NumPy.
3. Run:

```bat
python tools\build_web_assets.py
```

The script also pulls the already-extracted car/track atlas PNGs from the
reference fan decode. Those are original game art; keep them local.

## Why assets are excluded

`Road_Rash/`, `web/assets/`, `web/data/` and `preview/` contain Electronic
Arts artwork, audio, fonts and text. A public GitHub repository must not
redistribute them. If you need the assets in Git, make the repository
**private** first and then add them.
