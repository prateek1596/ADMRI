import { T } from "../../styles/theme";

export function Avatar({ name, size = 36, color = T.accent }) {
  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `${color}22`, border: `1.5px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 800, color,
      flexShrink: 0, fontFamily: "'Syne', sans-serif", letterSpacing: -0.5,
    }}>
      {initials}
    </div>
  );
}

export function RiskBadge({ score }) {
  const r = classifyRiskSimple(score);
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: `${r.color}22`, color: r.color,
      border: `1px solid ${r.color}44`, letterSpacing: 0.5, whiteSpace: "nowrap",
    }}>
      {r.label}
    </span>
  );
}

export function MiniTrend({ history }) {
  if (!history || history.length < 2) return null;
  const w = 72, h = 28;
  const pts = history
    .map((v, i) => `${(i / (history.length - 1)) * w},${h - (v / 100) * h}`)
    .join(" ");
  const c = classifyRiskSimple(history[history.length - 1]).color;
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={c} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - (history[history.length - 1] / 100) * h}
        r="3" fill={c} />
    </svg>
  );
}

export function GlowOrb({ x, y, color }) {
  return (
    <div style={{
      position: "fixed", left: `${x}%`, top: `${y}%`,
      width: 500, height: 500, borderRadius: "50%",
      background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
      pointerEvents: "none", transform: "translate(-50%,-50%)", zIndex: 0,
    }} />
  );
}

export function Spinner({ size = 20, color = T.accent }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid ${color}33`,
      borderTop: `2px solid ${color}`,
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

// Inline keyframe injection (no CSS file needed)
if (typeof document !== "undefined" && !document.getElementById("admri-spin")) {
  const style = document.createElement("style");
  style.id = "admri-spin";
  style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

function classifyRiskSimple(score) {
  if (score < 25) return { label: "Minimal",  color: "#34D399" };
  if (score < 50) return { label: "Mild",     color: "#86EFAC" };
  if (score < 70) return { label: "Moderate", color: "#FACC15" };
  if (score < 85) return { label: "High",     color: "#FB923C" };
  return             { label: "Severe",    color: "#F87171" };
}
