"""Voice every beat and pin each cue word to the moment it is spoken.

    python scripts/tts.py            # all weeks
    python scripts/tts.py w2 w5      # just these

Reads weeks/<id>.json, writes public/audio/<id>-<n>.mp3 and src/data.json.
Any object with "cue": "<word or phrase>" gets "at": seconds from beat start (cue "start" = 0.2 s).
Cues are matched in order within each list (board lines, acts, fx, shots), so each list reads in speaking order.
Cast members walk at "walkCue" -> "walkAt". Unknown cues are reported and left null (the item never shows).
"""
import sys
import json
import asyncio
import pathlib
import re
import subprocess

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEEKS = ROOT / "weeks"
AUDIO = ROOT / "public" / "audio"
DATA = ROOT / "src" / "data.json"
AUDIO.mkdir(parents=True, exist_ok=True)

VOICE = "en-AU-WilliamNeural"
RATE = "+6%"
LEAD_IN = 0.45
TAIL = 0.6


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9%$]", "", w.lower().replace("’", "'"))


def duration(path: pathlib.Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
                         capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


async def speak(text: str, path: pathlib.Path):
    for attempt in range(5):
        try:
            words = []
            com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
            with open(path, "wb") as f:
                async for chunk in com.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        words.append({"w": chunk["text"], "t": chunk["offset"] / 1e7})
            return words
        except Exception as e:  # network hiccups: retry
            print(f"    retry {attempt + 1}: {e}")
            await asyncio.sleep(2 + attempt * 3)
    raise RuntimeError(f"TTS failed: {text[:60]}")


def find(cue, words, start):
    if cue == "start":
        return 0.2 - LEAD_IN, start
    toks = [norm(t) for t in cue.split()]
    for i in range(start, len(words)):
        if all(i + k < len(words) and norm(words[i + k]["w"]).startswith(toks[k]) for k in range(len(toks))):
            return words[i]["t"], i + 1
    return None, start


def resolve(node, words, state, where):
    if isinstance(node, dict):
        if "cue" in node:
            t, state["i"] = find(node["cue"], words, state["i"])
            if t is None:
                print(f"    ! cue not found: {node['cue']!r} in {where}")
            node["at"] = None if t is None else round(LEAD_IN + t + node.get("delay", 0), 3)
        for k, v in node.items():
            if k != "cue":
                resolve(v, words, state, where)
    elif isinstance(node, list):
        for v in node:
            resolve(v, words, state, where)


async def build(spec_path: pathlib.Path):
    spec = json.loads(spec_path.read_text(encoding="utf8"))
    wid = spec_path.stem
    total = 0.0
    for n, beat in enumerate(spec["beats"]):
        path = AUDIO / f"{wid}-{n:02d}.mp3"
        words = await speak(beat["say"], path)
        spoken = duration(path)
        beat["audio"] = f"audio/{path.name}"
        beat["leadIn"] = LEAD_IN
        beat["seconds"] = round(LEAD_IN + spoken + beat.get("hold", TAIL), 3)
        beat["words"] = [{"w": w["w"], "t": round(LEAD_IN + w["t"], 3)} for w in words]
        where = f"{wid} beat {n}"
        for key in ("board", "acts", "fx", "shots"):
            if key in beat and beat[key]:
                resolve(beat[key], words, {"i": 0}, f"{where} {key}")
        for c in beat.get("cast", []):
            if "walkCue" in c:
                t, _ = find(c["walkCue"], words, 0)
                if t is None:
                    print(f"    ! walkCue not found: {c['walkCue']!r} in {where}")
                c["walkAt"] = None if t is None else round(LEAD_IN + t, 3)
        total += round(beat["seconds"] * 30) / 30
    spec["id"] = wid
    spec["total"] = round(total, 2)
    flag = "" if 160 <= total <= 200 else "   <-- outside 160-200 s"
    print(f"  {wid}: {total:5.1f}s over {len(spec['beats'])} beats{flag}")
    return spec


PER = ROOT / "src" / "weeks"
PER.mkdir(exist_ok=True)


def merge():
    """data.json = every built week (each week has its own file, so parallel runs never clobber each other)."""
    data = {p.stem: json.loads(p.read_text(encoding="utf8")) for p in PER.glob("*.json")}
    DATA.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf8")


async def main():
    only = set(sys.argv[1:])
    for p in sorted(WEEKS.glob("*.json"), key=lambda p: int(re.sub(r"\D", "", p.stem) or 0)):
        if only and p.stem not in only:
            continue
        spec = await build(p)
        (PER / f"{p.stem}.json").write_text(json.dumps(spec, indent=1, ensure_ascii=False), encoding="utf8")
        merge()
    merge()


asyncio.run(main())
