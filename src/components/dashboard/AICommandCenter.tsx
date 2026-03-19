/**
 * AI Command Center — Dashboard widget showing all AI provider status,
 * agent router, costs, A/B test, auto-pilot controls in one panel
 */

import { useState, useEffect, useCallback } from "react";

interface ProviderInfo {
  name: string;
  statusEmoji: string;
  status: string;
  latencyMs: number | null;
  configured: boolean;
  uptime: number;
}

interface RouteInfo {
  agentRole: string;
  taskType: string;
  primary: string;
  fallback: string;
  reason: string;
}

export default function AICommandCenter() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [rateLimits, setRateLimits] = useState<any>(null);
  const [costSummary, setCostSummary] = useState<any>(null);
  const [pulse, setPulse] = useState<any>(null);
  const [autopilotResult, setAutopilotResult] = useState<any>(null);
  const [abResult, setAbResult] = useState<any>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"overview" | "routes" | "tests" | "costs">("overview");

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, routesRes, limitsRes, costsRes, pulseRes] = await Promise.allSettled([
        fetch("/api/providers/health"),
        fetch("/api/agent-router/routes"),
        fetch("/api/rate-limits/status"),
        fetch("/api/costs/summary"),
        fetch("/api/realtime/pulse"),
      ]);

      if (healthRes.status === "fulfilled" && healthRes.value.ok) {
        const d = await healthRes.value.json();
        setProviders(d.providers || []);
      }
      if (routesRes.status === "fulfilled" && routesRes.value.ok) {
        const d = await routesRes.value.json();
        setRoutes(d.routes || []);
      }
      if (limitsRes.status === "fulfilled" && limitsRes.value.ok) {
        const d = await limitsRes.value.json();
        setRateLimits(d);
      }
      if (costsRes.status === "fulfilled" && costsRes.value.ok) {
        const d = await costsRes.value.json();
        setCostSummary(d);
      }
      if (pulseRes.status === "fulfilled" && pulseRes.value.ok) {
        const d = await pulseRes.value.json();
        setPulse(d.pulse);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAutopilot = async () => {
    setLoading(p => ({ ...p, autopilot: true }));
    try {
      const res = await fetch("/api/autopilot/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setAutopilotResult(data.run);
    } catch {}
    setLoading(p => ({ ...p, autopilot: false }));
  };

  const runABTest = async () => {
    setLoading(p => ({ ...p, abtest: true }));
    try {
      const res = await fetch("/api/ab-test/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "เขียน TikTok script สั้นๆ รีวิวหูฟัง Bluetooth", taskType: "tiktok-script" }),
      });
      const data = await res.json();
      setAbResult(data.test);
    } catch {}
    setLoading(p => ({ ...p, abtest: false }));
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
      borderRadius: 16,
      padding: 24,
      color: "#e0e0e0",
      border: "1px solid rgba(99,102,241,0.15)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🧠</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>AI Command Center</h3>
            <span style={{ fontSize: 12, color: "#888" }}>Multi-Provider Intelligence Hub</span>
          </div>
        </div>
        <button onClick={fetchData} style={{
          background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
          color: "#818cf8", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12
        }}>🔄 Refresh</button>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 4 }}>
        {(["overview", "routes", "tests", "costs"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "8px 0", border: "none", borderRadius: 8, cursor: "pointer",
            fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
            background: activeTab === tab ? "rgba(99,102,241,0.25)" : "transparent",
            color: activeTab === tab ? "#818cf8" : "#888",
          }}>
            {tab === "overview" ? "🏥 Overview" : tab === "routes" ? "🧭 Routes" : tab === "tests" ? "🧪 Tests" : "💰 Costs"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div>
          {/* Provider Status Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
            {providers.map(p => (
              <div key={p.name} style={{
                background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12,
                border: `1px solid ${p.status === "healthy" ? "rgba(34,197,94,0.2)" : p.status === "down" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)"}`,
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{p.statusEmoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", textTransform: "capitalize" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {p.latencyMs ? `${p.latencyMs}ms` : p.configured ? "Checking..." : "Not configured"}
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>Uptime: {p.uptime}%</div>
              </div>
            ))}
          </div>

          {/* System Pulse */}
          {pulse && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { label: "Agents", value: `${pulse.agents?.active || 0}/${pulse.agents?.total || 0}`, icon: "👥" },
                { label: "Tasks", value: pulse.tasks?.completed || 0, icon: "✅" },
                { label: "Providers", value: `${pulse.providers?.healthy || 0}/${pulse.providers?.total || 0}`, icon: "🏥" },
                { label: "Uptime", value: `${Math.round((pulse.uptime || 0) / 60)}m`, icon: "⏱️" },
              ].map(m => (
                <div key={m.label} style={{
                  background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 8px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 18 }}>{m.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{m.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Routes Tab */}
      {activeTab === "routes" && (
        <div style={{ maxHeight: 300, overflow: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th style={{ padding: 6, textAlign: "left", color: "#888" }}>Agent</th>
                <th style={{ padding: 6, textAlign: "left", color: "#888" }}>Task</th>
                <th style={{ padding: 6, textAlign: "left", color: "#888" }}>Primary</th>
                <th style={{ padding: 6, textAlign: "left", color: "#888" }}>Fallback</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: 6, color: "#c4b5fd" }}>{r.agentRole}</td>
                  <td style={{ padding: 6 }}>{r.taskType}</td>
                  <td style={{ padding: 6, color: "#34d399", fontSize: 10 }}>{r.primary}</td>
                  <td style={{ padding: 6, color: "#888", fontSize: 10 }}>{r.fallback}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tests Tab */}
      {activeTab === "tests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={runAutopilot} disabled={loading.autopilot} style={{
              flex: 1, padding: "12px 0", border: "none", borderRadius: 10, cursor: "pointer",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 13, fontWeight: 600,
              opacity: loading.autopilot ? 0.6 : 1,
            }}>
              {loading.autopilot ? "⏳ Running..." : "🤖 CEO Auto-Pilot"}
            </button>
            <button onClick={runABTest} disabled={loading.abtest} style={{
              flex: 1, padding: "12px 0", border: "none", borderRadius: 10, cursor: "pointer",
              background: "linear-gradient(135deg, #f59e0b, #ef4444)", color: "#fff", fontSize: 13, fontWeight: 600,
              opacity: loading.abtest ? 0.6 : 1,
            }}>
              {loading.abtest ? "⏳ Testing..." : "🎯 A/B Test"}
            </button>
          </div>
          {autopilotResult && (
            <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 10, padding: 12, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "#818cf8" }}>🤖 Auto-Pilot Result</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#ccc", fontSize: 11 }}>
                {autopilotResult.finalReport || JSON.stringify(autopilotResult.steps?.map((s: any) => `${s.step}: ${s.status}`), null, 2)}
              </pre>
            </div>
          )}
          {abResult && (
            <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 10, padding: 12, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "#f59e0b" }}>🎯 A/B Result — Winner: {abResult.winner}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#34d399" }}>A: {abResult.variantA?.provider} ({abResult.variantA?.score}pts)</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#60a5fa" }}>B: {abResult.variantB?.provider} ({abResult.variantB?.score}pts)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Costs Tab */}
      {activeTab === "costs" && (
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 8, textAlign: "center" }}>
            ${costSummary?.totalCost?.toFixed(4) || "0.0000"}
          </div>
          <div style={{ fontSize: 12, color: "#888", textAlign: "center", marginBottom: 16 }}>Total API Cost</div>
          {costSummary?.byProvider && Object.entries(costSummary.byProvider).map(([name, info]: any) => (
            <div key={name} style={{
              display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12,
            }}>
              <span style={{ color: "#c4b5fd", textTransform: "capitalize" }}>{name}</span>
              <span>${info.cost?.toFixed(4)} ({info.calls} calls)</span>
            </div>
          ))}
          {costSummary?.recommendations?.map((r: string, i: number) => (
            <div key={i} style={{ fontSize: 11, color: "#f59e0b", marginTop: 8 }}>{r}</div>
          ))}

          {/* Rate Limits */}
          {rateLimits?.limits && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 8 }}>⚡ Rate Limits</div>
              {rateLimits.limits.map((l: any) => (
                <div key={l.provider} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, width: 60, textTransform: "capitalize" }}>{l.provider}</span>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${l.utilizationPct}%`,
                      background: l.utilizationPct > 80 ? "#ef4444" : l.utilizationPct > 50 ? "#f59e0b" : "#34d399",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#888", width: 60, textAlign: "right" }}>{l.rpm}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
