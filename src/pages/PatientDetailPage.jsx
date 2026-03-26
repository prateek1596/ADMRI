import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NOTE_TYPE_COLORS, MOOD_COLORS } from "../styles/theme";
import { card, inp, btn, tabBtn, chip } from "../styles/shared";
import { Avatar, RiskBadge, Spinner } from "../components/ui/Primitives";
import {
  RiskGauge, TrendChart, ModalityBar,
  DomainRadar, ForecastChart, ConfidenceBar,
} from "../components/charts/Charts";
import { mlEngine, analyzeSentimentDetailed } from "../ml/ADMRIEngine";
import { QUESTIONS, OPTIONS } from "../data/seedData";
import { exportPatientReport } from "../utils/exportReport";
import ADMRIChatbot        from "../components/chat/ADMRIChatbot";
import { SchedulePanel }      from "../components/features/SchedulePanel";
import { TreatmentPlanPanel } from "../components/features/TreatmentPlanPanel";
import { ShapExplainer }      from "../components/features/ShapExplainer";

const SL = {
  fontSize: 10, fontWeight: 700, letterSpacing: 1,
  textTransform: "uppercase", color: "var(--muted)", marginBottom: 14,
};

// ── Quick Check questions (8 items, max score 15) ─────────────────────────────
const QQ = [
  { id:"q1", text:"Over the past 2 weeks, how often have you felt down or hopeless?",         opts:["Not at all","Several days","More than half","Nearly every day"],   scores:[0,1,2,3] },
  { id:"q2", text:"How often have you felt nervous, anxious, or on edge?",                     opts:["Not at all","Several days","More than half","Nearly every day"],   scores:[0,1,2,3] },
  { id:"q3", text:"How would you rate your sleep quality this week?",                          opts:["Very good","Fairly good","Fairly bad","Very bad"],                  scores:[0,1,2,3] },
  { id:"q4", text:"How many hours of sleep do you usually get per night?",                     opts:["8–10 hrs","6–8 hrs","Less than 6 hrs"],                            scores:[0,1,2]   },
  { id:"q5", text:"How connected do you feel to friends or family right now?",                 opts:["Well connected","Somewhat connected","Quite isolated"],             scores:[0,1,2]   },
  { id:"q6", text:"How many days this week did you do 20+ minutes of physical activity?",     opts:["4+ days","2–3 days","0–1 days"],                                    scores:[0,0,1]   },
  { id:"q7", text:"Have you had trouble concentrating on tasks this week?",                    opts:["No difficulty","Mild difficulty","Significant difficulty"],          scores:[0,1,2]   },
  { id:"q8", text:"How well are you managing your usual daily responsibilities?",              opts:["Managing well","Some struggles","Very difficult"],                   scores:[0,1,2]   },
];

