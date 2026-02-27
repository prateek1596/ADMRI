export const T = {
  bg: "#080C14",
  surface: "#0E1520",
  card: "#121B2B",
  cardHover: "#162032",
  border: "#1A2840",
  borderLight: "#223354",
  accent: "#3ABFF8",
  accentAlt: "#818CF8",
  warn: "#FACC15",
  danger: "#F87171",
  safe: "#34D399",
  text: "#E2E8F0",
  textSoft: "#94A3B8",
  muted: "#475569",
  doctorAccent: "#A78BFA",
};

export const SPECIALTIES = [
  "Child Psychiatry",
  "Clinical Psychology",
  "Adolescent Psychiatry",
  "Neuropsychology",
  "Counselling Psychology",
  "Child & Adolescent Mental Health",
  "Developmental Pediatrics",
  "School Psychology",
];

export const NOTE_TYPES = ["Session", "Check-in", "Assessment", "Crisis", "Family Meeting", "Phone Call"];
export const MOODS = ["Neutral", "Anxious", "Sad", "Hopeful", "Hyperactive", "Angry", "Withdrawn", "Calm"];

export const NOTE_TYPE_COLORS = {
  Session: T.accent,
  "Check-in": T.accentAlt,
  Assessment: T.warn,
  Crisis: T.danger,
  "Family Meeting": T.safe,
  "Phone Call": T.textSoft,
};

export const MOOD_COLORS = {
  Anxious: T.warn,
  Sad: T.danger,
  Neutral: T.muted,
  Hyperactive: T.accent,
  Hopeful: T.safe,
  Angry: "#F97316",
  Withdrawn: T.muted,
  Calm: T.safe,
};
