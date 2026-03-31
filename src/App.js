// src/App.js
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme }  from "./hooks/useTheme";
import { useAuth }   from "./hooks/useAuth";
import { useML }     from "./hooks/useML";
import { useMobile } from "./hooks/useMobile";
import { Sidebar }   from "./components/ui/Sidebar";
import { DashboardPage }     from "./pages/DashboardPage";
import { PatientsPage }      from "./pages/PatientsPage";
import { PatientDetailPage } from "./pages/PatientDetailPage";
import { ProfilePage }       from "./pages/ProfilePage";
import { AuthPage }          from "./pages/AuthPage";
import { AddNoteModal, AddPatientModal } from "./components/modals/Modals";

export default function App() {
  const { mode, setTheme, themeKey }    = useTheme();
  const {
    auth, patients, notes, ready,
    login, register, logout,
    addPatient, pushRiskScore, removePatient,
    addNote, removeNote, recordSession,
    saveFullAssessment, getAssessmentHistory,
  } = useAuth();
  const mlState = useML(auth);
  const { isMobile, isTablet, sidebarWidth } = useMobile();

  const [view,        setView]        = useState("dashboard");
  const [selPat,      setSelPat]      = useState(null);
  const [showAddPat,  setShowAddPat]  = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function navigate(v) {
    setView(v);
    if (isMobile) setSidebarOpen(false);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); setShowAddNote(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); setShowAddPat(true); }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close mobile sidebar on outside tap
  useEffect(() => {
    if (!isMobile || !sidebarOpen) return;
    function close(e) {
      if (!e.target.closest("[data-sidebar]")) setSidebarOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [isMobile, sidebarOpen]);

  if (!ready) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)",
      color: "var(--muted)", fontFamily: "'DM Sans',sans-serif", fontSize: 14,
    }}>
      Loading ADMRI…
    </div>
  );

  if (!auth) return <AuthPage onLogin={login} onRegister={register} />;

  const sidebarProps = {
    auth, patients, notes,
    view, selPat,
    onNav:             navigate,
    onSelectPatients:  () => navigate("patients"),
    onSelectDashboard: () => navigate("dashboard"),
    onLogout:          logout,
    onViewProfile:     () => navigate("profile"),
    mlState, themeMode: mode, onSetTheme: setTheme,
  };

  return (
    <div key={themeKey} style={{ minHeight: "100vh", background: "var(--bg)",
      fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      {isMobile && (
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "var(--surface)", borderBottom: "1px solid var(--border)",
          padding: "0 16px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button data-sidebar onClick={() => setSidebarOpen(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer",
              padding: "8px 4px", color: "var(--text)" }}>
            <HamburgerIcon open={sidebarOpen} />
          </button>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800,
            fontSize: 18, color: "var(--text)", letterSpacing: -0.5 }}>
            ADMRI<span style={{ color: "var(--accent)" }}>.</span>
          </div>
          <button onClick={() => setShowAddPat(true)}
            style={{ background: "var(--accent)", border: "none", cursor: "pointer",
              borderRadius: 8, padding: "6px 12px", color: "#fff",
              fontWeight: 700, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
            + Patient
          </button>
        </div>
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {isMobile ? (
        <>
          {/* Backdrop */}
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                style={{ position: "fixed", inset: 0,
                  background: "rgba(0,0,0,0.5)", zIndex: 149 }}
              />
            )}
          </AnimatePresence>

          {/* Drawer — SCROLLABLE */}
          <motion.div
            data-sidebar
            initial={false}
            animate={{ x: sidebarOpen ? 0 : -270 }}
            transition={{ type: "tween", duration: 0.22 }}
            style={{
              position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 150,
              width: 260,
              overflowY: "auto",   // ← KEY FIX: sidebar scrolls internally
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Sidebar {...sidebarProps} />
          </motion.div>
        </>
      ) : (
        /* Desktop/tablet — fixed sidebar */
        <div style={{ position: "fixed", top: 0, left: 0, bottom: 0,
          zIndex: 50, overflowY: "auto", overflowX: "hidden",
          width: sidebarWidth }}>
          <Sidebar {...sidebarProps} />
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div style={{
        marginLeft: isMobile ? 0 : sidebarWidth,
        minHeight: isMobile ? "calc(100vh - 52px)" : "100vh",
        paddingBottom: isMobile ? 64 : 0, // space for bottom nav
        transition: "margin-left 0.2s",
      }}>

        {/* Desktop top bar */}
        {!isMobile && (
          <div style={{
            padding: "0 28px", height: 56,
            background: "var(--surface)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "sticky", top: 0, zIndex: 40,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)" }}>
              {view === "dashboard" && "Dashboard"}
              {view === "patients"  && "Patient Registry"}
              {view === "profile"   && "My Profile"}
              {view === "patient" && selPat && (
                <>
                  <span>{selPat.name}</span>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span style={{ fontSize: 12 }}>{selPat.diagnosis}</span>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span style={{ fontSize: 12 }}>Age {selPat.age}</span>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Ctrl+N: New Patient</span>
              <button onClick={() => setShowAddNote(true)}
                style={{ padding: "6px 12px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--surface)",
                  color: "var(--muted)", fontSize: 12, fontWeight: 600,
                  fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }}>
                + Note
              </button>
              <button onClick={() => setShowAddPat(true)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none",
                  background: "var(--accent)", color: "#fff",
                  fontSize: 12, fontWeight: 700,
                  fontFamily: "'DM Sans',sans-serif", cursor: "pointer" }}>
                + Patient
              </button>
            </div>
          </div>
        )}

        {/* Page */}
        <div style={{ padding: isMobile ? "14px" : isTablet ? "18px 20px" : "24px 28px" }}>
          <AnimatePresence mode="wait">

            {view === "dashboard" && (
              <DashboardPage key="dash"
                auth={auth} patients={patients} notes={notes} mlState={mlState}
                onSelectPatient={p => { setSelPat(p); navigate("patient"); }}
                onAddPatient={() => setShowAddPat(true)}
              />
            )}

            {view === "patients" && (
              <PatientsPage key="pats"
                patients={patients} notes={notes}
                onSelectPatient={p => { setSelPat(p); navigate("patient"); }}
                onAddPatient={() => setShowAddPat(true)}
              />
            )}

            {view === "patient" && selPat && (
              <PatientDetailPage key={`pd-${selPat.id}`}
                patient={selPat} notes={notes} mlState={mlState}
                onAddNote={() => setShowAddNote(true)}
                onBack={() => navigate("patients")}
                onRunAssessment={async (pid, score, snap) => {
                  await pushRiskScore(pid, score);
                  await saveFullAssessment(pid, snap);
                  setSelPat(p => p?.id === pid
                    ? { ...p, riskHistory: [...(p.riskHistory || []), score] }
                    : p);
                }}
                onRemovePatient={async pid => {
                  await removePatient(pid);
                  navigate("patients");
                }}
                onRemoveNote={async (pid, nid) => removeNote(pid, nid)}
                getAssessmentHistory={getAssessmentHistory}
                doctorName={auth?.doctor?.name || auth?.name}
              />
            )}

            {/* ── ProfilePage — pass ALL required props ── */}
            {view === "profile" && (
              <ProfilePage key="prof"
                auth={auth}
                patients={patients || []}   // ← guard against undefined
                notes={notes || []}         // ← guard against undefined
                onLogout={logout}
                onBack={() => navigate("dashboard")}
                themeMode={mode}
                onSetTheme={setTheme}
              />
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          display: "flex", height: 58,
          paddingBottom: "env(safe-area-inset-bottom, 0px)", // iOS safe area
        }}>
          {[
            { id: "dashboard", emoji: "🏠", label: "Home" },
            { id: "patients",  emoji: "👥", label: "Patients" },
            { id: "patient",   emoji: "🧠", label: "Patient", disabled: !selPat },
          ].map(tab => (
            <button key={tab.id}
              disabled={tab.disabled}
              onClick={() => { if (!tab.disabled) navigate(tab.id); }}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                background: "none", border: "none",
                cursor: tab.disabled ? "not-allowed" : "pointer",
                opacity: tab.disabled ? 0.3 : 1,
              }}>
              <span style={{ fontSize: 20 }}>{tab.emoji}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                color: view === tab.id ? "var(--accent)" : "var(--muted)",
              }}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddPat && (
          <AddPatientModal
            onSave={async data => { await addPatient(data); setShowAddPat(false); }}
            onClose={() => setShowAddPat(false)}
          />
        )}
        {showAddNote && selPat && (
          <AddNoteModal
            patientName={selPat.name}
            onSave={async data => { await addNote(selPat.id, data); setShowAddNote(false); }}
            onClose={() => setShowAddNote(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HamburgerIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      {open ? (
        <>
          <line x1="5" y1="5" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="17" y1="5" x2="5"  y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <line x1="3" y1="7"  x2="19" y2="7"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="3" y1="15" x2="19" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}
