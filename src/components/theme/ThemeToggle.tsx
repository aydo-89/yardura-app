"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-3 shadow-soft dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100/40 dark:bg-emerald-500/10">
          <motion.span
            key={theme}
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="text-emerald-400"
            aria-hidden
          >
            {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </motion.span>
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Appearance</p>
          <p className="text-xs text-muted-foreground">
            Switch between light and dark modes anytime.
          </p>
        </div>
      </div>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label="Toggle dark mode"
        className="data-[state=checked]:bg-emerald-400"
      />
    </div>
  );
}
