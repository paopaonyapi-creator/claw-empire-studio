import { useState, useEffect } from "react";

interface AgentPerf {
  rank: number;
  agentName: string;
  tierEmoji: string;
  tierLabel: string;
  score: number;
  stats: {
    tasksDone: number;
    xp: number;
    completionRate: number;
    streak: number;
  };
}

export default function AgentPerformanceWidget() {
  const [agents, setAgents] = useState<AgentPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent-performance")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setAgents(data.agents || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <section style={{ background: "var(--th-bg-surface)", borderRadius: 16, padding: 20, border: "1px solid var(--th-border)" }}>
        <h3 style={{ color: "var(--th-text-heading)", margin: "0 0 12px" }}>🏆 Agent Leaderboard</h3>
        <div style={{ color: "var(--th-text-muted)", fontSize: 13 }}>กำลังโหลด...</div>
      </section>
    );

  return (
    <section
      style={{ background: "var(--th-bg-surface)", borderRadius: 16, padding: 20, border: "1px solid var(--th-border)" }}
    >
      <h3 style={{ color: "var(--th-text-heading)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
        🏆 Agent Leaderboard
        <span style={{ fontSize: 11, color: "var(--th-text-muted)", fontWeight: 400 }}>
          Performance Ranking
        </span>
      </h3>

      <div style={{ display: "grid", gap: 8 }}>
        {agents.slice(0, 10).map((agent) => (
          <div
            key={agent.rank}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: agent.rank <= 3 ? "var(--th-bg-elevated)" : "transparent",
              border: agent.rank <= 3 ? "1px solid var(--th-border)" : "1px solid transparent",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: agent.rank <= 3 ? 16 : 12,
                fontWeight: 700,
                background: agent.rank === 1 ? "#fbbf24" : agent.rank === 2 ? "#94a3b8" : agent.rank === 3 ? "#d97706" : "var(--th-bg-elevated)",
                color: agent.rank <= 3 ? "#000" : "var(--th-text-muted)",
              }}
            >
              {agent.rank <= 3 ? ["🥇", "🥈", "🥉"][agent.rank - 1] : agent.rank}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--th-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.agentName}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 8,
                    background: agent.tierLabel === "Legend" ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
                      : agent.tierLabel === "Elite" ? "linear-gradient(90deg,#8b5cf6,#6366f1)"
                      : agent.tierLabel === "Pro" ? "linear-gradient(90deg,#3b82f6,#2563eb)"
                      : "var(--th-bg-elevated)",
                    color: agent.tierLabel === "Rookie" ? "var(--th-text-muted)" : "#fff",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {agent.tierEmoji} {agent.tierLabel}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--th-text-muted)", marginTop: 2 }}>
                ✅ {agent.stats.tasksDone} tasks · 🔥 {agent.stats.streak} streak · {agent.stats.completionRate}% rate
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--th-text-heading)" }}>{agent.score}</div>
              <div style={{ fontSize: 9, color: "var(--th-text-muted)" }}>pts</div>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--th-text-muted)", fontSize: 13 }}>
            ยังไม่มีข้อมูล Agent
          </div>
        )}
      </div>
    </section>
  );
}
