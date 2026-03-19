import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface User {
  id: string;
  username: string;
  displayName: string;
  role: "ceo" | "admin" | "viewer";
  createdAt: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  ceo: { label: "CEO", color: "#ef4444", icon: "👑" },
  admin: { label: "Admin", color: "#8b5cf6", icon: "⚙️" },
  viewer: { label: "Viewer", color: "#64748b", icon: "👁️" },
};

export function UserManagementWidget() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", role: "viewer" as string });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/users", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setUsers(data.users);
    } catch {}
  }, [token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Only CEO can see this
  if (currentUser?.role !== "ceo") return null;

  const handleCreate = async () => {
    setError(""); setSuccess("");
    if (!form.username.trim() || !form.password || form.password.length < 6) {
      setError("ชื่อผู้ใช้ + รหัสผ่าน (≥6 ตัว) จำเป็น"); return;
    }
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`✅ สร้าง ${form.username} สำเร็จ`);
        setForm({ username: "", password: "", displayName: "", role: "viewer" });
        setShowForm(false);
        loadUsers();
      } else { setError(data.error || "Failed"); }
    } catch { setError("เชื่อมต่อไม่ได้"); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ลบ ${name}?`)) return;
    try {
      const res = await fetch(`/api/auth/users/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) loadUsers();
      else setError(data.error || "Delete failed");
    } catch { setError("เชื่อมต่อไม่ได้"); }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>👥</div>
        <h3 style={styles.title}>จัดการผู้ใช้ (CEO Only)</h3>
        <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
          {showForm ? "✕" : "+ เพิ่มผู้ใช้"}
        </button>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}
      {success && <div style={styles.successBox}>{success}</div>}

      {showForm && (
        <div style={styles.form}>
          <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={styles.input} />
          <input placeholder="Password (≥6)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={styles.input} />
          <input placeholder="Display Name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={styles.input} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={styles.input}>
            <option value="viewer">👁️ Viewer (อ่านอย่างเดียว)</option>
            <option value="admin">⚙️ Admin (จัดการได้)</option>
            <option value="ceo">👑 CEO (ทั้งหมด)</option>
          </select>
          <button onClick={handleCreate} style={styles.createBtn}>สร้างผู้ใช้</button>
        </div>
      )}

      <div style={styles.userList}>
        {users.map((u) => {
          const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.viewer;
          const isSelf = u.id === currentUser?.id;
          return (
            <div key={u.id} style={styles.userRow}>
              <div style={styles.userInfo}>
                <span style={styles.userName}>{roleInfo.icon} {u.displayName || u.username}</span>
                <span style={{ ...styles.roleBadge, background: roleInfo.color }}>{roleInfo.label}</span>
                {isSelf && <span style={styles.selfBadge}>คุณ</span>}
              </div>
              <div style={styles.userMeta}>
                <span style={styles.metaText}>@{u.username}</span>
                {!isSelf && (
                  <button onClick={() => handleDelete(u.id, u.displayName || u.username)} style={styles.deleteBtn}>🗑</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  icon: { fontSize: 24, background: "#eff6ff", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", flex: 1 },
  addBtn: { padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 16, padding: 16, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" },
  input: { padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", color: "#334155" },
  createBtn: { padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  errorBox: { background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12, fontWeight: 600 },
  successBox: { background: "#f0fdf4", color: "#16a34a", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12, fontWeight: 600 },
  userList: { display: "flex", flexDirection: "column", gap: 8 },
  userRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#fafbfc", borderRadius: 10, border: "1px solid #f1f5f9" },
  userInfo: { display: "flex", alignItems: "center", gap: 8 },
  userName: { fontSize: 14, fontWeight: 600, color: "#1e293b" },
  roleBadge: { padding: "2px 8px", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 700 },
  selfBadge: { padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1d4ed8", fontSize: 10, fontWeight: 700 },
  userMeta: { display: "flex", alignItems: "center", gap: 8 },
  metaText: { fontSize: 12, color: "#94a3b8" },
  deleteBtn: { padding: "4px 8px", borderRadius: 6, border: "none", background: "#fee2e2", cursor: "pointer", fontSize: 14 },
};
