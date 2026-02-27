import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { T, SPECIALTIES } from "../styles/theme";
import { inp, lbl, btn } from "../styles/shared";

export function AuthPage({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login"); // "login" | "register"

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{
        minHeight: "100vh", background: T.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative", overflow: "hidden", padding: "40px 16px",
      }}>
        {/* Glows */}
        <div style={{ position: "fixed", left: "20%", top: "30%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${T.accent}10 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "fixed", left: "75%", top: "65%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${T.doctorAccent}12 0%, transparent 70%)`, pointerEvents: "none" }} />

        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} style={{ width: 440, position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: -1.5, color: T.text }}>
              ADMRI<span style={{ color: T.accent }}>.</span>
            </div>
            <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
              Adaptive Digital Mental Health Risk Index
            </div>
            <div style={{
              marginTop: 12, display: "inline-block", padding: "5px 16px",
              borderRadius: 20, background: `${T.doctorAccent}22`,
              color: T.doctorAccent, border: `1px solid ${T.doctorAccent}44`,
              fontSize: 12, fontWeight: 700,
            }}>
              🏥 Clinician Portal
            </div>
          </div>

          {/* Tab Toggle */}
          <div style={{
            display: "flex", background: T.surface, borderRadius: 12,
            padding: 4, marginBottom: 20, border: `1px solid ${T.border}`,
          }}>
            {[["login", "Sign In"], ["register", "Create Account"]].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                background: mode === m ? T.card : "transparent",
                color: mode === m ? T.text : T.muted,
                boxShadow: mode === m ? "0 1px 4px #00000044" : "none",
              }}>
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === "login"
              ? <LoginForm key="login" onLogin={onLogin} />
              : <RegisterForm key="register" onRegister={onRegister} onSwitchToLogin={() => setMode("login")} />
            }
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}

// ── Login Form ────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    const err = await onLogin(email, password);
    if (err) setError(err);
    setLoading(false);
  }

  function fillDemo(e, p) {
    setEmail(e); setPassword(p); setError("");
  }

  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Email Address</label>
          <input style={inp} type="email" placeholder="doctor@admri.in"
            value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Password</label>
          <input style={inp} type="password" placeholder="••••••••"
            value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: `${T.danger}18`, border: `1px solid ${T.danger}44`, borderRadius: 10, color: T.danger, fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button style={{ ...btn("primary"), width: "100%", padding: 13, fontSize: 14, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? "Signing in…" : "Sign In →"}
        </button>

        {/* Clickable demo credentials */}
        <div style={{ marginTop: 18, padding: 14, background: T.surface, borderRadius: 10, fontSize: 12 }}>
          <div style={{ color: T.textSoft, fontWeight: 700, marginBottom: 8 }}>Demo Accounts (click to fill)</div>
          {[
            ["priya@admri.in", "doctor123", "Dr. Priya Sharma · Child Psychiatry"],
            ["arjun@admri.in", "doctor456", "Dr. Arjun Mehta · Clinical Psychology"],
          ].map(([e, p, label]) => (
            <div key={e} onClick={() => fillDemo(e, p)}
              style={{ color: T.muted, marginBottom: 4, cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "background 0.15s" }}
              onMouseEnter={el => el.target.style.background = T.card}
              onMouseLeave={el => el.target.style.background = "transparent"}>
              📧 {label} <span style={{ color: T.accent, fontSize: 11 }}>← click</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Register Form ─────────────────────────────────────────────────────────────
function RegisterForm({ onRegister, onSwitchToLogin }) {
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "", specialty: "", licenseNo: "",
  });
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit() {
    setError(""); setLoading(true);
    const err = await onRegister(form);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(true);
    setTimeout(onSwitchToLogin, 2000);
  }

  if (success) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
      background: T.card, border: `1px solid ${T.safe}44`, borderRadius: 20, padding: 48, textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
      <div style={{ color: T.safe, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Account created!</div>
      <div style={{ color: T.muted, fontSize: 13 }}>Redirecting to sign in...</div>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 18, padding: "12px 14px", background: `${T.accent}0d`, border: `1px solid ${T.accent}33`, borderRadius: 10, lineHeight: 1.7 }}>
          🔐 Clinician accounts only. License number required for verification.<br />
          <span style={{ color: T.safe }}>✅ Your account is saved permanently in this browser's localStorage.</span><br />
          <span style={{ color: T.muted }}>If you close and reopen the app, your login will still work. Data is only lost if you manually clear your browser's site data.</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Full Name</label>
            <input style={inp} placeholder="Dr. Your Full Name" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Email Address</label>
            <input style={inp} type="email" placeholder="you@hospital.in" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Password</label>
            <input style={inp} type="password" placeholder="Min. 8 chars, 1 uppercase, 1 number" value={form.password} onChange={e => set("password", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Confirm Password</label>
            <input style={inp} type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Specialty</label>
            <select style={inp} value={form.specialty} onChange={e => set("specialty", e.target.value)}>
              <option value="">Select specialty</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>License / Reg. No.</label>
            <input style={inp} placeholder="e.g. MCI-12345" value={form.licenseNo} onChange={e => set("licenseNo", e.target.value)} />
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: `${T.danger}18`, border: `1px solid ${T.danger}44`, borderRadius: 10, color: T.danger, fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button style={{ ...btn("primary"), width: "100%", padding: 13, fontSize: 14, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? "Creating account…" : "Create Clinician Account →"}
        </button>
      </div>
    </motion.div>
  );
}
