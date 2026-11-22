"""Render each week to ../videos/<id>-3min.mp4 + poster .jpg + captions .vtt.

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
    for sc in week["beats"]:
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


def compress(src, dst):
    """Remotion's h264 is ~1.6 Mbps; x264 slow/crf30/animation keeps the look at ~40 % of the size (Pages-friendly)."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-tune", "animation",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(dst)], check=True)


def main():
    ids = sys.argv[1:] or [w for w in DATA if re.fullmatch(r"w\d+", w)]
    if ids == ["models"]:
        ids = [w for w in DATA if w.startswith("m-")]
    for wid in ids:
        week = DATA[wid]
        model = wid.startswith("m-")
        base = (OUT / "models" / wid[2:]) if model else (OUT / f"{wid}-3min")
        base.parent.mkdir(exist_ok=True)
        mp4 = base.with_suffix(".mp4")
        print(f"== {wid}", flush=True)
        # 1280x720 keeps each 3-minute file small enough for GitHub Pages; ANGLE = GPU WebGL
        raw = ROOT / "out" / f"{wid}.raw.mp4"
        subprocess.run(["npx", "remotion", "render", "src/index.ts", wid, str(raw), "--codec=h264", "--crf=24",
                        "--gl=angle", "--concurrency=4", "--log=error"], cwd=ROOT, check=True, shell=True)
        compress(raw, mp4)
        poster_at = max(1.0, week["beats"][0]["seconds"] - 0.6)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{poster_at:.2f}", "-i", str(mp4),
                        "-frames:v", "1", "-q:v", "4", str(base.with_suffix(".jpg"))], check=True)
        (base.with_suffix(".vtt")).write_text(captions(week), encoding="utf8")
        print(f"   {mp4.stat().st_size / 1e6:.1f} MB", flush=True)


if __name__ == "__main__":
    if sys.argv[1:2] == ["--compress"]:  # recompress finished videos in place
        for f in sys.argv[2:]:
            f = pathlib.Path(f); tmp = f.with_suffix(".tmp.mp4"); compress(f, tmp); tmp.replace(f)
    elif sys.argv[1:2] == ["--captions"]:
        for wid in [w for w in DATA if re.fullmatch(r"w\d+", w)]:
            (OUT / f"{wid}-3min.vtt").write_text(captions(DATA[wid]), encoding="utf8")
    else:
        main()
