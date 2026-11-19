"""Voice every scene and pin each visual cue to the moment its word is spoken.

    python scripts/tts.py            # all weeks
    python scripts/tts.py w2 w5      # just these

Reads weeks/<id>.json, writes public/audio/<id>-<n>.mp3 and src/data.json.
Any object in a scene with "cue": "<word or phrase>" gets "at": seconds from
scene start, matched in reading order against the voice's word boundaries.
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
RATE = "+12%"
LEAD_IN = 0.35
TAIL = 0.45


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9%$]", "", w.lower().replace("’", "'"))


def duration(path: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


async def speak(text: str, path: pathlib.Path):
    for attempt in range(4):
        try:
            return await _speak(text, path)
        except edge_tts.exceptions.NoAudioReceived:
            print(f"    retry {attempt + 1}: {text[:40]}")
            await asyncio.sleep(2 + attempt * 3)
    raise RuntimeError(f"TTS failed: {text}")


async def _speak(text: str, path: pathlib.Path):
    words = []
    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    with open(path, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({"w": chunk["text"], "t": chunk["offset"] / 1e7})
    return words


def resolve(node, words, state, where):
    """Walk the scene in order; give every cue an absolute 'at'."""
    if isinstance(node, dict):
        if "cue" in node:
            toks = [norm(t) for t in node["cue"].split()]
            hit = None
            for i in range(state["i"], len(words)):
                if all(i + k < len(words) and norm(words[i + k]["w"]).startswith(toks[k])
                       for k in range(len(toks))):
                    hit = i
                    break
            if hit is None:
                print(f"    ! cue not found: {node['cue']!r} in {where}")
                node["at"] = None
            else:
                node["at"] = round(LEAD_IN + words[hit]["t"], 3)
                state["i"] = hit + 1
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
    for n, scene in enumerate(spec["scenes"]):
        path = AUDIO / f"{wid}-{n:02d}.mp3"
        words = await speak(scene["say"], path)
        spoken = duration(path)
        scene["audio"] = f"audio/{path.name}"
        scene["leadIn"] = LEAD_IN
        scene["seconds"] = round(LEAD_IN + spoken + scene.get("hold", TAIL), 3)
        scene["words"] = [{"w": w["w"], "t": round(LEAD_IN + w["t"], 3)} for w in words]
        resolve({k: v for k, v in scene.items() if k not in ("words", "say")},
                words, {"i": 0}, f"{wid} scene {n}")
        total += scene["seconds"]
    spec["id"] = wid
    spec["total"] = round(total, 2)
    flag = "" if 52 <= total <= 66 else "   <-- outside 52-66s"
    print(f"  {wid}: {total:5.1f}s{flag}")
    return spec


async def main():
    only = set(sys.argv[1:])
    data = json.loads(DATA.read_text(encoding="utf8")) if DATA.exists() else {}
    for p in sorted(WEEKS.glob("*.json"), key=lambda p: int(re.sub(r"\D", "", p.stem) or 0)):
        if only and p.stem not in only:
            continue
        data[p.stem] = await build(p)
        DATA.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf8")
    DATA.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf8")


asyncio.run(main())
