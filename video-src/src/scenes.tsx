import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, body, display, mono, tone, useIn, type Cue } from "./theme";
import { Person } from "./Person";

/* eslint-disable @typescript-eslint/no-explicit-any */
type S = any;

// "*word*" → accent italic. Keeps the specs readable.
export const Rich: React.FC<{ text: string; color?: string }> = ({ text, color = C.ox }) => (
  <>
    {text.split(/(\*[^*]+\*)/).map((p, i) =>
      p.startsWith("*") ? (
        <em key={i} style={{ color, fontStyle: "italic", fontWeight: "inherit" }}>{p.slice(1, -1)}</em>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      ),
    )}
  </>
);

const Rise: React.FC<{ c: Cue; i: number; base?: number; step?: number; dist?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  c, i, base = 0.5, step = 0.5, dist = 34, style, children,
}) => {
  const p = useIn(c.at, base + i * step);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dist}px)`, ...style }}>{children}</div>;
};

const Pop: React.FC<{ c: Cue; i: number; base?: number; step?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  c, i, base = 0.5, step = 0.5, style, children,
}) => {
  const p = useIn(c.at, base + i * step, { pop: true });
  return <div style={{ opacity: Math.min(1, p * 1.5), transform: `scale(${0.6 + 0.4 * p})`, ...style }}>{children}</div>;
};

export const Kicker: React.FC<{ text?: string; color?: string }> = ({ text, color = C.petrol }) => {
  const p = useIn(0, 0.05);
  if (!text) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: p, marginBottom: 34 }}>
      <div style={{ width: 70 * p, height: 4, background: color, borderRadius: 2 }} />
      <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: "0.14em", textTransform: "uppercase", color, fontWeight: 600 }}>{text}</div>
    </div>
  );
};

const Stage: React.FC<{ children: React.ReactNode; center?: boolean }> = ({ children, center }) => (
  <AbsoluteFill style={{ padding: "150px 150px 110px", display: "flex", flexDirection: "column", justifyContent: center ? "center" : "flex-start" }}>
    {children}
  </AbsoluteFill>
);

/* ---------------- title ---------------- */
export const Title: React.FC<{ s: S }> = ({ s }) => {
  const frame = useCurrentFrame();
  const ring = useIn(0, 0.1, { pop: true });
  // Slow directional push on the photo only. Nothing else drifts.
  const push = interpolate(frame, [0, s.frames], [1.0, 1.07], { extrapolateRight: "clamp" });
  const photos: string[] = s.photos ?? (s.photo ? [s.photo] : []);
  const size = photos.length > 1 ? 330 : 420;
  return (
    <AbsoluteFill style={{ padding: "0 150px", flexDirection: "row", alignItems: "center", gap: 100 }}>
      <div style={{ display: "flex", gap: 30, flexShrink: 0 }}>
        {photos.map((ph, i) => (
          <div key={ph} style={{
            width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            boxShadow: `0 0 0 10px ${C.card}, 0 0 0 ${10 + 6 * ring}px ${i ? C.petrol : C.ox}, 0 30px 60px -20px rgba(22,24,31,.35)`,
            transform: `scale(${0.85 + 0.15 * ring})`, opacity: ring,
          }}>
            <Img src={staticFile(`photos/${ph}`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${push})`, transformOrigin: "50% 35%" }} />
          </div>
        ))}
        {!photos.length && (
          <div style={{
            width: size, height: size, borderRadius: "50%", background: C.ox, color: C.card, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: display, fontWeight: 700, fontSize: 200, letterSpacing: "-0.04em", transform: `scale(${0.85 + 0.15 * ring})`, opacity: ring,
            boxShadow: `0 0 0 10px ${C.card}, 0 30px 60px -20px rgba(22,24,31,.35)`,
          }}>{s.badge}</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <Rise c={{}} i={0} base={0.2} step={0.25}>
          <div style={{ fontFamily: mono, fontSize: 30, letterSpacing: "0.14em", color: C.ox, textTransform: "uppercase", fontWeight: 600 }}>{s.eyebrow}</div>
        </Rise>
        <Rise c={{}} i={1} base={0.2} step={0.25}>
          <div style={{ fontFamily: display, fontWeight: 600, fontSize: s.title.length > 40 ? 80 : 96, lineHeight: 1.04, letterSpacing: "-0.025em", color: C.ink, margin: "22px 0 40px" }}>
            <Rich text={s.title} />
          </div>
        </Rise>
        <Rise c={{}} i={2} base={0.2} step={0.25}>
          <div style={{ width: 120, height: 4, background: C.rule, marginBottom: 30 }} />
          <div style={{ fontFamily: body, fontSize: 44, fontWeight: 600, color: C.ink }}>{s.speaker}</div>
          <div style={{ fontFamily: body, fontSize: 32, color: C.ink3, marginTop: 8 }}>{s.org}</div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- statement ---------------- */
export const Statement: React.FC<{ s: S }> = ({ s }) => (
  <Stage center>
    <Kicker text={s.kicker} />
    {s.lines.map((l: S, i: number) => (
      <Rise key={i} c={l} i={i} base={0.4} step={1.4}>
        <div style={{
          fontFamily: l.size === "s" ? body : display,
          fontWeight: l.size === "s" ? 400 : 600,
          fontSize: l.size === "s" ? 44 : l.size === "l" ? 112 : 80,
          lineHeight: l.size === "s" ? 1.35 : 1.1,
          letterSpacing: l.size === "s" ? 0 : "-0.02em",
          color: l.size === "s" ? C.ink2 : C.ink,
          marginBottom: l.size === "s" ? 18 : 30,
          maxWidth: 1560,
        }}>
          <Rich text={l.text} color={tone(l.tone).fg} />
        </div>
      </Rise>
    ))}
  </Stage>
);

/* ---------------- versus ---------------- */
const Card: React.FC<{ side: S; i: number }> = ({ side, i }) => {
  const t = tone(side.tone ?? (i ? "petrol" : "ox"));
  return (
    <Rise c={side} i={i} base={0.4} step={1.2} style={{ flex: 1 }}>
      <div style={{ background: C.card, borderRadius: 28, padding: "50px 60px 56px", borderTop: `10px solid ${t.fg}`, boxShadow: "0 1px 2px rgba(22,24,31,.05), 0 24px 50px -24px rgba(22,24,31,.25)", height: "100%" }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: side.big ? 140 : String(side.label).length > 9 ? 76 : 104, color: t.fg, lineHeight: 1, letterSpacing: "-0.03em" }}>{side.label}</div>
        {side.title && <div style={{ fontFamily: body, fontSize: 40, fontWeight: 600, color: C.ink, marginTop: 22 }}>{side.title}</div>}
        <div style={{ marginTop: 18 }}>
          {(side.items ?? []).map((it: S, j: number) => (
            <Rise key={j} c={it} i={j} base={(side.at ?? 0.4 + i * 1.2) + 0.5} step={0.45} dist={16}>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline", fontFamily: body, fontSize: 40, color: C.ink2, marginTop: 18, lineHeight: 1.3 }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: t.fg, flexShrink: 0, transform: "translateY(-4px)" }} />
                <span><Rich text={it.text} color={t.fg} /></span>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </Rise>
  );
};

export const Versus: React.FC<{ s: S }> = ({ s }) => (
  <Stage center>
    <Kicker text={s.kicker} />
    <div style={{ display: "flex", gap: 60, alignItems: "stretch" }}>
      <Card side={s.left} i={0} />
      <Card side={s.right} i={1} />
    </div>
    {s.verdict && (
      <Rise c={s.verdict} i={0} base={3}>
        <div style={{ fontFamily: display, fontSize: 56, fontWeight: 600, color: C.ink, marginTop: 44, textAlign: "center" }}>
          <Rich text={s.verdict.text} />
        </div>
      </Rise>
    )}
  </Stage>
);

/* ---------------- list ---------------- */
export const List: React.FC<{ s: S }> = ({ s }) => {
  const many = s.items.length > 4;
  return (
    <Stage center>
      <Kicker text={s.kicker} />
      {s.title && (
        <Rise c={{}} i={0} base={0.15}>
          <div style={{ fontFamily: display, fontWeight: 600, fontSize: 70, color: C.ink, letterSpacing: "-0.02em", marginBottom: many ? 34 : 50, lineHeight: 1.1 }}>
            <Rich text={s.title} />
          </div>
        </Rise>
      )}
      <div style={{ display: "grid", gridTemplateColumns: s.cols === 2 ? "1fr 1fr" : "1fr", columnGap: 70, rowGap: many ? 26 : 38 }}>
        {s.items.map((it: S, i: number) => {
          const t = tone(it.tone ?? s.tone);
          const mark = it.mark ?? s.mark ?? "num";
          return (
            <Rise key={i} c={it} i={i} base={0.8} step={0.9} dist={24}>
              <div style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
                <div style={{
                  width: many ? 74 : 92, height: many ? 74 : 92, borderRadius: 46, flexShrink: 0, background: t.bg, color: t.fg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontWeight: 600, fontSize: 32,
                }}>
                  {mark === "x" ? "✕" : mark === "check" ? "✓" : mark === "num" ? String(i + 1).padStart(2, "0") : mark}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ fontFamily: body, fontWeight: 600, fontSize: many ? 42 : 56, color: C.ink, lineHeight: 1.15 }}>
                    <Rich text={it.head} color={t.fg} />
                  </div>
                  {it.sub && <div style={{ fontFamily: body, fontSize: many ? 30 : 38, color: C.ink3, marginTop: 8, lineHeight: 1.3 }}><Rich text={it.sub} color={t.fg} /></div>}
                </div>
              </div>
            </Rise>
          );
        })}
      </div>
    </Stage>
  );
};

/* ---------------- stat ---------------- */
const Stat: React.FC<{ st: S; i: number; n: number }> = ({ st, i, n }) => {
  const p = useIn(st.at, 0.5 + i * 1.2);
  const t = tone(st.tone);
  const count = useIn(st.at, 0.5 + i * 1.2, { delay: 2, dur: 40 });
  const v = (st.from ?? 0) + (st.value - (st.from ?? 0)) * count;
  const shown = st.text ?? `${st.prefix ?? ""}${v.toLocaleString("en-AU", { minimumFractionDigits: st.decimals ?? 0, maximumFractionDigits: st.decimals ?? 0 })}${st.suffix ?? ""}`;
  return (
    <div style={{ flex: 1, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, borderLeft: i ? `3px solid ${C.rule}` : undefined, paddingLeft: i ? 60 : 0 }}>
      <div style={{ fontFamily: display, fontWeight: 700, fontSize: n > 2 ? 150 : 200, lineHeight: 1, color: t.fg, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{shown}</div>
      <div style={{ fontFamily: body, fontSize: 40, color: C.ink, marginTop: 26, lineHeight: 1.3, maxWidth: 760, fontWeight: 500 }}><Rich text={st.label} color={t.fg} /></div>
    </div>
  );
};

export const Stats: React.FC<{ s: S }> = ({ s }) => (
  <Stage center>
    <Kicker text={s.kicker} />
    {s.title && (
      <Rise c={{}} i={0} base={0.15}>
        <div style={{ fontFamily: display, fontWeight: 600, fontSize: 64, color: C.ink, marginBottom: 60, letterSpacing: "-0.02em" }}><Rich text={s.title} /></div>
      </Rise>
    )}
    <div style={{ display: "flex", gap: 60 }}>
      {s.stats.map((st: S, i: number) => <Stat key={i} st={st} i={i} n={s.stats.length} />)}
    </div>
    {s.note && (
      <Rise c={s.note} i={0} base={3}>
        <div style={{ fontFamily: display, fontSize: 50, fontWeight: 600, color: C.ink, marginTop: 70 }}><Rich text={s.note.text} /></div>
      </Rise>
    )}
  </Stage>
);

/* ---------------- bars ---------------- */
const Bar: React.FC<{ b: S; i: number; max: number }> = ({ b, i, max }) => {
  const p = useIn(b.at, 0.6 + i * 0.7);
  const grow = useIn(b.at, 0.6 + i * 0.7, { delay: 4, dur: 30 });
  const t = tone(b.tone);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 36, opacity: p, marginBottom: 30 }}>
      <div style={{ width: 380, fontFamily: body, fontSize: 38, color: C.ink, fontWeight: 500, textAlign: "right", flexShrink: 0 }}>{b.label}</div>
      <div style={{ flex: 1, height: 74, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "#E6E8ED", borderRadius: 12 }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(1.2, (b.value / max) * 100) * grow}%`, background: t.fg, borderRadius: 12 }} />
      </div>
      <div style={{ width: 300, fontFamily: display, fontWeight: 700, fontSize: 52, color: t.fg, flexShrink: 0 }}>{b.display ?? b.value}</div>
    </div>
  );
};

export const Bars: React.FC<{ s: S }> = ({ s }) => {
  const max = s.max ?? Math.max(...s.bars.map((b: S) => b.value));
  return (
    <Stage center>
      <Kicker text={s.kicker} />
      {s.title && (
        <Rise c={{}} i={0} base={0.15}>
          <div style={{ fontFamily: display, fontWeight: 600, fontSize: 64, color: C.ink, marginBottom: 56, letterSpacing: "-0.02em" }}><Rich text={s.title} /></div>
        </Rise>
      )}
      {s.bars.map((b: S, i: number) => <Bar key={i} b={b} i={i} max={max} />)}
      {s.note && (
        <Rise c={s.note} i={0} base={3}>
          <div style={{ fontFamily: display, fontSize: 50, fontWeight: 600, color: C.ink, marginTop: 34 }}><Rich text={s.note.text} /></div>
        </Rise>
      )}
    </Stage>
  );
};

/* ---------------- flow ---------------- */
const Arrow: React.FC<{ c: Cue; i: number }> = ({ c, i }) => {
  const p = useIn(c.at, 0.6 + i * 0.8, { delay: -6 });
  return (
    <svg width="52" height="40" viewBox="0 0 70 40" style={{ flexShrink: 0 }}>
      <line x1="4" y1="20" x2={4 + 54 * p} y2="20" stroke={C.ink3} strokeWidth="5" strokeLinecap="round" />
      <path d="M48 8 L64 20 L48 32" stroke={C.ink3} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={p > 0.9 ? 1 : 0} />
    </svg>
  );
};

export const Flow: React.FC<{ s: S }> = ({ s }) => {
  const n = s.steps.length;
  const fs = n > 5 ? 30 : n > 4 ? 38 : n > 3 ? 46 : 54;
  return (
    <Stage center>
      <Kicker text={s.kicker} />
      {s.title && (
        <Rise c={{}} i={0} base={0.15}>
          <div style={{ fontFamily: display, fontWeight: 600, fontSize: 64, color: C.ink, marginBottom: 70, letterSpacing: "-0.02em" }}><Rich text={s.title} /></div>
        </Rise>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {s.steps.map((st: S, i: number) => {
          const t = tone(st.tone ?? (i === n - 1 ? "ox" : "petrol"));
          return (
            <React.Fragment key={i}>
              {i > 0 && <Arrow c={st} i={i} />}
              <Pop c={st} i={i} base={0.6} step={0.8} style={{ flex: "1 1 0", minWidth: 0 }}>
                <div style={{ background: t.bg, border: `3px solid ${t.fg}`, borderRadius: 26, padding: n > 5 ? "34px 10px" : "40px 26px", textAlign: "center", minHeight: n > 4 ? 230 : 300, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontFamily: body, fontWeight: 600, fontSize: fs, color: t.fg, lineHeight: 1.15 }}>{st.text}</div>
                  {st.sub && <div style={{ fontFamily: body, fontSize: fs * 0.72, color: C.ink2, marginTop: 10, lineHeight: 1.25 }}>{st.sub}</div>}
                </div>
              </Pop>
            </React.Fragment>
          );
        })}
      </div>
      {s.note && (
        <Rise c={s.note} i={0} base={4}>
          <div style={{ fontFamily: display, fontSize: 52, fontWeight: 600, color: C.ink, marginTop: 80, textAlign: "center" }}><Rich text={s.note.text} /></div>
        </Rise>
      )}
    </Stage>
  );
};

/* ---------------- skit ---------------- */
const Bubble: React.FC<{ b: S; i: number; x: number; active: boolean; flipTail: boolean }> = ({ b, i, x, active, flipTail }) => {
  const p = useIn(b.at, 0.6 + i * 1.6, { pop: true });
  const think = b.kind === "think";
  const t = tone(b.tone ?? (think ? "petrol" : "ink"));
  return (
    <div style={{
      position: "absolute", left: `${x}%`, bottom: (b.n > 2 ? 650 : 720) + (b.lift ?? 0), transform: `translateX(-50%) scale(${0.5 + 0.5 * p})`,
      transformOrigin: flipTail ? "85% 100%" : "15% 100%", opacity: Math.min(1, p * 1.4),
    }}>
      <div style={{
        background: think ? t.bg : C.card, border: `4px solid ${active ? t.fg : C.rule}`, borderRadius: think ? 60 : 30,
        padding: "26px 40px", maxWidth: 620, minWidth: 260, fontFamily: think ? display : body, fontStyle: think ? "italic" : "normal",
        fontSize: 44, fontWeight: think ? 600 : 500, color: think ? t.fg : C.ink, lineHeight: 1.22, textAlign: "center",
        boxShadow: "0 20px 40px -24px rgba(22,24,31,.35)",
      }}>
        {think ? "" : "“"}<Rich text={b.text} color={t.fg} />{think ? "" : "”"}
      </div>
      {think ? (
        <div style={{ position: "absolute", left: flipTail ? "70%" : "26%", top: "100%" }}>
          <div style={{ width: 26, height: 26, borderRadius: 13, background: t.bg, border: `4px solid ${t.fg}`, marginTop: 10 }} />
          <div style={{ width: 14, height: 14, borderRadius: 7, background: t.bg, border: `3px solid ${t.fg}`, margin: `8px 0 0 ${flipTail ? 22 : -10}px` }} />
        </div>
      ) : (
        <svg width="60" height="44" style={{ position: "absolute", top: "calc(100% - 4px)", left: flipTail ? "auto" : 70, right: flipTail ? 70 : "auto", transform: flipTail ? "scaleX(-1)" : undefined }}>
          <path d="M0 0 L44 0 L10 40 Z" fill={C.card} />
          <path d="M44 0 L10 40 L4 2" fill="none" stroke={active ? t.fg : C.rule} strokeWidth="4" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
};

export const Skit: React.FC<{ s: S }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  const cast: S[] = s.cast;
  const xs = cast.length === 1 ? [50] : cast.length === 2 ? [27, 73] : [18, 50, 82];
  const beats: S[] = s.beats ?? [];
  const startOf = (b: S, i: number) => b.at ?? 0.6 + i * 1.6;
  // The latest beat to start is the one "speaking"; its owner's mouth moves for ~1.4s.
  const live = beats.reduce((acc: number, b: S, i: number) => (sec >= startOf(b, i) ? i : acc), -1);
  const liveFor = live >= 0 ? sec - startOf(beats[live], live) : 99;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ padding: "150px 150px 0" }}>
        <Kicker text={s.kicker} />
      </AbsoluteFill>
      {/* floor */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 150, background: "#E7E9EE" }} />
      {cast.map((c: S, i: number) => {
        const p = useIn(c.at, 0.1 + i * 0.2);
        return (
          <div key={i} style={{ position: "absolute", left: `${xs[i]}%`, bottom: 110, transform: `translateX(-50%) translateY(${(1 - p) * 60}px)`, opacity: p, textAlign: "center" }}>
            <Person height={s.cast.length > 2 ? 470 : 540} look={c.look ?? i} flip={c.flip ?? i > 0} prop={c.prop} talking={live >= 0 && beats[live].who === i && beats[live].kind !== "think" && liveFor < 1.4} />
            <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: "0.12em", textTransform: "uppercase", color: C.ink3, marginTop: 8 }}>{c.name}</div>
          </div>
        );
      })}
      {beats.map((b: S, i: number) => {
        // A later bubble from the same person replaces the earlier one.
        const replaced = beats.some((o: S, j: number) => j > i && o.who === b.who && sec >= startOf(o, j));
        if (replaced) return null;
        return <Bubble key={i} b={{ ...b, n: cast.length }} i={i} x={xs[b.who] + (b.who === 0 ? 6 : -6) * (cast.length > 1 ? 1 : 0)} active={i === live} flipTail={b.who > 0} />;
      })}
      {s.chips && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "flex-end", paddingRight: 150, gap: 24 }}>
          {s.chips.map((c: S, i: number) => (
            <Pop key={i} c={c} i={i} base={3} step={0.5}>
              <div style={{ background: tone(c.tone ?? "amber").bg, color: tone(c.tone ?? "amber").fg, border: `3px solid ${tone(c.tone ?? "amber").fg}`, fontFamily: body, fontWeight: 600, fontSize: 38, padding: "14px 34px", borderRadius: 50 }}>{c.text}</div>
            </Pop>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------------- outro ---------------- */
export const Outro: React.FC<{ s: S }> = ({ s }) => (
  <Stage center>
    <Kicker text={s.kicker ?? "The takeaway"} color={C.ox} />
    {s.lines.map((l: S, i: number) => (
      <Rise key={i} c={l} i={i} base={0.4} step={1.4}>
        <div style={{ fontFamily: display, fontWeight: 600, fontSize: 84, lineHeight: 1.1, letterSpacing: "-0.02em", color: C.ink, marginBottom: 28, maxWidth: 1560 }}>
          <Rich text={l.text} />
        </div>
      </Rise>
    ))}
    <Rise c={{}} i={0} base={s.footAt ?? 2.6}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 18, marginTop: 50, fontFamily: mono, fontSize: 28, letterSpacing: "0.1em", textTransform: "uppercase", color: C.petrol, fontWeight: 600 }}>
        {s.foot ?? "Full notes and one-page summary below"} <span style={{ fontSize: 34 }}>↓</span>
      </div>
    </Rise>
  </Stage>
);

export const SCENES: Record<string, React.FC<{ s: S }>> = {
  title: Title, statement: Statement, versus: Versus, list: List, stats: Stats, bars: Bars, flow: Flow, skit: Skit, outro: Outro,
};
