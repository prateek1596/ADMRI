// src/styles/shared.js
// All shared style builders — use CSS variables so they work in light + dark

export const inp = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid var(--inp-border)",
  background: "var(--inp-bg)",
  color: "var(--inp-text)",
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

export const lbl = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--muted)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 6,
};

export const card = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "18px 20px",
  marginBottom: 16,
};

export function btn(variant = "", size = "md") {
  const base = {
    padding: size === "sm" ? "7px 14px" : "9px 18px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: size === "sm" ? 12 : 13,
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.15s",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  if (variant === "primary") {
    return {
      ...base,
      background: "var(--accent)",
      color: "#fff",
    };
  }
  if (variant === "danger") {
    return {
      ...base,
      background: "color-mix(in srgb, var(--danger) 15%, transparent)",
      color: "var(--danger)",
      border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
    };
  }
  return {
    ...base,
    background: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  };
}

export function tabBtn(active) {
  return {
    padding: "7px 16px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    fontFamily: "'DM Sans', sans-serif",
    transition: "all 0.15s",
    background: active
      ? "color-mix(in srgb, var(--accent) 18%, transparent)"
      : "transparent",
    color: active ? "var(--accent)" : "var(--muted)",
  };
}

export function chip(color) {
  return {
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
  };
}
