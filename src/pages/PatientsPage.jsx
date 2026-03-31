// src/pages/PatientsPage.jsx — mobile-responsive with search + filter
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMobile } from "../hooks/useMobile";
import { Avatar, RiskBadge } from "../components/ui/Primitives";
import { mlEngine } from "../ml/ADMRIEngine";

const RISK_FILTERS = ["All","Minimal","Mild","Moderate","High","Severe"];

function MiniSparkline({ history }) {
  if (!history?.length) return null;
  const pts  = history.slice(-6);
  const min  = Math.min(...pts);
  const max  = Math.max(...pts) || 1;
  const W = 60, H = 24, pad = 2;
  const points = pts.map((v,i) => ({
    x: pad + (i / (pts.length - 1 || 1)) * (W - pad*2),
    y: pad + H - pad - ((v - min) / (max - min || 1)) * (H - pad*2),
  }));
  const d = points.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last  = pts[pts.length-1];
  const first = pts[0];
  const color = last > first + 5 ? "var(--danger)" : last < first - 5 ? "var(--safe)" : "var(--muted)";
  return (
    <svg width={W} height={H} style={{ flexShrink:0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function PatientsPage({ patients, notes, onSelectPatient, onAddPatient }) {
  const { isMobile, isTablet, gridCols } = useMobile();
  const [search,      setSearch]      = useState("");
  const [riskFilter,  setRiskFilter]  = useState("All");
  const [sort,        setSort]        = useState("name"); // name | risk | date

  const filtered = useMemo(() => {
    let list = [...patients];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.diagnosis?.toLowerCase().includes(q) ||
        p.guardian?.toLowerCase().includes(q)
      );
    }

    // Risk filter
    if (riskFilter !== "All") {
      list = list.filter(p => {
        const last = p.riskHistory?.[p.riskHistory.length-1];
        if (last === undefined) return false;
        const risk = mlEngine.classifyRisk(last);
        return risk?.label === riskFilter;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sort === "risk") {
        const aS = a.riskHistory?.[a.riskHistory.length-1] ?? 0;
        const bS = b.riskHistory?.[b.riskHistory.length-1] ?? 0;
        return bS - aS;
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [patients, search, riskFilter, sort]);

  const highRisk = patients.filter(p => {
    const last = p.riskHistory?.[p.riskHistory.length-1];
    return last !== undefined && last >= 61;
  });

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800,
            fontSize: isMobile?18:22, color:"var(--text)" }}>
            Patient Registry
          </div>
          <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>
            {patients.length} patients · {highRisk.length} high risk
          </div>
        </div>
        {!isMobile && (
          <button onClick={onAddPatient} style={{
            padding:"9px 18px", borderRadius:10, border:"none",
            background:"var(--accent)", color:"#fff",
            fontWeight:700, fontSize:13, cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",
          }}>+ Add Patient</button>
        )}
      </div>

      {/* High risk banner */}
      {highRisk.length > 0 && (
        <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:14,
          background:"color-mix(in srgb,var(--danger) 10%,transparent)",
          border:"1px solid color-mix(in srgb,var(--danger) 30%,transparent)",
          fontSize:13, color:"var(--danger)", fontWeight:600 }}>
          ⚠ {highRisk.length} patient{highRisk.length>1?"s":""} require immediate attention:
          {" "}{highRisk.map(p=>p.name.split(" ")[0]).join(", ")}
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth: isMobile?"100%":200, position:"relative" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name, diagnosis, guardian…"
            style={{ width:"100%", padding:"9px 12px 9px 36px", borderRadius:10,
              border:"1px solid var(--inp-border)", background:"var(--inp-bg)",
              color:"var(--inp-text)", fontSize:13, outline:"none",
              fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" }}/>
          <span style={{ position:"absolute", left:12, top:"50%",
            transform:"translateY(-50%)", fontSize:14, color:"var(--muted)" }}>🔍</span>
        </div>
        <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)}
          style={{ padding:"9px 12px", borderRadius:10,
            border:"1px solid var(--inp-border)", background:"var(--inp-bg)",
            color:"var(--inp-text)", fontSize:13, outline:"none",
            fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
          {RISK_FILTERS.map(f=><option key={f}>{f}</option>)}
        </select>
        <select value={sort} onChange={e=>setSort(e.target.value)}
          style={{ padding:"9px 12px", borderRadius:10,
            border:"1px solid var(--inp-border)", background:"var(--inp-bg)",
            color:"var(--inp-text)", fontSize:13, outline:"none",
            fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
          <option value="name">Sort: Name</option>
          <option value="risk">Sort: Risk ↓</option>
        </select>
      </div>

      {/* Patient grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px", color:"var(--muted)",
          fontSize:13, background:"var(--surface)", borderRadius:12,
          border:"1px dashed var(--border)" }}>
          {search || riskFilter!=="All" ? "No patients match your filters." : "No patients yet."}
        </div>
      ) : (
        <div style={{ display:"grid",
          gridTemplateColumns: isMobile?"1fr":isTablet?"repeat(2,1fr)":"repeat(3,1fr)",
          gap:12 }}>
          <AnimatePresence>
            {filtered.map((p, i) => (
              <PatientCard key={p.id} patient={p} index={i}
                onClick={()=>onSelectPatient(p)} isMobile={isMobile} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button onClick={onAddPatient} style={{
          position:"fixed", bottom:72, right:16, zIndex:80,
          width:52, height:52, borderRadius:"50%", border:"none",
          background:"var(--accent)", color:"#fff",
          fontSize:24, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 4px 16px rgba(0,0,0,0.25)",
        }}>+</button>
      )}
    </motion.div>
  );
}

function PatientCard({ patient, index, onClick, isMobile }) {
  const lastScore = patient.riskHistory?.[patient.riskHistory.length-1];
  const risk      = lastScore !== undefined ? mlEngine.classifyRisk(lastScore) : null;
  const trend     = (() => {
    const h = patient.riskHistory || [];
    if (h.length < 2) return null;
    const delta = h[h.length-1] - h[h.length-2];
    return delta > 5 ? "↑" : delta < -5 ? "↓" : "→";
  })();
  const trendColor = trend==="↑"?"var(--danger)":trend==="↓"?"var(--safe)":"var(--muted)";

  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      style={{ background:"var(--card)", border:"1px solid var(--border)",
        borderRadius:14, padding:"14px 16px", cursor:"pointer",
        transition:"border-color 0.15s",
      }}
      whileHover={{ scale:1.01 }}
      whileTap={{ scale:0.99 }}>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
        <Avatar name={patient.name} size={38} color="var(--accent)" />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"var(--text)",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {patient.name}
          </div>
          <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
            Age {patient.age} · {patient.gender}
          </div>
        </div>
        {risk && <RiskBadge score={lastScore} />}
      </div>

      <div style={{ fontSize:12, color:"var(--muted)", marginBottom:10,
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {patient.diagnosis || "No diagnosis"}
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <MiniSparkline history={patient.riskHistory} />
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {lastScore !== undefined && (
            <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>
              {lastScore}
              {trend && <span style={{ color:trendColor, marginLeft:4 }}>{trend}</span>}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
