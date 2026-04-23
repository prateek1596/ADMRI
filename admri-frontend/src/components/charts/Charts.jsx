import { motion } from "framer-motion";
import { T } from "../../styles/theme";

export function RiskGauge({ score, risk }) {
  const angle = (score / 100) * 180 - 90;

  return (
    <div style={{ textAlign: "center", padding: "16px 0 6px" }}>
      <svg width="190" height="100" viewBox="0 0 200 110">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={T.safe}   />
            <stop offset="50%"  stopColor={T.warn}   />
            <stop offset="100%" stopColor={T.danger}  />
          </linearGradient>
        </defs>
        {/* Track */}
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke={T.border} strokeWidth="10" strokeLinecap="round" />
        {/* Fill */}
        <path d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none" stroke="url(#gaugeGrad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 251} 251`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
        {/* Needle */}
        <line
          x1="100" y1="100"
          x2={100 + 60 * Math.cos(((angle - 90) * Math.PI) / 180)}
          y2={100 + 60 * Math.sin(((angle - 90) * Math.PI) / 180)}
          stroke={risk.color} strokeWidth="3" strokeLinecap="round"
          style={{ transition: "all 1.2s" }} />
        <circle cx="100" cy="100" r="5" fill={risk.color} />
      </svg>

      <div style={{ marginTop: -2 }}>
        <span style={{ fontSize: 38, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: risk.color, letterSpacing: -2 }}>
          {Math.round(score)}
        </span>
        <span style={{ color: T.muted, fontSize: 15 }}>/100</span>
      </div>

      <div style={{
        display: "inline-block", padding: "3px 14px", borderRadius: 20,
        background: `${risk.color}22`, border: `1px solid ${risk.color}55`,
        color: risk.color, fontSize: 12, fontWeight: 700, marginTop: 4,
        letterSpacing: 1, textTransform: "uppercase",
      }}>
        {risk.label} Risk
      </div>
    </div>
  );
}

export function TrendChart({ history, label = "Risk Trend" }) {
  if (!history || history.length < 2) return null;
  const w = 280, h = 64;

  const pts = history.map((v, i) =>
    `${(i / (history.length - 1)) * w},${h - (v / 100) * h}`
  );
  const fillPath = `M 0,${h} L ${pts.join(" L ")} L ${w},${h} Z`;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>
        {label} ({history.length} sessions)
      </div>
      <svg width={w} height={h}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={T.accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={T.accent} stopOpacity="0"    />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#trendFill)" />
        <polyline
          points={pts.join(" ")}
          fill="none" stroke={T.accent} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {history.map((v, i) => (
          <circle key={i}
            cx={(i / (history.length - 1)) * w}
            cy={h - (v / 100) * h}
            r="3" fill={T.accent} />
        ))}
      </svg>
    </div>
  );
}

export function ModalityBar({ label, score, color, icon }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12, color: T.muted }}>
        <span>{icon} {label}</span>
        <span style={{ color: T.text, fontWeight: 700 }}>{Math.round(score)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 4, background: T.border, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 4, background: color }}
        />
      </div>
    </div>
  );
}

/** Live training loss curve */
export function TrainingChart({ logs }) {
  if (!logs || logs.length < 2) return null;
  const w = 300, h = 60;
  const losses    = logs.map(l => l.loss);
  const valLosses = logs.map(l => l.valLoss);
  const maxL = Math.max(...losses, ...valLosses) || 1;

  const toPoints = (arr) =>
    arr.map((v, i) => `${(i / (arr.length - 1)) * w},${h - (v / maxL) * h}`).join(" ");

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>
        Training Loss  <span style={{ color: T.accentAlt }}>— val loss</span>
      </div>
      <svg width={w} height={h}>
        <polyline points={toPoints(losses)} fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={toPoints(valLosses)} fill="none" stroke={T.accentAlt} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
      </svg>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
        Epoch {logs[logs.length - 1]?.epoch}/40 &nbsp;·&nbsp;
        Loss: <span style={{ color: T.accent }}>{logs[logs.length - 1]?.loss}</span> &nbsp;·&nbsp;
        MAE: <span style={{ color: T.safe }}>{logs[logs.length - 1]?.mae}</span>
      </div>
    </div>
  );
}

