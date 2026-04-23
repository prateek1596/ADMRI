// src/hooks/useAuth.js
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";

const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// ── Token helpers ─────────────────────────────────────────────────────────────
const Tokens = {
  getAccess:  () => localStorage.getItem("admri_access_token"),
  getRefresh: () => localStorage.getItem("admri_refresh_token"),
  set: (access, refresh) => {
    if (access)  localStorage.setItem("admri_access_token",  access);
    if (refresh) localStorage.setItem("admri_refresh_token", refresh);
  },
  clear: () => {
    localStorage.removeItem("admri_access_token");
    localStorage.removeItem("admri_refresh_token");
  },
  isLoggedIn: () => !!localStorage.getItem("admri_access_token"),
};

// ── Format a date string from ISO or existing date field ──────────────────────
function formatDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("en-IN"); }
  catch { return ""; }
}

// ── Core fetch ────────────────────────────────────────────────────────────────
async function apiFetch(method, path, body = null) {
  const headers = { "Content-Type": "application/json" };
  const token = Tokens.getAccess();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const h2 = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Tokens.getAccess()}`,
      };
      const r2 = await fetch(`${BASE}${path}`, {
        method, headers: h2,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!r2.ok) {
        const d = await r2.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${r2.status}`);
      }
      return r2.status === 204 ? null : r2.json();
    }
    Tokens.clear();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.fields && data.fields.length) {
      throw new Error(data.fields.map(f => f.message).join(", "));
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function tryRefresh() {
  const refresh = Tokens.getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const { tokens } = await res.json();
    Tokens.set(tokens.access, tokens.refresh);
    return true;
  } catch { return false; }
}

const api = {
  get:    (path)       => apiFetch("GET",    path),
  post:   (path, body) => apiFetch("POST",   path, body),
  patch:  (path, body) => apiFetch("PATCH",  path, body),
  delete: (path)       => apiFetch("DELETE", path),
};

// ── Normalise patient: snake_case → camelCase ─────────────────────────────────
function normPatient(p) {
  if (!p) return p;
  return {
    ...p,
    riskHistory:  p.risk_history  || p.riskHistory  || [],
    latestScore:  p.latest_score  ?? p.latestScore  ?? null,
    riskLevel:    p.risk_level    || p.riskLevel    || null,
    joinDate:     p.join_date     || p.joinDate     || "",
    guardian:     p.guardian      || "",
    contact:      p.contact       || "",
    // date fields components may reference
    date:         formatDate(p.created_at || p.join_date),
  };
}

