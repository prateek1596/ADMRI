import { useMemo } from "react";
import { motion } from "framer-motion";
import { T } from "../styles/theme";
import { card } from "../styles/shared";
import { Avatar, RiskBadge, MiniTrend } from "../components/ui/Primitives";
import { mlEngine } from "../ml/ADMRIEngine";

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ ...card, marginBottom: 0, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Syne', sans-serif", color }}>{value}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Risk Distribution Bar ─────────────────────────────────────────────────────
function RiskDistBar({ patients }) {
  const tiers = [
    { label: "Minimal",  color: "#34D399", max: 20 },
    { label: "Mild",     color: "#86EFAC", max: 40 },
    { label: "Moderate", color: "#FACC15", max: 60 },
    { label: "High",     color: "#FB923C", max: 80 },
    { label: "Severe",   color: "#F87171", max: 101 },
  ];

  const counts = tiers.map(t => ({
    ...t,
    count: patients.filter(p => {
      const s = p.riskHistory?.[p.riskHistory.length - 1];
      return s !== undefined && s < t.max && s >= (tiers.indexOf(t) === 0 ? 0 : tiers[tiers.indexOf(t)-1].max);
    }).length,
  }));
  const total = patients.filter(p => p.riskHistory?.length > 0).length || 1;

  return (
    <div style={card}>
      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>Risk Distribution</div>
      <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 14, gap: 2 }}>
        {counts.map(t => t.count > 0 && (
          <div key={t.label} style={{ flex: t.count, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000a" }}>
            {t.count}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {counts.map(t => (
          <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color }} />
            <span style={{ color: T.muted }}>{t.label}</span>
            <span style={{ fontWeight: 700, color: T.text }}>{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trend Summary ─────────────────────────────────────────────────────────────
function TrendSummary({ patients, onSelectPatient }) {
  const trends = patients.map(p => {
    const h = p.riskHistory || [];
    if (h.length < 2) return { name: p.name, trend: "new", delta: 0, last: h[0] ?? null };
    const delta = h[h.length - 1] - h[h.length - 2];
    return {
      id: p.id, name: p.name, age: p.age, diagnosis: p.diagnosis,
      trend: delta > 5 ? "worsening" : delta < -5 ? "improving" : "stable",
      delta, last: h[h.length - 1], history: h,
    };
  }).filter(t => t.last !== null).sort((a, b) => b.last - a.last);

  const worsening = trends.filter(t => t.trend === "worsening");
  const improving = trends.filter(t => t.trend === "improving");
  const stable    = trends.filter(t => t.trend === "stable");

  return (
    <div style={card}>
      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
        Patient Trajectories
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Worsening", list: worsening, color: T.danger,  icon: "↑" },
          { label: "Stable",    list: stable,    color: T.warn,    icon: "→" },
          { label: "Improving", list: improving, color: T.safe,    icon: "↓" },
        ].map(({ label, list, color, icon }) => (
          <div key={label} style={{ textAlign: "center", padding: "12px 8px", borderRadius: 12, background: `${color}0f`, border: `1px solid ${color}22` }}>
            <div style={{ fontSize: 22, color, fontWeight: 800 }}>{list.length}</div>
            <div style={{ fontSize: 11, color, fontWeight: 600 }}>{icon} {label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {trends.slice(0, 6).map((t, i) => {
          const tColor = t.trend === "worsening" ? T.danger : t.trend === "improving" ? T.safe : T.warn;
          return (
            <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => { const p = patients.find(p => p.id === t.id); if (p && onSelectPatient) onSelectPatient(p); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: T.surface, cursor: onSelectPatient ? "pointer" : "default" }}>
              <Avatar name={t.name} size={30} color={tColor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{t.diagnosis}</div>
              </div>
              <MiniTrend history={t.history} />
              <RiskBadge score={t.last} />
              <div style={{ fontSize: 12, color: tColor, fontWeight: 700, minWidth: 32, textAlign: "right" }}>
                {t.delta > 0 ? "+" : ""}{t.delta !== 0 ? t.delta : "—"}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ notes, patients }) {
  const recent = [...notes]
    .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
    .slice(0, 8);

  const patMap = Object.fromEntries(patients.map(p => [p.id, p]));

  return (
    <div style={card}>
      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
        Recent Activity
      </div>
      {recent.length === 0 && <div style={{ color: T.muted, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No activity yet</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recent.map((note, i) => {
          const pat = patMap[note.patientId];
          const typeColors = { Session: T.accent, "Check-in": T.accentAlt, Assessment: T.warn, Crisis: T.danger, "Family Meeting": T.safe };
          const c = typeColors[note.type] || T.muted;
          return (
            <motion.div key={note.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              style={{ display: "flex", gap: 10, padding: "8px 10px", borderRadius: 10, background: T.surface, alignItems: "flex-start" }}>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 3, background: c, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{pat?.name ?? "Unknown"}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>{note.date}</span>
                </div>
                <span style={{ fontSize: 11, color: c, fontWeight: 600 }}>{note.type}</span>
                <span style={{ fontSize: 11, color: T.muted, marginLeft: 6 }}>
                  {note.content?.slice(0, 60)}{note.content?.length > 60 ? "…" : ""}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Avg Score by Diagnosis ────────────────────────────────────────────────────
function DiagnosisBreakdown({ patients }) {
  const byDiag = useMemo(() => {
    const map = {};
    patients.forEach(p => {
      const last = p.riskHistory?.[p.riskHistory.length - 1];
      if (last === undefined) return;
      if (!map[p.diagnosis]) map[p.diagnosis] = { scores: [], count: 0 };
      map[p.diagnosis].scores.push(last);
      map[p.diagnosis].count++;
    });
    return Object.entries(map).map(([diag, { scores, count }]) => ({
      diag, count,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    })).sort((a, b) => b.avg - a.avg);
  }, [patients]);

  if (byDiag.length === 0) return null;

  return (
    <div style={card}>
      <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
        Average Risk by Diagnosis
      </div>
      {byDiag.map(({ diag, count, avg }) => {
        const risk = mlEngine.classifyRisk(avg);
        return (
          <div key={diag} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: T.text, fontWeight: 600 }}>{diag}</span>
              <span style={{ color: T.muted }}>{count} patient{count !== 1 ? "s" : ""} · <span style={{ color: risk.color, fontWeight: 700 }}>{avg}</span></span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: T.border, overflow: "hidden" }}>
              <div style={{ width: `${avg}%`, height: "100%", background: risk.color, borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function DashboardPage({ patients, notes, auth, onSelectPatient }) {
  const assessed  = patients.filter(p => p.riskHistory?.length > 0);
  const highRisk  = patients.filter(p => { const s = p.riskHistory?.slice(-1)[0]; return s !== undefined && s >= 70; });
  const worsening = patients.filter(p => { const h = p.riskHistory||[]; return h.length >= 2 && h[h.length-1] - h[h.length-2] > 5; });

  const avgScore  = assessed.length
    ? Math.round(assessed.map(p => p.riskHistory.slice(-1)[0]).reduce((a,b)=>a+b,0) / assessed.length)
    : null;

  const totalNotes    = notes.length;
  const thisWeekNotes = notes.filter(n => {
    const d = new Date(n.date);
    const now = new Date();
    return (now - d) < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 4 }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {auth.doctor.name.split(" ")[1] || auth.doctor.name.split(" ")[0]} 👋
        </div>
        <div style={{ fontSize: 13, color: T.muted }}>Here's your clinical overview for today, {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Patients"   value={patients.length}   icon="👥" color={T.accent}    sub="Under your care" />
        <StatCard label="High Risk"        value={highRisk.length}   icon="⚠️" color={T.danger}    sub={highRisk.length > 0 ? highRisk.map(p=>p.name.split(" ")[0]).join(", ") : "All patients stable"} />
        <StatCard label="Avg ADMRI Score"  value={avgScore ?? "—"}   icon="📊" color={T.accentAlt} sub={`${assessed.length} assessed`} />
        <StatCard label="Notes This Week"  value={thisWeekNotes}     icon="📋" color={T.safe}      sub={`${totalNotes} total notes`} />
      </div>

      {/* High risk alert */}
      {highRisk.length > 0 && (
        <div style={{ padding: "12px 18px", background: `${T.danger}10`, border: `1px solid ${T.danger}33`, borderRadius: 12, marginBottom: 20, fontSize: 13, color: T.danger, fontWeight: 600 }}>
          🚨 {highRisk.length} patient{highRisk.length > 1 ? "s" : ""} require immediate attention: {highRisk.map(p => p.name).join(", ")}
        </div>
      )}
      {worsening.length > 0 && (
        <div style={{ padding: "12px 18px", background: `${T.warn}10`, border: `1px solid ${T.warn}33`, borderRadius: 12, marginBottom: 20, fontSize: 13, color: T.warn, fontWeight: 600 }}>
          📈 {worsening.length} patient{worsening.length > 1 ? "s" : ""} showing worsening trend: {worsening.map(p => p.name).join(", ")}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        <div>
          <TrendSummary patients={patients} onSelectPatient={onSelectPatient} />
          <DiagnosisBreakdown patients={patients} />
        </div>
        <div>
          <RiskDistBar patients={patients} />
          <ActivityFeed notes={notes} patients={patients} />
        </div>
      </div>
    </motion.div>
  );
}
