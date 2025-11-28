import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";

export type Theme = "light" | "dim" | "lights-out" | "sunset" | "ocean" | "forest" | "sepia" | "high-contrast";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isInitialized: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const validThemes: Theme[] = ["light", "dim", "lights-out", "sunset", "ocean", "forest", "sepia", "high-contrast"];

const THEME_CLASSES = {
  light: ["light"],
  dim: ["dark", "dim"],
  "lights-out": ["dark", "lights-out"],
  sunset: ["dark", "sunset"],
  ocean: ["dark", "ocean"],
  forest: ["dark", "forest"],
  sepia: ["light", "sepia"],
  "high-contrast": ["dark", "high-contrast"],
} as const;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const stored = localStorage.getItem("theme");
    if (stored && validThemes.includes(stored as Theme)) {
      setThemeState(stored as Theme);
    } else if (stored === "dark") {
      setThemeState("dim");
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const root = document.documentElement;
    root.classList.remove(...validThemes, "dark", "light");
    
    const themeClasses = THEME_CLASSES[theme];
    root.classList.add(...themeClasses);
    
    if (isInitialized) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, isInitialized]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
    isInitialized,
  }), [theme, setTheme, isInitialized]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
