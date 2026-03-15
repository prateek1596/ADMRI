import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { T, NOTE_TYPE_COLORS, MOOD_COLORS } from "../styles/theme";
import { card, inp, btn, tabBtn, chip } from "../styles/shared";
import { Avatar, RiskBadge, Spinner } from "../components/ui/Primitives";
import {
  RiskGauge, TrendChart, ModalityBar, TrainingChart,
  DomainRadar, ForecastChart, ConfidenceBar,
} from "../components/charts/Charts";
import { mlEngine, analyzeSentiment, analyzeSentimentDetailed } from "../ml/ADMRIEngine";
import { QUESTIONS, OPTIONS } from "../data/seedData";
import { exportPatientReport } from "../utils/exportReport";
import ADMRIChatbot from "../components/chat/ADMRIChatbot";

export function PatientDetailPage({
  patient, notes, mlState,
  onAddNote, onBack, onRunAssessment,
  onRemovePatient, onRemoveNote,
  getAssessmentHistory, doctorName,
}) {
  const [tab, setTab] = useState("overview");

  const patNotes = notes
    .filter(n => n.patientId === patient.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const latestScore = patient.riskHistory?.[patient.riskHistory.length - 1];

  return (
    <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* ── Patient Header ── */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <Avatar name={patient.name} size={56} color={T.accent} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 5 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800 }}>
              {patient.name}
            </div>
            {latestScore !== undefined && <RiskBadge score={latestScore} />}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {[
              ["Diagnosis",     patient.diagnosis],
              ["Age",           patient.age],
              ["Gender",        patient.gender],
              ["Guardian",      patient.guardian],
              ["Contact",       patient.contact],
              ["Patient since", patient.joinDate],
            ].map(([k, v]) => (
              <div key={k} style={{ fontSize: 12 }}>
                <span style={{ color: T.muted }}>{k}: </span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <button style={btn("primary", "sm")} onClick={() => setTab("assess")}>
          🧪 New Assessment
        </button>
      </div>

      {/* ── ML Status Banners ── */}
      {mlState.loading && (
        <div style={{
          padding: "10px 16px", background: `${T.accentAlt}10`,
          border: `1px solid ${T.accentAlt}33`, borderRadius: 12, marginBottom: 14,
          display: "flex", alignItems: "center", gap: 12, fontSize: 13,
        }}>
          <Spinner size={16} color={T.accentAlt} />
          <span style={{ color: T.accentAlt }}>Checking browser cache for saved models…</span>
        </div>
      )}

      {mlState.training && (
        <div style={{
          padding: "14px 18px", background: `${T.accent}08`,
          border: `1px solid ${T.accent}33`, borderRadius: 12, marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Spinner size={16} />
            <span style={{ color: T.accent, fontSize: 13, fontWeight: 700 }}>
              Training 4-Model Ensemble — {mlState.overallProgress}% overall
            </span>
          </div>
          {Object.entries(mlState.modelNames || {}).map(([key, label]) => {
            const pct = mlState.modelProgress?.[key] || 0;
            const isCurrent = mlState.currentModel === key;
            const isDone = pct >= 100;
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span style={{
                    color: isDone ? T.safe : isCurrent ? T.accent : T.muted,
                    fontWeight: isCurrent ? 700 : 400,
                  }}>
                    {isDone ? "✓ " : isCurrent ? "⟳ " : "○ "}{label}
                  </span>
                  <span style={{ color: isDone ? T.safe : T.muted }}>{pct}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 3, background: T.border, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 3,
                    background: isDone ? T.safe : isCurrent ? T.accent : T.border,
                    transition: "width 0.3s",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mlState.trained && !mlState.training && !mlState.loading && (
        <div style={{
          padding: "8px 16px", background: `${T.safe}10`,
          border: `1px solid ${T.safe}33`, borderRadius: 12,
          marginBottom: 14, fontSize: 12, color: T.safe,
        }}>
          {mlState.fromCache
            ? "⚡ 4 models loaded from browser cache (IndexedDB) — instant start"
            : "✅ 4-model ensemble trained on clinical dataset (PHQ-9 · GAD-7 · ISI · SCARED) — saved to browser cache"}
        </div>
      )}

      {/* ── Tabs + Action Buttons ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            ["overview", "📊 Overview"],
            ["notes",    "📋 Notes"],
            ["assess",   "🧪 Assessment"],
            ["history",  "📈 History"],
          ].map(([id, label]) => (
            <button key={id} style={tabBtn(tab === id)} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            title="Export PDF report"
            style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              cursor: "pointer", fontWeight: 700, fontSize: 11,
              background: `${T.safe}18`, color: T.safe,
            }}
            onClick={() => exportPatientReport(
              patient, notes,
              getAssessmentHistory(patient.id),
              doctorName || "Clinician",
            )}
          >
            📄 Export PDF
          </button>
          <button
            title="Delete patient"
            style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              cursor: "pointer", fontWeight: 700, fontSize: 11,
              background: `${T.danger}18`, color: T.danger,
            }}
            onClick={() => {
              if (window.confirm(`Permanently delete ${patient.name}? This cannot be undone.`))
                onRemovePatient?.(patient.id);
            }}
          >
            🗑 Delete
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {tab === "overview" && (
          <OverviewTab
            key="ov"
            patient={patient}
            patNotes={patNotes}
            mlState={mlState}
            onGoAssess={() => setTab("assess")}
          />
        )}
        {tab === "notes" && (
          <NotesTab
            key="no"
            patNotes={patNotes}
            onAddNote={onAddNote}
            onRemoveNote={onRemoveNote}
          />
        )}
        {tab === "assess" && (
          <AssessTab
            key="as"
            patient={patient}
            mlState={mlState}
            onRunAssessment={onRunAssessment}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            key="hi"
            patient={patient}
            patNotes={patNotes}
            assessmentHistory={getAssessmentHistory?.(patient.id) || []}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ patient, patNotes, mlState, onGoAssess }) {
  const lastScore = patient.riskHistory?.[patient.riskHistory.length - 1];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Risk gauge + trend */}
        <div style={card}>
          <div style={{
            fontSize: 10, color: T.muted, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase", marginBottom: 14,
          }}>
            Current ADMRI Score
          </div>
          {lastScore !== undefined ? (
            <>
              <RiskGauge score={lastScore} risk={mlEngine.classifyRisk(lastScore)} />
              <TrendChart history={patient.riskHistory} />
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "30px 0", color: T.muted, fontSize: 13 }}>
              No assessments yet.{" "}
              <span
                style={{ color: T.accent, cursor: "pointer" }}
                onClick={onGoAssess}
              >
                Run first →
              </span>
            </div>
          )}
        </div>

        {/* Recent notes */}
        <div style={card}>
          <div style={{
            fontSize: 10, color: T.muted, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase", marginBottom: 14,
          }}>
            Recent Session Notes
          </div>
          {patNotes.length === 0 && (
            <div style={{ color: T.muted, fontSize: 13 }}>No notes yet.</div>
          )}
          {patNotes.slice(0, 3).map(note => (
            <div key={note.id} style={{ padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={chip(NOTE_TYPE_COLORS[note.type] || T.accent)}>{note.type}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{note.date}</span>
              </div>
              <div style={{ fontSize: 13, color: T.textSoft, lineHeight: 1.6 }}>
                {note.content.slice(0, 110)}{note.content.length > 110 ? "…" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── On-device Support Chat ── */}
      <div style={card}>
        <div style={{
          fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1,
          textTransform: "uppercase", marginBottom: 14,
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: T.safe, display: "inline-block",
          }} />
          Support Chat
          <span style={{
            fontWeight: 400, textTransform: "none",
            color: T.muted, fontSize: 11,
          }}>
            — On-device · No API key · CBT-grounded · context-aware for{" "}
            {patient.name.split(" ")[0]}
          </span>
        </div>
        <ADMRIChatbot
          patientName={patient.name}
          riskScore={lastScore}
          riskLevel={lastScore !== undefined ? mlEngine.classifyRisk(lastScore)?.label : undefined}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes Tab
// ─────────────────────────────────────────────────────────────────────────────
function NotesTab({ patNotes, onAddNote, onRemoveNote }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: T.muted, fontSize: 13 }}>{patNotes.length} notes on file</div>
        <button style={btn("primary", "sm")} onClick={onAddNote}>+ Add Note</button>
      </div>

      {patNotes.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: T.muted, padding: 48 }}>
          No notes yet.
        </div>
      )}

      {patNotes.map((note, i) => (
        <motion.div
          key={note.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          style={card}
        >
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 10,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={chip(NOTE_TYPE_COLORS[note.type] || T.accent)}>{note.type}</span>
              <span style={{ fontSize: 12, color: MOOD_COLORS[note.mood] || T.muted }}>
                ● {note.mood}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: T.muted }}>{note.date}</span>
              {onRemoveNote && (
                <button
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: T.muted, fontSize: 13, padding: "2px 4px",
                  }}
                  title="Delete note"
                  onClick={() => {
                    if (window.confirm("Delete this note?")) onRemoveNote(note.id);
                  }}
                >
                  🗑
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 14, color: T.text, lineHeight: 1.75, marginBottom: 10 }}>
            {note.content}
          </div>
          {note.tags?.length > 0 && (
            <div>{note.tags.map(t => <span key={t} style={chip(T.muted)}>#{t}</span>)}</div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessment Tab
// ─────────────────────────────────────────────────────────────────────────────
function AssessTab({ patient, mlState, onRunAssessment }) {
  const DRAFT_KEY = `admri_draft_${patient.id}`;

  const savedDraft = (() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      return d ? JSON.parse(d) : null;
    } catch { return null; }
  })();

  const [step,       setStep]       = useState(savedDraft?.step ?? 0);
  const [answers,    setAnswers]    = useState(savedDraft?.answers ?? {});
  const [journal,    setJournal]    = useState(savedDraft?.journal ?? "");
  const [behavioral, setBehavioral] = useState(savedDraft?.behavioral ?? {
    sleepHours: 7, screenTime: 3, exerciseMinutes: 30,
    socialInteractions: 3, appetiteChange: false,
  });
  const [results,  setResults]  = useState(null);
  const [dashTab,  setDashTab]  = useState("overview");
  const [hasDraft, setHasDraft] = useState(!!savedDraft);

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, answers, journal, behavioral }));
      setHasDraft(true);
    } catch {}
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setHasDraft(false);
  }

  function runML() {
    const sentDetails = analyzeSentimentDetailed(journal);
    const sentScore   = sentDetails.score;
    const sentVar     = sentDetails.variance;
    const riskHistory = patient.riskHistory || [];

    const confidence    = mlEngine.predictWithConfidence(answers, behavioral, sentScore, patient.age, riskHistory, sentVar);
    const score         = confidence.mean;
    const adaptive      = mlEngine.adaptiveRecalibrate([...riskHistory, score]);
    const risk          = mlEngine.classifyRisk(score);
    const recs          = mlEngine.getRecommendations(score, answers);
    const domainProfile = mlEngine.getDomainProfile(answers, behavioral, sentScore);
    const forecast      = mlEngine.forecastNextScore([...riskHistory, score]);
    const anomaly       = mlEngine.detectAnomaly([...riskHistory, score]);

    const qs = (Object.values(answers).reduce((s, v) => s + v, 0) / (10 * 3)) * 100;
    const bs = mlEngine._behavScore(behavioral);

    if (riskHistory.length >= 1) {
      mlEngine.finetuneOnPatient(answers, behavioral, sentScore, score, patient.age, riskHistory);
    }

    const fullSnapshot = {
      score, adaptive,
      questScore: qs, sentimentScore: sentScore, behaviouralScore: bs,
      questAnswers: { ...answers }, behavioral: { ...behavioral },
      journal, confidence, domainProfile, forecast, anomaly, sentDetails,
    };

    setResults({
      score, adaptive, risk, recs, qs, ss: sentScore, bs,
      confidence, domainProfile, forecast, anomaly, sentDetails,
      history: [...riskHistory, score],
    });
    setDashTab("overview");
    onRunAssessment(patient.id, score, fullSnapshot);
  }

  // ── Pre-results: 3-step form ───────────────────────────────────────────────
  if (!results) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* Draft restored banner */}
      {hasDraft && (
        <div style={{
          padding: "10px 16px", background: `${T.accentAlt}12`,
          border: `1px solid ${T.accentAlt}33`, borderRadius: 12,
          marginBottom: 14, display: "flex", justifyContent: "space-between",
          alignItems: "center", fontSize: 12,
        }}>
          <span style={{ color: T.accentAlt, fontWeight: 600 }}>
            💾 Draft restored — your previous progress is loaded
          </span>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", color: T.muted, fontSize: 11 }}
            onClick={() => {
              setStep(0);
              setAnswers({});
              setJournal("");
              setBehavioral({ sleepHours: 7, screenTime: 3, exerciseMinutes: 30, socialInteractions: 3, appetiteChange: false });
              clearDraft();
            }}
          >
            ✕ Discard draft
          </button>
        </div>
      )}

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
        {["Questionnaire", "Journal Entry", "Behavioral Data"].map((st, i) => (
          <div key={i} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: step === i ? T.accent : step > i ? `${T.safe}22` : T.surface,
            color: step === i ? T.bg : step > i ? T.safe : T.muted,
            border: `1px solid ${step === i ? T.accent : step > i ? T.safe : T.border}`,
          }}>
            {step > i ? "✓ " : `${i + 1}. `}{st}
          </div>
        ))}
        <button
          style={{
            marginLeft: "auto", background: "none", border: "none",
            cursor: "pointer", color: T.muted, fontSize: 11,
            fontFamily: "'DM Sans', sans-serif",
          }}
          onClick={saveDraft}
          title="Save progress as draft"
        >
          💾 Save draft
        </button>
      </div>

      <AnimatePresence mode="wait">

        {/* Step 0 — Questionnaire */}
        {step === 0 && (
          <motion.div
            key="q"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={card}>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                fontSize: 17, marginBottom: 4,
              }}>
                Patient Questionnaire
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>
                Administered for {patient.name} · Over the last 2 weeks
              </div>
              {QUESTIONS.map(q => (
                <div key={q.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>{q.text}</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setAnswers(p => ({ ...p, [q.id]: o.value }))}
                        style={{
                          padding: "7px 12px", borderRadius: 8, cursor: "pointer",
                          fontSize: 12, fontWeight: 600, transition: "all 0.12s",
                          fontFamily: "'DM Sans', sans-serif",
                          border: `1px solid ${answers[q.id] === o.value ? T.accent : T.border}`,
                          background: answers[q.id] === o.value ? `${T.accent}22` : T.surface,
                          color: answers[q.id] === o.value ? T.accent : T.muted,
                        }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                style={btn("primary")}
                onClick={() => setStep(1)}
                disabled={Object.keys(answers).length < QUESTIONS.length}
              >
                Continue →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 1 — Journal */}
        {step === 1 && (
          <motion.div
            key="j"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={card}>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                fontSize: 17, marginBottom: 4,
              }}>
                Free Expression Journal
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
                Ask {patient.name.split(" ")[0]} to describe how they've been feeling in their own words
              </div>
              <textarea
                style={{ ...inp, height: 140, resize: "vertical", lineHeight: 1.7 }}
                placeholder="How have you been feeling lately? What's been on your mind most?"
                value={journal}
                onChange={e => setJournal(e.target.value)}
              />
              {journal.length > 10 && (() => {
                const det = analyzeSentimentDetailed(journal);
                return (
                  <div style={{
                    marginTop: 10, padding: "10px 14px",
                    background: T.surface, borderRadius: 8, fontSize: 12,
                  }}>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: det.crisisFlags?.length > 0 ? 8 : 0 }}>
                      <span>NLP Score: <strong style={{ color: T.accent }}>{det.score}/100</strong></span>
                      <span style={{ color: T.muted }}>
                        Emotion:{" "}
                        <strong style={{
                          color: det.dominantEmotion === "distress" ? T.danger
                            : det.dominantEmotion === "positive" ? T.safe : T.warn,
                        }}>
                          {det.dominantEmotion}
                        </strong>
                      </span>
                      <span style={{ color: T.muted }}>
                        Variance: <strong style={{ color: T.textSoft }}>{det.variance}</strong>
                      </span>
                    </div>
                    {det.crisisFlags?.length > 0 && (
                      <div style={{
                        padding: "7px 10px",
                        background: `${T.danger}15`, border: `1px solid ${T.danger}44`,
                        borderRadius: 8, color: T.danger, fontWeight: 600,
                      }}>
                        ⚠️ Crisis language detected: "{det.crisisFlags.join('", "')}" — immediate review recommended
                      </div>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button style={btn("", "sm")} onClick={() => setStep(0)}>← Back</button>
                <button style={btn("primary")} onClick={() => setStep(2)}>Continue →</button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2 — Behavioral */}
        {step === 2 && (
          <motion.div
            key="b"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div style={card}>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                fontSize: 17, marginBottom: 4,
              }}>
                Behavioral Biomarkers
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>
                Record observed or reported behavioral data for {patient.name.split(" ")[0]}
              </div>
              {[
                { key: "sleepHours",         label: "Average Sleep (hours/night)",          min: 2,  max: 12,  step: 0.5 },
                { key: "screenTime",         label: "Daily Screen Time (hours)",            min: 0,  max: 14,  step: 0.5 },
                { key: "exerciseMinutes",    label: "Exercise per Day (minutes)",           min: 0,  max: 120, step: 5   },
                { key: "socialInteractions", label: "Meaningful Social Interactions / Day", min: 0,  max: 10,  step: 1   },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                    <span>{f.label}</span>
                    <span style={{ color: T.accent, fontWeight: 700 }}>{behavioral[f.key]}</span>
                  </div>
                  <input
                    type="range" min={f.min} max={f.max} step={f.step}
                    value={behavioral[f.key]}
                    onChange={e => setBehavioral(p => ({ ...p, [f.key]: parseFloat(e.target.value) }))}
                    style={{ width: "100%", accentColor: T.accent }}
                  />
                </div>
              ))}
              <label style={{
                display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", marginBottom: 18, fontSize: 13,
              }}>
                <input
                  type="checkbox"
                  checked={behavioral.appetiteChange}
                  onChange={e => setBehavioral(p => ({ ...p, appetiteChange: e.target.checked }))}
                  style={{ accentColor: T.accent, width: 15, height: 15 }}
                />
                Noticeable change in appetite reported
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btn("", "sm")} onClick={() => setStep(1)}>← Back</button>
                <button
                  style={btn("primary")}
                  onClick={() => { clearDraft(); runML(); }}
                >
                  {mlState.trained
                    ? "Generate ADMRI Score (Neural Net) →"
                    : "Generate ADMRI Score (Fallback) →"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  // ── Post-results view ──────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

      {/* Result tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {[
          ["overview", "📊 Score Overview"],
          ["recs",     "🧠 CBT Interventions"],
          ["chat",     "💬 Support Chat"],
          ["model",    "⚙️ Model Info"],
        ].map(([id, label]) => (
          <button key={id} style={tabBtn(dashTab === id)} onClick={() => setDashTab(id)}>
            {label}
          </button>
        ))}
        <button
          style={{ ...btn("", "sm"), marginLeft: "auto" }}
          onClick={() => { setResults(null); setStep(0); setAnswers({}); setJournal(""); }}
        >
          Re-assess
        </button>
      </div>

      {/* ── Score Overview ── */}
      {dashTab === "overview" && (
        <div>
          {results.anomaly && (
            <div style={{
              padding: "12px 16px", marginBottom: 14,
              background: results.anomaly.severity === "critical" ? `${T.danger}12` : `${T.warn}12`,
              border: `1px solid ${results.anomaly.severity === "critical" ? T.danger : T.warn}44`,
              borderRadius: 12, fontSize: 13,
              color: results.anomaly.severity === "critical" ? T.danger : T.warn,
              fontWeight: 600,
            }}>
              🔔 Anomaly detected ({results.anomaly.change} pts, z={results.anomaly.zScore}σ): {results.anomaly.message}
            </div>
          )}

          {results.sentDetails?.crisisFlags?.length > 0 && (
            <div style={{
              padding: "12px 16px", marginBottom: 14,
              background: `${T.danger}12`, border: `1px solid ${T.danger}44`,
              borderRadius: 12, fontSize: 13, color: T.danger, fontWeight: 600,
            }}>
              ⚠️ Crisis language in journal: "{results.sentDetails.crisisFlags.join('", "')}" — Safety assessment recommended
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 14 }}>
            <div style={card}>
              <div style={{
                fontSize: 10, color: T.muted, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
              }}>
                ADMRI Score {mlState.trained ? "(Neural Net + MC-Dropout)" : "(Fallback)"}
              </div>
              <RiskGauge score={results.score} risk={results.risk} />
              <ConfidenceBar
                mean={results.confidence.mean}
                lower={results.confidence.lower}
                upper={results.confidence.upper}
                std={results.confidence.std}
                confidence={results.confidence.confidence}
              />
              {results.adaptive && (
                <div style={{ textAlign: "center", fontSize: 12, color: T.muted, marginTop: 8 }}>
                  7-session adaptive avg:{" "}
                  <strong style={{ color: T.accentAlt }}>{results.adaptive}</strong>
                </div>
              )}
              <TrendChart history={results.history} />
              <ForecastChart history={results.history} forecast={results.forecast} />
              {results.risk.tier >= 4 && (
                <div style={{
                  marginTop: 12, padding: 12,
                  background: `${T.danger}10`, border: `1px solid ${T.danger}33`,
                  borderRadius: 10, fontSize: 12, color: T.danger,
                }}>
                  ⚠️ {results.risk.description}<br />
                  Crisis line: <strong>iCall 9152987821</strong>
                </div>
              )}
            </div>

            <div>
              <div style={card}>
                <div style={{
                  fontSize: 10, color: T.muted, fontWeight: 700,
                  letterSpacing: 1, textTransform: "uppercase", marginBottom: 16,
                }}>
                  Feature Contributions
                </div>
                <ModalityBar label="Questionnaire (PHQ-A adapted)" score={results.qs}  color={T.accent}    icon="📋" />
                <ModalityBar
                  label="NLP Sentiment Analysis"
                  score={results.ss}
                  color={results.sentDetails?.dominantEmotion === "distress" ? T.danger : T.accentAlt}
                  icon="💭"
                />
                <ModalityBar label="Behavioral Biomarkers"          score={results.bs}  color={T.warn}      icon="🏃" />
              </div>
              <div style={card}>
                <DomainRadar profile={results.domainProfile} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CBT Interventions ── */}
      {dashTab === "recs" && (
        <div>
          <div style={{
            ...card, background: `${T.accentAlt}0d`,
            border: `1px solid ${T.accentAlt}33`, marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, color: T.accentAlt, fontWeight: 700 }}>
              CBT Intervention Engine — Evidence-Graded
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
              Personalised to {patient.name.split(" ")[0]}'s dominant symptom domain.
            </div>
          </div>
          {results.recs.map((rec, i) => {
            const ec = { High: T.safe, Moderate: T.warn, Low: T.danger };
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                style={{ ...card, paddingLeft: 18, position: "relative", overflow: "hidden" }}
              >
                <div style={{
                  position: "absolute", top: 0, left: 0,
                  width: 3, height: "100%", background: ec[rec.evidence],
                }} />
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "flex-start", marginBottom: 6,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{rec.title}</div>
                  <span style={chip(T.accentAlt)}>{rec.category}</span>
                </div>
                <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.65, marginBottom: 8 }}>
                  {rec.description}
                </div>
                <span style={{ fontSize: 11, color: T.accent }}>⏱ {rec.duration}</span>
                <span style={{ fontSize: 11, color: ec[rec.evidence], marginLeft: 14 }}>
                  ● Evidence: {rec.evidence}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Support Chat (post-assessment, score-aware) ── */}
      {dashTab === "chat" && (
        <div style={card}>
          <div style={{
            fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1,
            textTransform: "uppercase", marginBottom: 14,
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: T.safe, display: "inline-block",
            }} />
            Support Chat
            <span style={{ fontWeight: 400, textTransform: "none", color: T.muted, fontSize: 11 }}>
              — On-device · Score {results.score} · {results.risk.label} · No API key needed
            </span>
          </div>
          <ADMRIChatbot
            patientName={patient.name}
            riskScore={results.score}
            riskLevel={results.risk.label}
          />
        </div>
      )}

      {/* ── Model Info ── */}
      {dashTab === "model" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {[
              {
                key: "depnet",    label: "Model 1 — DepNet",    color: T.danger,
                desc: "Specialised on PHQ-9 depression features (anhedonia, mood, self-worth, fatigue, concentration). Architecture: Dense(64)→BN→Dense(32)→Dropout(0.3)→Dense(16)→Sigmoid",
              },
              {
                key: "anxnet",    label: "Model 2 — AnxNet",    color: T.warn,
                desc: "Specialised on GAD-7 anxiety + SCARED features (nervousness, worry, fear, sleep, sentiment). Architecture: Dense(64)→BN→Dropout(0.25)→Dense(32)→Dense(16)→Sigmoid",
              },
              {
                key: "sleepnet",  label: "Model 3 — SleepNet",  color: T.accentAlt,
                desc: "Specialised on ISI insomnia + behavioural biomarkers (sleep hours, screen time, exercise, social interactions, appetite). Architecture: Dense(48)→BN→Dense(24)→Dropout(0.25)→Dense(12)→Sigmoid",
              },
              {
                key: "fusionnet", label: "Model 4 — FusionNet", color: T.accent,
                desc: "Stacked meta-learner. Takes all 20 features + outputs of models 1–3 (23 inputs). Learns optimal weighting. Architecture: Dense(128)→BN→Dense(64)→Dropout(0.35)→Dense(32)→Dropout(0.2)→Sigmoid",
              },
            ].map(m => (
              <div key={m.key} style={{ ...card, borderLeft: `3px solid ${m.color}`, marginBottom: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: 13, color: m.color,
                  marginBottom: 6, fontFamily: "'Syne', sans-serif",
                }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.65, marginBottom: 10 }}>
                  {m.desc}
                </div>
                {mlState.trainLogs?.[m.key]?.length > 0 && (
                  <div style={{ fontSize: 11, color: T.muted }}>
                    Final loss:{" "}
                    <span style={{ color: m.color, fontWeight: 700 }}>
                      {mlState.trainLogs[m.key].slice(-1)[0].loss}
                    </span>
                    &nbsp;·&nbsp; MAE:{" "}
                    <span style={{ color: T.safe }}>
                      {mlState.trainLogs[m.key].slice(-1)[0].mae}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={card}>
              <div style={{
                fontSize: 10, color: T.muted, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 14,
              }}>
                Clinical Dataset
              </div>
              {[
                ["Instruments",  "PHQ-9, GAD-7, ISI, SCARED"],
                ["Sample size",  "6,000 samples"],
                ["Label source", "Validated composite (PHQ-9 30% + GAD-7 25% + ISI 20% + SCARED 15% + Behavioural 10%)"],
                ["Severity",     "None 50%, Mild 22%, Moderate 15%, High 8%, Severe 5%"],
                ["References",   "Kroenke 2001, Spitzer 2006, Morin 2011, Birmaher 1997"],
                ["Epochs",       "60 per model · 15% validation split"],
                ["Batch size",   "128 samples"],
                ["Persistence",  "All 4 models saved to IndexedDB"],
                ["Confidence",   "Monte Carlo Dropout (20 passes per model)"],
                ["Fine-tuning",  "Per-patient online learning (lr=0.00005)"],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12,
                }}>
                  <span style={{ color: T.muted, whiteSpace: "nowrap", marginRight: 8 }}>{k}</span>
                  <span style={{ color: T.text, fontWeight: 600, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{
                fontSize: 10, color: T.muted, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
              }}>
                Per-Model Scores (last assessment)
              </div>
              {results?.confidence?.modelScores ? (
                Object.entries({
                  DepNet:    results.confidence.modelScores.depnet,
                  AnxNet:    results.confidence.modelScores.anxnet,
                  SleepNet:  results.confidence.modelScores.sleepnet,
                  FusionNet: results.confidence.modelScores.fusionnet,
                }).map(([label, score], i) => {
                  const colors = [T.danger, T.warn, T.accentAlt, T.accent];
                  return (
                    <div key={label} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: T.muted }}>{label}</span>
                        <span style={{ color: colors[i], fontWeight: 700 }}>{score}/100</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: T.border, overflow: "hidden" }}>
                        <div style={{
                          width: `${score}%`, height: "100%",
                          background: colors[i], borderRadius: 3,
                          transition: "width 1s",
                        }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                  Run an assessment to see per-model scores
                </div>
              )}
              {mlState.fromCache && (
                <div style={{
                  marginTop: 14, padding: 10,
                  background: `${T.accent}0d`, borderRadius: 8,
                  fontSize: 11, color: T.muted,
                }}>
                  ⚡ Models loaded from IndexedDB cache — no retraining needed on this browser
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Tab
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab({ patient, patNotes, assessmentHistory }) {
  const [selected, setSelected] = useState(null);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Score history */}
        <div style={card}>
          <div style={{
            fontSize: 10, color: T.muted, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase", marginBottom: 14,
          }}>
            Risk Score History
          </div>
          {patient.riskHistory?.length ? (
            <>
              <TrendChart history={patient.riskHistory} />
              <div style={{ marginTop: 16 }}>
                {patient.riskHistory.map((score, i) => {
                  const snap = assessmentHistory[assessmentHistory.length - 1 - i];
                  return (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "8px 0",
                      borderBottom: `1px solid ${T.border}`, fontSize: 13,
                    }}>
                      <div>
                        <span style={{ color: T.muted }}>Session {i + 1}</span>
                        {snap?.date && (
                          <span style={{ color: T.muted, fontSize: 11, marginLeft: 8 }}>
                            {snap.date}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>{score}/100</span>
                        <RiskBadge score={score} />
                        {snap && (
                          <button
                            style={{
                              background: "none", border: `1px solid ${T.border}`,
                              borderRadius: 6, cursor: "pointer",
                              color: T.accent, fontSize: 11, padding: "2px 8px",
                            }}
                            onClick={() => setSelected(selected?.id === snap.id ? null : snap)}
                          >
                            {selected?.id === snap.id ? "Hide" : "Details"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ color: T.muted, fontSize: 13 }}>No assessment data yet.</div>
          )}
        </div>

        <div>
          {/* Snapshot detail */}
          {selected && (
            <div style={{ ...card, border: `1px solid ${T.accent}33`, marginBottom: 14 }}>
              <div style={{
                fontSize: 10, color: T.accent, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
              }}>
                Assessment Detail — {selected.date}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  ["ADMRI Score",   selected.score],
                  ["Questionnaire", selected.questScore      ? Math.round(selected.questScore)      : "—"],
                  ["Sentiment",     selected.sentimentScore  ? Math.round(selected.sentimentScore)  : "—"],
                  ["Behavioural",   selected.behaviouralScore? Math.round(selected.behaviouralScore): "—"],
                  ["Confidence",    selected.confidence?.confidence ?? "—"],
                  ["CI Range",      selected.confidence
                    ? `${selected.confidence.lower}–${selected.confidence.upper}` : "—"],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding: "8px 10px", background: T.surface, borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 3 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{val}</div>
                  </div>
                ))}
              </div>
              {selected.journal && (
                <div>
                  <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, marginBottom: 6 }}>
                    JOURNAL ENTRY
                  </div>
                  <div style={{
                    fontSize: 12, color: T.muted, lineHeight: 1.65,
                    padding: "10px 12px", background: T.surface, borderRadius: 8,
                  }}>
                    {selected.journal}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Treatment timeline */}
          <div style={card}>
            <div style={{
              fontSize: 10, color: T.muted, fontWeight: 700,
              letterSpacing: 1, textTransform: "uppercase", marginBottom: 14,
            }}>
              Treatment Timeline
            </div>
            {patNotes.length === 0 && (
              <div style={{ color: T.muted, fontSize: 13 }}>No notes yet.</div>
            )}
            {patNotes.map((note, i) => (
              <div key={note.id} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: 9, height: 9, borderRadius: "50%",
                    background: T.accent, marginTop: 3, flexShrink: 0,
                  }} />
                  {i < patNotes.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: T.border, margin: "4px 0" }} />
                  )}
                </div>
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{note.type}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>{note.date}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55 }}>
                    {note.content?.slice(0, 90)}{note.content?.length > 90 ? "…" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
