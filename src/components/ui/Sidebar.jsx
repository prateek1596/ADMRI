import { SidebarProfile } from "./SidebarProfile";
import { ThemeToggle }    from "./ThemeToggle";

export function Sidebar({
  auth, patients, notes,
  view, selPat, onNav,
  onSelectPatients, onSelectDashboard,
  onLogout, onViewProfile,
  mlState, themeMode, onSetTheme,
}) {
  const highRisk = patients.filter(p => {
    const last = p.riskHistory?.[p.riskHistory.length - 1];
    return last !== undefined && last >= 70;
  }).length;

  const sideBtn = (active, isDoctor = false) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
    width: "100%", textAlign: "left", fontSize: 13, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
    background: active
      ? isDoctor
        ? "color-mix(in srgb, var(--doctor) 14%, transparent)"
        : "color-mix(in srgb, var(--accent) 14%, transparent)"
      : "transparent",
    color: active
      ? isDoctor ? "var(--doctor)" : "var(--accent)"
      : "var(--muted)",
    marginBottom: 2,
  });

  const mlDot   = mlState?.training ? "#E3B341" : mlState?.trained ? "#3FB950" : "#8B949E";
  const mlColor = mlState?.training ? "var(--warn)" : mlState?.trained ? "var(--safe)" : "var(--muted)";
  const mlLabel = mlState?.loading   ? "Checking cache..."
    : mlState?.training ? `Training… ${mlState.overallProgress || 0}%`
    : mlState?.trained  ? (mlState.fromCache ? "Models cached ⚡" : "Models ready ✓")
    : "Awaiting...";

  return (
    <div style={{
      width: 236, minHeight: "100vh",
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      position: "fixed", top: 0, left: 0, zIndex: 50,
      overflow: "hidden",  // prevent anything from poking out
    }}>
      {/* Logo */}
      <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: -0.8, color: "var(--text)" }}>
          ADMRI<span style={{ color: "var(--accent)" }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Clinician Dashboard</div>
      </div>

      {/* Nav — scrollable middle */}
      <div style={{ padding: "14px 10px", flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <button style={sideBtn(view === "dashboard")} onClick={onSelectDashboard}>
          <span style={{ fontSize: 15 }}>🏠</span> Dashboard
        </button>
        <button style={sideBtn(view === "patients")} onClick={onSelectPatients}>
          <span style={{ fontSize: 15 }}>👥</span> My Patients
          <span style={{
            marginLeft: "auto", flexShrink: 0,
            background: "color-mix(in srgb, var(--accent) 18%, transparent)",
            color: "var(--accent)",
            borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 700,
          }}>
            {patients.length}
          </span>
        </button>

        {selPat && (
          <button style={sideBtn(view === "patient", true)} onClick={() => onNav("patient")}>
            <span style={{ fontSize: 15 }}>🧠</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selPat.name.split(" ")[0]}
            </span>
          </button>
        )}

        <div style={{ height: 1, background: "var(--border)", margin: "14px 4px" }} />

        <div style={{ padding: "0 4px", fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
          OVERVIEW
        </div>
        {[
          { label: "Total Patients", value: patients.length, danger: false },
          { label: "High Risk",      value: highRisk,         danger: highRisk > 0 },
          { label: "Session Notes",  value: notes.length,     danger: false },
        ].map(s => (
          <div key={s.label} style={{ padding: "7px 4px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--muted)" }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: s.danger ? "var(--danger)" : "var(--text)" }}>{s.value}</span>
          </div>
        ))}

        <div style={{ height: 1, background: "var(--border)", margin: "14px 4px" }} />

        <div style={{ padding: "0 4px", fontSize: 10, color: "var(--muted)", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
          ML ENGINE
        </div>
        <div style={{ padding: "10px", background: `${mlDot}12`, borderRadius: 10, border: `1px solid ${mlDot}28`, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%", background: mlDot, flexShrink: 0,
              animation: mlState?.training ? "pulse 1.2s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: mlColor }}>{mlLabel}</span>
          </div>
          {mlState?.training && (
            <div style={{ height: 3, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${mlState.overallProgress || 0}%`, height: "100%", background: mlDot, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          )}
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>4-model ensemble · PHQ-9/GAD-7/ISI</div>
        </div>
      </div>

      {/* Bottom — fixed height, no overflow */}
      <div style={{ padding: "10px 10px 12px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>

        {/* Appearance row — icon-only toggle to save space */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8, padding: "0 2px",
        }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Appearance</span>
          {/* Icon-only compact toggle */}
          <ThemeToggle mode={themeMode} onSetTheme={onSetTheme} compact={true} />
        </div>

        <SidebarProfile auth={auth} onLogout={onLogout} onViewProfile={onViewProfile} />
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
