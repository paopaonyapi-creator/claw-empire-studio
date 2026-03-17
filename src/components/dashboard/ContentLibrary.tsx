/**
 * ContentLibrary — Browse all generated content, filter, copy, re-run
 */

import { useState, useEffect, useCallback } from "react";

interface TaskItem {
  id: string;
  title: string;
  status: string;
  agent_id?: string;
  agent_name?: string;
  output?: string;
  created_at?: string;
  updated_at?: string;
  dept?: string;
}

const STATUS_ICONS: Record<string, string> = {
  done: "✅",
  in_progress: "🔄",
  pending: "⏳",
  failed: "❌",
  review: "👀",
};

const FILTERS = ["all", "done", "in_progress", "pending"] as const;

export function ContentLibrary() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = (await res.json()) as { tasks?: TaskItem[] };
        setTasks(data.tasks || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleRerun = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/run`, { method: "POST" });
    } catch { /* ignore */ }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📚 Content Library</h2>
        <span style={styles.count}>{filtered.length} / {tasks.length} items</span>
      </div>

      {/* Filters */}
      <div style={styles.controls}>
        <input
          type="text"
          placeholder="🔍 Search content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(filter === f ? styles.filterBtnActive : {}),
              }}
            >
              {f === "all" ? "📋 All" : `${STATUS_ICONS[f] || ""} ${f.replace("_", " ")}`}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div style={styles.loading}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>📭 No content yet. Use Quick Create or TG commands to generate!</div>
      ) : (
        <div style={styles.taskList}>
          {filtered.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
              style={{
                ...styles.taskCard,
                borderLeft: `3px solid ${task.status === "done" ? "#10b981" : task.status === "in_progress" ? "#f59e0b" : "#94a3b8"}`,
              }}
            >
              <div style={styles.taskHeader}>
                <span style={styles.taskIcon}>{STATUS_ICONS[task.status] || "📄"}</span>
                <div style={styles.taskInfo}>
                  <div style={styles.taskTitle}>{task.title}</div>
                  <div style={styles.taskMeta}>
                    {task.agent_name && <span>🤖 {task.agent_name}</span>}
                    {task.created_at && (
                      <span>📅 {new Date(task.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                </div>
                <span style={styles.expandIcon}>{selectedTask?.id === task.id ? "▲" : "▼"}</span>
              </div>

              {selectedTask?.id === task.id && (
                <div style={styles.taskContent}>
                  {task.output ? (
                    <>
                      <pre style={styles.outputText}>{task.output}</pre>
                      <div style={styles.actionRow}>
                        <button onClick={(e) => { e.stopPropagation(); handleCopy(task.output || ""); }} style={styles.actionBtn}>
                          {copied ? "✅ Copied!" : "📋 Copy"}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleRerun(task.id); }} style={styles.actionBtnSecondary}>
                          🔄 Re-run
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={styles.noOutput}>
                      {task.status === "pending" ? "⏳ Agent ยังไม่เริ่มทำ" : task.status === "in_progress" ? "🔄 กำลังทำ..." : "📭 ไม่มี output"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    marginBottom: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "#1e293b",
  },
  count: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 500,
  },
  controls: {
    marginBottom: 14,
  },
  searchInput: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 13,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    marginBottom: 8,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  filterRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  filterBtn: {
    padding: "4px 10px",
    fontSize: 11,
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
    color: "#64748b",
    fontWeight: 500,
    textTransform: "capitalize" as const,
  },
  filterBtnActive: {
    background: "#6366f1",
    color: "#fff",
    borderColor: "#6366f1",
  },
  loading: {
    textAlign: "center" as const,
    padding: 30,
    color: "#94a3b8",
    fontSize: 14,
  },
  empty: {
    textAlign: "center" as const,
    padding: 30,
    color: "#94a3b8",
    fontSize: 13,
  },
  taskList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    maxHeight: 400,
    overflowY: "auto" as const,
  },
  taskCard: {
    padding: "10px 12px",
    borderRadius: 8,
    background: "#fafbfc",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  taskHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  taskIcon: {
    fontSize: 16,
  },
  taskInfo: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  taskMeta: {
    display: "flex",
    gap: 10,
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 10,
    color: "#94a3b8",
  },
  taskContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
  },
  outputText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "#334155",
    background: "#f8fafc",
    padding: 10,
    borderRadius: 6,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    maxHeight: 200,
    overflowY: "auto" as const,
    margin: 0,
    fontFamily: "inherit",
  },
  actionRow: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    background: "#6366f1",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  actionBtnSecondary: {
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#6366f1",
    background: "#ede9fe",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  noOutput: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center" as const,
    padding: 10,
  },
};
