
const dark = {
  bg:           "#0D1117",
  surface:      "#161B22",
  card:         "#1C2128",
  border:       "#21262D",
  text:         "#E6EDF3",
  textSoft:     "#C9D1D9",
  muted:        "#8B949E",
  accent:       "#58A6FF",
  accentAlt:    "#3FB950",
  doctorAccent: "#BC8CFF",
  safe:         "#3FB950",
  warn:         "#E3B341",
  danger:       "#F85149",
  info:         "#58A6FF",
};

// ── Light palette ──────────────────────────────────────────────────────────
const light = {
  bg:           "#F6F8FA",
  surface:      "#FFFFFF",
  card:         "#FFFFFF",
  border:       "#D0D7DE",
  text:         "#1F2328",
  textSoft:     "#3D444D",
  muted:        "#636C76",
  accent:       "#0969DA",
  accentAlt:    "#1A7F37",
  doctorAccent: "#8250DF",
  safe:         "#1A7F37",
  warn:         "#9A6700",
  danger:       "#CF222E",
  info:         "#0969DA",
};

// ── Active theme (set at runtime by ThemeProvider) ─────────────────────────
// T is a mutable proxy — components import T and always get the current values
export let T = { ...dark };

export function applyTheme(mode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && prefersDark);
  const palette = isDark ? dark : light;
  Object.assign(T, palette);

  // Also update CSS variables on :root so any raw CSS benefits
  const root = document.documentElement;
  root.setAttribute("data-theme", isDark ? "dark" : "light");
  Object.entries(palette).forEach(([k, v]) => {
    root.style.setProperty(`--admri-${k}`, v);
  });

  // Set overall page background
  document.body.style.background = palette.bg;
  document.body.style.color      = palette.text;

  return palette;
}

// ── Theme storage helpers ──────────────────────────────────────────────────
export function getSavedTheme() {
  return localStorage.getItem("admri_theme") || "system";
}

export function saveTheme(mode) {
  localStorage.setItem("admri_theme", mode);
}

// ── Re-exports so nothing else needs to change ─────────────────────────────
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
  Session:        T.accent,
  "Check-in":     T.accentAlt,
  Crisis:         T.danger,
  "Family Meeting": T.doctorAccent,
  Progress:       T.safe,
  Discharge:      T.muted,
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
