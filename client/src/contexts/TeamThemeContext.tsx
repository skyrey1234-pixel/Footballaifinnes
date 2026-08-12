import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type TeamTheme = {
  schoolName: string;
  primaryColor: string;
  secondaryColor: string;
  saving: boolean;
  saveTheme: (theme: { schoolName: string; primaryColor: string; secondaryColor: string }) => Promise<void>;
};

const DEFAULT_THEME = {
  schoolName: "Your Program",
  primaryColor: "#006778",
  secondaryColor: "#D7A22A",
};

const TeamThemeContext = createContext<TeamTheme | undefined>(undefined);

function getForeground(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#102A56" : "#FFFFFF";
}

function applyTeamTheme(primaryColor: string, secondaryColor: string) {
  const root = document.documentElement;
  root.style.setProperty("--school-primary", primaryColor);
  root.style.setProperty("--school-secondary", secondaryColor);
  root.style.setProperty("--school-primary-foreground", getForeground(primaryColor));
  root.style.setProperty("--school-secondary-foreground", getForeground(secondaryColor));
  root.style.setProperty("--primary", primaryColor);
  root.style.setProperty("--primary-foreground", getForeground(primaryColor));
  root.style.setProperty("--ring", primaryColor);
  root.style.setProperty("--sidebar-primary", secondaryColor);
  root.style.setProperty("--sidebar-primary-foreground", getForeground(secondaryColor));
}

export function TeamThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data } = trpc.branding.get.useQuery(undefined, { enabled: isAuthenticated });
  const saveMutation = trpc.branding.update.useMutation();
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    if (!data) return;
    setTheme({
      schoolName: data.schoolName || DEFAULT_THEME.schoolName,
      primaryColor: data.schoolPrimaryColor || DEFAULT_THEME.primaryColor,
      secondaryColor: data.schoolSecondaryColor || DEFAULT_THEME.secondaryColor,
    });
  }, [data]);

  useEffect(() => {
    applyTeamTheme(theme.primaryColor, theme.secondaryColor);
  }, [theme.primaryColor, theme.secondaryColor]);

  const value = useMemo<TeamTheme>(() => ({
    ...theme,
    saving: saveMutation.isPending,
    saveTheme: async (nextTheme) => {
      const optimistic = {
        schoolName: nextTheme.schoolName || DEFAULT_THEME.schoolName,
        primaryColor: nextTheme.primaryColor.toUpperCase(),
        secondaryColor: nextTheme.secondaryColor.toUpperCase(),
      };
      setTheme(optimistic);
      await saveMutation.mutateAsync({
        schoolName: optimistic.schoolName,
        schoolPrimaryColor: optimistic.primaryColor,
        schoolSecondaryColor: optimistic.secondaryColor,
      });
      await utils.branding.get.invalidate();
    },
  }), [saveMutation, theme, utils.branding.get]);

  return <TeamThemeContext.Provider value={value}>{children}</TeamThemeContext.Provider>;
}

export function useTeamTheme() {
  const context = useContext(TeamThemeContext);
  if (!context) throw new Error("useTeamTheme must be used within TeamThemeProvider");
  return context;
}

export const TEAM_PALETTES = [
  { name: "Jaguars Teal", primary: "#006778", secondary: "#D7A22A" },
  { name: "Crimson Night", primary: "#9E1B32", secondary: "#0D1B2A" },
  { name: "Purple Reign", primary: "#4C1D95", secondary: "#F4C542" },
  { name: "Forest Edge", primary: "#166534", secondary: "#F8FAFC" },
  { name: "Orange Rush", primary: "#C2410C", secondary: "#102A56" },
  { name: "Cardinal Steel", primary: "#BE123C", secondary: "#CBD5E1" },
] as const;
