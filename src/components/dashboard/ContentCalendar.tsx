/**
 * ContentCalendar — Weekly content scheduling grid
 */

import { useState, useEffect, useCallback } from "react";

interface CalendarEntry {
  id: string;
  day: string;
  time: string;
  platform: string;
  productName: string;
  status: "scheduled" | "posted" | "skipped";
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun",
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#ff0050",
  facebook: "#1877f2",
  instagram: "#e4405f",
  shopee: "#ee4d2d",
  lazada: "#0f146d",
};

export function ContentCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [weekOf, setWeekOf] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const json = await res.json();
        setEntries(json.entries || []);
        setWeekOf(json.weekOf || "");
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const getEntriesForDay = (day: string) =>
    entries.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time));

  const today = new Date();
  const todayDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][today.getDay()];

  return (
    <div className="calendar-widget" style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📅 Content Calendar</h2>
        <span style={styles.weekLabel}>Week: {weekOf || "—"}</span>
      </div>

      {loading ? (
        <div style={styles.loading}>⏳ Loading...</div>
      ) : (
        <div className="calendar-grid-7" style={styles.grid}>
          {DAYS.map((day) => {
            const dayEntries = getEntriesForDay(day);
            const isToday = day === todayDay;

            return (
              <div
                key={day}
                className={`calendar-day-col ${isToday ? 'calendar-day-today' : ''}`}
                style={{
                  ...styles.dayCol,
                  ...(isToday ? styles.dayColToday : {}),
                }}
              >
                <div className={isToday ? 'calendar-day-header-today' : 'calendar-day-header'} style={{
                  ...styles.dayHeader,
                  ...(isToday ? styles.dayHeaderToday : {}),
                }}>
                  {DAY_LABELS[day]}
                </div>

                <div style={styles.dayBody}>
                  {dayEntries.length === 0 ? (
                    <div style={styles.emptySlot}>—</div>
                  ) : (
                    dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          ...styles.entryCard,
                          borderLeft: `3px solid ${PLATFORM_COLORS[entry.platform] || "#94a3b8"}`,
                        }}
                      >
                        <div style={styles.entryTime}>{entry.time}</div>
                        <div style={styles.entryProduct}>{entry.productName}</div>
                        <div style={styles.entryMeta}>
                          <span style={{
                            ...styles.platformTag,
                            background: PLATFORM_COLORS[entry.platform] || "#94a3b8",
                          }}>
                            {entry.platform}
                          </span>
                          <span style={styles.statusIcon}>
                            {entry.status === "posted" ? "✅" : entry.status === "skipped" ? "⏭️" : "⏰"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div style={styles.empty}>
          📭 ยังไม่มีตาราง — ใช้ /schedule add &lt;วัน&gt; &lt;เวลา&gt; &lt;สินค้า&gt;
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff", borderRadius: 14, padding: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" },
  weekLabel: { fontSize: 11, color: "#94a3b8", fontWeight: 500 },
  loading: { textAlign: "center" as const, padding: 30, color: "#94a3b8" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  dayCol: {
    borderRadius: 8, overflow: "hidden", background: "#f8fafc",
    minHeight: 120, display: "flex", flexDirection: "column" as const,
  },
  dayColToday: { background: "#eff6ff", boxShadow: "0 0 0 2px #3b82f6" },
  dayHeader: {
    padding: "6px 0", textAlign: "center" as const, fontSize: 11, fontWeight: 700,
    color: "#64748b", background: "#f1f5f9", textTransform: "uppercase" as const,
  },
  dayHeaderToday: { background: "#3b82f6", color: "#fff" },
  dayBody: { padding: 4, flex: 1, display: "flex", flexDirection: "column" as const, gap: 3 },
  emptySlot: { textAlign: "center" as const, color: "#cbd5e1", padding: 8, fontSize: 12 },
  entryCard: {
    padding: "5px 6px", borderRadius: 5, background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  entryTime: { fontSize: 10, color: "#64748b", fontWeight: 600 },
  entryProduct: {
    fontSize: 11, fontWeight: 600, color: "#1e293b", marginTop: 1,
    whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
  },
  entryMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  platformTag: {
    fontSize: 8, color: "#fff", padding: "1px 4px", borderRadius: 3,
    fontWeight: 600, textTransform: "uppercase" as const,
  },
  statusIcon: { fontSize: 10 },
  empty: { textAlign: "center" as const, padding: 20, color: "#94a3b8", fontSize: 12, marginTop: 8 },
};
