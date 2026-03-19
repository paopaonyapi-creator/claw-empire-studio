import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

const CATEGORY_ICONS: Record<string, string> = {
  telegram: "📱", automation: "⚡", ai: "🤖", appearance: "🎨", general: "🏢", backup: "☁️",
};
const CATEGORY_LABELS: Record<string, string> = {
  telegram: "Telegram", automation: "Automation", ai: "AI Settings", appearance: "Appearance", general: "General", backup: "Backup",
};

export function SystemSettingsWidget() {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState<Record<string, any[]>>({});
  const [saving, setSaving] = useState("");
  const [msg, setMsg] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setSettings(data.settings);
    } catch {}
  }, [token]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const updateSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      await fetch(`/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value }),
      });
      setMsg(`✅ ${key} อัพเดทแล้ว`);
      loadSettings();
    } catch { setMsg("❌ Error"); }
    setSaving("");
    setTimeout(() => setMsg(""), 2000);
  };

  if (user?.role !== "ceo") return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>⚙️</div>
        <h3 style={styles.title}>System Settings</h3>
        {msg && <span style={styles.msg}>{msg}</span>}
      </div>

      {Object.entries(settings).map(([category, items]) => (
        <div key={category} style={styles.section}>
          <div style={styles.sectionTitle}>
            {CATEGORY_ICONS[category] || "📌"} {CATEGORY_LABELS[category] || category}
          </div>
          {items.map(item => (
            <div key={item.key} style={styles.row}>
              <div style={styles.label}>{item.label || item.key}</div>
              {item.type === "toggle" ? (
                <button
                  onClick={() => updateSetting(item.key, item.value === "on" ? "off" : "on")}
                  disabled={saving === item.key}
                  style={{ ...styles.toggle, background: item.value === "on" ? "#16a34a" : "#94a3b8" }}
                >
                  {item.value === "on" ? "ON" : "OFF"}
                </button>
              ) : item.type === "password" ? (
                <div style={styles.passwordVal}>{item.value}</div>
              ) : (
                <input
                  defaultValue={item.value}
                  onBlur={e => { if (e.target.value !== item.value) updateSetting(item.key, e.target.value); }}
                  style={styles.input}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  iconBox: { fontSize: 22, background: "#f1f5f9", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", flex: 1 },
  msg: { fontSize: 12, color: "#16a34a", fontWeight: 500 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid #f1f5f9" },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", gap: 12 },
  label: { fontSize: 13, color: "#475569", fontWeight: 500 },
  toggle: { padding: "4px 12px", borderRadius: 14, border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", minWidth: 48 },
  passwordVal: { fontSize: 13, color: "#94a3b8", fontFamily: "monospace" },
  input: { padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, width: 160, outline: "none", textAlign: "right" },
};
