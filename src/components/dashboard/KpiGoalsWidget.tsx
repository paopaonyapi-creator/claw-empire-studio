import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface KpiGoal {
  id: number;
  metric: string;
  target: number;
  current: number;
  period: string;
  icon: string;
  color: string;
  percent: number;
}

export function KpiGoalsWidget() {
  const { token, user } = useAuth();
  const [goals, setGoals] = useState<KpiGoal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ metric: "", target: "", period: "daily", icon: "🎯" });

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/kpi-goals", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setGoals(data.goals);
    } catch {}
  }, [token]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const addGoal = async () => {
    if (!form.metric || !form.target) return;
    await fetch("/api/kpi-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, target: Number(form.target) }),
    });
    setForm({ metric: "", target: "", period: "daily", icon: "🎯" });
    setShowForm(false);
    loadGoals();
  };

  const deleteGoal = async (id: number) => {
    await fetch(`/api/kpi-goals/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    loadGoals();
  };

  const getStatusColor = (percent: number) => {
    if (percent >= 100) return "#16a34a";
    if (percent >= 70) return "#f59e0b";
    if (percent >= 40) return "#3b82f6";
    return "#ef4444";
  };

  const isCeo = user?.role === "ceo";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>📊</div>
        <h3 style={styles.title}>KPI Goals</h3>
        <div style={{ flex: 1 }} />
        {isCeo && (
          <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
            {showForm ? "✕" : "➕"}
          </button>
        )}
      </div>

      {showForm && (
        <div style={styles.form}>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="ชื่อ KPI เช่น Revenue" value={form.metric}
              onChange={e => setForm({ ...form, metric: e.target.value })} style={{ ...styles.input, flex: 2 }} />
            <input placeholder="เป้า" type="number" value={form.target}
              onChange={e => setForm({ ...form, target: e.target.value })} style={{ ...styles.input, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} style={styles.input}>
              <option value="daily">รายวัน</option>
              <option value="weekly">รายสัปดาห์</option>
              <option value="monthly">รายเดือน</option>
            </select>
            <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={styles.input}>
              <option value="🎯">🎯 เป้า</option>
              <option value="💰">💰 รายได้</option>
              <option value="📝">📝 Task</option>
              <option value="📱">📱 Post</option>
              <option value="👥">👥 Users</option>
              <option value="🛒">🛒 Orders</option>
            </select>
            <button onClick={addGoal} style={styles.saveBtn}>บันทึก</button>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {goals.length === 0 ? (
          <div style={styles.empty}>📭 ยังไม่มีเป้าหมาย — กด ➕ เพื่อเพิ่ม</div>
        ) : (
          goals.map(g => (
            <div key={g.id} style={styles.goalRow}>
              <div style={styles.goalIcon}>{g.icon}</div>
              <div style={styles.goalContent}>
                <div style={styles.goalName}>
                  {g.metric}
                  <span style={styles.periodBadge}>{g.period}</span>
                </div>
                <div style={styles.progressBar}>
                  <div style={{
                    ...styles.progressFill,
                    width: `${Math.min(100, g.percent)}%`,
                    background: getStatusColor(g.percent),
                  }} />
                </div>
                <div style={styles.goalNumbers}>
                  <span>{g.current.toLocaleString()} / {g.target.toLocaleString()}</span>
                  <span style={{ color: getStatusColor(g.percent), fontWeight: 700 }}>{g.percent}%</span>
                </div>
              </div>
              {isCeo && (
                <button onClick={() => deleteGoal(g.id)} style={styles.delBtn}>🗑️</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBox: { fontSize: 22, background: "#eef2ff", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  addBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  form: { background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid #e2e8f0" },
  input: { padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, outline: "none" },
  saveBtn: { padding: "6px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 },
  goalRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#fafbfc", border: "1px solid #f1f5f9" },
  goalIcon: { fontSize: 22, flexShrink: 0 },
  goalContent: { flex: 1, minWidth: 0 },
  goalName: { fontSize: 13, fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 },
  periodBadge: { fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#e2e8f0", color: "#64748b", fontWeight: 500 },
  progressBar: { height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden", marginBottom: 3 },
  progressFill: { height: "100%", borderRadius: 3, transition: "width 0.5s ease" },
  goalNumbers: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" },
  delBtn: { width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, opacity: 0.5 },
};
