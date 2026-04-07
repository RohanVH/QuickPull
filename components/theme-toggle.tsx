"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    const saved = window.localStorage.getItem("quickpull-theme");
    const initial = saved === "light" ? "light" : "dark";
    root.classList.toggle("light", initial === "light");
    setTheme(initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("light", next === "light");
    window.localStorage.setItem("quickpull-theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="glass-panel inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm text-[var(--foreground)] transition hover:scale-[1.03]"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
