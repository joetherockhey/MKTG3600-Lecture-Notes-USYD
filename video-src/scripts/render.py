"""Render each week to ../videos/<id>.mp4 + poster .jpg + captions .vtt.

    python scripts/render.py            # all weeks in src/data.json
    python scripts/render.py w2 w3
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT.parent / "videos"
OUT.mkdir(exist_ok=True)
DATA = json.loads((ROOT / "src" / "data.json").read_text(encoding="utf8"))
FPS = 30


def norm(w):
    return re.sub(r"[^a-z0-9%$]", "", w.lower())


def ts(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


def captions(week):
    """One cue per phrase, timed from the voice's word boundaries."""
    cues, offset = [], 0.0
    for sc in week["scenes"]:
        words, i = sc["words"], 0
        # Phrases: sentences, with long ones split at commas/colons.
        phrases = []
        say = re.sub(r"\b((?:[A-Za-z]\.){2,})", lambda m: m.group(1).replace(".", "").upper().replace("PM", "pm"), sc["say"].strip())
        for sent in re.split(r"(?<=[.?!])\s+", say):
            parts = re.split(r"(?<=[,:])\s+", sent) if len(sent.split()) > 13 else [sent]
            phrases += [p for p in parts if p]
        starts = []
        for p in phrases:
            first = norm(p.split()[0])
            j = next((k for k in range(i, len(words)) if norm(words[k]["w"]).startswith(first[:4]) or first.startswith(norm(words[k]["w"])[:4] or "~")), None)
            if j is None:
                j = min(i, len(words) - 1)
            starts.append(words[j]["t"])
            i = j + 1
        for n, p in enumerate(phrases):
            a = starts[n]
            b = starts[n + 1] - 0.05 if n + 1 < len(phrases) else sc["seconds"] - 0.2
            cues.append((offset + a, offset + max(b, a + 0.8), p))
        offset += round(sc["seconds"] * FPS) / FPS
    lines = ["WEBVTT", ""]
    for a, b, text in cues:
        lines += [f"{ts(a)} --> {ts(b)}", text, ""]
    return "\n".join(lines)


def main():
    ids = sys.argv[1:] or list(DATA)
    for wid in ids:
        week = DATA[wid]
        mp4 = OUT / f"{wid}.mp4"
        print(f"== {wid}")
        subprocess.run(["npx", "remotion", "render", "src/index.ts", wid, str(mp4),
                        "--codec=h264", "--crf=20", "--concurrency=3", "--log=error"],
                       cwd=ROOT, check=True, shell=True)
        # Poster: the title card once everything has landed.
        poster_at = max(1.0, week["scenes"][0]["seconds"] - 0.6)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{poster_at:.2f}", "-i", str(mp4),
                        "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "4", str(OUT / f"{wid}.jpg")], check=True)
        (OUT / f"{wid}.vtt").write_text(captions(week), encoding="utf8")
        print(f"   {mp4.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--captions"]:
        for wid in DATA:
            (OUT / f"{wid}.vtt").write_text(captions(DATA[wid]), encoding="utf8")
    else:
        main()
