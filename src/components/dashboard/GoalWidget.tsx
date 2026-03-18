/**
 * GoalWidget — Progress bars for revenue/content/clicks targets
 */
import { useState, useEffect, useCallback } from "react";

interface Goal {
  id: string; metric: string; target: number; period: string;
  current: number; progress: number; icon: string;
}

export function GoalWidget() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [metric, setMetric] = useState("revenue");
  const [target, setTarget] = useState("");
  const [period, setPeriod] = useState("month");

  const fetch_ = useCallback(async () => {
    try { const r = await fetch("/api/goals"); if (r.ok) { const j = await r.json(); setGoals(j.goals || []); } } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const addGoal = async () => {
    if (!target) return;
    await fetch("/api/goals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric, target: Number(target), period }),
    });
    setTarget(""); setShowForm(false); fetch_();
  };

  if (loading) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🎯 Goals</h2>
        <button style={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? "✕" : "＋"} 
        </button>
      </div>

      {showForm && (
        <div style={styles.form}>
          <select style={styles.sel} value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="revenue">💰 Revenue</option>
            <option value="content">📝 Content</option>
            <option value="clicks">🔗 Clicks</option>
            <option value="tasks">📋 Tasks</option>
          </select>
          <input style={styles.inp} type="number" placeholder="Target" value={target} onChange={(e) => setTarget(e.target.value)} />
          <select style={styles.sel} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <button style={styles.saveBtn} onClick={addGoal}>✅</button>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div style={styles.empty}>กดปุ่ม ＋ เพื่อตั้งเป้าหมาย</div>
      )}

      {goals.map((g) => {
        const clr = g.progress >= 100 ? "#10b981" : g.progress >= 50 ? "#f59e0b" : "#6366f1";
        return (
          <div key={g.id} style={styles.goalCard}>
            <div style={styles.goalHeader}>
              <span>{g.icon} {g.metric}</span>
              <span style={styles.goalPeriod}>/{g.period}</span>
            </div>
            <div style={styles.barBg}>
              <div style={{ ...styles.barFill, width: `${Math.min(100, g.progress)}%`, background: clr }} />
            </div>
            <div style={styles.goalStats}>
              <span style={{ color: clr, fontWeight: 800 }}>{g.current.toLocaleString()}</span>
              <span style={styles.goalTarget}>/ {g.target.toLocaleString()}</span>
              <span style={{ color: clr, fontWeight: 700, fontSize: 11 }}>
                {g.progress >= 100 ? "🎉" : `${g.progress}%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 14, padding: 16, marginBottom: 20,
    background: "linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(16,185,129,0.08) 100%)",
    border: "1px solid rgba(245,158,11,0.2)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "var(--th-text-heading, #f1f5f9)" },
  addBtn: {
    width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(245,158,11,0.4)",
    background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontSize: 14,
    cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
  },
  form: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" as const },
  sel: {
    padding: "5px 8px", borderRadius: 6, fontSize: 12,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-input-bg, rgba(16,16,42,0.85))", color: "var(--th-text-primary, #e2e8f0)",
  },
  inp: {
    width: 80, padding: "5px 8px", borderRadius: 6, fontSize: 12,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-input-bg, rgba(16,16,42,0.85))", color: "var(--th-text-primary, #e2e8f0)",
  },
  saveBtn: {
    padding: "5px 12px", borderRadius: 6, fontSize: 12, border: "none",
    background: "#10b981", color: "#fff", cursor: "pointer", fontWeight: 700,
  },
  empty: { textAlign: "center" as const, color: "var(--th-text-muted, #64748b)", fontSize: 12, padding: 8 },
  goalCard: {
    padding: 10, borderRadius: 8, marginBottom: 6,
    background: "var(--th-card-bg, rgba(16,16,42,0.65))",
    border: "1px solid var(--th-card-border, rgba(50,50,95,0.35))",
  },
  goalHeader: { display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--th-text-primary, #e2e8f0)", marginBottom: 6 },
  goalPeriod: { fontSize: 10, color: "var(--th-text-muted, #64748b)" },
  barBg: { height: 6, borderRadius: 3, background: "rgba(50,50,95,0.4)", overflow: "hidden", marginBottom: 4 },
  barFill: { height: "100%", borderRadius: 3, transition: "width 0.5s ease" },
  goalStats: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 },
  goalTarget: { color: "var(--th-text-muted, #64748b)", fontSize: 11 },
};
