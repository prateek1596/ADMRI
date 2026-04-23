/**
 * PDF Report Export
 * ─────────────────
 * Generates a printable HTML report that opens in a new tab.
 * User can Ctrl+P → Save as PDF from there.
 * No external PDF library needed.
 */

export function exportPatientReport(patient, notes, assessmentHistory, doctorName) {
  const lastScore  = patient.riskHistory?.slice(-1)[0];
  const riskLabel  = lastScore === undefined ? "Not assessed" :
    lastScore < 20 ? "Minimal" : lastScore < 40 ? "Mild" :
    lastScore < 60 ? "Moderate" : lastScore < 80 ? "High" : "Severe";
  const riskColor  = lastScore === undefined ? "#94A3B8" :
    lastScore < 20 ? "#34D399" : lastScore < 40 ? "#86EFAC" :
    lastScore < 60 ? "#FACC15" : lastScore < 80 ? "#FB923C" : "#F87171";

  const patNotes = notes.filter(n => n.patientId === patient.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const historyRows = (patient.riskHistory || []).map((score, i) => `
    <tr>
      <td>Session ${i + 1}</td>
      <td><span style="color:${score < 40 ? "#059669" : score < 70 ? "#D97706" : "#DC2626"};font-weight:700">${score}/100</span></td>
      <td>${score < 20 ? "Minimal" : score < 40 ? "Mild" : score < 60 ? "Moderate" : score < 80 ? "High" : "Severe"}</td>
    </tr>`).join("");

  const notesRows = patNotes.slice(0, 10).map(n => `
    <tr>
      <td>${n.date}</td>
      <td><span style="color:#6366F1;font-weight:600">${n.type}</span></td>
      <td>${n.mood || "—"}</td>
      <td>${n.content?.slice(0, 120) ?? ""}${(n.content?.length ?? 0) > 120 ? "..." : ""}</td>
    </tr>`).join("");

  const assessRows = (assessmentHistory || []).slice(0, 5).map(a => `
    <tr>
      <td>${a.date}</td>
      <td>${a.score ?? "—"}</td>
      <td>${a.questScore ? Math.round(a.questScore) : "—"}</td>
      <td>${a.sentimentScore ? Math.round(a.sentimentScore) : "—"}</td>
      <td>${a.behaviouralScore ? Math.round(a.behaviouralScore) : "—"}</td>
    </tr>`).join("");

  const trendSvg = (() => {
    const h = patient.riskHistory || [];
    if (h.length < 2) return "<p style='color:#94A3B8'>Not enough data for trend chart</p>";
    const w = 500, ht = 80;
    const pts = h.map((v, i) => `${(i/(h.length-1))*w},${ht-(v/100)*ht}`).join(" ");
    return `<svg width="${w}" height="${ht}" style="border:1px solid #e2e8f0;border-radius:8px;padding:4px">
      <polyline points="${pts}" fill="none" stroke="${riskColor}" stroke-width="2.5" stroke-linecap="round"/>
      ${h.map((v,i) => `<circle cx="${(i/(h.length-1))*w}" cy="${ht-(v/100)*ht}" r="3" fill="${riskColor}"/>`).join("")}
    </svg>`;
  })();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ADMRI Clinical Report — ${patient.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 40px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; margin-bottom: 28px; }
    .logo { font-size: 26px; font-weight: 900; letter-spacing: -1px; color: #0f172a; }
    .logo span { color: #3ABFF8; }
    .report-meta { text-align: right; color: #64748b; font-size: 12px; }
    .score-hero { display: flex; align-items: center; gap: 24px; padding: 24px; background: #f8fafc; border-radius: 16px; margin-bottom: 28px; border: 1px solid #e2e8f0; }
    .score-circle { width: 80px; height: 80px; border-radius: 50%; border: 4px solid ${riskColor}; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: ${riskColor}; flex-shrink: 0; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .info-item { padding: 12px 16px; background: #f8fafc; border-radius: 10px; }
    .info-label { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
    .info-value { font-size: 14px; font-weight: 700; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    tr:hover td { background: #f8fafc; }
    .disclaimer { padding: 16px; background: #fef9f0; border: 1px solid #fde68a; border-radius: 10px; font-size: 11px; color: #92400e; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">ADMRI<span>.</span></div>
      <div style="color:#64748b;font-size:12px;margin-top:4px">Adaptive Digital Mental Health Risk Index</div>
    </div>
    <div class="report-meta">
      <div style="font-weight:700;font-size:14px">Clinical Assessment Report</div>
      <div>Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
      <div>Clinician: ${doctorName}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:4px">CONFIDENTIAL — For clinical use only</div>
    </div>
  </div>

  <div class="score-hero">
    <div class="score-circle">${lastScore ?? "—"}</div>
    <div>
      <div style="font-size:20px;font-weight:800;margin-bottom:4px">${patient.name}</div>
      <div style="color:#64748b;margin-bottom:8px">${patient.diagnosis} · Age ${patient.age} · ${patient.gender}</div>
      <div style="display:inline-block;padding:4px 14px;border-radius:20px;background:${riskColor}22;color:${riskColor};font-weight:700;font-size:13px;border:1px solid ${riskColor}44">${riskLabel} Risk</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Patient Information</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Full Name</div><div class="info-value">${patient.name}</div></div>
      <div class="info-item"><div class="info-label">Age</div><div class="info-value">${patient.age} years</div></div>
      <div class="info-item"><div class="info-label">Gender</div><div class="info-value">${patient.gender}</div></div>
      <div class="info-item"><div class="info-label">Diagnosis</div><div class="info-value">${patient.diagnosis}</div></div>
      <div class="info-item"><div class="info-label">Guardian</div><div class="info-value">${patient.guardian || "—"}</div></div>
      <div class="info-item"><div class="info-label">Contact</div><div class="info-value">${patient.contact || "—"}</div></div>
      <div class="info-item"><div class="info-label">Joined</div><div class="info-value">${patient.joinDate}</div></div>
      <div class="info-item"><div class="info-label">Sessions</div><div class="info-value">${patient.riskHistory?.length ?? 0} assessments</div></div>
      <div class="info-item"><div class="info-label">Latest ADMRI</div><div class="info-value" style="color:${riskColor}">${lastScore ?? "Not assessed"}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Risk Score Trend (${patient.riskHistory?.length ?? 0} sessions)</div>
    ${trendSvg}
  </div>

  ${historyRows ? `<div class="section">
    <div class="section-title">Assessment History</div>
    <table>
      <thead><tr><th>Session</th><th>ADMRI Score</th><th>Risk Level</th></tr></thead>
      <tbody>${historyRows}</tbody>
    </table>
  </div>` : ""}

  ${assessRows ? `<div class="section">
    <div class="section-title">Detailed Assessment Records</div>
    <table>
      <thead><tr><th>Date</th><th>ADMRI</th><th>Questionnaire</th><th>Sentiment</th><th>Behavioural</th></tr></thead>
      <tbody>${assessRows}</tbody>
    </table>
  </div>` : ""}

  ${notesRows ? `<div class="section">
    <div class="section-title">Session Notes (recent 10)</div>
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Mood</th><th>Notes</th></tr></thead>
      <tbody>${notesRows}</tbody>
    </table>
  </div>` : ""}

  <div class="disclaimer">
    <strong>⚠️ Clinical Disclaimer:</strong> This ADMRI report is a decision-support tool only. Risk scores are generated by machine learning models trained on validated clinical instruments (PHQ-9, GAD-7, ISI, SCARED) and should not replace clinical judgment. All assessments must be reviewed by a qualified mental health professional. In case of crisis, contact iCall: 9152987821 or emergency services.
  </div>

  <div style="text-align:center;color:#94a3b8;font-size:11px;margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9">
    ADMRI Clinical System · Generated ${new Date().toISOString()} · ${doctorName}
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}
