import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface CalEvent { id: number; title: string; description: string; date: string; time: string; platform: string; contentType: string; status: string; color: string; }

const PLATFORMS: Record<string, string> = { facebook: "📘", tiktok: "🎵", telegram: "📱", instagram: "📸", youtube: "▶️" };
const STATUS_COLORS: Record<string, string> = { planned: "#6366f1", in_progress: "#f59e0b", published: "#16a34a", cancelled: "#94a3b8" };
const DAYS_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function ContentCalendarProWidget() {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", time: "09:00", platform: "facebook", description: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar?month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setEvents(data.events || []);
    } catch {}
  }, [token, month]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title || !form.date) return;
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setForm({ title: "", date: "", time: "09:00", platform: "facebook", description: "" });
    setShowForm(false);
    load();
  };

  const changeStatus = async (id: number, status: string) => {
    await fetch(`/api/calendar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/calendar/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  // Build calendar grid
  const [year, mon] = month.split("-").map(Number);
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const prevMonth = () => {
    const d = new Date(year, mon - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const d = new Date(year, mon, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const eventsMap = new Map<string, CalEvent[]>();
  for (const e of events) {
    const key = e.date;
    if (!eventsMap.has(key)) eventsMap.set(key, []);
    eventsMap.get(key)!.push(e);
  }

  const isCeo = user?.role === "ceo";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>📆</div>
        <h3 style={styles.title}>Content Calendar</h3>
        <div style={{ flex: 1 }} />
        <button onClick={prevMonth} style={styles.navBtn}>◀</button>
        <span style={styles.monthLabel}>{new Date(year, mon - 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })}</span>
        <button onClick={nextMonth} style={styles.navBtn}>▶</button>
        {isCeo && <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>{showForm ? "✕" : "➕"}</button>}
      </div>

      {showForm && (
        <div style={styles.form}>
          <div style={{ display: "flex", gap: 6 }}>
            <input placeholder="ชื่อ content..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...styles.input, flex: 1 }} />
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} style={{ ...styles.input, width: 90 }}>
              {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ ...styles.input, flex: 1 }} />
            <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ ...styles.input, width: 90 }} />
          </div>
          <button onClick={create} style={styles.saveBtn}>📆 สร้าง Event</button>
        </div>
      )}

      {/* Calendar Grid */}
      <div style={styles.calGrid}>
        {DAYS_TH.map(d => <div key={d} style={styles.dayHeader}>{d}</div>)}
        {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} style={styles.dayCell} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${month}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsMap.get(dateStr) || [];
          const isToday = dateStr === today;
          return (
            <div key={day} style={{ ...styles.dayCell, ...(isToday ? styles.todayCell : {}) }}>
              <div style={{ ...styles.dayNum, ...(isToday ? { color: "#6366f1", fontWeight: 800 } : {}) }}>{day}</div>
              {dayEvents.slice(0, 2).map(ev => (
                <div key={ev.id} style={{ ...styles.eventDot, background: STATUS_COLORS[ev.status] || "#6366f1" }}
                  title={`${PLATFORMS[ev.platform] || "📌"} ${ev.title} (${ev.time})`}>
                  {PLATFORMS[ev.platform] || "📌"}
                </div>
              ))}
              {dayEvents.length > 2 && <div style={styles.moreEvents}>+{dayEvents.length - 2}</div>}
            </div>
          );
        })}
      </div>

      {/* Upcoming Events */}
      {events.length > 0 && (
        <div style={styles.upcoming}>
          <div style={styles.upcomingTitle}>📋 Upcoming</div>
          {events.filter(e => e.date >= today).slice(0, 4).map(e => (
            <div key={e.id} style={styles.eventRow}>
              <span style={styles.eventPlatform}>{PLATFORMS[e.platform] || "📌"}</span>
              <div style={styles.eventInfo}>
                <div style={styles.eventName}>{e.title}</div>
                <div style={styles.eventMeta}>{e.date} • {e.time}</div>
              </div>
              <select value={e.status} onChange={ev => changeStatus(e.id, ev.target.value)}
                style={{ ...styles.statusSelect, color: STATUS_COLORS[e.status] || "#94a3b8" }}>
                <option value="planned">📝 Planned</option>
                <option value="in_progress">🔄 Working</option>
                <option value="published">✅ Published</option>
                <option value="cancelled">❌ Cancel</option>
              </select>
              {isCeo && <button onClick={() => remove(e.id)} style={styles.delBtn}>🗑️</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14 },
  iconBox: { fontSize: 22, background: "#ecfdf5", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  navBtn: { width: 28, height: 28, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 13, fontWeight: 700, color: "#475569", minWidth: 100, textAlign: "center" },
  addBtn: { width: 28, height: 28, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 12, marginLeft: 4 },
  form: { background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid #e2e8f0" },
  input: { padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" },
  saveBtn: { width: "100%", marginTop: 8, padding: "7px 0", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 14 },
  dayHeader: { textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", padding: "4px 0" },
  dayCell: { minHeight: 40, padding: 3, borderRadius: 4, background: "#fafbfc", textAlign: "center", position: "relative" },
  todayCell: { background: "#eef2ff", border: "1px solid #c7d2fe" },
  dayNum: { fontSize: 10, color: "#64748b", marginBottom: 2 },
  eventDot: { fontSize: 8, borderRadius: 3, padding: "0 2px", marginBottom: 1, display: "inline-block" },
  moreEvents: { fontSize: 8, color: "#6366f1", fontWeight: 700 },
  upcoming: { paddingTop: 10, borderTop: "1px solid #f1f5f9" },
  upcomingTitle: { fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 },
  eventRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "#fafbfc", marginBottom: 4 },
  eventPlatform: { fontSize: 18, flexShrink: 0 },
  eventInfo: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 12, fontWeight: 600, color: "#1e293b" },
  eventMeta: { fontSize: 10, color: "#94a3b8" },
  statusSelect: { fontSize: 10, border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 4px", background: "#fff", fontWeight: 600 },
  delBtn: { background: "transparent", border: "none", fontSize: 12, cursor: "pointer", opacity: 0.4 },
};
