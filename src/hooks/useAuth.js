import { useState, useEffect, useCallback, useRef } from "react";
import {
  initStorage, getAuth, persistAuth, clearAuth,
  findDoctorByEmail, emailExists, saveDoctor,
  getDoctorPatients, getDoctorNotes,
  savePatient, updatePatient, deletePatient,
  saveNote, deleteNote, saveSession,
  saveAssessment, getPatientAssessments,
  touchActivity, getLastActivity,
  getDoctors, setStored, KEYS,
} from "../utils/storage";
import { hashPassword, verifyPassword } from "../utils/crypto";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useAuth() {
  const [auth,     setAuth]     = useState(null);
  const [patients, setPatients] = useState([]);
  const [notes,    setNotes]    = useState([]);
  const [ready,    setReady]    = useState(false);
  const timeoutRef = useRef(null);

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    initStorage();
    const saved = getAuth();
    if (saved) {
      // Check if session has expired
      const lastActivity = getLastActivity();
      if (Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
        clearAuth();
      } else {
        setAuth(saved);
        setPatients(getDoctorPatients(saved.doctor.id));
        setNotes(getDoctorNotes(saved.doctor.id));
        scheduleTimeout();
      }
    }
    setReady(true);
  }, []);

  // ── Session timeout ─────────────────────────────────────────────────────────
  function scheduleTimeout() {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      clearAuth();
      setAuth(null);
      setPatients([]);
      setNotes([]);
    }, SESSION_TIMEOUT_MS);
  }

  // Reset timeout on any user activity
  useEffect(() => {
    if (!auth) return;
    const bump = () => { touchActivity(); scheduleTimeout(); };
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, bump, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, bump));
      clearTimeout(timeoutRef.current);
    };
  }, [auth]);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const doc = findDoctorByEmail(email.trim().toLowerCase());
    if (!doc) return "Invalid email or password.";

    let valid = false;

    if (doc.passwordHash && doc.passwordHash !== "__NEEDS_HASH__") {
      // Normal hashed password check
      valid = await verifyPassword(password, doc.passwordHash);
    } else {
      // Legacy plaintext (seed doctors on first load) — accept and upgrade
      valid = doc.password === password;
      if (valid) {
        const hash = await hashPassword(password);
        const allDoctors = getDoctors();
        const updated = allDoctors.map(d =>
          d.email === doc.email ? { ...d, passwordHash: hash, password: undefined } : d
        );
        setStored(KEYS.DOCTORS, updated);
      }
    }

    if (!valid) return "Invalid email or password.";

    const safeDoc = { id: doc.id, name: doc.name, email: doc.email, specialty: doc.specialty, licenseNo: doc.licenseNo };
    const a = { doctor: safeDoc };
    setAuth(a);
    persistAuth(a);
    setPatients(getDoctorPatients(doc.id));
    setNotes(getDoctorNotes(doc.id));
    scheduleTimeout();
    return null;
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────────
  const register = useCallback(async (fields) => {
    const { name, email, password, confirmPassword, specialty, licenseNo } = fields;
    if (!name.trim())                              return "Full name is required.";
    if (!email.includes("@"))                      return "Enter a valid email address.";
    if (password.length < 8)                       return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password))                   return "Password must contain at least one uppercase letter.";
    if (!/[0-9]/.test(password))                   return "Password must contain at least one number.";
    if (password !== confirmPassword)              return "Passwords do not match.";
    if (!specialty)                                return "Please select a specialty.";
    if (!licenseNo.trim())                         return "License / registration number is required.";
    if (emailExists(email.trim().toLowerCase()))   return "An account with this email already exists.";

    const passwordHash = await hashPassword(password);

    const doc = {
      id:           `doc_${Date.now()}`,
      name:         name.trim(),
      email:        email.trim().toLowerCase(),
      passwordHash,
      specialty,
      licenseNo:    licenseNo.trim(),
    };
    saveDoctor(doc);
    return null;
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearAuth();
    setAuth(null);
    setPatients([]);
    setNotes([]);
  }, []);

  // ── Patients ──────────────────────────────────────────────────────────────────
  const addPatient = useCallback((fields) => {
    if (!auth) return;
    const pat = {
      id:          `pat_${Date.now()}`,
      doctorId:    auth.doctor.id,
      joinDate:    new Date().toISOString().split("T")[0],
      riskHistory: [],
      ...fields,
      age: parseInt(fields.age) || 14,
    };
    savePatient(pat);
    setPatients(prev => [...prev, pat]);
    return pat;
  }, [auth]);

  const pushRiskScore = useCallback((patientId, score) => {
    setPatients(prev => {
      const updated = prev.map(p => {
        if (p.id !== patientId) return p;
        const next = { ...p, riskHistory: [...(p.riskHistory || []), Math.round(score)] };
        updatePatient(next);
        return next;
      });
      return updated;
    });
  }, []);

  const removePatient = useCallback((patientId) => {
    if (!auth) return;
    deletePatient(patientId, auth.doctor.id);
    setPatients(prev => prev.filter(p => p.id !== patientId));
    setNotes(prev => prev.filter(n => n.patientId !== patientId));
  }, [auth]);

  // ── Notes ─────────────────────────────────────────────────────────────────────
  const addNote = useCallback((patientId, fields) => {
    if (!auth) return;
    const note = {
      id:        `note_${Date.now()}`,
      patientId,
      doctorId:  auth.doctor.id,
      date:      new Date().toISOString().split("T")[0],
      ...fields,
      tags: typeof fields.tags === "string"
        ? fields.tags.split(",").map(t => t.trim()).filter(Boolean)
        : fields.tags ?? [],
    };
    saveNote(note);
    setNotes(prev => [...prev, note]);
    return note;
  }, [auth]);

  const removeNote = useCallback((noteId) => {
    if (!auth) return;
    deleteNote(noteId, auth.doctor.id);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }, [auth]);

  // ── Sessions + Full Assessment Snapshots ──────────────────────────────────────
  const recordSession = useCallback((patientId, scores) => {
    if (!auth) return;
    saveSession({
      id:        `sess_${Date.now()}`,
      patientId,
      doctorId:  auth.doctor.id,
      date:      new Date().toISOString().split("T")[0],
      ...scores,
    });
  }, [auth]);

  const saveFullAssessment = useCallback((patientId, snapshot) => {
    if (!auth) return;
    saveAssessment({
      id:        `asmnt_${Date.now()}`,
      patientId,
      doctorId:  auth.doctor.id,
      date:      new Date().toISOString().split("T")[0],
      timestamp: new Date().toISOString(),
      ...snapshot,
    });
  }, [auth]);

  const getAssessmentHistory = useCallback((patientId) => {
    return getPatientAssessments(patientId);
  }, []);

  return {
    auth, patients, notes, ready,
    login, register, logout,
    addPatient, pushRiskScore, removePatient,
    addNote, removeNote,
    recordSession, saveFullAssessment, getAssessmentHistory,
    highRiskPatients: patients.filter(p => {
      const last = p.riskHistory?.[p.riskHistory.length - 1];
      return last !== undefined && last >= 70;
    }),
  };
}
