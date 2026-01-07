"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const THEME_STORAGE_KEY = "yardura-theme";
const THEME_COOKIE = "yardura-theme";

export type ThemeName = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  initialTheme: ThemeName;
  children: ReactNode;
};

function persistTheme(theme: ThemeName) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn("theme-localstorage-error", error);
  }

  try {
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch (error) {
    console.warn("theme-cookie-error", error);
  }
}

function applyThemeClass(theme: ThemeName) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ initialTheme, children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
    if (!isFirstRender.current) {
      persistTheme(theme);
    }
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

