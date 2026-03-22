// src/pages/ProfilePage.jsx
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "../components/ui/ThemeToggle";

const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

async function apiFetch(method, path, body = null) {
  const token = localStorage.getItem("admri_access_token");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    if (d.fields?.length) throw new Error(d.fields.map(f => f.message).join(", "));
    throw new Error(d.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Shared styles (no T lookups — all CSS variables) ─────────────────────
const S = {
  page:    { padding: "0 0 40px" },
  section: {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "20px 24px", marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "var(--muted)",
    marginBottom: 16, paddingBottom: 10,
    borderBottom: "1px solid var(--border)",
  },
  label: {
    fontSize: 11, fontWeight: 700, color: "var(--muted)",
    letterSpacing: "0.04em", textTransform: "uppercase",
    display: "block", marginBottom: 6,
  },
  input: {
    width: "100%", padding: "9px 12px", borderRadius: 10,
    border: "1px solid var(--inp-border)",
    background: "var(--inp-bg)", color: "var(--inp-text)",
    fontSize: 13, fontFamily: "'DM Sans', sans-serif",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  btnPrimary: {
    padding: "9px 20px", borderRadius: 10, border: "none",
    cursor: "pointer", fontWeight: 700, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    background: "var(--accent)", color: "#fff",
    transition: "opacity 0.15s",
  },
  btnSecondary: {
    padding: "9px 16px", borderRadius: 10,
    border: "1px solid var(--border)",
    cursor: "pointer", fontWeight: 700, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    background: "var(--surface)", color: "var(--text)",
  },
  btnDanger: {
    padding: "9px 16px", borderRadius: 10,
    border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
    cursor: "pointer", fontWeight: 700, fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    background: "color-mix(in srgb, var(--danger) 12%, transparent)",
    color: "var(--danger)",
  },
};

function Feedback({ msg, err }) {
  const text = msg || err;
  if (!text) return null;
  const ok = !!msg;
  return (
    <div style={{
      padding: "9px 13px", borderRadius: 10, marginBottom: 12, fontSize: 12,
      background: ok
        ? "color-mix(in srgb, var(--safe) 12%, transparent)"
        : "color-mix(in srgb, var(--danger) 12%, transparent)",
      border: ok
        ? "1px solid color-mix(in srgb, var(--safe) 40%, transparent)"
        : "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
      color: ok ? "var(--safe)" : "var(--danger)",
      fontWeight: 600,
    }}>
      {ok ? "✅ " : "❌ "}{text}
    </div>
  );
}

export function ProfilePage({ auth, patients, notes, onLogout, onBack, themeMode, onSetTheme }) {
  const doctor     = auth?.doctor || auth || {};
  const initials   = (doctor.name || "DR").split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const joinedDate = doctor.created_at
    ? new Date(doctor.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";
  const lastLogin  = doctor.last_login
    ? new Date(doctor.last_login).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  // ── Profile form (isolated state — no re-render lag) ─────────────────────
  const [name,       setName]      = useState(doctor.name      || "");
  const [specialty,  setSpecialty] = useState(doctor.specialty || "");
  const [profMsg,    setProfMsg]   = useState("");
  const [profErr,    setProfErr]   = useState("");
  const [profBusy,   setProfBusy]  = useState(false);

  const saveProfile = useCallback(async () => {
    setProfErr(""); setProfMsg(""); setProfBusy(true);
    try {
      await apiFetch("PATCH", "/auth/me", { name: name.trim(), specialty: specialty.trim() });
      setProfMsg("Profile updated successfully");
    } catch (e) { setProfErr(e.message); }
    finally { setProfBusy(false); }
  }, [name, specialty]);

  // ── Email form ────────────────────────────────────────────────────────────
  const [newEmail,   setNewEmail]  = useState("");
  const [emailPwd,   setEmailPwd]  = useState("");
  const [emailMsg,   setEmailMsg]  = useState("");
  const [emailErr,   setEmailErr]  = useState("");
  const [emailBusy,  setEmailBusy] = useState(false);

  const changeEmail = useCallback(async () => {
    setEmailErr(""); setEmailMsg(""); setEmailBusy(true);
    if (!newEmail.trim())                        { setEmailErr("Enter a new email address");      setEmailBusy(false); return; }
    if (!emailPwd)                               { setEmailErr("Enter your password to confirm"); setEmailBusy(false); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailErr("Enter a valid email"); setEmailBusy(false); return; }
    try {
      await apiFetch("PATCH", "/auth/me/email", { new_email: newEmail.trim().toLowerCase(), current_password: emailPwd });
      setEmailMsg("Email updated — logging you out…");
      setTimeout(() => onLogout(), 2500);
    } catch (e) { setEmailErr(e.message); }
    finally { setEmailBusy(false); }
  }, [newEmail, emailPwd, onLogout]);

  // ── Password form ─────────────────────────────────────────────────────────
  const [curPwd,   setCurPwd]   = useState("");
  const [newPwd,   setNewPwd]   = useState("");
  const [confPwd,  setConfPwd]  = useState("");
  const [pwdMsg,   setPwdMsg]   = useState("");
  const [pwdErr,   setPwdErr]   = useState("");
  const [pwdBusy,  setPwdBusy]  = useState(false);

  const changePassword = useCallback(async () => {
    setPwdErr(""); setPwdMsg(""); setPwdBusy(true);
    if (!curPwd)               { setPwdErr("Enter your current password");              setPwdBusy(false); return; }
    if (newPwd.length < 8)     { setPwdErr("New password must be at least 8 chars");    setPwdBusy(false); return; }
    if (!/[A-Z]/.test(newPwd)) { setPwdErr("New password needs 1 uppercase letter");    setPwdBusy(false); return; }
    if (!/[0-9]/.test(newPwd)) { setPwdErr("New password needs 1 number");              setPwdBusy(false); return; }
    if (newPwd !== confPwd)    { setPwdErr("Passwords do not match");                   setPwdBusy(false); return; }
    try {
      await apiFetch("POST", "/auth/change-password", { current_password: curPwd, new_password: newPwd });
      setPwdMsg("Password changed — logging you out…");
      setTimeout(() => onLogout(), 2500);
    } catch (e) { setPwdErr(e.message); }
    finally { setPwdBusy(false); }
  }, [curPwd, newPwd, confPwd, onLogout]);

  // Stats
  const totalPatients = patients.length;
  const highRisk      = patients.filter(p => (p.latestScore || p.latest_score || 0) >= 61).length;
  const improving     = patients.filter(p => { const h = p.riskHistory || []; return h.length >= 2 && h[h.length-1] < h[h.length-2]; }).length;
  const totalNotes    = notes.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={S.page}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <button style={S.btnSecondary} onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: "var(--text)" }}>
            My Profile
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Manage your account, appearance, email and password
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

        {/* ── Left column ── */}
        <div>
          {/* Avatar card */}
          <div style={{ ...S.section, textAlign: "center" }}>
            <div style={{
              width: 68, height: 68, borderRadius: "50%", margin: "0 auto 12px",
              background: "color-mix(in srgb, var(--accent) 18%, transparent)",
              border: "2px solid color-mix(in srgb, var(--accent) 35%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "var(--accent)",
              fontFamily: "'Syne', sans-serif",
            }}>
              {initials}
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text)", marginBottom: 3 }}>
              {doctor.name || "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 3 }}>{doctor.specialty || "—"}</div>
            <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 8 }}>{doctor.email || "—"}</div>
            <div style={{
              display: "inline-block", padding: "3px 12px", borderRadius: 20,
              background: "color-mix(in srgb, var(--safe) 15%, transparent)",
              color: "var(--safe)", fontSize: 11, fontWeight: 700,
              border: "1px solid color-mix(in srgb, var(--safe) 35%, transparent)",
            }}>
              {doctor.role || "Doctor"}
            </div>
          </div>

          {/* Account info */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Account Info</div>
            {[
              ["License No.",  doctor.license_number || "—"],
              ["Member Since", joinedDate],
              ["Last Login",   lastLogin],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{k}</span>
                <span style={{ fontWeight: 600, color: "var(--text)", textAlign: "right", maxWidth: "58%" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Practice Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["Patients",  totalPatients, "var(--accent)"],
                ["Notes",     totalNotes,    "var(--accent-alt)"],
                ["High Risk", highRisk,      highRisk > 0 ? "var(--danger)" : "var(--safe)"],
                ["Improving", improving,     "var(--safe)"],
              ].map(([label, val, color]) => (
                <div key={label} style={{
                  padding: "11px 8px", borderRadius: 10, textAlign: "center",
                  background: "var(--surface)", border: "1px solid var(--border)",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Syne', sans-serif" }}>{val}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div>

          {/* Appearance */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Appearance</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>Theme</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>System follows your device preference automatically</div>
              </div>
              <ThemeToggle mode={themeMode} onSetTheme={onSetTheme} />
            </div>
          </div>

          {/* Edit profile */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Edit Profile</div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Full Name</label>
              <input style={S.input} value={name} onChange={e => setName(e.target.value)}
                placeholder="Dr. Your Name"
                onFocus={e => e.target.style.borderColor = "var(--inp-focus)"}
                onBlur={e => e.target.style.borderColor = "var(--inp-border)"} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Specialty</label>
              <input style={S.input} value={specialty} onChange={e => setSpecialty(e.target.value)}
                placeholder="e.g. Child Psychiatry"
                onFocus={e => e.target.style.borderColor = "var(--inp-focus)"}
                onBlur={e => e.target.style.borderColor = "var(--inp-border)"} />
            </div>
            <Feedback msg={profMsg} err={profErr} />
            <button style={{ ...S.btnPrimary, opacity: profBusy ? 0.7 : 1 }} onClick={saveProfile} disabled={profBusy}>
              {profBusy ? "Saving…" : "Save Changes"}
            </button>
          </div>

          {/* Change email */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Change Email Address</div>
            <div style={{
              padding: "10px 13px", borderRadius: 10, marginBottom: 14, fontSize: 12,
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
              color: "var(--muted)", lineHeight: 1.7,
            }}>
              Current email: <strong style={{ color: "var(--accent)" }}>{doctor.email || "—"}</strong><br />
              After changing you will be logged out and need to sign in with your new address.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>New Email Address</label>
              <input style={S.input} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="new@email.com"
                onFocus={e => e.target.style.borderColor = "var(--inp-focus)"}
                onBlur={e => e.target.style.borderColor = "var(--inp-border)"} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Confirm with Current Password</label>
              <input style={S.input} type="password" value={emailPwd} onChange={e => setEmailPwd(e.target.value)}
                placeholder="Enter your current password"
                onFocus={e => e.target.style.borderColor = "var(--inp-focus)"}
                onBlur={e => e.target.style.borderColor = "var(--inp-border)"} />
            </div>
            <Feedback msg={emailMsg} err={emailErr} />
            <button style={{ ...S.btnPrimary, opacity: emailBusy ? 0.7 : 1 }} onClick={changeEmail} disabled={emailBusy}>
              {emailBusy ? "Updating…" : "Update Email"}
            </button>
          </div>

          {/* Change password */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Change Password</div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Current Password</label>
              <input style={S.input} type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)}
                placeholder="Enter current password"
                onFocus={e => e.target.style.borderColor = "var(--inp-focus)"}
                onBlur={e => e.target.style.borderColor = "var(--inp-border)"} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={S.label}>New Password</label>
                <input style={S.input} type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  onFocus={e => e.target.style.borderColor = "var(--inp-focus)"}
                  onBlur={e => e.target.style.borderColor = "var(--inp-border)"} />
              </div>
              <div>
                <label style={S.label}>Confirm New Password</label>
                <input style={S.input} type="password" value={confPwd} onChange={e => setConfPwd(e.target.value)}
                  placeholder="Repeat new password"
                  onFocus={e => e.target.style.borderColor = "var(--inp-focus)"}
                  onBlur={e => e.target.style.borderColor = "var(--inp-border)"} />
              </div>
            </div>
            <Feedback msg={pwdMsg} err={pwdErr} />
            <button style={{ ...S.btnPrimary, opacity: pwdBusy ? 0.7 : 1 }} onClick={changePassword} disabled={pwdBusy}>
              {pwdBusy ? "Updating…" : "Update Password"}
            </button>
          </div>

          {/* Session */}
          <div style={{ ...S.section, borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}>
            <div style={{ ...S.sectionTitle, color: "var(--danger)" }}>Session</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btnSecondary} onClick={onLogout}>Sign Out</button>
              <button
                style={S.btnDanger}
                onClick={async () => {
                  if (window.confirm("Sign out from all devices? All active sessions will end.")) {
                    try {
                      await apiFetch("POST", "/auth/logout", {
                        refresh_token: localStorage.getItem("admri_refresh_token"),
                        all_devices: true,
                      });
                    } catch {}
                    onLogout();
                  }
                }}
              >
                Sign Out All Devices
              </button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
