"""Write the Models page (section#v-models) into ../index.html from models/models.json.

    python scripts/build_models.py

Replaces everything between <!-- MODELS:START --> and <!-- MODELS:END --> (inserted before the exam view the first time).
Videos are videos/models/<id>.mp4 (+ .jpg poster, .vtt captions) rendered from weeks/m-<id>.json.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT.parent / "index.html"
VIDS = ROOT.parent / "videos" / "models"
MODELS = json.loads((ROOT / "models" / "models.json").read_text(encoding="utf8"))

e = html.escape


def para(t):
    return "".join(f"<p>{e(p.strip())}</p>" for p in re.split(r"\n\s*\n", t or "") if p.strip())


def card(m):
    weeks = ", ".join(f'<a href="#w{w}" onclick="go(\'w{w}\');return false;">Week {w}</a>' for w in m.get("weeks") or [])
    meta = " &middot; ".join(x for x in [weeks, e(m.get("who") or "")] if x)
    vid = ""
    if (VIDS / f"{m['id']}.mp4").exists():
        vid = (f'<figure class="md-vid noprint"><video controls preload="none" playsinline poster="videos/models/{m["id"]}.jpg">'
               f'<source src="videos/models/{m["id"]}.mp4" type="video/mp4">'
               f'<track kind="captions" src="videos/models/{m["id"]}.vtt" srclang="en" label="English"></video></figure>')
    parts = ""
    if m.get("parts"):
        items = []
        for p in m["parts"]:
            k, _, v = p.partition(":")
            items.append(f"<li><b>{e(k.strip())}</b>{': ' + e(v.strip()) if v else ''}</li>")
        parts = f'<h3>The parts</h3><ul class="md-parts">{"".join(items)}</ul>'
    lec = f'<h3>What the lecturer said</h3>{para(m["lecture"])}' if m.get("lecture") else ""
    return (f'<article class="md" id="model-{m["id"]}">'
            f'<h2>{e(m["name"])}</h2><div class="md-meta">{meta}</div>'
            f'<p class="md-short">{e(m["short"])}</p>{vid}'
            f'<h3>Explained</h3>{para(m["long"])}{parts}'
            f'<h3>Example</h3>{para(m["example"])}{lec}</article>')


def section():
    groups = [("mentioned", "From the lectures", "Every model, framework and rule of thumb a speaker named, in the order they came up."),
              ("predicted", "Ones that might come up", "Classic marketing models the lectures did not name but that sit right next to them. Good to know for transfer questions.")]
    index, body = [], []
    for g, title, blurb in groups:
        ms = [m for m in MODELS if m["group"] == g]
        index.append(f'<div class="md-ix"><div class="md-ixh">{title} &middot; {len(ms)}</div><ol>'
                     + "".join(f'<li><a href="#model-{m["id"]}" data-md="{m["id"]}">{e(m["name"])}</a></li>' for m in ms) + "</ol></div>")
        body.append(f'<h2 class="md-group" id="models-{g}">{title}</h2><p class="md-gblurb">{blurb}</p>' + "".join(card(m) for m in ms))
    n = len(MODELS)
    return f"""<!-- MODELS:START -->
<section class="view" id="v-models">
  <div class="exhero">
    <div class="eyebrow">Models &middot; {n} explained</div>
    <h1>Every model, explained</h1>
    <p class="lede">Each model from the lectures, then the classics likely to come up. Every one has a short animated video, a plain-English explanation, its parts and a worked example.</p>
  </div>
  <nav class="md-index" aria-label="Models">{''.join(index)}</nav>
  {''.join(body)}
</section>
<!-- MODELS:END -->"""


CSS = """/* ---------- models page ---------- */
.md-index{margin:26px 0 10px;padding:18px 0;border-bottom:1px solid var(--rule)}
.md-ixh{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ox);font-weight:600;margin:14px 0 8px}
.md-ix ol{margin:0;padding-left:22px;columns:2 260px;column-gap:28px}
.md-ix li{font-size:14px;line-height:1.5;margin:0 0 5px;break-inside:avoid;color:var(--ink-3)}
.md-ix a{color:var(--ink-2);text-decoration:none;border-bottom:1px solid var(--rule)}
.md-ix a:hover{color:var(--ox);border-color:var(--ox)}
.md-group{font-family:var(--display);font-weight:600;font-size:30px;letter-spacing:-.02em;margin:48px 0 6px}
.md-gblurb{color:var(--ink-3);font-size:15px;margin:0 0 8px}
.md{padding:30px 0 28px;border-bottom:1px solid var(--rule);max-width:760px;scroll-margin-top:80px}
.md h2{font-family:var(--display);font-weight:600;font-size:24px;letter-spacing:-.015em;line-height:1.2;margin:0}
.md-meta{font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--ink-3);margin-top:8px}
.md-meta a{color:var(--petrol)}
.md-short{font-family:var(--display);font-style:italic;font-size:18px;color:var(--ox);line-height:1.4;margin:14px 0 0}
.md-vid{margin:18px 0 4px}
.md-vid video{display:block;width:100%;aspect-ratio:16/9;border-radius:12px;background:#000;box-shadow:var(--shadow)}
.md h3{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);font-weight:600;margin:22px 0 8px}
.md p{font-size:15.5px;line-height:1.65;color:var(--ink-2);margin:0 0 10px}
.md-parts{margin:0;padding:0;list-style:none}
.md-parts li{position:relative;padding-left:17px;margin-bottom:7px;font-size:15px;line-height:1.55;color:var(--ink-2)}
.md-parts li::before{content:"";position:absolute;left:1px;top:9px;width:5px;height:5px;border-radius:50%;background:var(--ox)}
.md-parts b{color:var(--ink);font-weight:600}
.mdbtn{background:var(--petrol)}
@media(max-width:560px){.md-ix ol{columns:1}.md-group{font-size:25px}}
"""


def main():
    s = SITE.read_text(encoding="utf8")
    block = section()
    if "<!-- MODELS:START -->" in s:
        s = re.sub(r"<!-- MODELS:START -->.*?<!-- MODELS:END -->", lambda _: block, s, flags=re.S)
    else:
        s = s.replace('<section class="view" id="v-exam">', block + '\n\n<section class="view" id="v-exam">', 1)
    if "/* ---------- models page ---------- */" not in s:
        s = s.replace("</style>", CSS + "</style>", 1)
    btn = '<button class="exbtn mdbtn" type="button" onclick="go(\'models\')">Models</button>'
    if btn not in s:
        s = s.replace("""    <button class="exbtn" type="button" onclick="go('exam')">""", "    " + btn + """\n    <button class="exbtn" type="button" onclick="go('exam')">""", 1)
    js = "/* ---------- models page links ---------- */"
    if js not in s:
        s = s.replace("/* ---------- routing ---------- */", js + """
document.addEventListener('click',e=>{
  const a = e.target.closest('[data-md]'); if(!a) return;
  e.preventDefault();
  const t = document.getElementById('model-'+a.getAttribute('data-md')); if(t) t.scrollIntoView({behavior:'smooth',block:'start'});
});
/* ---------- routing ---------- */""", 1)
    SITE.write_text(s, encoding="utf8")
    have = sum((VIDS / f"{m['id']}.mp4").exists() for m in MODELS)
    print(f"models page: {len(MODELS)} models, {have} with video")


main()
