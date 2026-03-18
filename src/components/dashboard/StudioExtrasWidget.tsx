import { useState, useEffect, useCallback } from "react";

interface PipelineItem {
  id: string;
  topic: string;
  hookLine: string;
  status: "draft" | "posted" | "scheduled";
  created: string;
}

interface TeamMember {
  name: string;
  role: string;
}

interface AbTest {
  id: string;
  variantA: string;
  variantB: string;
  metricsA: { clicks: number };
  metricsB: { clicks: number };
  status: string;
  winner?: string;
}

export default function StudioExtrasWidget() {
  const [pipelines, setPipelines] = useState<PipelineItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [abTests, setAbTests] = useState<AbTest[]>([]);

  const load = useCallback(async () => {
    try {
      const [pRes, tRes, aRes] = await Promise.allSettled([
        fetch("/api/pipelines").then((r) => r.json()),
        fetch("/api/team").then((r) => r.json()),
        fetch("/api/ab-tests").then((r) => r.json()),
      ]);
      if (pRes.status === "fulfilled") setPipelines((pRes.value as { pipelines?: PipelineItem[] }).pipelines || []);
      if (tRes.status === "fulfilled") setTeam((tRes.value as { members?: TeamMember[] }).members || []);
      if (aRes.status === "fulfilled") setAbTests((aRes.value as { tests?: AbTest[] }).tests || []);
    } catch {}
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, [load]);

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: "16px 20px",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 12,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 16 }}>
      {/* Content Pipeline */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>🚀 Content Pipeline</span>
          <span style={{ fontSize: 12, opacity: 0.5 }}>{pipelines.length} items</span>
        </div>
        {pipelines.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: 13 }}>ยังไม่มี pipeline — ใช้ /pipeline &lt;หัวข้อ&gt;</p>
        ) : (
          pipelines.slice(0, 4).map((p) => (
            <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 500 }}>{p.topic}</span>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 8,
                  background: p.status === "posted" ? "rgba(34,197,94,0.15)" : p.status === "scheduled" ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.05)",
                  color: p.status === "posted" ? "#22c55e" : p.status === "scheduled" ? "#eab308" : "#888",
                }}>
                  {p.status === "posted" ? "✅" : p.status === "scheduled" ? "⏰" : "📝"} {p.status}
                </span>
              </div>
              <div style={{ opacity: 0.5, fontSize: 12, marginTop: 2 }}>{p.hookLine?.substring(0, 50)}...</div>
            </div>
          ))
        )}
      </div>

      {/* A/B Tests */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>🧪 A/B Tests</span>
          <span style={{ fontSize: 12, opacity: 0.5 }}>{abTests.length} tests</span>
        </div>
        {abTests.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: 13 }}>ยังไม่มี A/B tests — ใช้ /ab create A | B</p>
        ) : (
          abTests.slice(0, 3).map((t) => (
            <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{t.id}</span>
                {t.winner && <span style={{ color: "#eab308", fontSize: 11 }}>🏆 {t.winner}</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(99,102,241,0.1)", borderRadius: 6, padding: "4px 8px", fontSize: 11 }}>
                  🅰️ {t.metricsA.clicks} votes
                </div>
                <div style={{ flex: 1, background: "rgba(236,72,153,0.1)", borderRadius: 6, padding: "4px 8px", fontSize: 11 }}>
                  🅱️ {t.metricsB.clicks} votes
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Team Members */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>👥 Team</span>
          <span style={{ fontSize: 12, opacity: 0.5 }}>{team.length} members</span>
        </div>
        {team.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: 13 }}>ยังไม่มีทีม — ใช้ /team add &lt;name&gt; &lt;role&gt;</p>
        ) : (
          team.slice(0, 5).map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <span>{m.role === "admin" ? "👑" : m.role === "editor" ? "✏️" : "👁️"} {m.name}</span>
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 8,
                background: m.role === "admin" ? "rgba(234,179,8,0.15)" : "rgba(255,255,255,0.05)",
                color: m.role === "admin" ? "#eab308" : "#888",
              }}>{m.role}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
