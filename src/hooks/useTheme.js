// src/hooks/useTheme.js
import { useState, useEffect, useCallback } from "react";
import { applyTheme, getSavedTheme, saveTheme } from "../styles/theme";

// Apply immediately before React renders — prevents flash of wrong theme
const _initial = getSavedTheme();
applyTheme(_initial);

export function useTheme() {
  const [mode,     setMode]     = useState(_initial);
  const [themeKey, setThemeKey] = useState(0);

  const apply = useCallback((m) => {
    applyTheme(m);
    // Bump key so App re-renders and all T.xxx values refresh
    setThemeKey(k => k + 1);
  }, []);

  // Re-apply whenever mode changes
  useEffect(() => { apply(mode); }, [mode, apply]);

  // Follow OS preference changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (mode === "system") apply("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, apply]);

  function setTheme(newMode) {
    saveTheme(newMode);
    setMode(newMode);
    apply(newMode);
  }

  return { mode, setTheme, themeKey };
}
