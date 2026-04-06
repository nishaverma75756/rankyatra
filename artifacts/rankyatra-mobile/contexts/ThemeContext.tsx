import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolvedTheme: "light",
  toggleTheme: () => {},
});

const STORAGE_KEY = "@rankyatra/theme_preference";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "light" || val === "dark" || val === "system") {
        setPreference(val);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference((prev) => {
      let next: ThemePreference;
      if (prev === "system") {
        next = systemScheme === "dark" ? "light" : "dark";
      } else if (prev === "light") {
        next = "dark";
      } else {
        next = "light";
      }
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, [systemScheme]);

  const resolvedTheme: ResolvedTheme =
    preference === "system"
      ? (systemScheme === "dark" ? "dark" : "light")
      : preference;

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
