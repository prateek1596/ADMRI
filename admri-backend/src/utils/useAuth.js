// src/hooks/useAuth.js
// Updated to use the real backend API instead of localStorage
// Drop this in place of your existing useAuth.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { Auth, Patients, Assessments, Notes, Dashboard } from '../utils/api';

const SESSION_TIMEOUT_MS  = 30 * 60 * 1000; // 30 min
const WARNING_BEFORE_MS   =  5 * 60 * 1000; //  5 min

export function useAuth() {
  const [doctor,   setDoctor]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [patients, setPatients] = useState([]);
  const [notes,    setNotes]    = useState([]);

  // Session timeout refs
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // ── Boot: restore session ───────────────────────────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      if (!Auth.isLoggedIn()) { setLoading(false); return; }
      try {
        const me = await Auth.getMe();
        setDoctor(me);
        await loadAllData();
        resetSessionTimer();
      } catch {
        // Token invalid or expired — stay logged out
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  // ── Activity-based session timer ────────────────────────────────────────────
  function resetSessionTimer() {
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
    setShowTimeoutWarning(false);

    warningRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, SESSION_TIMEOUT_MS);
  }

  useEffect(() => {
    if (!doctor) return;
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    const reset = () => resetSessionTimer();
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, reset));
  }, [doctor]);

  // ── Load all data for logged-in doctor ──────────────────────────────────────
  async function loadAllData() {
    try {
      const { patients: pList } = await Patients.list({ limit: 100 });
      setPatients(pList || []);

      // Load recent notes for all patients
      const allNotes = [];
      for (const p of (pList || []).slice(0, 20)) {
        try {
          const { notes: pNotes } = await Notes.list(p.id, { limit: 20 });
          allNotes.push(...(pNotes || []));
        } catch {}
      }
      setNotes(allNotes);
    } catch (err) {
      console.error('Failed to load data:', err.message);
    }
  }

  // ── Auth actions ────────────────────────────────────────────────────────────
  async function handleLogin(email, password) {
    const me = await Auth.login(email, password);
    setDoctor(me);
    await loadAllData();
    resetSessionTimer();
    return me;
  }

  async function handleRegister(data) {
    const me = await Auth.register(data);
    setDoctor(me);
    resetSessionTimer();
    return me;
  }

  async function handleLogout(allDevices = false) {
    try { await Auth.logout(allDevices); } catch {}
    setDoctor(null);
    setPatients([]);
    setNotes([]);
    clearTimeout(timeoutRef.current);
    clearTimeout(warningRef.current);
  }

  // ── Patient actions ─────────────────────────────────────────────────────────
  async function addPatient(data) {
    const patient = await Patients.create(data);
    setPatients(prev => [patient, ...prev]);
    return patient;
  }

  async function updatePatient(id, data) {
    const updated = await Patients.update(id, data);
    setPatients(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }

  async function removePatient(id) {
    await Patients.delete(id);
    setPatients(prev => prev.filter(p => p.id !== id));
    setNotes(prev => prev.filter(n => n.patient_id !== id));
  }

  // ── Assessment actions ──────────────────────────────────────────────────────
  async function runAssessment(patientId, score, snapshot) {
    const riskLevel = score >= 76 ? 'Severe'
      : score >= 61 ? 'High'
      : score >= 41 ? 'Moderate'
      : score >= 21 ? 'Mild'
      : 'Minimal';

    const assessment = await Assessments.create(patientId, {
      admri_score:        Math.round(score),
      adaptive_score:     snapshot.adaptive ? Math.round(snapshot.adaptive) : undefined,
      risk_level:         riskLevel,
      quest_score:        snapshot.questScore  ? Math.round(snapshot.questScore)  : undefined,
      sentiment_score:    snapshot.sentimentScore ? Math.round(snapshot.sentimentScore) : undefined,
      behavioural_score:  snapshot.behaviouralScore ? Math.round(snapshot.behaviouralScore) : undefined,
      confidence_mean:    snapshot.confidence?.mean,
      confidence_lower:   snapshot.confidence?.lower,
      confidence_upper:   snapshot.confidence?.upper,
      confidence_label:   snapshot.confidence?.confidence,
      journal_text:       snapshot.journal,
      quest_answers:      snapshot.questAnswers,
      behavioral_data:    snapshot.behavioral,
      domain_profile:     snapshot.domainProfile,
      forecast:           snapshot.forecast,
      model_scores:       snapshot.confidence?.modelScores,
      crisis_flags:       snapshot.sentDetails?.crisisFlags,
      dominant_emotion:   snapshot.sentDetails?.dominantEmotion,
    });

    // Optimistically update patient in local state
    setPatients(prev => prev.map(p => {
      if (p.id !== patientId) return p;
      const history = [...(p.risk_history || []), Math.round(score)];
      return { ...p, latest_score: Math.round(score), risk_level: riskLevel, risk_history: history };
    }));

    return assessment;
  }

  function getAssessmentHistory(patientId) {
    // Returns cached or fetches from backend
    return Assessments.list(patientId).then(r => r.assessments).catch(() => []);
  }

  // ── Note actions ────────────────────────────────────────────────────────────
  async function addNote(patientId, data) {
    const note = await Notes.create(patientId, data);
    setNotes(prev => [note, ...prev]);
    return note;
  }

  async function removeNote(patientId, noteId) {
    await Notes.delete(patientId, noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }

  return {
    doctor, loading, patients, notes,
    showTimeoutWarning, setShowTimeoutWarning,
    login:    handleLogin,
    register: handleRegister,
    logout:   handleLogout,
    stayActive: resetSessionTimer,
    addPatient, updatePatient, removePatient,
    runAssessment, getAssessmentHistory,
    addNote, removeNote,
    refreshData: loadAllData,
  };
}
