# Writing a week script (weeks/wN.json)

Each file is a ~3-minute animated explainer of one MKTG3600 guest lecture. A little host (mustard jacket) walks
around five sets, explains the lecture and acts scenes out with other cartoon people. The voice is en-AU edge-tts.

## Source material
`../index.html`: the week is `<section class="view" id="v-wN">`. Use the `.sum` summary box (condensed bullets)
AND the full `<article id="art-wN">` so the video covers **all** the lecture's main points, frameworks, examples,
numbers and the speaker's key takeaways. Facts must come from the page only, never invent figures or claims.

## Length
- 15 to 19 beats, 430 to 480 spoken words total. Target total 165 to 195 s (tts.py prints it; aim ~180 s).
- Each beat's `say` is 1 to 3 short spoken sentences (18 to 40 words). Plain, warm, spoken Australian English,
  second person is fine ("Picture this..."). No em dashes, no lists read aloud as "one, two, three" unless natural.
- Beat 0: stage set intro with the speaker photo board. Last beat: a recap on the stage or office board with the
  big takeaways, ending with a short sign-off ("That's week N.").

## File shape
```json
{ "week": 2, "title": "Market research and consumer insights", "speaker": "Estelle Gohil", "beats": [ BEAT, ... ] }
```
BEAT:
```json
{ "set": "plaza|office|street|home|stage",
  "say": "Spoken text.",
  "board": { ... } ,                      // optional: what the set's screen/whiteboard/billboard/TV shows
  "cast": [ { "id": "host", "look": "host", "at": "c", "pose": "present" }, { "id": "s1", "look": "shopper", "v": 3, "at": "walkL", "to": "shelf", "walkCue": "browsing", "hold": "bag" } ],
  "acts": [ { "who": "s1", "cue": "price", "pose": "chin", "expr": "nervous" } ],
  "fx":   [ { "kind": "think", "who": "s1", "text": "Is it worth it?", "cue": "worth" }, { "kind": "money", "who": "host", "cue": "price" } ],
  "shots":[ { "cue": "start", "shot": "wide" }, { "cue": "price", "shot": "two", "who": "s1" } ],
  "hold": 0.6 }                           // optional seconds of silence after the line (default 0.6)
```

### Cues (timing)
Every act / fx / shot / board line has `"cue": "<word or short phrase from this beat's say>"`; the tool finds the
word in the speech (prefix match, case-insensitive, punctuation ignored) and fires the item when it is spoken.
**Within each list (acts, fx, shots, board lines/steps) cues must appear in speaking order**, and every cue word
must really be in `say`. `"cue": "start"` = the beginning of the beat. A cast member with `"to"` walks there at
`walkCue` (or at the start if no walkCue). Acts can also have `"to"` (walk) and `"mirror": true` (face the other way).

### Sets and marks (`at` / `to` values)
| set | what it is | marks |
|---|---|---|
| plaza | outdoor shopping strip: shops Crumb & Co, STRIDE, Pixel Hut, Daily Fresh; fruit stall; product shelves; a big ad screen (board) on the left | board, c, l, r, front, far, shelf, shelf2, stall, shop, shop2, walkL, walkR |
| office | open office: whiteboard (board), desks, meeting table, window with skyline | board, c, l, r, front, far, desk, desk2, table, table2, door, window, walkL, walkR |
| street | town street: billboard (board), bus shelter, shops, kerb | board, c, l, r, front, far, bus, shop, shop2, kerb, walkL, walkR |
| home | living room: TV (board), sofa, bookshelf | board, c, l, r, front, far, sofa, sofa2, tv, window, door, walkL, walkR |
| stage | lecture theatre stage: projector screen (board), lectern | board, c, l, r, front, far, lectern, aisle, aisle2, walkL, walkR |
walkL / walkR are off-screen left/right: use them as `at` to have someone walk in, or as `to` to walk out.
`sofa`/`sofa2` need `"mode": "sit"`. The host is added automatically at `board` (if the beat has a board) or `c`
when you leave it out; put the host in `cast` yourself to choose a mark/pose. Two people should not share a mark.
Wides can see roughly c, l, r, front, far plus the set's own features; keep the action near the centre.

### Looks (`look`, plus `v` 0-9 to vary colours / hair)
host, shopper (odd v = woman), student, exec, exec_f, kid, elder, worker, speaker, chef, farmer.

