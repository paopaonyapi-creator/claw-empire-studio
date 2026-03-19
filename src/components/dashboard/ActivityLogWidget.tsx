import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface Activity {
  id: number;
  action: string;
  category: string;
  actor: string;
  detail: string;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  auth: { icon: "🔐", color: "#8b5cf6", label: "Auth" },
  content: { icon: "📝", color: "#3b82f6", label: "Content" },
  product: { icon: "📦", color: "#f59e0b", label: "Product" },
  revenue: { icon: "💰", color: "#16a34a", label: "Revenue" },
  settings: { icon: "⚙️", color: "#64748b", label: "Settings" },
  social: { icon: "📱", color: "#ec4899", label: "Social" },
  system: { icon: "🖥️", color: "#6366f1", label: "System" },
};

export function ActivityLogWidget() {
  const { token, user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState("all");

  const loadActivities = useCallback(async () => {
    try {
      const url = filter === "all" ? "/api/activity-log?limit=20" : `/api/activity-log?limit=20&category=${filter}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setActivities(data.activities);
    } catch {}
  }, [token, filter]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  // Only CEO/Admin can see
  if (user?.role === "viewer") return null;

  const timeSince = (ts: string): string => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "เมื่อกี้";
    if (mins < 60) return `${mins}น.`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}ชม.`;
    return `${Math.floor(hrs / 24)}วัน`;
  };

  const categories = ["all", "auth", "content", "product", "revenue", "social", "system"];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>🗂️</div>
        <h3 style={styles.title}>Activity Log</h3>
        <button onClick={loadActivities} style={styles.refreshBtn}>🔄</button>
      </div>

      <div style={styles.filters}>
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            style={{
              ...styles.filterBtn,
              background: filter === c ? "#6366f1" : "#f1f5f9",
              color: filter === c ? "#fff" : "#64748b",
            }}
          >
            {c === "all" ? "📋 ทั้งหมด" : `${CATEGORY_CONFIG[c]?.icon || "📌"} ${CATEGORY_CONFIG[c]?.label || c}`}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {activities.length === 0 ? (
          <div style={styles.empty}>📭 ยังไม่มี activity</div>
        ) : (
          activities.map(a => {
            const cat = CATEGORY_CONFIG[a.category] || CATEGORY_CONFIG.system;
            return (
              <div key={a.id} style={styles.row}>
                <div style={{ ...styles.catDot, background: cat.color }}>{cat.icon}</div>
                <div style={styles.content}>
                  <div style={styles.actionText}>
                    <strong>{a.action}</strong>
                    <span style={styles.actorText}>by {a.actor}</span>
                  </div>
                  {a.detail && <div style={styles.detail}>{a.detail}</div>}
                </div>
                <div style={styles.time}>{timeSince(a.createdAt)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBox: { fontSize: 22, background: "#f0f9ff", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", flex: 1 },
  refreshBtn: { padding: "4px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14 },
  filters: { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 },
  filterBtn: { padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  empty: { textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 },
  row: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#fafbfc", border: "1px solid #f1f5f9" },
  catDot: { width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 },
  content: { flex: 1, minWidth: 0 },
  actionText: { fontSize: 13, color: "#1e293b", display: "flex", gap: 6, alignItems: "center" },
  actorText: { fontSize: 11, color: "#94a3b8" },
  detail: { fontSize: 11, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  time: { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 },
};
