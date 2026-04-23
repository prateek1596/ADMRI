// src/components/ui/ProfileModal.jsx
// Popup profile modal — edit name/specialty + change password + stats
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { T } from "../../styles/theme";
import { inp, btn } from "../../styles/shared";

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
    throw new Error(d.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export function ProfileModal({ auth, patients, notes, onClose, onLogout }) {
  const [tab,      setTab]      = useState("profile"); // "profile" | "password"
  const [name,     setName]     = useState(auth?.name     || auth?.doctor?.name     || "");
  const [specialty,setSpecialty]= useState(auth?.specialty|| auth?.doctor?.specialty|| "");
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState("");

  const [curPwd,   setCurPwd]   = useState("");
  const [newPwd,   setNewPwd]   = useState("");
  const [confPwd,  setConfPwd]  = useState("");
  const [pwdMsg,   setPwdMsg]   = useState("");
  const [pwdErr,   setPwdErr]   = useState("");

  const overlayRef = useRef(null);

  // Close on outside click
  function handleOverlay(e) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  async function saveProfile() {
    if (!name.trim()) return;
    setSaving(true); setSaveMsg("");
    try {
      await apiFetch("PATCH", "/auth/me", { name: name.trim(), specialty });
      setSaveMsg("✅ Profile updated");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setSaveMsg("❌ " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setPwdErr(""); setPwdMsg("");
    if (!curPwd)          return setPwdErr("Enter your current password");
    if (newPwd.length < 8)return setPwdErr("New password must be at least 8 characters");
    if (!/[A-Z]/.test(newPwd)) return setPwdErr("New password needs at least 1 uppercase letter");
    if (!/[0-9]/.test(newPwd)) return setPwdErr("New password needs at least 1 number");
    if (newPwd !== confPwd)    return setPwdErr("Passwords do not match");
    setSaving(true);
    try {
      await apiFetch("POST", "/auth/change-password", {
        current_password: curPwd,
        new_password:     newPwd,
      });
      setPwdMsg("✅ Password changed — please log in again");
      setCurPwd(""); setNewPwd(""); setConfPwd("");
      setTimeout(() => onLogout(), 2500);
    } catch (err) {
      setPwdErr("❌ " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Stats
  const totalPatients   = patients.length;
  const highRisk        = patients.filter(p => (p.latestScore || p.latest_score || 0) >= 61).length;
  const totalNotes      = notes.length;
  const doctorName      = auth?.name || auth?.doctor?.name || "Doctor";
  const doctorSpecialty = auth?.specialty || auth?.doctor?.specialty || "";
  const doctorEmail     = auth?.email || auth?.doctor?.email || "";
  const initials        = doctorName.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const joinedDate      = auth?.created_at
    ? new Date(auth.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "—";

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.18 }}
        style={{
          width: "100%", maxWidth: 480,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: `${T.accent}22`, border: `2px solid ${T.accent}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: T.accent,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, color: T.text }}>
              {doctorName}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {doctorSpecialty} · {doctorEmail}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: T.muted, fontSize: 20, lineHeight: 1,
              padding: 4, borderRadius: 6,
            }}
          >✕</button>
        </div>

        {/* Stats row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1, background: T.border,
          borderBottom: `1px solid ${T.border}`,
        }}>
          {[
            ["Patients",    totalPatients, T.accent],
            ["Notes",       totalNotes,    T.accentAlt],
            ["High Risk",   highRisk,      highRisk > 0 ? T.danger : T.safe],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: T.card, padding: "12px 0", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", gap: 4, padding: "12px 24px 0",
        }}>
          {[["profile", "Edit Profile"], ["password", "Change Password"]].map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "7px 14px", borderRadius: 8, border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                background: tab === t ? `${T.accent}22` : "transparent",
                color:      tab === t ? T.accent : T.muted,
                transition: "all 0.15s",
              }}
            >{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px 24px" }}>
          <AnimatePresence mode="wait">

            {/* Edit Profile */}
            {tab === "profile" && (
              <motion.div key="profile"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.12 }}
              >
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: T.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Full Name
                  </label>
                  <input
                    style={inp}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Dr. Your Name"
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: T.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Specialty
                  </label>
                  <input
                    style={inp}
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    placeholder="e.g. Child Psychiatry"
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: T.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Member Since
                  </label>
                  <div style={{
                    ...inp, display: "flex", alignItems: "center",
                    color: T.muted, cursor: "not-allowed", opacity: 0.6,
                  }}>
                    {joinedDate}
                  </div>
                </div>
                {saveMsg && (
                  <div style={{
                    padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 12,
                    background: saveMsg.startsWith("✅") ? `${T.safe}18` : `${T.danger}18`,
                    color: saveMsg.startsWith("✅") ? T.safe : T.danger,
                    border: `1px solid ${saveMsg.startsWith("✅") ? T.safe : T.danger}44`,
                  }}>
                    {saveMsg}
                  </div>
                )}
                <button
                  style={{ ...btn("primary"), width: "100%", padding: 12, opacity: saving ? 0.7 : 1 }}
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </motion.div>
            )}

            {/* Change Password */}
            {tab === "password" && (
              <motion.div key="password"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.12 }}
              >
                {[
                  ["Current Password",  curPwd,  setCurPwd,  "Enter current password"],
                  ["New Password",      newPwd,  setNewPwd,  "Min 8 chars, 1 uppercase, 1 number"],
                  ["Confirm Password",  confPwd, setConfPwd, "Repeat new password"],
                ].map(([label, val, setter, placeholder]) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: T.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                      {label}
                    </label>
                    <input
                      type="password"
                      style={inp}
                      value={val}
                      onChange={e => setter(e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                {(pwdErr || pwdMsg) && (
                  <div style={{
                    padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 12,
                    background: pwdMsg ? `${T.safe}18` : `${T.danger}18`,
                    color:      pwdMsg ? T.safe : T.danger,
                    border: `1px solid ${pwdMsg ? T.safe : T.danger}44`,
                  }}>
                    {pwdErr || pwdMsg}
                  </div>
                )}
                <button
                  style={{ ...btn("primary"), width: "100%", padding: 12, opacity: saving ? 0.7 : 1 }}
                  onClick={changePassword}
                  disabled={saving}
                >
                  {saving ? "Updating…" : "Update Password"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
