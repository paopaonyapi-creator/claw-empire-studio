import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface Agent { id: string; name: string; department: string; avatar: string; tasksCompleted: number; tasksInProgress: number; totalTasks: number; completionRate: number; weeklyTrend: string; streak: number; }

export function TeamPerformanceWidget() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [summary, setSummary] = useState<any>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/team-performance", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) { setAgents(data.agents || []); setSummary(data.summary || {}); }
    } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const trendIcon = (t: string) => t === "up" ? "📈" : t === "down" ? "📉" : "➡️";
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>📋</div>
        <h3 style={styles.title}>Team Performance</h3>
        <span style={styles.badge}>{summary.totalAgents || 0} agents</span>
      </div>

      {/* Summary Row */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryItem}><div style={styles.sumVal}>{summary.totalCompleted || 0}</div><div style={styles.sumLabel}>Done</div></div>
        <div style={styles.summaryItem}><div style={styles.sumVal}>{summary.totalInProgress || 0}</div><div style={styles.sumLabel}>In Progress</div></div>
        <div style={styles.summaryItem}><div style={styles.sumVal}>{summary.avgCompletionRate || 0}%</div><div style={styles.sumLabel}>Avg Rate</div></div>
        <div style={styles.summaryItem}><div style={{ ...styles.sumVal, color: "#6366f1" }}>⭐ {summary.topPerformer || "N/A"}</div><div style={styles.sumLabel}>Top</div></div>
      </div>

      {/* Agent List */}
      <div style={styles.list}>
        {agents.length === 0 ? (
          <div style={styles.empty}>📋 ยังไม่มีข้อมูล agent</div>
        ) : (
          agents.slice(0, 8).map((a, i) => (
            <div key={a.id} style={styles.agentRow}>
              <span style={styles.rank}>{medals[i] || `#${i + 1}`}</span>
              <span style={styles.avatar}>{a.avatar}</span>
              <div style={styles.agentInfo}>
                <div style={styles.agentName}>{a.name}</div>
                <div style={styles.agentDept}>{a.department}</div>
              </div>
              <div style={styles.statsArea}>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${a.completionRate}%` }} />
                </div>
                <div style={styles.statText}>{a.completionRate}% • {a.tasksCompleted}/{a.totalTasks}</div>
              </div>
              <span style={styles.trend}>{trendIcon(a.weeklyTrend)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  iconBox: { fontSize: 22, background: "#eef2ff", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", flex: 1 },
  badge: { fontSize: 11, fontWeight: 600, background: "#6366f1", color: "#fff", padding: "3px 8px", borderRadius: 10 },
  summaryRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 },
  summaryItem: { textAlign: "center", background: "#fafbfc", borderRadius: 8, padding: "8px 4px", border: "1px solid #f1f5f9" },
  sumVal: { fontSize: 14, fontWeight: 800, color: "#1e293b" },
  sumLabel: { fontSize: 9, color: "#94a3b8", marginTop: 2 },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  empty: { textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 },
  agentRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "#fafbfc", border: "1px solid #f1f5f9" },
  rank: { fontSize: 16, width: 24, textAlign: "center", flexShrink: 0 },
  avatar: { fontSize: 20, flexShrink: 0 },
  agentInfo: { flex: "0 0 80px" },
  agentName: { fontSize: 12, fontWeight: 700, color: "#1e293b" },
  agentDept: { fontSize: 9, color: "#94a3b8" },
  statsArea: { flex: 1, minWidth: 0 },
  progressBar: { height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginBottom: 2 },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #818cf8, #6366f1)", borderRadius: 3, transition: "width 0.5s ease" },
  statText: { fontSize: 10, color: "#64748b", fontWeight: 500 },
  trend: { fontSize: 14, flexShrink: 0 },
};