### Poses / holds / expressions
- pose: point, up, cheer, chin, shrug, hold, present, hips, or "none" (in acts) to drop arms
- hold (needs pose "hold"): phone, bag, box, coffee, card, clipboard, laptop (`holdCol` optional colour)
- expr: neutral, smile, smile_closed, grin, laugh, nervous, shock, relief, relief_open, dazed, pained, stern, whistle, lick
- mode: stand, sit, fall (fall = flop over in surprise, use rarely)

### Effects (`fx.kind`)
- `think` / `say`: speech or thought bubble with `text` (max ~6 words), placed beside `who`
- icons over `who`'s head: bulb, heart, money, question, exclaim, tick, cross, stars, burst, clock, chart, sparkle, eye, brain, zzz
- optional `dur` seconds (default 2.6), `size` (default 1)

### Shots (camera)
- `wide`: the set's establishing view.  `board`: the board + host.  `host`: medium shot of the host.
- `close`: head-and-shoulders of `who` (default host).  `actor`: medium shot of `who`.  `two`: host and `who` together.
- Cut 2 to 4 times per beat. Start most beats with `wide` or `board`; use `close` for punchlines/emotion.
  Add `"glide": true` to a shot for a smooth move from the previous framing instead of a cut (use sparingly).

### Boards (`board`)
Pick ONE layout per board. `**word**` marks accent-coloured text. Keep text short; boards are read on screen.
- Intro: `{ "photo": "photos/wN.jpg", "title": "...", "name": "Speaker Name", "org": "Role, Organisation" }`
  (photo file names: see public/photos; week 11 has a second speaker photo w11b.png; week 13 has no photo, so use a title board)
- Title + bullets: `{ "title": "...", "lines": [ { "text": "...", "cue": "..." } ] }` (max 4 lines, each <= 8 words)
- Numbered framework: `{ "title": "...", "steps": [ { "text": "**Name** short gloss", "cue": "..." } ] }` (max 5)
- Big number: `{ "title": "...", "big": "70%", "caption": "of **...**", "cue": "seventy" }`
- Bar chart: `{ "title": "...", "bars": [ { "label": "...", "value": 70, "display": "70%", "cue": "..." } ] }` (max 5)
- Versus: `{ "title": "...", "vs": { "left": "...", "right": "...", "leftItems": ["..."], "rightItems": ["..."], "cue": "..." } }`
Put the key frameworks and numbers on boards. About half the beats should have a board; the rest are acted scenes.

## Acting scenes (the point of the video)
The host is a guide who ACTS concepts out. When the lecture talks about consumers, put shoppers in the plaza and
have them do the behaviour (grab a product, hesitate, think-bubble the motive, walk out). Brand/strategy talk:
office meeting with execs. Advertising/media: billboard on the street or a family on the sofa with the TV.
Mix sets across the video; every beat should show something happening, not just the host talking.

## Check your work
`python scripts/tts.py wN` voices it and prints the total length and any cue that was not found. Fix every
"cue not found" warning and get the total within 165 to 195 s. Then render a few stills to eyeball it:
`node scripts/stills.mjs wN out/wN/s 100,1500,3000,4500 0.5` (frames at 30 fps) and look at the jpgs.
Do not edit anything under src/ or scripts/.

## Short model videos (weeks/m-<id>.json)
Same format, but one marketing model per file, named `m-<model id>.json` (id from models/models.json), with
`"week": 0`, `"title"`: the model name, `"speaker"`: its origin.
- 3 to 5 beats, 70 to 110 spoken words, total 25 to 45 s (tts.py's "outside 160-200 s" flag can be ignored here).
- Beat 0: the host at a board titled with the model name (a `steps` or `lines` board listing its parts is ideal).
- Middle beat(s): ACT the model out with characters (the plaza for consumer models, office for strategy, street
  or home for advertising/media), with think bubbles and icons.
- Last beat: a one-line "use it like this" takeaway, usually on a board.
- No sign-off line. Start straight in ("The marketing funnel tracks...").
- Lessons from the week scripts: a cue word can only fire once per list (give each item its own word); numbers like
  "2020" cannot be cued; office `desk` people face away, so keep them as background; on the street keep the
  host off `c` for close shots if anything blocks it; check stills.
