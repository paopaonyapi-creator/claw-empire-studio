/**
 * Performance Charts — 7-day task completion, agent productivity, pipeline
 * Uses CSS-only charts (no chart library needed)
 */

import { useEffect, useState } from "react";

interface ChartData {
  daily_completion: Array<{ date: string; done: number; created: number }>;
  agent_productivity: Array<{ name: string; total_done: number; xp: number; week_done: number }>;
  pipeline_throughput: Record<string, number>;
  status_distribution: Array<{ status: string; cnt: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  done: "#10b981",
  in_progress: "#f59e0b",
  inbox: "#6366f1",
  review: "#3b82f6",
  planned: "#8b5cf6",
  failed: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  done: "✅ Done",
  in_progress: "🔄 In Progress",
  inbox: "📥 Inbox",
  review: "🔍 Review",
  planned: "📝 Planned",
  failed: "❌ Failed",
};

export function PerformanceCharts() {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        const res = await fetch("/api/dashboard/charts");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchCharts();
    const interval = setInterval(fetchCharts, 120_000); // 2 min refresh
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>📊 PERFORMANCE CHARTS</div>
        <div style={styles.loading}>Loading charts...</div>
      </div>
    );
  }

  if (!data) return null;

  const maxCreated = Math.max(...data.daily_completion.map((d) => Math.max(d.done, d.created)), 1);
  const maxAgentDone = Math.max(...data.agent_productivity.map((a) => a.week_done), 1);
  const totalTasks = data.status_distribution.reduce((sum, s) => sum + s.cnt, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>📊 PERFORMANCE CHARTS</div>

      <div style={styles.chartsGrid}>
        {/* 7-Day Task Completion */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>📈 7-Day Task Flow</div>
          <div style={styles.barChart}>
            {data.daily_completion.map((day) => (
              <div key={day.date} style={styles.barGroup}>
                <div style={styles.barStack}>
                  <div
                    style={{
                      ...styles.bar,
                      height: `${(day.done / maxCreated) * 80}px`,
                      backgroundColor: "#10b981",
                    }}
                    title={`Done: ${day.done}`}
                  />
                  <div
                    style={{
                      ...styles.bar,
                      height: `${(day.created / maxCreated) * 80}px`,
                      backgroundColor: "#6366f1",
                      opacity: 0.6,
                    }}
                    title={`Created: ${day.created}`}
                  />
                </div>
                <div style={styles.barLabel}>{day.date.slice(5)}</div>
              </div>
            ))}
          </div>
          <div style={styles.legend}>
            <span style={{ ...styles.legendDot, backgroundColor: "#10b981" }} /> Done
            <span style={{ ...styles.legendDot, backgroundColor: "#6366f1", marginLeft: 12 }} /> Created
          </div>
        </div>

        {/* Status Distribution */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>🎯 Task Status</div>
          <div style={styles.statusList}>
            {data.status_distribution.map((s) => (
              <div key={s.status} style={styles.statusRow}>
                <div style={styles.statusLabel}>
                  {STATUS_LABELS[s.status] || s.status}
                </div>
                <div style={styles.statusBarBg}>
                  <div
                    style={{
                      ...styles.statusBarFill,
                      width: `${totalTasks > 0 ? (s.cnt / totalTasks) * 100 : 0}%`,
                      backgroundColor: STATUS_COLORS[s.status] || "#94a3b8",
                    }}
                  />
                </div>
                <div style={styles.statusCount}>{s.cnt}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Productivity */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>🤖 Agent Productivity (7 days)</div>
          <div style={styles.agentList}>
            {data.agent_productivity.slice(0, 5).map((agent, i) => (
              <div key={agent.name} style={styles.agentRow}>
                <div style={styles.agentRank}>#{i + 1}</div>
                <div style={styles.agentName}>{agent.name}</div>
                <div style={styles.agentBarBg}>
                  <div
                    style={{
                      ...styles.agentBarFill,
                      width: `${(agent.week_done / maxAgentDone) * 100}%`,
                    }}
                  />
                </div>
                <div style={styles.agentCount}>{agent.week_done}</div>
              </div>
            ))}
            {data.agent_productivity.length === 0 && (
              <div style={styles.noData}>No agent activity yet</div>
            )}
          </div>
        </div>

        {/* Pipeline Throughput */}
        <div style={styles.chartCard}>
          <div style={styles.chartTitle}>🔄 Pipeline (7 days)</div>
          <div style={styles.pipelineGrid}>
            {Object.entries(data.pipeline_throughput).map(([key, value]) => (
              <div key={key} style={styles.pipelineItem}>
                <div style={styles.pipelineIcon}>
                  {key === "trends" ? "🔍" : key === "scripts" ? "✍️" : key === "thumbnails" ? "🎨" : "📋"}
                </div>
                <div style={styles.pipelineValue}>{value}</div>
                <div style={styles.pipelineLabel}>{key}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    margin: "16px 0",
    padding: 0,
  },
  header: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "#b45309",
    marginBottom: 12,
    textTransform: "uppercase" as const,
  },
  loading: {
    padding: "20px",
    textAlign: "center" as const,
    color: "#94a3b8",
    fontSize: 13,
  },
  chartsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  chartCard: {
    background: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    padding: "16px",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 12,
    color: "#334155",
  },
  barChart: {
    display: "flex",
    alignItems: "flex-end",
    gap: 6,
    height: 100,
    paddingBottom: 20,
  },
  barGroup: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  barStack: {
    display: "flex",
    gap: 2,
    alignItems: "flex-end",
  },
  bar: {
    width: 12,
    borderRadius: "3px 3px 0 0",
    transition: "height 0.3s ease",
    minHeight: 2,
  },
  barLabel: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 4,
  },
  legend: {
    display: "flex",
    alignItems: "center",
    fontSize: 11,
    color: "#64748b",
    marginTop: 8,
  },
  legendDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    marginRight: 4,
  },
  statusList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  statusLabel: {
    fontSize: 12,
    width: 100,
    color: "#475569",
    flexShrink: 0,
  },
  statusBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  statusBarFill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.3s ease",
  },
  statusCount: {
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    width: 24,
    textAlign: "right" as const,
  },
  agentList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  agentRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  agentRank: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    width: 20,
  },
  agentName: {
    fontSize: 12,
    color: "#334155",
    width: 100,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  agentBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  agentBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#f59e0b",
    transition: "width 0.3s ease",
  },
  agentCount: {
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    width: 20,
    textAlign: "right" as const,
  },
  noData: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center" as const,
    padding: 12,
  },
  pipelineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  pipelineItem: {
    textAlign: "center" as const,
    padding: 8,
    background: "#f8fafc",
    borderRadius: 8,
  },
  pipelineIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  pipelineValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#334155",
  },
  pipelineLabel: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "capitalize" as const,
  },
};
