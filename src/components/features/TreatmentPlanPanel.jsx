// src/components/features/TreatmentPlanPanel.jsx
import { useState, useEffect } from "react";

const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
async function api(method, path, body = null) {
  const token = localStorage.getItem("admri_access_token");
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const d = await res.json().catch(()=>({})); throw new Error(d.error||`HTTP ${res.status}`); }
  return res.status === 204 ? null : res.json();
}

const CATEGORIES = ['Risk Score','PHQ-9','GAD-7','Sleep','Social','Behavioural','Custom'];
const PRIORITY_LABELS = { 1: "High", 2: "Medium", 3: "Low" };
const PRIORITY_COLORS = {
  1: "var(--danger)", 2: "var(--warn)", 3: "var(--accent)",
};
const STATUS_COLORS = {
  active:        { bg: "color-mix(in srgb, var(--accent) 12%, transparent)", text: "var(--accent)" },
  achieved:      { bg: "color-mix(in srgb, var(--safe)   12%, transparent)", text: "var(--safe)" },
  paused:        { bg: "color-mix(in srgb, var(--warn)   12%, transparent)", text: "var(--warn)" },
  discontinued:  { bg: "color-mix(in srgb, var(--danger)  12%, transparent)", text: "var(--danger)" },
};

export function TreatmentPlanPanel({ patientId, latestScore }) {
  const [goals,       setGoals]       = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [progressGoal,setProgressGoal]= useState(null); // goal being updated

  // New goal form
  const [form, setForm] = useState({
    title: "", description: "", category: "Risk Score",
    target_value: "", baseline_value: "", target_date: "", priority: 2,
  });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState("");

  // Progress form
  const [progValue, setProgValue] = useState("");
  const [progNote,  setProgNote]  = useState("");

  useEffect(() => { loadGoals(); }, [patientId]);

  async function loadGoals() {
    setLoading(true);
    try {
      const res = await api("GET", `/patients/${patientId}/goals`);
      setGoals(res.goals || []);
    } catch {}
    finally { setLoading(false); }
  }

  async function loadSuggestions() {
    try {
      const res = await api("GET", `/patients/${patientId}/goals/suggest`);
      setSuggestions(res.suggestions || []);
      setShowSuggest(true);
    } catch {}
  }

  async function createGoal(data = null) {
    setSaving(true); setMsg("");
    const payload = data || {
      ...form,
      target_value:   form.target_value   ? parseFloat(form.target_value)   : undefined,
      baseline_value: form.baseline_value ? parseFloat(form.baseline_value) : undefined,
      priority: parseInt(form.priority),
    };
    try {
      const res = await api("POST", `/patients/${patientId}/goals`, payload);
      setGoals(prev => [res.goal, ...prev]);
      setShowForm(false); setShowSuggest(false);
      setForm({ title:"", description:"", category:"Risk Score",
                target_value:"", baseline_value:"", target_date:"", priority:2 });
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(goalId, status) {
    try {
      const res = await api("PATCH", `/patients/${patientId}/goals/${goalId}`, { status });
      setGoals(prev => prev.map(g => g.id === goalId ? res.goal : g));
    } catch {}
  }

  async function logProgress() {
    if (!progValue) return;
    try {
      const res = await api("POST", `/patients/${patientId}/goals/${progressGoal}/progress`, {
        value: parseFloat(progValue), note: progNote || undefined,
      });
      setProgressGoal(null); setProgValue(""); setProgNote("");
      loadGoals(); // Refresh to get updated current_value
      if (res.achieved) setMsg(`🎉 Goal achieved!`);
    } catch {}
  }

  async function deleteGoal(goalId) {
    if (!window.confirm("Delete this goal?")) return;
    try {
      await api("DELETE", `/patients/${patientId}/goals/${goalId}`);
      setGoals(prev => prev.filter(g => g.id !== goalId));
    } catch {}
  }

  const inp = {
    padding: "8px 11px", borderRadius: 9,
    border: "1px solid var(--inp-border)",
    background: "var(--inp-bg)", color: "var(--inp-text)",
    fontSize: 13, fontFamily: "'DM Sans',sans-serif",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  const activeGoals   = goals.filter(g => g.status === "active");
  const achievedGoals = goals.filter(g => g.status === "achieved");
  const otherGoals    = goals.filter(g => !["active","achieved"].includes(g.status));

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
            Treatment Plan
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {activeGoals.length} active · {achievedGoals.length} achieved
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadSuggestions} style={{
            padding: "8px 14px", borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text)",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>
            ✨ Suggest
          </button>
          <button onClick={() => setShowForm(v=>!v)} style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}>
            + Add Goal
          </button>
        </div>
      </div>

      {/* AI Suggestions */}
      {showSuggest && suggestions.length > 0 && (
        <div style={{
          background: "color-mix(in srgb, var(--doctor) 8%, var(--card))",
          border: "1px solid color-mix(in srgb, var(--doctor) 30%, transparent)",
          borderRadius: 12, padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--doctor)", marginBottom: 10 }}>
            ✨ AI-suggested goals based on latest assessment
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8,
                background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {s.category}
                    {s.baseline_value != null && ` · Baseline: ${s.baseline_value}`}
                    {s.target_value != null && ` → Target: ${s.target_value}`}
                  </div>
                </div>
                <button onClick={() => createGoal(s)} style={{
                  padding: "5px 12px", borderRadius: 7, border: "none",
                  background: "var(--doctor)", color: "#fff",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}>
                  Add
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setShowSuggest(false)} style={{
            marginTop: 10, fontSize: 11, color: "var(--muted)",
            background: "none", border: "none", cursor: "pointer",
          }}>
            Dismiss
          </button>
        </div>
      )}

      {/* New goal form */}
      {showForm && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
            New Treatment Goal
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>GOAL TITLE</label>
            <input style={inp} value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
              placeholder="e.g. Reduce PHQ-9 score to below 8" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>CATEGORY</label>
              <select style={inp} value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>BASELINE</label>
              <input style={inp} type="number" value={form.baseline_value}
                onChange={e => setForm(p=>({...p,baseline_value:e.target.value}))}
                placeholder="Starting value" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>TARGET</label>
              <input style={inp} type="number" value={form.target_value}
                onChange={e => setForm(p=>({...p,target_value:e.target.value}))}
                placeholder="Goal value" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>TARGET DATE</label>
              <input style={inp} type="date" value={form.target_date}
                onChange={e => setForm(p=>({...p,target_date:e.target.value}))}
                min={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>PRIORITY</label>
              <select style={inp} value={form.priority} onChange={e => setForm(p=>({...p,priority:e.target.value}))}>
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>DESCRIPTION</label>
            <textarea style={{ ...inp, height: 70, resize: "none" }}
              value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
              placeholder="Clinical rationale and intervention plan..." />
          </div>
          {msg && <div style={{ padding:"7px 11px", borderRadius:8, marginBottom:10, fontSize:12, color:"var(--danger)", background:"color-mix(in srgb,var(--danger) 10%,transparent)" }}>{msg}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => createGoal()} disabled={!form.title.trim()||saving} style={{
              padding: "8px 16px", borderRadius: 9, border: "none",
              background: "var(--accent)", color: "#fff",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? "Saving…" : "Create Goal"}
            </button>
            <button onClick={() => setShowForm(false)} style={{
              padding: "8px 14px", borderRadius: 9,
              border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text)",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Progress update modal */}
      {progressGoal && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--accent)",
          borderRadius: 12, padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
            Log Progress Update
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>NEW VALUE</label>
              <input style={inp} type="number" value={progValue}
                onChange={e => setProgValue(e.target.value)} placeholder="e.g. 45" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5 }}>NOTE</label>
              <input style={inp} value={progNote}
                onChange={e => setProgNote(e.target.value)} placeholder="Optional note..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={logProgress} style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "#fff",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>Log Progress</button>
            <button onClick={() => setProgressGoal(null)} style={{
              padding: "7px 12px", borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text)",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>Cancel</button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ padding:"9px 13px", borderRadius:9, marginBottom:12, fontSize:13,
          background:"color-mix(in srgb,var(--safe) 12%,transparent)",
          color:"var(--safe)", fontWeight:600 }}>{msg}</div>
      )}

      {loading ? (
        <div style={{ color:"var(--muted)", fontSize:13, padding:"20px 0" }}>Loading goals…</div>
      ) : goals.length === 0 ? (
        <div style={{
          textAlign:"center", padding:"32px 20px",
          background:"var(--surface)", borderRadius:12,
          border:"1px dashed var(--border)", color:"var(--muted)", fontSize:13,
        }}>
          No treatment goals yet.<br/>
          <span style={{ color:"var(--accent)", cursor:"pointer", fontWeight:600 }}
            onClick={loadSuggestions}>Get AI suggestions →</span>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {goals.map(g => (
            <GoalCard key={g.id} goal={g}
              onUpdateStatus={updateStatus}
              onLogProgress={() => setProgressGoal(g.id)}
              onDelete={deleteGoal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onUpdateStatus, onLogProgress, onDelete }) {
  const sc = STATUS_COLORS[goal.status] || STATUS_COLORS.active;
  const pc = PRIORITY_COLORS[goal.priority] || "var(--muted)";

  // Progress bar
  const baseline = parseFloat(goal.baseline_value || 0);
  const target   = parseFloat(goal.target_value || 0);
  const current  = parseFloat(goal.current_value ?? goal.baseline_value ?? 0);
  const hasProgress = goal.baseline_value != null && goal.target_value != null;
  const isDecreasing = target < baseline;
  const progress = hasProgress
    ? isDecreasing
      ? Math.min(100, Math.max(0, ((baseline - current) / (baseline - target)) * 100))
      : Math.min(100, Math.max(0, ((current - baseline) / (target - baseline)) * 100))
    : 0;

  const daysLeft = goal.target_date
    ? Math.ceil((new Date(goal.target_date) - new Date()) / 86400000)
    : null;

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Priority dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: pc, flexShrink: 0, marginTop: 4,
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
              {goal.title}
            </span>
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:600, background:sc.bg, color:sc.text }}>
              {goal.status}
            </span>
            <span style={{ padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:600,
              background:"color-mix(in srgb,var(--muted) 12%,transparent)", color:"var(--muted)" }}>
              {goal.category}
            </span>
          </div>

          {goal.description && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, lineHeight: 1.5 }}>
              {goal.description}
            </div>
          )}

          {/* Progress bar */}
          {hasProgress && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)", marginBottom:4 }}>
                <span>Baseline: {baseline}</span>
                <span style={{ fontWeight:600, color:"var(--text)" }}>Current: {current}</span>
                <span>Target: {target}</span>
              </div>
              <div style={{ height:6, borderRadius:3, background:"var(--surface)", overflow:"hidden" }}>
                <div style={{
                  height:"100%", borderRadius:3, transition:"width 0.4s",
                  width:`${progress}%`,
                  background: progress >= 100 ? "var(--safe)"
                    : progress >= 50 ? "var(--accent)"
                    : "var(--warn)",
                }} />
              </div>
              <div style={{ fontSize:10, color:"var(--muted)", marginTop:3 }}>
                {Math.round(progress)}% complete
                {daysLeft != null && daysLeft > 0 && ` · ${daysLeft} days remaining`}
                {daysLeft != null && daysLeft < 0 && ` · ${Math.abs(daysLeft)} days overdue`}
              </div>
            </div>
          )}

          {/* Actions */}
          {goal.status === "active" && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4 }}>
              <button onClick={() => onLogProgress(goal.id)} style={{
                padding:"4px 10px", borderRadius:7, border:"none",
                background:"color-mix(in srgb,var(--accent) 14%,transparent)",
                color:"var(--accent)", fontSize:11, fontWeight:700, cursor:"pointer",
              }}>+ Log Progress</button>
              <button onClick={() => onUpdateStatus(goal.id, "achieved")} style={{
                padding:"4px 10px", borderRadius:7, border:"none",
                background:"color-mix(in srgb,var(--safe) 14%,transparent)",
                color:"var(--safe)", fontSize:11, fontWeight:700, cursor:"pointer",
              }}>✓ Achieved</button>
              <button onClick={() => onUpdateStatus(goal.id, "paused")} style={{
                padding:"4px 10px", borderRadius:7, border:"none",
                background:"color-mix(in srgb,var(--warn) 12%,transparent)",
                color:"var(--warn)", fontSize:11, fontWeight:700, cursor:"pointer",
              }}>⏸ Pause</button>
              <button onClick={() => onDelete(goal.id)} style={{
                padding:"4px 8px", borderRadius:7, border:"none",
                background:"transparent", color:"var(--danger)",
                fontSize:12, cursor:"pointer",
              }}>✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
