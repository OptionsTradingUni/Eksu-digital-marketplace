import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dim" | "lights-out";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dim" || stored === "lights-out") {
      return stored;
    }
    if (stored === "dark") {
      return "dim";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark", "dim", "lights-out");
    
    if (theme === "light") {
      root.classList.add("light");
    } else if (theme === "dim") {
      root.classList.add("dark", "dim");
    } else if (theme === "lights-out") {
      root.classList.add("dark", "lights-out");
    }
    
    localStorage.setItem("theme", theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
