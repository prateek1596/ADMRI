// src/components/features/ShapExplainer.jsx
// SHAP-style feature importance panel — shows what drove the ADMRI score
import { useState, useEffect } from "react";

const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
async function api(method, path) {
  const token = localStorage.getItem("admri_access_token");
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.error||`HTTP ${res.status}`); }
  return res.json();
}

const DOMAIN_COLORS = {
  Questionnaire: "#58A6FF",
  NLP:           "#BC8CFF",
  Behavioural:   "#3FB950",
  Sleep:         "#E3B341",
};

export function ShapExplainer({ assessmentId, patientId, admriScore }) {
  const [features, setFeatures] = useState([]);
  const [baseValue, setBaseValue] = useState(50);
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState(null);

  useEffect(() => {
    if (!assessmentId || !patientId) return;
    load();
  }, [assessmentId, patientId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await api("GET", `/patients/${patientId}/assessments/${assessmentId}/shap`);
      setFeatures(res.feature_scores || []);
      setBaseValue(res.base_value || 50);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div style={{ padding:"24px 0", textAlign:"center", color:"var(--muted)", fontSize:13 }}>
      Computing feature importance…
    </div>
  );

  if (error) return (
    <div style={{ padding:"16px", borderRadius:10, fontSize:13,
      background:"color-mix(in srgb,var(--danger) 10%,transparent)",
      color:"var(--danger)" }}>
      Could not load explainability data: {error}
    </div>
  );

  const maxMag = Math.max(...features.map(f => f.magnitude), 1);
  const topRisks     = features.filter(f => f.contribution > 0).slice(0, 5);
  const topProtective= features.filter(f => f.contribution < 0).slice(0, 3);

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>

      {/* Score breakdown header */}
      <div style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"14px 16px", borderRadius:12, marginBottom:16,
        background:"var(--surface)", border:"1px solid var(--border)",
      }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, fontWeight:800, color:"var(--accent)", fontFamily:"'Syne',sans-serif", lineHeight:1 }}>
            {Math.round(admriScore)}
          </div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>ADMRI Score</div>
        </div>
        <div style={{ fontSize:20, color:"var(--muted)" }}>=</div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:700, color:"var(--muted)", fontFamily:"'Syne',sans-serif", lineHeight:1 }}>
            {Math.round(baseValue)}
          </div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>Baseline avg</div>
        </div>
        <div style={{ fontSize:20, color:"var(--muted)" }}>+</div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:22, fontWeight:700,
            color: admriScore > baseValue ? "var(--danger)" : "var(--safe)",
            fontFamily:"'Syne',sans-serif", lineHeight:1 }}>
            {admriScore > baseValue ? "+" : ""}{Math.round(admriScore - baseValue)}
          </div>
          <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>Feature effects</div>
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ fontSize:11, color:"var(--muted)", maxWidth:200, lineHeight:1.5 }}>
          The baseline is this patient's historical average. Feature effects show what pushed the score up or down this session.
        </div>
      </div>

      {/* Risk factors */}
      {topRisks.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--danger)",
            letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:10 }}>
            Factors increasing risk
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {topRisks.map(f => (
              <FeatureBar key={f.key} feature={f} maxMag={maxMag} direction="risk" />
            ))}
          </div>
        </div>
      )}

      {/* Protective factors */}
      {topProtective.length > 0 && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--safe)",
            letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:10 }}>
            Protective factors
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {topProtective.map(f => (
              <FeatureBar key={f.key} feature={f} maxMag={maxMag} direction="protective" />
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize:11, color:"var(--muted)", marginTop:14, lineHeight:1.6,
        padding:"10px 12px", borderRadius:8,
        background:"var(--surface)", border:"1px solid var(--border)" }}>
        ℹ️ Feature importance is computed using SHAP-style permutation analysis on the 4-model ensemble.
        Contributions are approximations and should be interpreted alongside clinical judgment.
      </div>
    </div>
  );
}

function FeatureBar({ feature, maxMag, direction }) {
  const isRisk = direction === "risk";
  const barColor = isRisk ? "var(--danger)" : "var(--safe)";
  const domainColor = DOMAIN_COLORS[feature.domain] || "var(--muted)";
  const barWidth = (feature.magnitude / maxMag) * 100;

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"10px 12px", borderRadius:10,
      background:"var(--card)", border:"1px solid var(--border)",
    }}>
      {/* Domain colour dot */}
      <div style={{ width:8, height:8, borderRadius:"50%", background:domainColor, flexShrink:0 }} />

      {/* Label */}
      <div style={{ width:160, flexShrink:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>{feature.label}</div>
        <div style={{ fontSize:10, color:"var(--muted)" }}>{feature.domain}</div>
      </div>

      {/* Bar */}
      <div style={{ flex:1, height:8, borderRadius:4, background:"var(--surface)", overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:4, transition:"width 0.5s ease",
          width:`${barWidth}%`,
          background: barColor,
          opacity: 0.7 + (barWidth / 300),
        }} />
      </div>

      {/* Value */}
      <div style={{
        fontSize:13, fontWeight:700, width:52, textAlign:"right", flexShrink:0,
        color: isRisk ? "var(--danger)" : "var(--safe)",
      }}>
        {isRisk ? "+" : ""}{feature.contribution.toFixed(1)}
      </div>
    </div>
  );
}
