/**
 * ThemeToggle — Inline button using existing ThemeContext
 */
import React from "react";
import { useTheme } from "../ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "สลับเป็น Light Mode" : "สลับเป็น Dark Mode"}
      style={{
        background: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
        border: "1px solid " + (theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"),
        borderRadius: 10,
        padding: "6px 14px",
        cursor: "pointer",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: theme === "dark" ? "#fbbf24" : "#64748b",
        fontWeight: 600,
        transition: "all 0.3s ease",
      }}
    >
      {theme === "dark" ? "🌙" : "☀️"}
      <span style={{ fontSize: 12 }}>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
