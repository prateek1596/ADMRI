import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NOTE_TYPES = ["Session", "Check-in", "Crisis", "Family Meeting", "Progress", "Discharge"];
const MOODS      = ["Positive", "Neutral", "Anxious", "Depressed", "Agitated", "Calm", "Mixed"];

// ── Shared styles — all CSS variables ────────────────────────────────────────
const overlay = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 200, display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24,
};

const modalCard = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 20, padding: 28, width: "100%",
};

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1px solid var(--inp-border)",
  background: "var(--inp-bg)",
  color: "var(--inp-text)",
  fontSize: 13, fontFamily: "'DM Sans', sans-serif",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const labelStyle = {
  fontSize: 11, fontWeight: 700,
  color: "var(--muted)",
  letterSpacing: "0.04em", textTransform: "uppercase",
  display: "block", marginBottom: 6,
};

function focusIn(e)  { e.target.style.borderColor = "var(--inp-focus)"; }
function focusOut(e) { e.target.style.borderColor = "var(--inp-border)"; }

function PrimaryBtn({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "9px 20px", borderRadius: 10, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700, fontSize: 13,
        fontFamily: "'DM Sans', sans-serif",
        background: "var(--accent)", color: "#ffffff",
        opacity: disabled ? 0.6 : 1, transition: "opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 18px", borderRadius: 10,
        border: "1px solid var(--border)",
        cursor: "pointer", fontWeight: 700, fontSize: 13,
        fontFamily: "'DM Sans', sans-serif",
        background: "var(--surface)", color: "var(--text)",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Add Session Note ──────────────────────────────────────────────────────────
export function AddNoteModal({ patientName, onSave, onClose }) {
  const [form, setForm] = useState({
    type: "Session", mood: "Neutral", content: "", tags: "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function handleSave() {
    if (!form.content.trim()) return;
    onSave({
      ...form,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={overlay}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
          style={{ ...modalCard, maxWidth: 540 }}
        >
          <div style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: 20, marginBottom: 4, color: "var(--text)",
          }}>
            Add Session Note
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
            Patient: {patientName}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Note Type</label>
              <select
                style={inputStyle} value={form.type}
                onChange={e => set("type", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              >
                {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Patient Mood</label>
              <select
                style={inputStyle} value={form.mood}
                onChange={e => set("mood", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              >
                {MOODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Session Notes</label>
            <textarea
              style={{ ...inputStyle, height: 130, resize: "vertical", lineHeight: 1.7 }}
              placeholder="Observations, interventions, patient response, homework assigned, risk factors..."
              value={form.content}
              onChange={e => set("content", e.target.value)}
              onFocus={focusIn} onBlur={focusOut}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input
              style={inputStyle}
              placeholder="cbt, anxiety, homework, medication..."
              value={form.tags}
              onChange={e => set("tags", e.target.value)}
              onFocus={focusIn} onBlur={focusOut}
            />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={handleSave} disabled={!form.content.trim()}>
              Save Note
            </PrimaryBtn>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Register New Patient ──────────────────────────────────────────────────────
export function AddPatientModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    name: "", age: "", gender: "Male",
    diagnosis: "", contact: "", guardian: "",
  });
  const [err, setErr] = useState("");
  const set = (k, v) => { setErr(""); setForm(p => ({ ...p, [k]: v })); };

  function handleSave() {
    if (!form.name.trim())      return setErr("Patient name is required.");
    if (!form.age)              return setErr("Age is required.");
    if (form.age < 4 || form.age > 25) return setErr("Age must be between 4 and 25.");
    if (!form.diagnosis.trim()) return setErr("Diagnosis is required.");
    onSave(form);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={overlay}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
          style={{ ...modalCard, maxWidth: 500 }}
        >
          <div style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: 20, marginBottom: 20, color: "var(--text)",
          }}>
            Register New Patient
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Full Name</label>
              <input
                style={inputStyle} type="text"
                placeholder="Patient's full name"
                value={form.name} onChange={e => set("name", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>
            <div>
              <label style={labelStyle}>Age</label>
              <input
                style={inputStyle} type="number" min={4} max={25}
                placeholder="Age"
                value={form.age} onChange={e => set("age", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>
            <div>
              <label style={labelStyle}>Gender</label>
              <select
                style={inputStyle} value={form.gender}
                onChange={e => set("gender", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              >
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
                <option>Other</option>
                <option>Prefer not to say</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Diagnosis</label>
              <input
                style={inputStyle} type="text"
                placeholder="e.g. Anxiety Disorder"
                value={form.diagnosis} onChange={e => set("diagnosis", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>
            <div>
              <label style={labelStyle}>Guardian Name</label>
              <input
                style={inputStyle} type="text"
                placeholder="Parent / guardian"
                value={form.guardian} onChange={e => set("guardian", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>
            <div>
              <label style={labelStyle}>Contact Number</label>
              <input
                style={inputStyle} type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={form.contact} onChange={e => set("contact", e.target.value)}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>
          </div>

          {err && (
            <div style={{
              padding: "9px 13px", marginBottom: 14, borderRadius: 10, fontSize: 13,
              background: "color-mix(in srgb, var(--danger) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
              color: "var(--danger)", fontWeight: 600,
            }}>
              ❌ {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
            <PrimaryBtn onClick={handleSave}>Register Patient</PrimaryBtn>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