// ─── Domain Radar Chart (Symptom Profile) ────────────────────────────────────
export function DomainRadar({ profile }) {
  if (!profile) return null;
  const cx = 110, cy = 110, r = 80;
  const domains = [
    { key: "depression",    label: "Depression"  },
    { key: "anxiety",       label: "Anxiety"     },
    { key: "sleep",         label: "Sleep"       },
    { key: "somatic",       label: "Somatic"     },
    { key: "concentration", label: "Cognitive"   },
    { key: "sentiment",     label: "Sentiment"   },
    { key: "behavioural",   label: "Behavioural" },
  ];
  const n     = domains.length;
  const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2;

  const gridPts = (pct) =>
    domains.map((_, i) => {
      const a = angle(i);
      return `${cx + pct * r * Math.cos(a)},${cy + pct * r * Math.sin(a)}`;
    }).join(" ");

  const dataPts = domains.map((d, i) => {
    const val = (profile[d.key] ?? 0) / 100;
    const a = angle(i);
    return `${cx + val * r * Math.cos(a)},${cy + val * r * Math.sin(a)}`;
  }).join(" ");

  return (
    <div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
        Symptom Domain Profile
      </div>
      <svg width={220} height={220}>
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <polygon key={pct} points={gridPts(pct)}
            fill="none" stroke={T.border} strokeWidth="1" />
        ))}
        {/* Axes */}
        {domains.map((_, i) => {
          const a = angle(i);
          return <line key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)}
            stroke={T.border} strokeWidth="1" />;
        })}
        {/* Data */}
        <polygon points={dataPts}
          fill={`${T.accent}28`} stroke={T.accent} strokeWidth="2"
          strokeLinejoin="round" />
        {/* Labels */}
        {domains.map((d, i) => {
          const a = angle(i);
          const lx = cx + (r + 18) * Math.cos(a);
          const ly = cy + (r + 18) * Math.sin(a);
          const val = profile[d.key] ?? 0;
          return (
            <text key={d.key} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fill={val > 60 ? T.danger : val > 40 ? T.warn : T.muted}
              fontSize="9" fontWeight="700" fontFamily="DM Sans, sans-serif">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Forecast Chart ───────────────────────────────────────────────────────────
export function ForecastChart({ history, forecast }) {
  if (!history || history.length < 2 || !forecast) return null;
  const w = 280, h = 70;
  const allPoints = [...history, forecast.forecast];
  const totalLen  = allPoints.length;
  const xFor      = i => (i / (totalLen - 1)) * w;
  const yFor      = v => h - (v / 100) * h;

  const histPts = history.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");

  const lastX   = xFor(history.length - 1);
  const lastY   = yFor(history[history.length - 1]);
  const foreX   = xFor(totalLen - 1);
  const foreY   = yFor(forecast.forecast);
  const loY     = yFor(forecast.lower);
  const hiY     = yFor(forecast.upper);

  const trendColor = forecast.trend === "worsening" ? T.danger
    : forecast.trend === "improving" ? T.safe
    : T.warn;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>
        Trajectory Forecast{" "}
        <span style={{ color: trendColor, fontWeight: 700 }}>
          ({forecast.trend}, {forecast.slopePerSession > 0 ? "+" : ""}{forecast.slopePerSession} pts/session)
        </span>
      </div>
      <svg width={w} height={h}>
        {/* CI band for forecast */}
        <rect x={lastX} y={hiY} width={foreX - lastX} height={loY - hiY}
          fill={`${trendColor}18`} />

        {/* History line */}
        <polyline points={histPts} fill="none"
          stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Forecast dashed line */}
        <line x1={lastX} y1={lastY} x2={foreX} y2={foreY}
          stroke={trendColor} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />

        {/* Forecast point */}
        <circle cx={foreX} cy={foreY} r="4" fill={trendColor} />
        <text x={foreX + 5} y={foreY - 5}
          fill={trendColor} fontSize="10" fontWeight="700" fontFamily="DM Sans, sans-serif">
          {forecast.forecast}
        </text>

        {/* CI labels */}
        <text x={foreX + 5} y={hiY + 2} fill={T.muted} fontSize="8" fontFamily="DM Sans, sans-serif">{forecast.upper}</text>
        <text x={foreX + 5} y={loY + 8} fill={T.muted} fontSize="8" fontFamily="DM Sans, sans-serif">{forecast.lower}</text>
      </svg>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
        Predicted next session: <span style={{ color: trendColor, fontWeight: 700 }}>{forecast.forecast}</span>
        {" "}(95% CI: {forecast.lower}–{forecast.upper})
      </div>
    </div>
  );
}

// ─── Confidence Distribution (MC Dropout histogram) ──────────────────────────
export function ConfidenceBar({ mean, lower, upper, std, confidence }) {
  const confColor = confidence === "high" ? T.safe : confidence === "medium" ? T.warn : T.danger;
  const barW = 260;
  const toX = v => (v / 100) * barW;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>
        Prediction Confidence{" "}
        <span style={{ color: confColor, fontWeight: 700 }}>({confidence})</span>
        {" "}· σ = {std}
      </div>
      <svg width={barW} height={24}>
        {/* Background track */}
        <rect x={0} y={8} width={barW} height={8} rx={4} fill={T.border} />
        {/* CI band */}
        <rect x={toX(lower)} y={8} width={toX(upper) - toX(lower)} height={8} rx={4} fill={`${confColor}44`} />
        {/* Mean point */}
        <circle cx={toX(mean)} cy={12} r={6} fill={confColor} />
        {/* Labels */}
        <text x={toX(lower)} y={24} textAnchor="middle" fill={T.muted} fontSize="9" fontFamily="DM Sans, sans-serif">{lower}</text>
        <text x={toX(mean)}  y={24} textAnchor="middle" fill={confColor} fontSize="9" fontWeight="700" fontFamily="DM Sans, sans-serif">{mean}</text>
        <text x={toX(upper)} y={24} textAnchor="middle" fill={T.muted} fontSize="9" fontFamily="DM Sans, sans-serif">{upper}</text>
      </svg>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
        95% confidence interval: {lower}–{upper}
      </div>
    </div>
  );
}
