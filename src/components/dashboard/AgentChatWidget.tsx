import { useState, useEffect, useRef } from "react";

interface ChatMessage {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string | null;
  content: string;
  type: "message" | "draft" | "review_request" | "review_response" | "task_handoff";
  timestamp: number;
}

const TYPE_ICONS: Record<string, string> = {
  message: "💬",
  draft: "📝",
  review_request: "🔍",
  review_response: "✅",
  task_handoff: "🔄",
};

const TYPE_COLORS: Record<string, string> = {
  message: "#3b82f6",
  draft: "#8b5cf6",
  review_request: "#f59e0b",
  review_response: "#10b981",
  task_handoff: "#6366f1",
};

export default function AgentChatWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const fetchMessages = () => {
    fetch("/api/agent-chat/feed")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setMessages(data.messages || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return "เมื่อกี้";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} นาทีที่แล้ว`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ชม.ที่แล้ว`;
    return d.toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
  };

  return (
    <section
      style={{ background: "var(--th-bg-surface)", borderRadius: 16, padding: 20, border: "1px solid var(--th-border)" }}
    >
      <h3 style={{ color: "var(--th-text-heading)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
        💬 Agent Chat
        <span style={{ fontSize: 11, color: "var(--th-text-muted)", fontWeight: 400 }}>
          Internal Communication
        </span>
        {messages.length > 0 && (
          <span
            style={{
              fontSize: 10,
              padding: "1px 8px",
              borderRadius: 10,
              background: "#3b82f6",
              color: "#fff",
              fontWeight: 600,
              marginLeft: "auto",
            }}
          >
            {messages.length} msgs
          </span>
        )}
      </h3>

      <div
        ref={feedRef}
        style={{
          maxHeight: 320,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {loading && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--th-text-muted)", fontSize: 13 }}>
            กำลังโหลด...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, color: "var(--th-text-muted)", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤫</div>
            ยังไม่มีข้อความ — Agent จะเริ่มคุยกันเมื่อมี task
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              background: "var(--th-bg-elevated)",
              border: "1px solid var(--th-border)",
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
                fontSize: 14,
                background: TYPE_COLORS[msg.type] || "#3b82f6",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {TYPE_ICONS[msg.type] || "💬"}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--th-text-primary)" }}>
                  {msg.fromAgentName}
                </span>
                {msg.toAgentId && (
                  <span style={{ fontSize: 10, color: "var(--th-text-muted)" }}>
                    → {msg.toAgentId}
                  </span>
                )}
                <span style={{ fontSize: 9, color: "var(--th-text-muted)", marginLeft: "auto" }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--th-text-secondary)",
                  lineHeight: 1.4,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflow: "hidden",
                  maxHeight: 60,
                  textOverflow: "ellipsis",
                }}
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
