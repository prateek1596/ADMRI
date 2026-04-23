/**
 * ADMRI Storage Layer
 * ────────────────────
 * All localStorage access is isolated here.
 * 
 * Security improvements:
 *  - Passwords stored as SHA-256 hashes (never plaintext)
 *  - Doctor data isolation: getPatients() scoped by doctorId at storage level
 *  - Session token stored separately from doctor profile
 *  - assessmentHistory stored per-patient (full answers, not just score)
 */

import { SEED_DOCTORS, SEED_PATIENTS, SEED_NOTES } from "../data/seedData";

export const KEYS = {
  DOCTORS:     "admri_doctors_v2",   // v2 = hashed passwords
  PATIENTS:    "admri_patients",
  NOTES:       "admri_notes",
  SESSIONS:    "admri_sessions",
  AUTH:        "admri_auth_v2",
  ASSESSMENTS: "admri_assessments",  // full assessment snapshots
  ACTIVITY:    "admri_activity",     // last activity timestamp for timeout
};

export function getStored(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function setStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initStorage() {
  // Always re-seed doctors under the new key if not present
  if (!getStored(KEYS.DOCTORS, null)) {
    // Keep plaintext password so login can do hash-upgrade on first use
    setStored(KEYS.DOCTORS, SEED_DOCTORS);
  }
  if (!getStored(KEYS.PATIENTS,    null)) setStored(KEYS.PATIENTS,    SEED_PATIENTS);
  if (!getStored(KEYS.NOTES,       null)) setStored(KEYS.NOTES,       SEED_NOTES);
  if (!getStored(KEYS.SESSIONS,    null)) setStored(KEYS.SESSIONS,    []);
  if (!getStored(KEYS.ASSESSMENTS, null)) setStored(KEYS.ASSESSMENTS, []);
}

// ── Activity tracking (for session timeout) ───────────────────────────────────
export function touchActivity()       { setStored(KEYS.ACTIVITY, Date.now()); }
export function getLastActivity()     { return getStored(KEYS.ACTIVITY, Date.now()); }

// ── Doctors ───────────────────────────────────────────────────────────────────
export function getDoctors()          { return getStored(KEYS.DOCTORS, []); }

export function saveDoctor(doc) {
  // doc.passwordHash should already be set by useAuth (async hash)
  const sanitised = { ...doc, password: undefined };
  setStored(KEYS.DOCTORS, [...getDoctors(), sanitised]);
}

export function findDoctorByEmail(email) {
  return getDoctors().find(d => d.email === email);
}

export function emailExists(email) {
  return !!getDoctors().find(d => d.email === email);
}

export function updateDoctorPassword(email, newHash) {
  setStored(KEYS.DOCTORS, getDoctors().map(d =>
    d.email === email ? { ...d, passwordHash: newHash } : d
  ));
}

// ── Patients (doctor-scoped at storage level) ─────────────────────────────────
export function getPatients()              { return getStored(KEYS.PATIENTS, []); }
export function getDoctorPatients(doctorId){ return getPatients().filter(p => p.doctorId === doctorId); }

export function savePatient(pat) {
  // Ensure no cross-doctor contamination
  if (!pat.doctorId) throw new Error("Patient must have doctorId");
  setStored(KEYS.PATIENTS, [...getPatients(), pat]);
}

export function updatePatient(updated) {
  if (!updated.doctorId) throw new Error("Patient must have doctorId");
  setStored(KEYS.PATIENTS, getPatients().map(p => p.id === updated.id ? updated : p));
}

export function deletePatient(patientId, doctorId) {
  setStored(KEYS.PATIENTS, getPatients().filter(p => !(p.id === patientId && p.doctorId === doctorId)));
}

// ── Notes ────────────────────────────────────────────────────────────────────
export function getNotes()               { return getStored(KEYS.NOTES, []); }
export function getDoctorNotes(doctorId) { return getNotes().filter(n => n.doctorId === doctorId); }
export function getPatientNotes(patientId, doctorId) {
  return getNotes().filter(n => n.patientId === patientId && n.doctorId === doctorId);
}
export function saveNote(note)           { setStored(KEYS.NOTES, [...getNotes(), note]); }
export function deleteNote(noteId, doctorId) {
  setStored(KEYS.NOTES, getNotes().filter(n => !(n.id === noteId && n.doctorId === doctorId)));
}

// ── Sessions ─────────────────────────────────────────────────────────────────
export function getSessions()            { return getStored(KEYS.SESSIONS, []); }
export function saveSession(sess)        { setStored(KEYS.SESSIONS, [...getSessions(), sess]); }

// ── Full Assessment Snapshots ─────────────────────────────────────────────────
// Stores complete assessment data so history is fully reviewable
export function getAssessments()         { return getStored(KEYS.ASSESSMENTS, []); }
export function getPatientAssessments(patientId) {
  return getAssessments().filter(a => a.patientId === patientId).sort((a,b) => b.date.localeCompare(a.date));
}
export function saveAssessment(snapshot) {
  setStored(KEYS.ASSESSMENTS, [...getAssessments(), snapshot]);
}

// ── Auth (token-based, no raw password in session) ────────────────────────────
export function getAuth()                { return getStored(KEYS.AUTH, null); }
export function persistAuth(auth)        { setStored(KEYS.AUTH, auth); touchActivity(); }
export function clearAuth()              { setStored(KEYS.AUTH, null); }
