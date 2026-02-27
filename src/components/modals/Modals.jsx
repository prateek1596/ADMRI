import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { T, NOTE_TYPES, MOODS } from "../../styles/theme";
import { inp, lbl, btn } from "../../styles/shared";

const overlay = {
  position: "fixed", inset: 0, background: "#00000099",
  zIndex: 200, display: "flex", alignItems: "center",
  justifyContent: "center", padding: 24,
};

const modalBox = {
  background: T.card, border: `1px solid ${T.border}`,
  borderRadius: 20, padding: 28, width: "100%",
};

// ── Add Session Note ──────────────────────────────────────────────────────────
export function AddNoteModal({ patientName, onSave, onClose }) {
  const [form, setForm] = useState({ type: "Session", mood: "Neutral", content: "", tags: "" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={overlay}>
        <motion.div initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
          style={{ ...modalBox, maxWidth: 540 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
            Add Session Note
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 20 }}>Patient: {patientName}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Note Type</label>
              <select style={inp} value={form.type} onChange={e => set("type", e.target.value)}>
                {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Patient Mood</label>
              <select style={inp} value={form.mood} onChange={e => set("mood", e.target.value)}>
                {MOODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Session Notes</label>
            <textarea
              style={{ ...inp, height: 130, resize: "vertical", lineHeight: 1.7 }}
              placeholder="Observations, interventions, patient response, homework assigned, risk factors..."
              value={form.content}
              onChange={e => set("content", e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Tags (comma-separated)</label>
            <input style={inp} placeholder="cbt, anxiety, homework, medication..." value={form.tags} onChange={e => set("tags", e.target.value)} />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button style={btn("", "sm")} onClick={onClose}>Cancel</button>
            <button style={btn("primary")} onClick={() => form.content.trim() && onSave(form)}>
              Save Note
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Register New Patient ──────────────────────────────────────────────────────
export function AddPatientModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: "", age: "", gender: "Male", diagnosis: "", contact: "", guardian: "" });
  const [err, setErr]   = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function handleSave() {
    if (!form.name.trim())      return setErr("Patient name is required.");
    if (!form.age)              return setErr("Age is required.");
    if (!form.diagnosis.trim()) return setErr("Diagnosis is required.");
    onSave(form);
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={overlay}>
        <motion.div initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
          style={{ ...modalBox, maxWidth: 500 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, marginBottom: 20 }}>
            Register New Patient
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              ["Full Name",      "name",      "text",   "Patient's full name"   ],
              ["Age",            "age",       "number", "Age"                   ],
              ["Diagnosis",      "diagnosis", "text",   "e.g. Anxiety Disorder" ],
              ["Guardian Name",  "guardian",  "text",   "Parent/guardian"       ],
              ["Contact Number", "contact",   "text",   "+91 XXXXX XXXXX"       ],
            ].map(([label, key, type, placeholder]) => (
              <div key={key}>
                <label style={lbl}>{label}</label>
                <input style={inp} type={type} placeholder={placeholder}
                  value={form[key]} onChange={e => set(key, e.target.value)} />
              </div>
            ))}
            <div>
              <label style={lbl}>Gender</label>
              <select style={inp} value={form.gender} onChange={e => set("gender", e.target.value)}>
                <option>Male</option>
                <option>Female</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </div>
          </div>

          {err && (
            <div style={{ padding: "9px 12px", background: `${T.danger}18`, border: `1px solid ${T.danger}44`, borderRadius: 10, color: T.danger, fontSize: 12, marginBottom: 14 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button style={btn("", "sm")} onClick={onClose}>Cancel</button>
            <button style={btn("primary")} onClick={handleSave}>Register Patient</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Register Doctor ───────────────────────────────────────────────────────────
export function RegisterForm({ onSuccess, onSwitchToLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "", specialty: "", licenseNo: "" });
  const [err, setErr]   = useState("");
  const [ok,  setOk]    = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // imported from hook at call site via prop
  return { form, set, err, setErr, ok, setOk };
}
