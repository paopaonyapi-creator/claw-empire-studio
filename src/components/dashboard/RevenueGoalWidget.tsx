import React, { useState, useEffect } from "react";

interface RevenueGoal {
  id: number;
  month: string;
  target_amount: number;
  actual_amount: number;
  progress_pct: number;
  note: string;
  currency: string;
}

export function RevenueGoalWidget() {
  const [goal, setGoal] = useState<RevenueGoal | null>(null);
  const [editing, setEditing] = useState(false);
  const [newTarget, setNewTarget] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("auth_token");
  const authHeader = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await fetch("/api/revenue-goals/current", { headers: authHeader });
      const data = await res.json();
      if (data.ok) {
        setGoal(data.goal);
        setNewTarget(String(data.goal.target_amount || ""));
        setNote(data.goal.note || "");
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!newTarget) return;
    setSaving(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await fetch("/api/revenue-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ month, target_amount: parseFloat(newTarget), note }),
      });
      await load();
      setEditing(false);
    } catch {}
    setSaving(false);
  };

  const fmt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
  const now = new Date();
  const monthLabel = now.toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  // Progress bar color
  const pct = goal?.progress_pct ?? 0;
  const barColor = pct >= 100 ? "#22c55e" : pct >= 80 ? "#f59e0b" : pct >= 50 ? "#6366f1" : "#8b5cf6";

  if (loading) return (
    <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>⏳ กำลังโหลด...</div>
  );

  return (
    <div className="widget-card" style={{ background: "var(--card-bg, #1a1a2e)", borderRadius: 16, padding: 20, border: "1px solid rgba(99,102,241,0.2)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>🎯</span>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary, #fff)" }}>Revenue Goal</h3>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{monthLabel}</p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818cf8", cursor: "pointer", fontSize: 12 }}
        >
          {editing ? "✕ ยกเลิก" : "✏️ ตั้งเป้า"}
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, alignSelf: "center" }}>฿</span>
            <input
              type="number"
              placeholder="เป้าหมาย เช่น 50000"
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, outline: "none" }}
            />
          </div>
          <input
            placeholder="📝 หมายเหตุ (ไม่บังคับ)"
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, outline: "none" }}
          />
          <button
            onClick={save}
            disabled={saving || !newTarget}
            style={{ padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            {saving ? "⏳ บันทึก..." : "✅ บันทึกเป้าหมาย"}
          </button>
        </div>
      )}

      {/* Progress display */}
      {goal && (
        <>
          {/* Big numbers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "เป้า", value: `฿${fmt(goal.target_amount)}`, color: "#818cf8" },
              { label: "ทำได้แล้ว", value: `฿${fmt(goal.actual_amount)}`, color: "#22c55e" },
              { label: "เหลืออีก", value: `฿${fmt(Math.max(0, goal.target_amount - goal.actual_amount))}`, color: "#f59e0b" },
            ].map(item => (
              <div key={item.label} style={{ textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 8px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Progress</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: barColor }}>{pct}%</span>
            </div>
            <div style={{ height: 12, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99, width: `${pct}%`,
                background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                transition: "width 0.8s cubic-bezier(0.25, 1, 0.5, 1)",
                boxShadow: `0 0 10px ${barColor}66`,
              }} />
            </div>
          </div>

          {/* Status badge */}
          <div style={{ textAlign: "center", marginTop: 10 }}>
            {pct >= 100 ? (
              <span style={{ fontSize: 13, background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "5px 14px", borderRadius: 20 }}>
                🏆 บรรลุเป้าหมายแล้ว!
              </span>
            ) : pct >= 80 ? (
              <span style={{ fontSize: 13, background: "rgba(245,158,11,0.15)", color: "#f59e0b", padding: "5px 14px", borderRadius: 20 }}>
                🔥 ใกล้ถึงเป้าแล้ว! สู้ๆ
              </span>
            ) : pct >= 50 ? (
              <span style={{ fontSize: 13, background: "rgba(99,102,241,0.15)", color: "#818cf8", padding: "5px 14px", borderRadius: 20 }}>
                📈 ผ่านครึ่งทางแล้ว!
              </span>
            ) : goal.target_amount === 0 ? (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                กด "ตั้งเป้า" เพื่อเริ่มต้น
              </span>
            ) : (
              <span style={{ fontSize: 13, background: "rgba(139,92,246,0.15)", color: "#a78bfa", padding: "5px 14px", borderRadius: 20 }}>
                🚀 ลุยต่อ! ยังไปได้อีก
              </span>
            )}
          </div>

          {goal.note && (
            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 8, marginBottom: 0 }}>
              📝 {goal.note}
            </p>
          )}
        </>
      )}
    </div>
  );
}