// ── Normalise note: add .date from created_at ─────────────────────────────────
function normNote(n, patientId) {
  if (!n) return n;
  return {
    ...n,
    patientId:  patientId || n.patient_id || n.patientId,
    patient_id: patientId || n.patient_id || n.patientId,
    // Every component that sorts notes uses .date — always provide it
    date: n.date || formatDate(n.created_at) || formatDate(n.updated_at) || "",
  };
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useAuth() {
  const [auth,     setAuth]     = useState(null);
  const [patients, setPatients] = useState([]);
  const [notes,    setNotes]    = useState([]);
  const [ready,    setReady]    = useState(false);

  const logoutRef = useRef(null);

  // ── Restore session on boot ─────────────────────────────────────────────────
  useEffect(() => {
    async function restore() {
      if (!Tokens.isLoggedIn()) { setReady(true); return; }
      try {
        const res = await api.get("/auth/me");
        setAuth({ ...res.doctor, doctor: res.doctor });
        await loadData();
      } catch (err) {
        console.warn("Session restore failed:", err.message);
        Tokens.clear();
      } finally {
        setReady(true);
      }
    }
    restore();
  }, []);

  // ── Load patients + notes ───────────────────────────────────────────────────
  async function loadData() {
    try {
      const res = await api.get("/patients?limit=100");
      const pList = (res.patients || []).map(normPatient);
      setPatients(pList);

      const allNotes = [];
      for (const p of pList.slice(0, 30)) {
        try {
          const nRes = await api.get(`/patients/${p.id}/notes?limit=50`);
          const pNotes = (nRes.notes || []).map(n => normNote(n, p.id));
          allNotes.push(...pNotes);
        } catch {}
      }
      setNotes(allNotes);
    } catch (err) {
      console.error("loadData error:", err.message);
    }
  }

  // ── AUTH ────────────────────────────────────────────────────────────────────
  // Returns null on success, error string on failure (AuthPage expects this)
  async function login(email, password) {
    try {
      const res = await api.post("/auth/login", { email, password });
      Tokens.set(res.tokens.access, res.tokens.refresh);
      setAuth({ ...res.doctor, doctor: res.doctor });
      await loadData();
      return null;
    } catch (err) {
      return err.message;
    }
  }

  async function register(form) {
    if (!form.name?.trim())          return "Full name is required";
    if (!form.email?.trim())         return "Email is required";
    if (!form.password)              return "Password is required";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    if (!form.specialty)             return "Please select a specialty";
    if (!form.licenseNo?.trim())     return "License number is required";

    try {
      const res = await api.post("/auth/register", {
        name:           form.name.trim(),
        email:          form.email.trim(),
        password:       form.password,
        specialty:      form.specialty,
        license_number: form.licenseNo.trim(),
      });
      Tokens.set(res.tokens.access, res.tokens.refresh);
      setAuth({ ...res.doctor, doctor: res.doctor });
      return null;
    } catch (err) {
      return err.message;
    }
  }

  async function logout(allDevices = false) {
    try {
      await api.post("/auth/logout", {
        refresh_token: Tokens.getRefresh(),
        all_devices:   allDevices,
      });
    } catch {}
    Tokens.clear();
    setAuth(null);
    setPatients([]);
    setNotes([]);
  }

  logoutRef.current = logout;

  // ── PATIENTS ────────────────────────────────────────────────────────────────
  async function addPatient(fields) {
    try {
      const res = await api.post("/patients", fields);
      const p = normPatient(res.patient);
      setPatients(prev => [p, ...prev]);
      return p;
    } catch (err) {
      console.error("addPatient:", err.message);
      const p = normPatient({
        ...fields,
        id: `local-${Date.now()}`,
        riskHistory: [],
        created_at: new Date().toISOString(),
      });
      setPatients(prev => [p, ...prev]);
      return p;
    }
  }

  function pushRiskScore(patientId, score) {
    const riskLevel = score >= 76 ? "Severe"
      : score >= 61 ? "High"
      : score >= 41 ? "Moderate"
      : score >= 21 ? "Mild" : "Minimal";

    setPatients(prev => prev.map(p => {
      if (p.id !== patientId) return p;
      const history = [...(p.riskHistory || []), Math.round(score)];
      return {
        ...p,
        riskHistory:  history,
        risk_history: history,
        latestScore:  Math.round(score),
        latest_score: Math.round(score),
        riskLevel,
        risk_level: riskLevel,
      };
    }));
  }

  async function removePatient(id) {
    try { await api.delete(`/patients/${id}`); } catch {}
    setPatients(prev => prev.filter(p => p.id !== id));
    setNotes(prev => prev.filter(n => n.patientId !== id && n.patient_id !== id));
  }

  // ── NOTES ────────────────────────────────────────────────────────────────────
  async function addNote(patientId, fields) {
    try {
      const res = await api.post(`/patients/${patientId}/notes`, fields);
      const n = normNote(res.note, patientId);
      setNotes(prev => [n, ...prev]);
      return n;
    } catch (err) {
      console.error("addNote:", err.message);
      // Fallback local note so UI stays responsive
      const n = normNote({
        ...fields,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      }, patientId);
      setNotes(prev => [n, ...prev]);
      return n;
    }
  }

  async function removeNote(patientId, noteId) {
    try { await api.delete(`/patients/${patientId}/notes/${noteId}`); } catch {}
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }

  // ── ASSESSMENTS ──────────────────────────────────────────────────────────────
  function recordSession(patientId, sessionData) {
    // Score already pushed via pushRiskScore — nothing extra needed
  }

  async function saveFullAssessment(patientId, snapshot) {
    const score = Math.round(snapshot.score || snapshot.admri_score || 0);
    const riskLevel = score >= 76 ? "Severe"
      : score >= 61 ? "High"
      : score >= 41 ? "Moderate"
      : score >= 21 ? "Mild" : "Minimal";
    try {
      await api.post(`/patients/${patientId}/assessments`, {
        admri_score:       score,
        adaptive_score:    snapshot.adaptive         ? Math.round(snapshot.adaptive)            : undefined,
        risk_level:        riskLevel,
        quest_score:       snapshot.questScore       ? Math.round(snapshot.questScore)          : undefined,
        sentiment_score:   snapshot.sentimentScore   ? Math.round(snapshot.sentimentScore)      : undefined,
        behavioural_score: snapshot.behaviouralScore ? Math.round(snapshot.behaviouralScore)    : undefined,
        confidence_mean:   snapshot.confidence?.mean,
        confidence_lower:  snapshot.confidence?.lower,
        confidence_upper:  snapshot.confidence?.upper,
        confidence_label:  snapshot.confidence?.confidence,
        journal_text:      snapshot.journal,
        quest_answers:     snapshot.questAnswers,
        behavioral_data:   snapshot.behavioral,
        domain_profile:    snapshot.domainProfile,
        forecast:          snapshot.forecast,
        model_scores:      snapshot.confidence?.modelScores,
        crisis_flags:      snapshot.sentDetails?.crisisFlags,
        dominant_emotion:  snapshot.sentDetails?.dominantEmotion,
      });
    } catch (err) {
      console.error("saveFullAssessment:", err.message);
    }
  }

  async function getAssessmentHistory(patientId) {
    try {
      const res = await api.get(`/patients/${patientId}/assessments?limit=50`);
      return (res.assessments || []).map(a => ({
        id:               a.id,
        date:             formatDate(a.created_at),
        score:            parseFloat(a.admri_score),
        adaptive:         a.adaptive_score     ? parseFloat(a.adaptive_score)    : null,
        questScore:       a.quest_score        ? parseFloat(a.quest_score)       : null,
        sentimentScore:   a.sentiment_score    ? parseFloat(a.sentiment_score)   : null,
        behaviouralScore: a.behavioural_score  ? parseFloat(a.behavioural_score) : null,
        confidence: a.confidence_mean ? {
          mean:       parseFloat(a.confidence_mean),
          lower:      parseFloat(a.confidence_lower),
          upper:      parseFloat(a.confidence_upper),
          confidence: a.confidence_label,
        } : null,
        journal:     a.journal_text,
        crisisFlags: a.crisis_flags,
        anomaly:     a.anomaly_detected
          ? { delta: parseFloat(a.anomaly_delta), zScore: parseFloat(a.anomaly_z_score) }
          : null,
      }));
    } catch { return []; }
  }

  const normalisedPatients = patients.map(normPatient);

  return {
    auth,
    patients: normalisedPatients,
    notes,
    ready,
    login,
    register,
    logout,
    addPatient,
    pushRiskScore,
    removePatient,
    addNote,
    removeNote,
    recordSession,
    saveFullAssessment,
    getAssessmentHistory,
  };
}

export default useAuth;
