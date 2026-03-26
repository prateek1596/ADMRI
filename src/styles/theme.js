// src/styles/theme.js
// T holds CSS variable STRINGS — every inline style using T.accent etc
// automatically works in both light and dark mode because the browser
// resolves var(--accent) at paint time, not at JS execution time.

// ── Apply theme (sets CSS variables on :root) ─────────────────────────────
export function applyTheme(mode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && prefersDark);
  const root = document.documentElement;
  root.setAttribute("data-theme", isDark ? "dark" : "light");

  if (isDark) {
    root.style.setProperty("--bg",          "#0D1117");
    root.style.setProperty("--surface",     "#161B22");
    root.style.setProperty("--card",        "#1C2128");
    root.style.setProperty("--border",      "#21262D");
    root.style.setProperty("--text",        "#E6EDF3");
    root.style.setProperty("--text-soft",   "#C9D1D9");
    root.style.setProperty("--muted",       "#8B949E");
    root.style.setProperty("--accent",      "#58A6FF");
    root.style.setProperty("--accent-alt",  "#3FB950");
    root.style.setProperty("--doctor",      "#BC8CFF");
    root.style.setProperty("--safe",        "#3FB950");
    root.style.setProperty("--warn",        "#E3B341");
    root.style.setProperty("--danger",      "#F85149");
    root.style.setProperty("--inp-bg",      "#0D1117");
    root.style.setProperty("--inp-border",  "#30363D");
    root.style.setProperty("--inp-text",    "#E6EDF3");
    root.style.setProperty("--inp-focus",   "#58A6FF");
  } else {
    root.style.setProperty("--bg",          "#F6F8FA");
    root.style.setProperty("--surface",     "#FFFFFF");
    root.style.setProperty("--card",        "#FFFFFF");
    root.style.setProperty("--border",      "#D0D7DE");
    root.style.setProperty("--text",        "#1F2328");
    root.style.setProperty("--text-soft",   "#3D444D");
    root.style.setProperty("--muted",       "#656D76");
    root.style.setProperty("--accent",      "#0969DA");
    root.style.setProperty("--accent-alt",  "#1A7F37");
    root.style.setProperty("--doctor",      "#8250DF");
    root.style.setProperty("--safe",        "#1A7F37");
    root.style.setProperty("--warn",        "#9A6700");
    root.style.setProperty("--danger",      "#CF222E");
    root.style.setProperty("--inp-bg",      "#FFFFFF");
    root.style.setProperty("--inp-border",  "#D0D7DE");
    root.style.setProperty("--inp-text",    "#1F2328");
    root.style.setProperty("--inp-focus",   "#0969DA");
  }

  document.body.style.background = isDark ? "#0D1117" : "#F6F8FA";
  document.body.style.color      = isDark ? "#E6EDF3" : "#1F2328";
  return isDark;
}

export function getSavedTheme() {
  return localStorage.getItem("admri_theme") || "system";
}

export function saveTheme(mode) {
  localStorage.setItem("admri_theme", mode);
}

// ── T — CSS variable strings ───────────────────────────────────────────────
// Every component that does background: T.card gets "var(--card)"
// The browser resolves this to the correct color for the current theme.
// No DOM reads, no re-render lag, works in ALL existing components unchanged.
export const T = {
  bg:           "var(--bg)",
  surface:      "var(--surface)",
  card:         "var(--card)",
  border:       "var(--border)",
  text:         "var(--text)",
  textSoft:     "var(--text-soft)",
  muted:        "var(--muted)",
  accent:       "var(--accent)",
  accentAlt:    "var(--accent-alt)",
  doctorAccent: "var(--doctor)",
  safe:         "var(--safe)",
  warn:         "var(--warn)",
  danger:       "var(--danger)",
  info:         "var(--accent)",
};

// ── Static exports ─────────────────────────────────────────────────────────
export const SPECIALTIES = [
  "Child Psychiatry",
  "Clinical Psychology",
  "Child Psychology",
  "Adolescent Psychiatry",
  "Developmental Paediatrics",
  "Paediatric Neurology",
  "School Psychology",
  "Counselling Psychology",
  "Neuropsychology",
  "Other",
];

export const NOTE_TYPE_COLORS = {
  Session:          "#58A6FF",
  "Check-in":       "#3FB950",
  Crisis:           "#F85149",
  "Family Meeting": "#BC8CFF",
  Progress:         "#3FB950",
  Discharge:        "#8B949E",
};

export const MOOD_COLORS = {
  Positive:  "#3FB950",
  Neutral:   "#8B949E",
  Anxious:   "#E3B341",
  Depressed: "#F85149",
  Agitated:  "#FF7B72",
  Calm:      "#58A6FF",
  Mixed:     "#BC8CFF",
};
