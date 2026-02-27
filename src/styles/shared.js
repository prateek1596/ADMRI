import { T } from "./theme";

export const card = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 22,
  marginBottom: 14,
};

export const inp = {
  width: "100%",
  padding: "10px 14px",
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  color: T.text,
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

export const lbl = {
  fontSize: 11,
  color: T.muted,
  marginBottom: 5,
  display: "block",
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
};

export const btn = (variant = "primary", size = "md") => ({
  padding: size === "sm" ? "7px 14px" : "11px 22px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: size === "sm" ? 12 : 13,
  fontFamily: "'DM Sans', sans-serif",
  transition: "all 0.15s",
  background:
    variant === "primary" ? T.accent
    : variant === "danger"  ? `${T.danger}22`
    : variant === "outline" ? "transparent"
    : T.surface,
  color:
    variant === "primary" ? T.bg
    : variant === "danger"  ? T.danger
    : variant === "outline" ? T.accent
    : T.text,
  outline: variant === "outline" ? `1px solid ${T.accent}55` : "none",
});

export const tabBtn = (active) => ({
  padding: "7px 16px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  background: active ? `${T.accent}22` : "transparent",
  color: active ? T.accent : T.muted,
  transition: "all 0.15s",
  fontFamily: "'DM Sans', sans-serif",
});

export const chip = (color = T.accentAlt) => ({
  display: "inline-block",
  padding: "2px 9px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 600,
  background: `${color}22`,
  color,
  border: `1px solid ${color}44`,
  marginRight: 4,
  marginBottom: 3,
});
