# Week recap videos

60-second motion-graphic recaps shown at the top of each week on the site (`../videos/`).

- `weeks/w2.json` and `scripts/specs.py` (writes w3–w13): the scripts. `say` is the voiceover; any `cue` word pins a graphic to the moment it is spoken.
- `python scripts/tts.py [w5 ...]`: voices scenes (edge-tts, en-AU-WilliamNeural) → `public/audio/`, `src/data.json`.
- `npx remotion studio`: preview.
- `python scripts/render.py [w5 ...]`: mp4 + poster + captions → `../videos/`. `--captions` rebuilds the .vtt files only.

After rendering, copy `../videos/` to the OneDrive Lec Notes Build folder along with `index.html`.
