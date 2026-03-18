/**
 * NotificationCenter — Bell icon with activity feed dropdown
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface Notification {
  id: string;
  type: "task_done" | "pipeline" | "link_click" | "system";
  message: string;
  timestamp: string;
  read: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  task_done: "✅",
  pipeline: "🔄",
  link_click: "👆",
  system: "🔔",
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastCheck, setLastCheck] = useState(Date.now());
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      // Fetch recent tasks as notifications
      const tasksRes = await fetch("/api/tasks");
      if (!tasksRes.ok) return;
      const data = (await tasksRes.json()) as { tasks?: Array<{ id: string; title: string; status: string; updated_at?: string }> };
      const tasks = data.tasks || [];

      const notifs: Notification[] = [];

      // Tasks completed recently
      tasks
        .filter(t => t.status === "done" && t.updated_at)
        .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
        .slice(0, 10)
        .forEach(t => {
          notifs.push({
            id: `task_${t.id}`,
            type: "task_done",
            message: `Task completed: ${t.title}`,
            timestamp: t.updated_at || new Date().toISOString(),
            read: new Date(t.updated_at || "").getTime() < lastCheck,
          });
        });

      // Tasks in progress
      tasks
        .filter(t => t.status === "in_progress")
        .slice(0, 5)
        .forEach(t => {
          notifs.push({
            id: `prog_${t.id}`,
            type: "system",
            message: `In progress: ${t.title}`,
            timestamp: t.updated_at || new Date().toISOString(),
            read: true,
          });
        });

      setNotifications(notifs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    } catch { /* ignore */ }
  }, [lastCheck]);

  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, 30000);
    return () => clearInterval(t);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setLastCheck(Date.now());
    }
  };

  const timeAgo = (ts: string): string => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div ref={ref} style={styles.wrapper}>
      <button onClick={handleOpen} style={styles.bellBtn} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span style={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>🔔 Notifications</span>
            <span style={styles.dropdownCount}>{notifications.length}</span>
          </div>

          <div style={styles.list}>
            {notifications.length === 0 ? (
              <div style={styles.empty}>No notifications yet</div>
            ) : (
              notifications.slice(0, 15).map(n => (
                <div key={n.id} style={{ ...styles.item, ...(n.read ? {} : styles.itemUnread) }}>
                  <span style={styles.itemIcon}>{TYPE_ICONS[n.type] || "🔔"}</span>
                  <div style={styles.itemContent}>
                    <div style={styles.itemMessage}>{n.message}</div>
                    <div style={styles.itemTime}>{timeAgo(n.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: "relative" as const, display: "inline-block" },
  bellBtn: {
    background: "none", border: "none", fontSize: 20, cursor: "pointer",
    padding: "4px 8px", borderRadius: 8, position: "relative" as const,
  },
  badge: {
    position: "absolute" as const, top: 0, right: 2,
    background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700,
    borderRadius: 10, padding: "1px 4px", minWidth: 14, textAlign: "center" as const,
    lineHeight: "14px",
  },
  dropdown: {
    position: "absolute" as const, top: "100%", right: 0,
    width: 320, maxHeight: 420,
    background: "#fff", borderRadius: 12,
    boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
    border: "1px solid #e2e8f0",
    zIndex: 1000, overflow: "hidden",
  },
  dropdownHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 14px", borderBottom: "1px solid #f1f5f9",
  },
  dropdownTitle: { fontSize: 14, fontWeight: 700, color: "#1e293b" },
  dropdownCount: { fontSize: 11, color: "#94a3b8" },
  list: { maxHeight: 360, overflowY: "auto" as const },
  empty: { padding: 30, textAlign: "center" as const, color: "#94a3b8", fontSize: 13 },
  item: {
    display: "flex", gap: 8, padding: "10px 14px",
    borderBottom: "1px solid #f8fafc", cursor: "default",
  },
  itemUnread: { background: "#f0f9ff" },
  itemIcon: { fontSize: 16, marginTop: 1 },
  itemContent: { flex: 1, minWidth: 0 },
  itemMessage: {
    fontSize: 12, color: "#334155", lineHeight: 1.4,
    whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
  },
  itemTime: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
};
