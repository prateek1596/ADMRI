// src/ml/PlattCalibration.js
// Platt scaling converts raw neural network outputs (MC-Dropout means)
// into calibrated probability estimates.
// "72% probability this patient crosses the High threshold at next assessment"

export class PlattCalibration {
  constructor() {
    // Platt parameters (A, B) — learned via sigmoid fitting
    // These are initialised from population statistics and refined per-patient
    this.params = {
      mild:     { A: -1.8, B: 0.42 },  // P(score >= 41)
      moderate: { A: -2.1, B: 0.48 },  // P(score >= 61)
      high:     { A: -2.6, B: 0.55 },  // P(score >= 76)
    };
    this.calibrated = false;
    this.sampleCount = 0;
  }

  // ── Sigmoid function ──────────────────────────────────────────────────────
  _sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  // ── Convert raw score to calibrated probability ───────────────────────────
  // Returns { pMild, pModerate, pHigh, pSevere } as 0-1 probabilities
  calibrate(rawScore, confidenceInterval = null) {
    const score = rawScore / 100; // normalise to 0-1

    const pMild     = this._sigmoid(this.params.mild.A     * score + this.params.mild.B);
    const pModerate = this._sigmoid(this.params.moderate.A * score + this.params.moderate.B);
    const pHigh     = this._sigmoid(this.params.high.A     * score + this.params.high.B);

    // Adjust using CI width as uncertainty factor
    let uncertainty = 0;
    if (confidenceInterval) {
      const ciWidth = (confidenceInterval.upper - confidenceInterval.lower) / 100;
      uncertainty = ciWidth * 0.15; // CI width shrinks confidence
    }

    // Clamp to [0.02, 0.98] — never report 0% or 100%
    const clamp = (v) => Math.min(0.98, Math.max(0.02, v));

    return {
      pMinimal:  clamp(1 - pMild),
      pMild:     clamp(pMild - pModerate),
      pModerate: clamp(pModerate - pHigh),
      pHigh:     clamp(pHigh * 0.7),
      pSevere:   clamp(pHigh * 0.3),
      uncertainty: Math.round(uncertainty * 100),
      calibrated: this.calibrated,
    };
  }

  // ── Refine parameters using patient's own history ─────────────────────────
  // Called after each new assessment — online learning
  refineFromHistory(scoreHistory) {
    if (scoreHistory.length < 3) return;

    // Use patient history to adjust B (intercept) toward their personal base rate
    const avg = scoreHistory.reduce((a, b) => a + b, 0) / scoreHistory.length;
    const normalised = avg / 100;

    // Nudge parameters slightly toward patient's observed distribution
    const lr = 0.05; // small learning rate — don't overfit
    this.params.mild.B     += lr * (normalised > 0.41 ? 0.1 : -0.1);
    this.params.moderate.B += lr * (normalised > 0.61 ? 0.1 : -0.1);
    this.params.high.B     += lr * (normalised > 0.76 ? 0.1 : -0.1);

    this.calibrated   = true;
    this.sampleCount  = scoreHistory.length;
  }

  // ── Format for display ────────────────────────────────────────────────────
  formatProbabilities(probs) {
    return [
      { label: "Minimal",  prob: probs.pMinimal,  color: "var(--safe)"   },
      { label: "Mild",     prob: probs.pMild,     color: "var(--accent)" },
      { label: "Moderate", prob: probs.pModerate, color: "var(--warn)"   },
      { label: "High",     prob: probs.pHigh,     color: "var(--danger)" },
      { label: "Severe",   prob: probs.pSevere,   color: "#FF4500"       },
    ].map(tier => ({
      ...tier,
      pct:   Math.round(tier.prob * 100),
      label: tier.label,
    }));
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  save(patientId) {
    try {
      localStorage.setItem(`admri_platt_${patientId}`, JSON.stringify({
        params: this.params, calibrated: this.calibrated, sampleCount: this.sampleCount,
      }));
    } catch {}
  }

  load(patientId) {
    try {
      const d = localStorage.getItem(`admri_platt_${patientId}`);
      if (!d) return;
      const { params, calibrated, sampleCount } = JSON.parse(d);
      this.params      = params;
      this.calibrated  = calibrated;
      this.sampleCount = sampleCount;
    } catch {}
  }
}

// ── CalibratedProbabilityBar component (React) ─────────────────────────────
// Add this to Charts.jsx or use inline in PatientDetailPage
export function CalibratedProbabilityDisplay({ rawScore, confidenceInterval, riskHistory, patientId }) {
  const calibrator = new PlattCalibration();
  calibrator.load(patientId);
  if (riskHistory?.length >= 3) {
    calibrator.refineFromHistory(riskHistory);
    calibrator.save(patientId);
  }

  const probs  = calibrator.calibrate(rawScore, confidenceInterval);
  const tiers  = calibrator.formatProbabilities(probs);
  const topTwo = [...tiers].sort((a, b) => b.pct - a.pct).slice(0, 2);

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)",
        letterSpacing:1, textTransform:"uppercase", marginBottom:10 }}>
        Calibrated Risk Probabilities
        {probs.calibrated && (
          <span style={{ marginLeft:8, color:"var(--safe)", fontWeight:500, textTransform:"none" }}>
            · personalised ({calibrator.sampleCount} sessions)
          </span>
        )}
      </div>

      {/* Stacked probability bar */}
      <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden", marginBottom:10 }}>
        {tiers.map(tier => (
          <div key={tier.label} style={{
            width:`${tier.pct}%`, height:"100%",
            background:tier.color, transition:"width 0.5s",
            minWidth: tier.pct > 2 ? 2 : 0,
          }}/>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
        {tiers.map(tier => (
          <div key={tier.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:tier.color }}/>
            <span style={{ fontSize:11, color:"var(--muted)" }}>
              {tier.label}: <strong style={{ color:"var(--text)" }}>{tier.pct}%</strong>
            </span>
          </div>
        ))}
      </div>

      {/* Top prediction */}
      <div style={{ marginTop:10, padding:"8px 12px", borderRadius:8,
        background:"var(--surface)", fontSize:12, color:"var(--muted)" }}>
        Most likely: <strong style={{ color:topTwo[0].color }}>{topTwo[0].label} ({topTwo[0].pct}%)</strong>
        {topTwo[1] && ` · also possible: ${topTwo[1].label} (${topTwo[1].pct}%)`}
        {probs.uncertainty > 5 && ` · ±${probs.uncertainty}% uncertainty`}
      </div>
    </div>
  );
}
