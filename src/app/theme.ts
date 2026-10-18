import { useCallback, useState } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "provodnik.theme";

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Dark by default; the choice is a per-device preference kept in localStorage (see index.html). */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage may be unavailable (private mode); the theme still applies for this session
    }
    setThemeState(next);
  }, []);
  return [theme, setTheme];
}
