/**
 * AgentLeaderboard — Agent performance ranking for Dashboard
 */

import { useState, useEffect, useCallback } from "react";

interface Agent {
  id: string;
  name: string;
  dept?: string;
  tasks_done?: number;
  tasks_total?: number;
  success_rate?: number;
}

export function AgentLeaderboard() {
  const [agents, setAgents] = useState<Agent[]>([]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = (await res.json()) as { agents?: Agent[] };
        setAgents(data.agents || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // Sort by tasks done (descending)
  const ranked = [...agents]
    .map(a => ({
      ...a,
      done: a.tasks_done || 0,
      total: a.tasks_total || 0,
      rate: a.tasks_total && a.tasks_total > 0 ? Math.round(((a.tasks_done || 0) / a.tasks_total) * 100) : 0,
    }))
    .sort((a, b) => b.done - a.done);

  const top5 = ranked.slice(0, 5);
  const totalDone = ranked.reduce((s, a) => s + a.done, 0);
  const avgRate = ranked.length > 0 ? Math.round(ranked.reduce((s, a) => s + a.rate, 0) / ranked.length) : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🏆 Agent Leaderboard</h3>
        <span style={styles.badge}>{agents.length} agents</span>
      </div>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{totalDone}</div>
          <div style={styles.summaryLabel}>Tasks Done</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{avgRate}%</div>
          <div style={styles.summaryLabel}>Avg Success</div>
        </div>
      </div>

      <div style={styles.podium}>
        {top5.map((agent, i) => (
          <div key={agent.id} style={styles.agentRow}>
            <span style={styles.rankIcon}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </span>
            <div style={styles.agentInfo}>
              <div style={styles.agentName}>{agent.name}</div>
              <div style={styles.agentMeta}>
                {agent.dept && <span style={styles.deptTag}>{agent.dept}</span>}
                <span>{agent.done} tasks</span>
                {agent.rate > 0 && <span>• {agent.rate}%</span>}
              </div>
            </div>
            <div style={styles.rateCircle}>
              <svg width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="14" fill="none"
                  stroke={i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#cd7f32" : "#6366f1"}
                  strokeWidth="3"
                  strokeDasharray={`${(agent.rate / 100) * 88} 88`}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                />
              </svg>
              <span style={styles.rateText}>{agent.done}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" },
  badge: { fontSize: 11, color: "#f59e0b", background: "#fef3c7", padding: "2px 8px", borderRadius: 10, fontWeight: 600 },
  summaryRow: { display: "flex", gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, background: "linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)", borderRadius: 10, padding: "10px 12px", textAlign: "center" as const },
  summaryValue: { fontSize: 20, fontWeight: 800, color: "#f59e0b" },
  summaryLabel: { fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 2 },
  podium: { display: "flex", flexDirection: "column" as const, gap: 6 },
  agentRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#fafbfc" },
  rankIcon: { fontSize: 16, minWidth: 24, textAlign: "center" as const },
  agentInfo: { flex: 1, minWidth: 0 },
  agentName: { fontSize: 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" },
  agentMeta: { display: "flex", gap: 6, fontSize: 10, color: "#94a3b8", marginTop: 2 },
  deptTag: { background: "#ede9fe", color: "#6366f1", padding: "0 4px", borderRadius: 3, fontSize: 9, fontWeight: 600 },
  rateCircle: { position: "relative" as const, width: 32, height: 32 },
  rateText: { position: "absolute" as const, top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 9, fontWeight: 700, color: "#334155" },
};
