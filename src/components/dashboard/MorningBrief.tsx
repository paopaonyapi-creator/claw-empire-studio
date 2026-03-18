/**
 * MorningBrief — CEO daily summary widget with Export button
 */

import { useState, useEffect, useCallback } from "react";

interface BriefData {
  date: string;
  greeting: string;
  tasks: { total: number; done: number; inProgress: number; pending: number };
  revenue: { today: number; week: number; month: number; topProduct: string };
  calendar: { scheduledToday: number; entries: Array<{ time: string; product: string; platform: string }> };
  agents: { total: number; working: number; topAgent: string };
}

export function MorningBrief() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBrief = useCallback(async () => {
    try {
      const res = await fetch("/api/brief");
      if (res.ok) setBrief(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBrief(); }, [fetchBrief]);

  const openReport = () => {
    window.open("/api/report/pdf", "_blank");
  };

  if (loading) return null;
  if (!brief) return null;

  return (
    <div className="morning-brief-widget" style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{brief.greeting}, Boss! 👋</h2>
          <div style={styles.date}>{brief.date}</div>
        </div>
        <button onClick={openReport} style={styles.exportBtn}>
          📄 Export Report
        </button>
      </div>

      <div className="dashboard-2col-grid" style={styles.grid}>
        {/* Tasks Summary */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>📋 Tasks</div>
          <div style={styles.miniGrid}>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#10b981" }}>{brief.tasks.done}</div>
              <div style={styles.miniLabel}>Done</div>
            </div>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#f59e0b" }}>{brief.tasks.inProgress}</div>
              <div style={styles.miniLabel}>Active</div>
            </div>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#6366f1" }}>{brief.tasks.pending}</div>
              <div style={styles.miniLabel}>Queue</div>
            </div>
          </div>
        </div>

        {/* Revenue Summary */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>💰 Revenue</div>
          <div style={styles.miniGrid}>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#f59e0b" }}>฿{brief.revenue.today.toLocaleString()}</div>
              <div style={styles.miniLabel}>Today</div>
            </div>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#10b981" }}>฿{brief.revenue.week.toLocaleString()}</div>
              <div style={styles.miniLabel}>7d</div>
            </div>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#8b5cf6" }}>฿{brief.revenue.month.toLocaleString()}</div>
              <div style={styles.miniLabel}>Month</div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>📅 Today's Schedule</div>
          {brief.calendar.scheduledToday === 0 ? (
            <div style={styles.emptyMsg}>📭 ไม่มี post วันนี้</div>
          ) : (
            brief.calendar.entries.slice(0, 3).map((e, i) => (
              <div key={i} style={styles.scheduleRow}>
                <span>⏰ {e.time}</span>
                <span style={styles.scheduleProduct}>{e.product}</span>
                <span style={styles.schedulePlatform}>{e.platform}</span>
              </div>
            ))
          )}
        </div>

        {/* Agents */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>🤖 Agents</div>
          <div style={styles.miniGrid}>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#10b981" }}>{brief.agents.working}</div>
              <div style={styles.miniLabel}>Active</div>
            </div>
            <div style={styles.miniStat}>
              <div style={styles.miniVal}>{brief.agents.total}</div>
              <div style={styles.miniLabel}>Total</div>
            </div>
            <div style={styles.miniStat}>
              <div style={{ ...styles.miniVal, color: "#f59e0b", fontSize: 12 }}>{brief.agents.topAgent}</div>
              <div style={styles.miniLabel}>🏆 Top</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 14, padding: 20, marginBottom: 20,
    background: "var(--th-card-bg, rgba(16,16,42,0.65))",
    border: "1px solid var(--th-card-border, rgba(50,50,95,0.35))",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "var(--th-text-heading, #f1f5f9)" },
  date: { fontSize: 12, color: "var(--th-text-muted, #64748b)", marginTop: 2 },
  exportBtn: {
    padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8,
    border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.15)",
    color: "#a5b4fc", cursor: "pointer", whiteSpace: "nowrap" as const,
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  card: {
    padding: 14, borderRadius: 10,
    background: "var(--th-bg-surface, rgba(22,22,48,0.75))",
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
  },
  cardLabel: { fontSize: 12, fontWeight: 700, color: "var(--th-text-secondary, #94a3b8)", marginBottom: 10 },
  miniGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 },
  miniStat: { textAlign: "center" as const },
  miniVal: { fontSize: 16, fontWeight: 800, color: "var(--th-text-heading, #f1f5f9)" },
  miniLabel: { fontSize: 9, color: "var(--th-text-muted, #64748b)", textTransform: "uppercase" as const, marginTop: 2 },
  emptyMsg: { textAlign: "center" as const, color: "var(--th-text-muted, #64748b)", fontSize: 12, padding: 8 },
  scheduleRow: { display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0", color: "var(--th-text-primary, #e2e8f0)" },
  scheduleProduct: { flex: 1, fontWeight: 600 },
  schedulePlatform: { fontSize: 10, color: "var(--th-text-muted, #64748b)" },
};
