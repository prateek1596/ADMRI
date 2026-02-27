import { useState } from "react";
import { motion } from "framer-motion";
import { T } from "../styles/theme";
import { card, inp, chip } from "../styles/shared";
import { Avatar, RiskBadge, MiniTrend } from "../components/ui/Primitives";

export function PatientsPage({ patients, notes, onSelectPatient, onAddPatient }) {
  const [search, setSearch] = useState("");

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.diagnosis.toLowerCase().includes(search.toLowerCase())
  );

  const highRisk = patients.filter(p => {
    const last = p.riskHistory?.[p.riskHistory.length - 1];
    return last !== undefined && last >= 70;
  });

  return (
    <motion.div key="patients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Search */}
      <input
        style={{ ...inp, marginBottom: 18 }}
        placeholder="🔍  Search by name or diagnosis..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* High risk alert */}
      {highRisk.length > 0 && (
        <div style={{
          padding: "12px 16px", background: `${T.danger}10`,
          border: `1px solid ${T.danger}33`, borderRadius: 12,
          marginBottom: 18, fontSize: 13, color: T.danger,
          fontWeight: 600, display: "flex", gap: 8, alignItems: "center",
        }}>
          ⚠️ {highRisk.length} patient(s) at High/Severe risk —{" "}
          {highRisk.map(p => p.name.split(" ")[0]).join(", ")}
        </div>
      )}

      {/* Patient Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
        {filtered.map((pat, i) => {
          const lastScore = pat.riskHistory?.[pat.riskHistory.length - 1];
          const patNotes  = notes.filter(n => n.patientId === pat.id);
          const latestNote = patNotes.sort((a, b) => b.date.localeCompare(a.date))[0];

          return (
            <motion.div
              key={pat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -3, borderColor: T.borderLight }}
              onClick={() => onSelectPatient(pat)}
              style={{ ...card, cursor: "pointer", transition: "all 0.18s", marginBottom: 0 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Avatar name={pat.name} size={42} color={T.accent} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{pat.name}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>Age {pat.age} · {pat.gender}</div>
                  </div>
                </div>
                {lastScore !== undefined && <RiskBadge score={lastScore} />}
              </div>

              <span style={chip(T.accentAlt)}>{pat.diagnosis}</span>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <div style={{ fontSize: 11, color: T.muted }}>
                  {latestNote ? `Last note: ${latestNote.date}` : `Joined: ${pat.joinDate}`}
                </div>
                <MiniTrend history={pat.riskHistory} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
          No patients found.{" "}
          <span style={{ color: T.accent, cursor: "pointer" }} onClick={onAddPatient}>
            Add one?
          </span>
        </div>
      )}
    </motion.div>
  );
}
