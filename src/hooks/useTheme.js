// src/hooks/useTheme.js
import { useState, useEffect, useCallback } from "react";
import { applyTheme, getSavedTheme, saveTheme } from "../styles/theme";

export function useTheme() {
  const [mode,   setMode]   = useState(() => getSavedTheme());
  const [isDark, setIsDark] = useState(false);
  // themeKey forces child components to re-render when theme changes
  const [themeKey, setThemeKey] = useState(0);

  const apply = useCallback((m) => {
    const dark = applyTheme(m);
    setIsDark(dark);
    // Bump key so React re-renders components that use T
    setThemeKey(k => k + 1);
  }, []);

  useEffect(() => { apply(mode); }, [mode, apply]);

  // Follow OS changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (mode === "system") apply("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, apply]);

  function setTheme(newMode) {
    saveTheme(newMode);
    setMode(newMode);
  }

  return { mode, isDark, setTheme, themeKey };
}