export function PatientDetailPage({
  patient, notes, mlState,
  onAddNote, onBack, onRunAssessment,
  onRemovePatient, onRemoveNote,
  getAssessmentHistory, doctorName,
}) {
  const [tab,            setTab]           = useState("overview");
  const [assessHistory,  setAssessHistory] = useState([]);
  const [histLoading,    setHistLoading]   = useState(false);

  const patNotes = notes
    .filter(n => (n.patientId || n.patient_id) === patient.id)
    .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0));

  const latestScore = patient.riskHistory?.[patient.riskHistory.length - 1]
    ?? patient.latestScore ?? patient.latest_score;

  useEffect(() => {
    if (!getAssessmentHistory) return;
    setHistLoading(true);
    Promise.resolve(getAssessmentHistory(patient.id))
      .then(h => setAssessHistory(Array.isArray(h) ? h : []))
      .catch(() => setAssessHistory([]))
      .finally(() => setHistLoading(false));
  }, [patient.id]);

  const lastAssessmentId = assessHistory[0]?.id ?? null;

  const TABS = [
    ["overview","Overview"], ["notes","Notes"], ["assess","Assessment"],
    ["history","History"],   ["schedule","Sessions"], ["goals","Treatment Plan"],
    ["shap","Explainability"],
  ];

  return (
    <motion.div key="detail" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>

      {/* Header */}
      <div style={{ ...card, background:"var(--card)", border:"1px solid var(--border)",
        display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}>
        <Avatar name={patient.name} size={56} color="var(--accent)" />
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:5 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:"var(--text)" }}>
              {patient.name}
            </div>
            {latestScore !== undefined && <RiskBadge score={latestScore} />}
          </div>
          <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
            {[["Diagnosis",patient.diagnosis],["Age",patient.age],["Gender",patient.gender],
              ["Guardian",patient.guardian],["Contact",patient.contact],
              ["Since",patient.joinDate||patient.join_date]
            ].filter(([,v])=>v).map(([k,v])=>(
              <div key={k} style={{ fontSize:12 }}>
                <span style={{ color:"var(--muted)" }}>{k}: </span>
                <span style={{ fontWeight:600, color:"var(--text)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <button style={{ ...btn("primary","sm"), background:"var(--accent)", color:"#fff" }}
          onClick={() => setTab("assess")}>
          New Assessment
        </button>
      </div>

      {/* ML banners */}
      {mlState.loading && (
        <div style={{ padding:"10px 16px", background:"color-mix(in srgb,var(--accent-alt) 10%,transparent)",
          border:"1px solid color-mix(in srgb,var(--accent-alt) 30%,transparent)",
          borderRadius:12, marginBottom:14, display:"flex", alignItems:"center", gap:12, fontSize:13 }}>
          <Spinner size={16} /><span style={{ color:"var(--accent-alt)" }}>Checking browser cache…</span>
        </div>
      )}
      {mlState.training && (
        <div style={{ padding:"14px 18px", background:"color-mix(in srgb,var(--accent) 8%,transparent)",
          border:"1px solid color-mix(in srgb,var(--accent) 30%,transparent)",
          borderRadius:12, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <Spinner size={16} />
            <span style={{ color:"var(--accent)", fontSize:13, fontWeight:700 }}>
              Training 4-Model Ensemble — {mlState.overallProgress}%
            </span>
          </div>
          {Object.entries(mlState.modelNames||{}).map(([key,label])=>{
            const pct=mlState.modelProgress?.[key]||0, isDone=pct>=100, isCur=mlState.currentModel===key;
            return (
              <div key={key} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                  <span style={{ color:isDone?"var(--safe)":isCur?"var(--accent)":"var(--muted)", fontWeight:isCur?700:400 }}>
                    {isDone?"✓ ":isCur?"⟳ ":"○ "}{label}
                  </span>
                  <span style={{ color:isDone?"var(--safe)":"var(--muted)" }}>{pct}%</span>
                </div>
                <div style={{ height:3, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", borderRadius:3, transition:"width 0.3s",
                    background:isDone?"var(--safe)":isCur?"var(--accent)":"var(--border)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {mlState.trained&&!mlState.training&&!mlState.loading&&(
        <div style={{ padding:"8px 16px", background:"color-mix(in srgb,var(--safe) 10%,transparent)",
          border:"1px solid color-mix(in srgb,var(--safe) 30%,transparent)",
          borderRadius:12, marginBottom:14, fontSize:12, color:"var(--safe)" }}>
          {mlState.fromCache?"⚡ Models loaded from cache":"✅ 4-model ensemble trained and cached"}
        </div>
      )}

      {/* Tabs + actions */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom:18, flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {TABS.map(([id,label])=>(
            <button key={id} style={tabBtn(tab===id)} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ padding:"6px 12px", borderRadius:8, border:"none", cursor:"pointer",
            fontWeight:700, fontSize:11,
            background:"color-mix(in srgb,var(--safe) 15%,transparent)", color:"var(--safe)" }}
            onClick={async()=>{
              const h = await Promise.resolve(getAssessmentHistory(patient.id)).catch(()=>[]);
              exportPatientReport(patient, notes, Array.isArray(h)?h:[], doctorName||"Clinician");
            }}>
            Export PDF
          </button>
          <button style={{ padding:"6px 12px", borderRadius:8, border:"none", cursor:"pointer",
            fontWeight:700, fontSize:11,
            background:"color-mix(in srgb,var(--danger) 15%,transparent)", color:"var(--danger)" }}
            onClick={()=>{ if(window.confirm(`Delete ${patient.name}?`)) onRemovePatient?.(patient.id); }}>
            Delete
          </button>
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab==="overview"  && <OverviewTab  key="ov" patient={patient} patNotes={patNotes} mlState={mlState} latestScore={latestScore} onGoAssess={()=>setTab("assess")} />}
        {tab==="notes"     && <NotesTab     key="no" patNotes={patNotes} onAddNote={onAddNote} onRemoveNote={onRemoveNote} />}
        {tab==="assess"    && <AssessTab    key="as" patient={patient} mlState={mlState} onRunAssessment={onRunAssessment} />}
        {tab==="history"   && <HistoryTab   key="hi" patient={patient} patNotes={patNotes} assessmentHistory={assessHistory} loading={histLoading} />}
        {tab==="schedule"  && (
          <motion.div key="sc" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
              <SchedulePanel patientId={patient.id} patientName={patient.name} />
            </div>
          </motion.div>
        )}
        {tab==="goals" && (
          <motion.div key="gl" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
              <TreatmentPlanPanel patientId={patient.id} latestScore={latestScore} />
            </div>
          </motion.div>
        )}
        {tab==="shap" && (
          <motion.div key="sh" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
              <div style={{...SL,marginBottom:16}}>ADMRI Score Explainability</div>
              {lastAssessmentId ? (
                <ShapExplainer assessmentId={lastAssessmentId} patientId={patient.id}
                  admriScore={latestScore??assessHistory[0]?.score??0} />
              ) : (
                <div style={{textAlign:"center",padding:"40px 0",color:"var(--muted)",fontSize:13}}>
                  Run an assessment first to see feature importance.<br/>
                  <span style={{color:"var(--accent)",cursor:"pointer"}} onClick={()=>setTab("assess")}>
                    Go to Assessment →
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ patient, patNotes, mlState, latestScore, onGoAssess }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
          <div style={SL}>Current ADMRI Score</div>
          {latestScore!==undefined ? (
            <><RiskGauge score={latestScore} risk={mlEngine.classifyRisk(latestScore)} />
            <TrendChart history={patient.riskHistory||[]} /></>
          ) : (
            <div style={{textAlign:"center",padding:"30px 0",color:"var(--muted)",fontSize:13}}>
              No assessments yet.{" "}
              <span style={{color:"var(--accent)",cursor:"pointer"}} onClick={onGoAssess}>Run first →</span>
            </div>
          )}
        </div>
        <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
          <div style={SL}>Recent Session Notes</div>
          {patNotes.length===0&&<div style={{color:"var(--muted)",fontSize:13}}>No notes yet.</div>}
          {patNotes.slice(0,3).map(n=>(
            <div key={n.id} style={{padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={chip(NOTE_TYPE_COLORS[n.type]||"var(--accent)")}>{n.type}</span>
                <span style={{fontSize:11,color:"var(--muted)"}}>{n.date||new Date(n.created_at).toLocaleDateString("en-IN")}</span>
              </div>
              <div style={{fontSize:13,color:"var(--text-soft)",lineHeight:1.6}}>
                {n.content?.slice(0,110)}{n.content?.length>110?"…":""}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
        <div style={{...SL,display:"flex",gap:8,alignItems:"center"}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:"var(--safe)",display:"inline-block"}}/>
          Support Chat
          <span style={{fontWeight:400,textTransform:"none",color:"var(--muted)",fontSize:11}}>
            — On-device · CBT-grounded · context-aware for {patient.name.split(" ")[0]}
          </span>
        </div>
        <ADMRIChatbot patientName={patient.name} riskScore={latestScore}
          riskLevel={latestScore!==undefined?mlEngine.classifyRisk(latestScore)?.label:undefined} />
      </div>
    </motion.div>
  );
}

// ── Notes ─────────────────────────────────────────────────────────────────────
function NotesTab({ patNotes, onAddNote, onRemoveNote }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{color:"var(--muted)",fontSize:13}}>{patNotes.length} notes on file</div>
        <button style={{...btn("primary","sm"),background:"var(--accent)",color:"#fff"}} onClick={onAddNote}>+ Add Note</button>
      </div>
      {patNotes.length===0&&(
        <div style={{...card,textAlign:"center",color:"var(--muted)",padding:48,background:"var(--card)",border:"1px solid var(--border)"}}>No notes yet.</div>
      )}
      {patNotes.map((note,i)=>(
        <motion.div key={note.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
          style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={chip(NOTE_TYPE_COLORS[note.type]||"var(--accent)")}>{note.type}</span>
              {note.mood&&<span style={{fontSize:12,color:MOOD_COLORS[note.mood]||"var(--muted)"}}>● {note.mood}</span>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:"var(--muted)"}}>
                {note.date||(note.created_at?new Date(note.created_at).toLocaleDateString("en-IN"):"")}
              </span>
              {onRemoveNote&&(
                <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:13,padding:"2px 4px"}}
                  onClick={()=>{if(window.confirm("Delete this note?")) onRemoveNote(note.patient_id||note.patientId,note.id);}}>
                  🗑
                </button>
              )}
            </div>
          </div>
          <div style={{fontSize:14,color:"var(--text)",lineHeight:1.75,marginBottom:10}}>{note.content}</div>
          {note.tags?.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(Array.isArray(note.tags)?note.tags:[]).map(t=><span key={t} style={chip("var(--muted)")}>#{t}</span>)}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Assessment ────────────────────────────────────────────────────────────────
function AssessTab({ patient, mlState, onRunAssessment }) {
  const DRAFT_KEY = `admri_draft_${patient.id}`;
  const savedDraft = (()=>{ try{const d=localStorage.getItem(DRAFT_KEY);return d?JSON.parse(d):null;}catch{return null;} })();

  const [assessType,  setAssessType]  = useState("full");
  const [step,        setStep]        = useState(savedDraft?.step??0);
  const [answers,     setAnswers]     = useState(savedDraft?.answers??{});
  const [journal,     setJournal]     = useState(savedDraft?.journal??"");
  const [behavioral,  setBehavioral]  = useState(savedDraft?.behavioral??{sleepHours:7,screenTime:3,exerciseMinutes:30,socialInteractions:3,appetiteChange:false});
  const [quickAns,    setQuickAns]    = useState({});
  const [results,     setResults]     = useState(null);
  const [dashTab,     setDashTab]     = useState("overview");
  const [hasDraft,    setHasDraft]    = useState(!!savedDraft);

  const saveDraft = ()=>{ try{localStorage.setItem(DRAFT_KEY,JSON.stringify({step,answers,journal,behavioral}));setHasDraft(true);}catch{} };
  const clearDraft= ()=>{ try{localStorage.removeItem(DRAFT_KEY);}catch{} setHasDraft(false); };

  function runQuickCheck() {
    const total = Object.values(quickAns).reduce((a,b)=>a+b,0);
    const max   = 17; // sum of all max scores
    const admri = Math.round((total/max)*15);
    const risk  = mlEngine.classifyRisk(admri);
    setResults({ score:admri, risk, isQuick:true, history:[...(patient.riskHistory||[]),admri] });
    onRunAssessment(patient.id, admri, { score:admri, isQuickCheck:true });
  }

  function runML() {
    const sd=analyzeSentimentDetailed(journal), ss=sd.score, sv=sd.variance;
    const rh=patient.riskHistory||[];
    const conf=mlEngine.predictWithConfidence(answers,behavioral,ss,patient.age,rh,sv);
    const score=conf.mean, adapt=mlEngine.adaptiveRecalibrate([...rh,score]);
    const risk=mlEngine.classifyRisk(score), recs=mlEngine.getRecommendations(score,answers);
    const dp=mlEngine.getDomainProfile(answers,behavioral,ss), fc=mlEngine.forecastNextScore([...rh,score]);
    const an=mlEngine.detectAnomaly([...rh,score]);
    const qs=(Object.values(answers).reduce((s,v)=>s+v,0)/(10*3))*100, bs=mlEngine._behavScore(behavioral);
    if(rh.length>=1) mlEngine.finetuneOnPatient(answers,behavioral,ss,score,patient.age,rh);
    setResults({score,adaptive:adapt,risk,recs,qs,ss,bs,confidence:conf,domainProfile:dp,forecast:fc,anomaly:an,sentDetails:sd,history:[...rh,score]});
    onRunAssessment(patient.id,score,{score,adaptive:adapt,questScore:qs,sentimentScore:ss,behaviouralScore:bs,questAnswers:{...answers},behavioral:{...behavioral},journal,confidence:conf,domainProfile:dp,forecast:fc,anomaly:an,sentDetails:sd});
  }

  const btnSel = (sel)=>({ padding:"7px 12px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,
    fontFamily:"'DM Sans',sans-serif",transition:"all 0.12s",
    border:`1px solid ${sel?"var(--accent)":"var(--border)"}`,
    background:sel?"color-mix(in srgb,var(--accent) 18%,transparent)":"var(--surface)",
    color:sel?"var(--accent)":"var(--muted)" });

  if (!results) return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      {/* Type selector */}
      <div style={{display:"flex",gap:10,marginBottom:18}}>
        {[["full","Full Assessment","35 questions · Neural net · ~15 min"],
          ["quick","Quick Check","8 questions · Score ≤ 15 · ~5 min"]].map(([id,label,sub])=>(
          <div key={id} onClick={()=>setAssessType(id)} style={{
            flex:1,padding:"14px 16px",borderRadius:12,cursor:"pointer",
            border:`2px solid ${assessType===id?"var(--accent)":"var(--border)"}`,
            background:assessType===id?"color-mix(in srgb,var(--accent) 8%,var(--card))":"var(--card)",
          }}>
            <div style={{fontWeight:700,fontSize:14,color:assessType===id?"var(--accent)":"var(--text)"}}>{label}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>{sub}</div>
          </div>
        ))}
      </div>

      {assessType==="quick"&&(
        <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,marginBottom:4,color:"var(--text)"}}>Quick Check</div>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:20}}>For {patient.name} · Minimal risk screen · 8 questions</div>
          {QQ.map(q=>(
            <div key={q.id} style={{marginBottom:16}}>
              <div style={{fontSize:13,marginBottom:8,color:"var(--text)"}}>{q.text}</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {q.opts.map((opt,i)=>(
                  <button key={opt} onClick={()=>setQuickAns(p=>({...p,[q.id]:q.scores[i]}))}
                    style={btnSel(quickAns[q.id]===q.scores[i]&&quickAns[q.id]!==undefined&&(i===0?quickAns[q.id]===0:true)&&quickAns[q.id]===q.scores[i])}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",gap:12,marginTop:8}}>
            <button style={{...btn("primary"),background:"var(--accent)",color:"#fff"}}
              onClick={runQuickCheck} disabled={Object.keys(quickAns).length<QQ.length}>
              Generate Quick Score →
            </button>
            <span style={{fontSize:12,color:"var(--muted)"}}>{Object.keys(quickAns).length}/{QQ.length} answered</span>
          </div>
        </div>
      )}

      {assessType==="full"&&(
        <>
          {hasDraft&&(
            <div style={{padding:"10px 16px",background:"color-mix(in srgb,var(--accent-alt) 12%,transparent)",
              border:"1px solid color-mix(in srgb,var(--accent-alt) 30%,transparent)",
              borderRadius:12,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
              <span style={{color:"var(--accent-alt)",fontWeight:600}}>Draft restored</span>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:11}}
                onClick={()=>{setStep(0);setAnswers({});setJournal("");setBehavioral({sleepHours:7,screenTime:3,exerciseMinutes:30,socialInteractions:3,appetiteChange:false});clearDraft();}}>
                ✕ Discard
              </button>
            </div>
          )}
          <div style={{display:"flex",gap:6,marginBottom:22}}>
            {["Questionnaire","Journal Entry","Behavioral Data"].map((st,i)=>(
              <div key={i} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                background:step===i?"var(--accent)":step>i?"color-mix(in srgb,var(--safe) 18%,transparent)":"var(--surface)",
                color:step===i?"#fff":step>i?"var(--safe)":"var(--muted)",
                border:`1px solid ${step===i?"var(--accent)":step>i?"var(--safe)":"var(--border)"}`}}>
                {step>i?"✓ ":`${i+1}. `}{st}
              </div>
            ))}
            <button style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:11}} onClick={saveDraft}>Save draft</button>
          </div>
          <AnimatePresence mode="wait">
            {step===0&&(
              <motion.div key="q" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,marginBottom:4,color:"var(--text)"}}>Patient Questionnaire</div>
                  <div style={{fontSize:12,color:"var(--muted)",marginBottom:20}}>For {patient.name} · Over the last 2 weeks</div>
                  {QUESTIONS.map(q=>(
                    <div key={q.id} style={{marginBottom:18}}>
                      <div style={{fontSize:13,marginBottom:8,color:"var(--text)"}}>{q.text}</div>
                      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                        {OPTIONS.map(o=>(
                          <button key={o.value} onClick={()=>setAnswers(p=>({...p,[q.id]:o.value}))}
                            style={btnSel(answers[q.id]===o.value)}>{o.label}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button style={{...btn("primary"),background:"var(--accent)",color:"#fff"}}
                    onClick={()=>setStep(1)} disabled={Object.keys(answers).length<QUESTIONS.length}>Continue →</button>
                </div>
              </motion.div>
            )}
            {step===1&&(
              <motion.div key="j" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,marginBottom:4,color:"var(--text)"}}>Free Expression Journal</div>
                  <div style={{fontSize:12,color:"var(--muted)",marginBottom:14}}>Ask {patient.name.split(" ")[0]} to describe how they've been feeling</div>
                  <textarea style={{...inp,height:140,resize:"vertical",lineHeight:1.7}}
                    placeholder="How have you been feeling lately?" value={journal} onChange={e=>setJournal(e.target.value)}/>
                  {journal.length>10&&(()=>{
                    const det=analyzeSentimentDetailed(journal);
                    return(
                      <div style={{marginTop:10,padding:"10px 14px",background:"var(--surface)",borderRadius:8,fontSize:12}}>
                        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:det.crisisFlags?.length>0?8:0}}>
                          <span style={{color:"var(--text)"}}>NLP: <strong style={{color:"var(--accent)"}}>{det.score}/100</strong></span>
                          <span style={{color:"var(--muted)"}}>Emotion: <strong style={{color:det.dominantEmotion==="distress"?"var(--danger)":det.dominantEmotion==="positive"?"var(--safe)":"var(--warn)"}}>{det.dominantEmotion}</strong></span>
                        </div>
                        {det.crisisFlags?.length>0&&(
                          <div style={{padding:"7px 10px",background:"color-mix(in srgb,var(--danger) 12%,transparent)",
                            border:"1px solid color-mix(in srgb,var(--danger) 35%,transparent)",
                            borderRadius:8,color:"var(--danger)",fontWeight:600}}>
                            ⚠️ Crisis language: "{det.crisisFlags.join('", "')}" — immediate review recommended
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{display:"flex",gap:8,marginTop:14}}>
                    <button style={btn("","sm")} onClick={()=>setStep(0)}>← Back</button>
                    <button style={{...btn("primary"),background:"var(--accent)",color:"#fff"}} onClick={()=>setStep(2)}>Continue →</button>
                  </div>
                </div>
              </motion.div>
            )}
            {step===2&&(
              <motion.div key="b" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,marginBottom:4,color:"var(--text)"}}>Behavioral Biomarkers</div>
                  <div style={{fontSize:12,color:"var(--muted)",marginBottom:20}}>For {patient.name.split(" ")[0]}</div>
                  {[{key:"sleepHours",label:"Sleep (hrs/night)",min:2,max:12,step:0.5},
                    {key:"screenTime",label:"Screen Time (hrs/day)",min:0,max:14,step:0.5},
                    {key:"exerciseMinutes",label:"Exercise (min/day)",min:0,max:120,step:5},
                    {key:"socialInteractions",label:"Social Interactions / Day",min:0,max:10,step:1}
                  ].map(f=>(
                    <div key={f.key} style={{marginBottom:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13,color:"var(--text)"}}>
                        <span>{f.label}</span>
                        <span style={{color:"var(--accent)",fontWeight:700}}>{behavioral[f.key]}</span>
                      </div>
                      <input type="range" min={f.min} max={f.max} step={f.step} value={behavioral[f.key]}
                        onChange={e=>setBehavioral(p=>({...p,[f.key]:parseFloat(e.target.value)}))}
                        style={{width:"100%",accentColor:"var(--accent)"}}/>
                    </div>
                  ))}
                  <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:18,fontSize:13,color:"var(--text)"}}>
                    <input type="checkbox" checked={behavioral.appetiteChange}
                      onChange={e=>setBehavioral(p=>({...p,appetiteChange:e.target.checked}))}
                      style={{accentColor:"var(--accent)",width:15,height:15}}/>
                    Noticeable change in appetite reported
                  </label>
                  <div style={{display:"flex",gap:8}}>
                    <button style={btn("","sm")} onClick={()=>setStep(1)}>← Back</button>
                    <button style={{...btn("primary"),background:"var(--accent)",color:"#fff"}}
                      onClick={()=>{clearDraft();runML();}}>
                      {mlState.trained?"Generate ADMRI Score (Neural Net) →":"Generate ADMRI Score →"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );

  // Post-results
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}}>
      <div style={{display:"flex",gap:6,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        {(results.isQuick?[["overview","Score"]]:
          [["overview","Score Overview"],["recs","CBT Interventions"],["chat","Support Chat"],["model","Model Info"]]
        ).map(([id,label])=>(
          <button key={id} style={tabBtn(dashTab===id)} onClick={()=>setDashTab(id)}>{label}</button>
        ))}
        <button style={{...btn("","sm"),marginLeft:"auto"}}
          onClick={()=>{setResults(null);setStep(0);setAnswers({});setJournal("");setQuickAns({});}}>
          Re-assess
        </button>
      </div>

      {results.isQuick&&(
        <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
          <RiskGauge score={results.score} risk={results.risk}/>
          <TrendChart history={results.history}/>
          <div style={{marginTop:14,padding:"12px 14px",borderRadius:10,fontSize:13,fontWeight:600,
            background:results.score<=5?"color-mix(in srgb,var(--safe) 12%,transparent)":results.score<=10?"color-mix(in srgb,var(--warn) 12%,transparent)":"color-mix(in srgb,var(--danger) 12%,transparent)",
            color:results.score<=5?"var(--safe)":results.score<=10?"var(--warn)":"var(--danger)"}}>
            {results.score<=5?"Minimal risk — next assessment in 3 months":results.score<=10?"Low–minimal — check-in in 4–6 weeks":"Approaching threshold — full assessment recommended"}
          </div>
        </div>
      )}

      {!results.isQuick&&dashTab==="overview"&&(
        <div>
          {results.anomaly&&(
            <div style={{padding:"12px 16px",marginBottom:14,borderRadius:12,fontSize:13,fontWeight:600,
              background:`color-mix(in srgb,${results.anomaly.severity==="critical"?"var(--danger)":"var(--warn)"} 10%,transparent)`,
              border:`1px solid color-mix(in srgb,${results.anomaly.severity==="critical"?"var(--danger)":"var(--warn)"} 35%,transparent)`,
              color:results.anomaly.severity==="critical"?"var(--danger)":"var(--warn)"}}>
              Anomaly: {results.anomaly.message}
            </div>
          )}
          {results.sentDetails?.crisisFlags?.length>0&&(
            <div style={{padding:"12px 16px",marginBottom:14,background:"color-mix(in srgb,var(--danger) 10%,transparent)",
              border:"1px solid color-mix(in srgb,var(--danger) 35%,transparent)",
              borderRadius:12,fontSize:13,color:"var(--danger)",fontWeight:600}}>
              ⚠️ Crisis language detected — Safety assessment recommended
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1.2fr",gap:14}}>
            <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
              <div style={SL}>ADMRI Score</div>
              <RiskGauge score={results.score} risk={results.risk}/>
              <ConfidenceBar mean={results.confidence.mean} lower={results.confidence.lower}
                upper={results.confidence.upper} std={results.confidence.std} confidence={results.confidence.confidence}/>
              <TrendChart history={results.history}/>
              <ForecastChart history={results.history} forecast={results.forecast}/>
            </div>
            <div>
              <div style={{...card,background:"var(--card)",border:"1px solid var(--border)",marginBottom:14}}>
                <div style={SL}>Feature Contributions</div>
                <ModalityBar label="Questionnaire" score={results.qs} color="var(--accent)" icon="📋"/>
                <ModalityBar label="NLP Sentiment" score={results.ss} color={results.sentDetails?.dominantEmotion==="distress"?"var(--danger)":"var(--accent-alt)"} icon="💭"/>
                <ModalityBar label="Behavioural"   score={results.bs} color="var(--warn)" icon="🏃"/>
              </div>
              <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
                <DomainRadar profile={results.domainProfile}/>
              </div>
            </div>
          </div>
        </div>
      )}
      {!results.isQuick&&dashTab==="recs"&&(
        <div>
          {results.recs?.map((rec,i)=>{
            const ec={High:"var(--safe)",Moderate:"var(--warn)",Low:"var(--danger)"};
            return(
              <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}
                style={{...card,background:"var(--card)",border:"1px solid var(--border)",paddingLeft:18,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:ec[rec.evidence]}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{rec.title}</div>
                  <span style={chip("var(--accent-alt)")}>{rec.category}</span>
                </div>
                <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.65,marginBottom:8}}>{rec.description}</div>
                <span style={{fontSize:11,color:"var(--accent)"}}>⏱ {rec.duration}</span>
                <span style={{fontSize:11,color:ec[rec.evidence],marginLeft:14}}>● Evidence: {rec.evidence}</span>
              </motion.div>
            );
          })}
        </div>
      )}
      {!results.isQuick&&dashTab==="chat"&&(
        <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
          <div style={{...SL,display:"flex",gap:8,alignItems:"center"}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"var(--safe)",display:"inline-block"}}/>
            Support Chat
          </div>
          <ADMRIChatbot patientName={patient.name} riskScore={results.score} riskLevel={results.risk.label}/>
        </div>
      )}
      {!results.isQuick&&dashTab==="model"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {[{key:"depnet",label:"Model 1 — DepNet",color:"var(--danger)",desc:"PHQ-9 features. Dense(64)→BN→Dense(32)→Dropout(0.3)→Dense(16)→Sigmoid"},
            {key:"anxnet",label:"Model 2 — AnxNet",color:"var(--warn)",desc:"GAD-7+SCARED features. Dense(64)→BN→Dropout(0.25)→Dense(32)→Dense(16)→Sigmoid"},
            {key:"sleepnet",label:"Model 3 — SleepNet",color:"var(--accent-alt)",desc:"ISI+behavioural. Dense(48)→BN→Dense(24)→Dropout(0.25)→Dense(12)→Sigmoid"},
            {key:"fusionnet",label:"Model 4 — FusionNet",color:"var(--accent)",desc:"23-input meta-learner. Dense(128)→BN→Dense(64)→Dropout(0.35)→Dense(32)→Dropout(0.2)→Sigmoid"},
          ].map(m=>(
            <div key={m.key} style={{...card,background:"var(--card)",border:"1px solid var(--border)",borderLeft:`3px solid ${m.color}`,marginBottom:0}}>
              <div style={{fontWeight:800,fontSize:13,color:m.color,marginBottom:6,fontFamily:"'Syne',sans-serif"}}>{m.label}</div>
              <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.65}}>{m.desc}</div>
              {results?.confidence?.modelScores?.[m.key]&&(
                <div style={{marginTop:8,fontSize:11}}>Score: <span style={{color:m.color,fontWeight:700}}>{results.confidence.modelScores[m.key]}/100</span></div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function HistoryTab({ patient, patNotes, assessmentHistory, loading }) {
  const [selected, setSelected] = useState(null);
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
          <div style={SL}>Risk Score History</div>
          {loading?<div style={{color:"var(--muted)",fontSize:13}}>Loading…</div>
          :patient.riskHistory?.length?(
            <>
              <TrendChart history={patient.riskHistory}/>
              <div style={{marginTop:16}}>
                {[...(patient.riskHistory)].reverse().map((score,i)=>{
                  const snap=assessmentHistory[i];
                  return(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                      <div>
                        <span style={{color:"var(--muted)"}}>Session {patient.riskHistory.length-i}</span>
                        {snap?.date&&<span style={{color:"var(--muted)",fontSize:11,marginLeft:8}}>{snap.date}</span>}
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontWeight:600,color:"var(--text)"}}>{score}/100</span>
                        <RiskBadge score={score}/>
                        {snap&&(
                          <button style={{background:"none",border:"1px solid var(--border)",borderRadius:6,
                            cursor:"pointer",color:"var(--accent)",fontSize:11,padding:"2px 8px"}}
                            onClick={()=>setSelected(selected?.id===snap.id?null:snap)}>
                            {selected?.id===snap.id?"Hide":"Details"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ):<div style={{color:"var(--muted)",fontSize:13}}>No assessment data yet.</div>}
        </div>
        <div>
          {selected&&(
            <div style={{...card,background:"var(--card)",
              border:"1px solid color-mix(in srgb,var(--accent) 40%,transparent)",marginBottom:14}}>
              <div style={{...SL,color:"var(--accent)"}}>Assessment Detail — {selected.date}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                {[["ADMRI",selected.score],["Quest.",selected.questScore?Math.round(selected.questScore):"—"],
                  ["Sentiment",selected.sentimentScore?Math.round(selected.sentimentScore):"—"],
                  ["Behavioural",selected.behaviouralScore?Math.round(selected.behaviouralScore):"—"],
                  ["Confidence",selected.confidence?.confidence??"—"],
                  ["CI",selected.confidence?`${selected.confidence.lower}–${selected.confidence.upper}`:"—"]
                ].map(([label,val])=>(
                  <div key={label} style={{padding:"8px 10px",background:"var(--surface)",borderRadius:8}}>
                    <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,marginBottom:3}}>{label}</div>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{val}</div>
                  </div>
                ))}
              </div>
              {selected.journal&&(
                <div>
                  <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,marginBottom:6}}>JOURNAL ENTRY</div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.65,padding:"10px 12px",background:"var(--surface)",borderRadius:8}}>
                    {selected.journal}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{...card,background:"var(--card)",border:"1px solid var(--border)"}}>
            <div style={SL}>Treatment Timeline</div>
            {patNotes.length===0&&<div style={{color:"var(--muted)",fontSize:13}}>No notes yet.</div>}
            {patNotes.map((note,i)=>(
              <div key={note.id} style={{display:"flex",gap:12,marginBottom:14}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:"var(--accent)",marginTop:3,flexShrink:0}}/>
                  {i<patNotes.length-1&&<div style={{width:1,flex:1,background:"var(--border)",margin:"4px 0"}}/>}
                </div>
                <div style={{flex:1,paddingBottom:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontSize:12,fontWeight:700,color:"var(--text)"}}>{note.type}</span>
                    <span style={{fontSize:11,color:"var(--muted)"}}>{note.date||(note.created_at?new Date(note.created_at).toLocaleDateString("en-IN"):"")}</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.55}}>
                    {note.content?.slice(0,90)}{note.content?.length>90?"…":""}
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
