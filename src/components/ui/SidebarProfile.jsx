// src/components/ui/SidebarProfile.jsx
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function SidebarProfile({ auth, onLogout, onViewProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const doctor     = auth?.doctor || auth || {};
  const doctorName = doctor.name      || "Doctor";
  const specialty  = doctor.specialty || "";
  const initials   = doctorName.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.13 }}
            style={{
              position: "absolute", bottom: "calc(100% + 8px)",
              left: 0, right: 0,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12, overflow: "hidden", zIndex: 200,
              boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
            }}
          >
            {/* Profile */}
            <button
              onClick={() => { setOpen(false); onViewProfile(); }}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: 12, padding: "12px 16px",
                background: "none", border: "none", cursor: "pointer",
                textAlign: "left",
                borderBottom: "1px solid var(--border)",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="7.5" cy="5" r="3" stroke="var(--accent)" strokeWidth="1.3"/>
                  <path d="M2 14c0-3.314 2.91-5 5.5-5s5.5 1.686 5.5 5" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>My Profile</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Edit details · email · password</div>
              </div>
            </button>

            {/* Sign out */}
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: 12, padding: "12px 16px",
                background: "none", border: "none", cursor: "pointer",
                textAlign: "left",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 8%, transparent)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "color-mix(in srgb, var(--danger) 15%, transparent)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M6 3H3a1 1 0 00-1 1v7a1 1 0 001 1h3" stroke="var(--danger)" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M10 10l3-3-3-3M13 7H6" stroke="var(--danger)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)" }}>Sign Out</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>End your session</div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Doctor button */}
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          gap: 10, padding: "10px 12px",
          background: open ? "var(--surface)" : "transparent",
          border: `1px solid ${open ? "var(--border)" : "transparent"}`,
          borderRadius: 12, cursor: "pointer",
          transition: "all 0.15s",
          fontFamily: "'DM Sans', sans-serif",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--surface)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "color-mix(in srgb, var(--accent) 18%, transparent)",
          border: "1.5px solid color-mix(in srgb, var(--accent) 35%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: "var(--accent)",
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {doctorName}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {specialty}
          </div>
        </div>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"
          style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(-90deg)" : "rotate(90deg)" }}>
          <path d="M3.5 2l4 3.5-4 3.5" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}
