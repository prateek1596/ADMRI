// src/components/features/SchedulePanel.jsx
// Assessment scheduling — date picker, session type, upcoming list
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

const SESSION_TYPES = ["Assessment","Check-in","Review","Crisis","Family Meeting"];

const STATUS_COLORS = {
  upcoming:  { bg: "color-mix(in srgb, var(--accent) 12%, transparent)", text: "var(--accent)" },
  completed: { bg: "color-mix(in srgb, var(--safe)   12%, transparent)", text: "var(--safe)" },
  cancelled: { bg: "color-mix(in srgb, var(--muted)  12%, transparent)", text: "var(--muted)" },
  missed:    { bg: "color-mix(in srgb, var(--danger)  12%, transparent)", text: "var(--danger)" },
};

export function SchedulePanel({ patientId, patientName }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [date,  setDate]  = useState("");
  const [time,  setTime]  = useState("10:00");
  const [type,  setType]  = useState("Assessment");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]   = useState("");

  useEffect(() => { loadSessions(); }, [patientId]);

  async function loadSessions() {
    setLoading(true);
    try {
      const res = await api("GET", `/patients/${patientId}/sessions`);
      setSessions(res.sessions || []);
    } catch {}
    finally { setLoading(false); }
  }

  async function scheduleSession() {
    if (!date) { setMsg("Please select a date"); return; }
    setSaving(true); setMsg("");
    try {
      const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
      const res = await api("POST", `/patients/${patientId}/sessions`, {
        scheduled_at, session_type: type, notes: notes || undefined,
      });
      setSessions(prev => [...prev, res.session].sort((a,b) =>
        new Date(a.scheduled_at) - new Date(b.scheduled_at)));
      setShowForm(false);
      setDate(""); setTime("10:00"); setNotes("");
      setMsg("Session scheduled — reminder email will be sent 24hrs before.");
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(sessionId, status) {
    try {
      const res = await api("PATCH", `/sessions/${sessionId}`, { status });
      setSessions(prev => prev.map(s => s.id === sessionId ? res.session : s));
    } catch {}
  }

  async function removeSession(sessionId) {
    if (!window.confirm("Delete this session?")) return;
    try {
      await api("DELETE", `/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch {}
  }

  const upcoming  = sessions.filter(s => s.status === "upcoming");
  const past      = sessions.filter(s => s.status !== "upcoming");

  const inp = {
    padding: "8px 11px", borderRadius: 9,
    border: "1px solid var(--inp-border)",
    background: "var(--inp-bg)", color: "var(--inp-text)",
    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
            Sessions
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {upcoming.length} upcoming · {past.length} past
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            padding: "8px 16px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          + Schedule
        </button>
      </div>

      {/* Schedule form */}
      {showForm && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
            New Session for {patientName}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Date</label>
              <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Time</label>
              <input type="time" style={inp} value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Type</label>
              <select style={inp} value={type} onChange={e => setType(e.target.value)}>
                {SESSION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>Notes (optional)</label>
            <input type="text" style={inp} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Pre-session notes or reminders..." />
          </div>
          {msg && (
            <div style={{
              padding: "7px 11px", borderRadius: 8, marginBottom: 10, fontSize: 12,
              background: msg.includes("scheduled")
                ? "color-mix(in srgb, var(--safe) 12%, transparent)"
                : "color-mix(in srgb, var(--danger) 12%, transparent)",
              color: msg.includes("scheduled") ? "var(--safe)" : "var(--danger)",
            }}>{msg}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={scheduleSession} disabled={saving} style={{
              padding: "8px 16px", borderRadius: 9, border: "none",
              background: "var(--accent)", color: "#fff",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? "Scheduling…" : "Confirm"}
            </button>
            <button onClick={() => setShowForm(false)} style={{
              padding: "8px 14px", borderRadius: 9,
              border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text)",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0" }}>Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "32px 20px",
          background: "var(--surface)", borderRadius: 12,
          border: "1px dashed var(--border)", color: "var(--muted)", fontSize: 13,
        }}>
          No sessions scheduled yet.<br />
          <span style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
            onClick={() => setShowForm(true)}>Schedule the first one →</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map(s => <SessionRow key={s.id} session={s} onUpdate={updateStatus} onDelete={removeSession} />)}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onUpdate, onDelete }) {
  const d = new Date(session.scheduled_at);
  const isPast = d < new Date();
  const sc = STATUS_COLORS[session.status] || STATUS_COLORS.upcoming;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px", borderRadius: 10,
      background: "var(--card)", border: "1px solid var(--border)",
    }}>
      {/* Date block */}
      <div style={{
        width: 48, textAlign: "center", flexShrink: 0,
        padding: "6px 0", borderRadius: 8,
        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)", fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
          {d.getDate()}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase" }}>
          {d.toLocaleDateString("en-IN", { month: "short" })}
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {session.session_type}
          <span style={{
            marginLeft: 8, padding: "2px 8px", borderRadius: 20, fontSize: 10,
            fontWeight: 600, background: sc.bg, color: sc.text,
          }}>
            {session.status}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          {session.notes && ` · ${session.notes}`}
        </div>
      </div>

      {/* Actions */}
      {session.status === "upcoming" && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onUpdate(session.id, "completed")}
            style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
              background: "color-mix(in srgb, var(--safe) 15%, transparent)",
              color: "var(--safe)", fontSize: 11, fontWeight: 700 }}>
            ✓ Done
          </button>
          <button onClick={() => onUpdate(session.id, "cancelled")}
            style={{ padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
              background: "color-mix(in srgb, var(--muted) 12%, transparent)",
              color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>
            Cancel
          </button>
          <button onClick={() => onDelete(session.id)}
            style={{ padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer",
              background: "transparent", color: "var(--danger)", fontSize: 13 }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
