// src/components/ui/ThemeToggle.jsx
// compact={true}  → icons only (for sidebar, tight spaces)
// compact={false} → icons + labels (for profile page)

export function ThemeToggle({ mode, onSetTheme, compact = false }) {
  const MODES = [
    { id: "system", label: "System", Icon: MonitorIcon },
    { id: "light",  label: "Light",  Icon: SunIcon     },
    { id: "dark",   label: "Dark",   Icon: MoonIcon    },
  ];

  return (
    <div style={{
      display: "inline-flex",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 9, padding: 2, gap: 1,
      flexShrink: 0,
    }}>
      {MODES.map(({ id, label, Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            onClick={() => onSetTheme(id)}
            title={`${label} mode`}
            style={{
              display: "flex", alignItems: "center",
              gap: compact ? 0 : 4,
              padding: compact ? "5px 7px" : "5px 10px",
              borderRadius: 7,
              border: "none", cursor: "pointer",
              transition: "all 0.15s",
              background: active ? "var(--card)" : "transparent",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
            }}
          >
            <Icon active={active} />
            {!compact && (
              <span style={{
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--accent)" : "var(--muted)",
              }}>
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MonitorIcon({ active }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2" width="12" height="8" rx="1.5"
        stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.3"/>
      <path d="M4 12h6M7 10v2"
        stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function SunIcon({ active }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2.5"
        stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.3"/>
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M9.01 9.01l1.06 1.06M2.93 11.07l1.06-1.06M9.01 4.99l1.06-1.06"
        stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function MoonIcon({ active }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M11.5 8.5A5 5 0 015.5 2.5a5 5 0 100 9 5 5 0 006-3z"
        stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
