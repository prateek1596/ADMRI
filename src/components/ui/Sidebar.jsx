import { T } from "../../styles/theme";
import { Avatar } from "../ui/Primitives";

export function Sidebar({ auth, patients, notes, view, selPat, onNav, onSelectPatients, onSelectDashboard, onLogout, mlState }) {
  const highRisk = patients.filter(p => {
    const last = p.riskHistory?.[p.riskHistory.length - 1];
    return last !== undefined && last >= 70;
  }).length;

  const sideBtn = (active, color = T.accent) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
    width: "100%", textAlign: "left", fontSize: 13, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
    background: active ? `${color}18` : "transparent",
    color: active ? color : T.muted, marginBottom: 2,
  });

  const mlColor = mlState?.training ? T.warn : mlState?.trained ? T.safe : T.muted;
  const mlLabel = mlState?.loading ? "Checking cache..." : mlState?.training ? `Training… ${mlState.overallProgress || 0}%` : mlState?.trained ? (mlState.fromCache ? "Models cached ⚡" : "Models ready ✓") : "Awaiting...";

  return (
    <div style={{ width: 236, minHeight: "100vh", background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, zIndex: 50 }}>
      {/* Logo */}
      <div style={{ padding: "22px 18px 18px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: -0.8 }}>
          ADMRI<span style={{ color: T.accent }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Clinician Dashboard</div>
      </div>

      {/* Nav */}
      <div style={{ padding: "14px 10px", flex: 1, overflowY: "auto" }}>
        <button style={sideBtn(view === "dashboard")} onClick={onSelectDashboard}>
          <span>🏠</span> Dashboard
        </button>
        <button style={sideBtn(view === "patients")} onClick={onSelectPatients}>
          <span>👥</span> My Patients
          <span style={{ marginLeft: "auto", background: `${T.accent}22`, color: T.accent, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
            {patients.length}
          </span>
        </button>

        {selPat && (
          <button style={{ ...sideBtn(view === "patient", T.doctorAccent) }} onClick={() => onNav("patient")}>
            <span>🧠</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selPat.name.split(" ")[0]}
            </span>
          </button>
        )}

        <div style={{ height: 1, background: T.border, margin: "14px 4px" }} />

        <div style={{ padding: "0 4px", fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>OVERVIEW</div>

        {[
          { label: "Total Patients", value: patients.length,  color: T.text },
          { label: "High Risk",      value: highRisk,          color: highRisk > 0 ? T.danger : T.text },
          { label: "Session Notes",  value: notes.length,      color: T.text },
        ].map((s, i) => (
          <div key={i} style={{ padding: "7px 4px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: T.muted }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
          </div>
        ))}

        <div style={{ height: 1, background: T.border, margin: "14px 4px" }} />

        {/* ML Status */}
        <div style={{ padding: "0 4px", fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>ML ENGINE</div>
        <div style={{ padding: "10px 10px", background: `${mlColor}0f`, borderRadius: 10, border: `1px solid ${mlColor}22`, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: mlColor, flexShrink: 0,
              animation: mlState?.training ? "pulse 1.2s ease-in-out infinite" : "none" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: mlColor }}>{mlLabel}</span>
          </div>
          {mlState?.training && (
            <div style={{ height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
              <div style={{ width: `${mlState.overallProgress || 0}%`, height: "100%", background: mlColor, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          )}
          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>4-model ensemble · PHQ-9/GAD-7/ISI</div>
        </div>


      </div>

      {/* Doctor profile + logout */}
      <div style={{ padding: "14px 10px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 4px", marginBottom: 10 }}>
          <Avatar name={auth.doctor.name} size={34} color={T.doctorAccent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.doctor.name}</div>
            <div style={{ fontSize: 11, color: T.muted }}>{auth.doctor.specialty}</div>
          </div>
        </div>
        <button style={{ width: "100%", padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", background: `${T.danger}22`, color: T.danger }}
          onClick={onLogout}>Sign Out</button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
