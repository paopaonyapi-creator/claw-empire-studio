import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface AiSchedule {
  id: number; name: string; contentType: string; platform: string;
  scheduleTime: string; days: string[]; promptTemplate: string;
  status: string; lastRun: string; runCount: number;
}

const PLATFORMS = [
  { value: "facebook", icon: "📘", label: "Facebook" },
  { value: "tiktok", icon: "🎵", label: "TikTok" },
  { value: "telegram", icon: "📱", label: "Telegram" },
  { value: "instagram", icon: "📸", label: "Instagram" },
];

const DAYS = [
  { value: "mon", label: "จ" }, { value: "tue", label: "อ" },
  { value: "wed", label: "พ" }, { value: "thu", label: "พฤ" },
  { value: "fri", label: "ศ" }, { value: "sat", label: "ส" },
  { value: "sun", label: "อา" },
];

export function AiSchedulerWidget() {
  const { token, user } = useAuth();
  const [schedules, setSchedules] = useState<AiSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contentType: "post", platform: "facebook", scheduleTime: "09:00", days: ["mon", "wed", "fri"], promptTemplate: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-scheduler", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setSchedules(data.schedules);
    } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name) return;
    await fetch("/api/ai-scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setForm({ name: "", contentType: "post", platform: "facebook", scheduleTime: "09:00", days: ["mon", "wed", "fri"], promptTemplate: "" });
    setShowForm(false);
    load();
  };

  const toggleStatus = async (id: number, current: string) => {
    await fetch(`/api/ai-scheduler/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: current === "active" ? "paused" : "active" }),
    });
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/ai-scheduler/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const toggleDay = (d: string) => {
    setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }));
  };

  const isCeo = user?.role === "ceo";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>🤖</div>
        <h3 style={styles.title}>AI Content Scheduler</h3>
        <div style={{ flex: 1 }} />
        {isCeo && (
          <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
            {showForm ? "✕" : "➕"}
          </button>
        )}
      </div>

      {showForm && (
        <div style={styles.form}>
          <input placeholder="ชื่อ schedule (เช่น Morning Post)" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} style={styles.input} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} style={styles.input}>
              {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
            </select>
            <input type="time" value={form.scheduleTime} onChange={e => setForm({ ...form, scheduleTime: e.target.value })} style={styles.input} />
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {DAYS.map(d => (
              <button key={d.value} onClick={() => toggleDay(d.value)}
                style={{ ...styles.dayBtn, ...(form.days.includes(d.value) ? styles.dayActive : {}) }}>
                {d.label}
              </button>
            ))}
          </div>
          <textarea placeholder="Prompt template (optional)..." value={form.promptTemplate}
            onChange={e => setForm({ ...form, promptTemplate: e.target.value })}
            style={{ ...styles.input, marginTop: 8, minHeight: 50, resize: "vertical" }} />
          <button onClick={create} style={styles.saveBtn}>🤖 สร้าง Schedule</button>
        </div>
      )}

      <div style={styles.list}>
        {schedules.length === 0 ? (
          <div style={styles.empty}>📭 ยังไม่มี schedule — กด ➕ เพื่อสร้าง</div>
        ) : (
          schedules.map(s => {
            const plat = PLATFORMS.find(p => p.value === s.platform);
            return (
              <div key={s.id} style={styles.scheduleRow}>
                <div style={styles.scheduleIcon}>{plat?.icon || "📌"}</div>
                <div style={styles.scheduleContent}>
                  <div style={styles.scheduleName}>{s.name}</div>
                  <div style={styles.scheduleMeta}>
                    ⏰ {s.scheduleTime} • {s.days.join(",")} • {s.runCount} runs
                  </div>
                </div>
                <button onClick={() => toggleStatus(s.id, s.status)}
                  style={{ ...styles.statusBtn, background: s.status === "active" ? "#16a34a" : "#94a3b8" }}>
                  {s.status === "active" ? "▶" : "⏸"}
                </button>
                {isCeo && <button onClick={() => remove(s.id)} style={styles.delBtn}>🗑️</button>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBox: { fontSize: 22, background: "#ecfdf5", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  addBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  form: { background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12, border: "1px solid #e2e8f0" },
  input: { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" },
  dayBtn: { padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#64748b" },
  dayActive: { background: "#6366f1", color: "#fff", borderColor: "#6366f1" },
  saveBtn: { width: "100%", marginTop: 10, padding: "8px 0", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 },
  scheduleRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#fafbfc", border: "1px solid #f1f5f9" },
  scheduleIcon: { fontSize: 22, flexShrink: 0 },
  scheduleContent: { flex: 1, minWidth: 0 },
  scheduleName: { fontSize: 13, fontWeight: 600, color: "#1e293b" },
  scheduleMeta: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  statusBtn: { width: 28, height: 28, borderRadius: "50%", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  delBtn: { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, opacity: 0.4 },
};
