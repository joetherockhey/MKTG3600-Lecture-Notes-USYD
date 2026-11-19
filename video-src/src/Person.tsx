import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "./theme";

// Flat, friendly figures for the acted bits. Looks are picked by index so a
// week can cast a few different people without any image assets.
const LOOKS = [
  { skin: "#E9B993", hair: "#2B2118", shirt: C.petrol, style: "short" },
  { skin: "#C98E66", hair: "#16181F", shirt: C.ox, style: "long" },
  { skin: "#F2CDB0", hair: "#B87A12", shirt: "#41465A", style: "bun" },
  { skin: "#8D5B3E", hair: "#16181F", shirt: C.amber, style: "short" },
  { skin: "#E3A983", hair: "#6B3A22", shirt: "#5B6B8C", style: "long" },
];

export const Person: React.FC<{ look?: number; talking?: boolean; flip?: boolean; prop?: string; height?: number }> = ({
  look = 0, talking, flip, prop, height = 430,
}) => {
  const frame = useCurrentFrame();
  const L = LOOKS[look % LOOKS.length];
  // Blink for 3 frames every ~3.4s, offset per look so a pair never blinks together.
  const blink = (frame + look * 37) % 102 < 3;
  const mouthOpen = talking && Math.floor(frame / 4) % 2 === 0;
  return (
    <svg viewBox="0 0 260 430" height={height} style={{ transform: flip ? "scaleX(-1)" : undefined, overflow: "visible" }}>
      {/* body */}
      <path d="M40 430 C40 300 70 250 130 250 C190 250 220 300 220 430 Z" fill={L.shirt} />
      <path d="M108 252 L130 290 L152 252 Z" fill="#FFFFFF" opacity={0.9} />
      {/* neck + head */}
      <rect x="114" y="200" width="32" height="56" rx="12" fill={L.skin} />
      {L.style === "long" && <path d="M58 120 C58 40 202 40 202 120 L210 250 C180 262 80 262 50 250 Z" fill={L.hair} />}
      <ellipse cx="130" cy="140" rx="70" ry="80" fill={L.skin} />
      {L.style === "short" && <path d="M60 128 C55 60 110 42 140 50 C190 55 210 95 200 130 C185 100 150 92 120 96 C95 100 75 110 60 128 Z" fill={L.hair} />}
      {L.style === "long" && <path d="M62 120 C70 62 190 58 198 120 C170 96 120 88 62 120 Z" fill={L.hair} />}
      {L.style === "bun" && (
        <>
          <circle cx="130" cy="48" r="30" fill={L.hair} />
          <path d="M62 125 C64 66 196 66 198 125 C170 100 95 98 62 125 Z" fill={L.hair} />
        </>
      )}
      {/* face */}
      {blink ? (
        <>
          <rect x="96" y="140" width="20" height="4" rx="2" fill={C.ink} />
          <rect x="144" y="140" width="20" height="4" rx="2" fill={C.ink} />
        </>
      ) : (
        <>
          <ellipse cx="106" cy="141" rx="8" ry="10" fill={C.ink} />
          <ellipse cx="154" cy="141" rx="8" ry="10" fill={C.ink} />
        </>
      )}
      <circle cx="92" cy="170" r="10" fill="#E07A6A" opacity={0.25} />
      <circle cx="168" cy="170" r="10" fill="#E07A6A" opacity={0.25} />
      {mouthOpen ? (
        <ellipse cx="130" cy="182" rx="14" ry="11" fill="#5A1E24" />
      ) : (
        <path d="M114 178 Q130 192 146 178" stroke="#5A1E24" strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
      {prop === "phone" && <rect x="176" y="300" width="44" height="78" rx="9" fill={C.ink} stroke="#fff" strokeWidth="4" />}
      {prop === "clipboard" && (
        <>
          <rect x="28" y="296" width="70" height="92" rx="8" fill="#F8F3E6" stroke={C.ink2} strokeWidth="4" />
          <rect x="42" y="318" width="42" height="5" rx="2" fill={C.ink3} />
          <rect x="42" y="332" width="34" height="5" rx="2" fill={C.ink3} />
          <rect x="42" y="346" width="40" height="5" rx="2" fill={C.ink3} />
        </>
      )}
      {prop === "coffee" && (
        <>
          <path d="M178 312 L222 312 L216 372 L184 372 Z" fill="#fff" stroke={C.ink2} strokeWidth="4" />
          <rect x="174" y="302" width="52" height="12" rx="5" fill={C.ink2} />
        </>
      )}
      {prop === "camera" && (
        <>
          <rect x="112" y="300" width="36" height="28" rx="6" fill={C.ink} />
          <circle cx="130" cy="314" r="8" fill="#7EBECC" />
        </>
      )}
    </svg>
  );
};
