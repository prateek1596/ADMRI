import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth }  from "./hooks/useAuth";
import { useML }    from "./hooks/useML";
import { useTheme } from "./hooks/useTheme";

import { AuthPage }          from "./pages/AuthPage";
import { DashboardPage }     from "./pages/DashboardPage";
import { PatientsPage }      from "./pages/PatientsPage";
import { PatientDetailPage } from "./pages/PatientDetailPage";
import { ProfilePage }       from "./pages/ProfilePage";

import { Sidebar }         from "./components/ui/Sidebar";
import { AddNoteModal }    from "./components/modals/Modals";
import { AddPatientModal } from "./components/modals/Modals";

const WARN_BEFORE_MS = 5 * 60 * 1000;
const TIMEOUT_MS     = 30 * 60 * 1000;

export default function App() {
  const {
    auth, patients, notes, ready,
    login, register, logout,
    addPatient, pushRiskScore, removePatient,
    addNote, removeNote,
    recordSession, saveFullAssessment, getAssessmentHistory,
  } = useAuth();

  const mlState = useML();
  const { mode: themeMode, setTheme, themeKey } = useTheme();

  const [view,             setView]             = useState("dashboard");
  const [selPat,           setSelPat]           = useState(null);
  const [showNoteModal,    setShowNoteModal]    = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showTimeoutWarn,  setShowTimeoutWarn]  = useState(false);
  const [lastActivity,     setLastActivity]     = useState(Date.now());

  // Session timeout
  useEffect(() => {
    if (!auth) return;
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity;
      if (idle > TIMEOUT_MS - WARN_BEFORE_MS && idle < TIMEOUT_MS) setShowTimeoutWarn(true);
      else if (idle >= TIMEOUT_MS) { logout(); setShowTimeoutWarn(false); }
      else setShowTimeoutWarn(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [auth, lastActivity, logout]);

  useEffect(() => {
    if (!auth) return;
    const bump = () => setLastActivity(Date.now());
    const events = ["mousedown", "keydown", "touchstart"];
    events.forEach(e => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, bump));
  }, [auth]);

  useEffect(() => {
    if (!auth) return;
    function onKey(e) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "n" && view === "patients") { e.preventDefault(); setShowPatientModal(true); }
        if (e.key === "b" && view === "patient")  { e.preventDefault(); setShowNoteModal(true); }
        if (e.key === "d") { e.preventDefault(); goDashboard(); }
        if (e.key === "p") { e.preventDefault(); goPatients(); }
      }
      if (e.key === "Escape") {
        setShowNoteModal(false);
        setShowPatientModal(false);
        setShowTimeoutWarn(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [auth, view]);

  if (!ready) return null;
  if (!auth)  return <AuthPage onLogin={login} onRegister={register} />;

  function openPatient(pat) { setSelPat(pat); setView("patient"); }
  function goPatients()     { setSelPat(null); setView("patients"); }
  function goDashboard()    { setSelPat(null); setView("dashboard"); }
  function goProfile()      { setSelPat(null); setView("profile"); }

  function handleAssessmentComplete(patientId, score, fullSnapshot) {
    pushRiskScore(patientId, score);
    setSelPat(prev => prev
      ? { ...prev, riskHistory: [...(prev.riskHistory || []), Math.round(score)] }
      : prev
    );
    recordSession(patientId, { score });
    if (fullSnapshot) saveFullAssessment(patientId, fullSnapshot);
  }

  const pageTitle = view === "dashboard" ? "Dashboard"
    : view === "patients" ? "Patient Registry"
    : view === "profile"  ? "My Profile"
    : selPat?.name ?? "";
  const pageSubtitle = view === "patient" && selPat
    ? `${selPat.diagnosis} · Age ${selPat.age}` : "";

  // themeKey forces re-render when theme changes so CSS var reads update
  return (
    <div key={themeKey} style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex",
      transition: "background 0.2s, color 0.2s",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <Sidebar
        auth={auth} patients={patients} notes={notes}
        view={view} selPat={selPat}
        onNav={setView}
        onSelectPatients={goPatients}
        onSelectDashboard={goDashboard}
        onLogout={logout}
        onViewProfile={goProfile}
        mlState={mlState}
        themeMode={themeMode}
        onSetTheme={setTheme}
      />

      <div style={{ marginLeft: 236, flex: 1, minWidth: 0 }}>
        {/* Topbar */}
        <div style={{
          padding: "14px 28px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface)",
          position: "sticky", top: 0, zIndex: 40,
        }}>
          <div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
              {pageTitle}
            </span>
            {pageSubtitle && (
              <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 10 }}>{pageSubtitle}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 4 }}>
              {view === "patients"  && "Ctrl+N: New Patient"}
              {view === "patient"   && "Ctrl+B: Add Note"}
              {view === "dashboard" && "Ctrl+P: Patients"}
            </span>
            {view === "patients" && (
              <button style={topBtn()} onClick={() => setShowPatientModal(true)}>+ Add Patient</button>
            )}
            {view === "patient" && (<>
              <button style={topBtn(false)} onClick={goPatients}>← Back</button>
              <button style={topBtn()} onClick={() => setShowNoteModal(true)}>+ Add Note</button>
            </>)}
            {mlState.trained && !mlState.training && (
              <button
                style={{ ...topBtn(false), fontSize: 11, color: "var(--muted)", padding: "5px 10px" }}
                onClick={() => { if (window.confirm("Retrain all 4 ML models from scratch? ~60 seconds.")) mlState.forceRetrain(); }}
              >
                🔄 Retrain ML
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "28px" }}>
          <AnimatePresence mode="wait">
            {view === "dashboard" && (
              <DashboardPage key="dash" patients={patients} notes={notes} auth={auth} onSelectPatient={openPatient} />
            )}
            {view === "patients" && (
              <PatientsPage key="patients" patients={patients} notes={notes} onSelectPatient={openPatient} onAddPatient={() => setShowPatientModal(true)} />
            )}
            {view === "patient" && selPat && (
              <PatientDetailPage
                key={`patient-${selPat.id}`}
                patient={selPat} notes={notes} mlState={mlState}
                onAddNote={() => setShowNoteModal(true)}
                onBack={goPatients}
                onRunAssessment={handleAssessmentComplete}
                onRemovePatient={(id) => { removePatient(id); goPatients(); }}
                onRemoveNote={removeNote}
                getAssessmentHistory={getAssessmentHistory}
                doctorName={auth.doctor?.name || auth.name}
              />
            )}
            {view === "profile" && (
              <ProfilePage
                key="profile"
                auth={auth} patients={patients} notes={notes}
                onLogout={logout} onBack={goDashboard}
                themeMode={themeMode} onSetTheme={setTheme}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {showNoteModal && selPat && (
        <AddNoteModal
          patientName={selPat.name}
          onSave={(fields) => { addNote(selPat.id, fields); setShowNoteModal(false); }}
          onClose={() => setShowNoteModal(false)}
        />
      )}
      {showPatientModal && (
        <AddPatientModal
          onSave={(fields) => { addPatient(fields); setShowPatientModal(false); }}
          onClose={() => setShowPatientModal(false)}
        />
      )}

      <AnimatePresence>
        {showTimeoutWarn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 500,
              background: "var(--card)", border: "1px solid color-mix(in srgb, var(--warn) 35%, transparent)",
              borderRadius: 14, padding: "16px 20px", maxWidth: 320,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warn)", marginBottom: 8 }}>⏱ Session expiring soon</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
              You'll be automatically signed out in 5 minutes due to inactivity.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={topBtn()} onClick={() => { setLastActivity(Date.now()); setShowTimeoutWarn(false); }}>Stay signed in</button>
              <button style={topBtn(false)} onClick={() => { logout(); setShowTimeoutWarn(false); }}>Sign out</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function topBtn(primary = true) {
  return {
    padding: "7px 14px", borderRadius: 10, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: 12, fontFamily: "'DM Sans', sans-serif",
    background: primary ? "var(--accent)" : "var(--surface)",
    color:      primary ? "#fff" : "var(--text)",
    border:     primary ? "none" : "1px solid var(--border)",
    transition: "all 0.15s",
  };
}
