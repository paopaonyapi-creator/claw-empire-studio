/**
 * TemplateSelector — Quick template creation modal for Dashboard
 *
 * Shows template cards → user selects → enters product/topic → creates task instantly
 */

import { useState, useEffect, useCallback } from "react";

interface Template {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  category: string;
  description: string;
  suggestedAgent: string;
  estimatedTime: string;
  platforms: string[];
}

interface TemplateSelectorProps {
  onTaskCreated?: (task: { id: string; title: string }) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  research: "#6366f1",
  content: "#10b981",
  creative: "#f59e0b",
  analytics: "#3b82f6",
};

const VARIABLE_LABELS: Record<string, { label: string; placeholder: string }> = {
  "tiktok-script": { label: "ชื่อสินค้า", placeholder: "เช่น เครื่องปั่น Philips รุ่น HR2600" },
  "product-review": { label: "ชื่อสินค้า", placeholder: "เช่น หูฟัง Sony WH-1000XM5" },
  "trend-research": { label: "หมวดสินค้า", placeholder: "เช่น เครื่องสำอาง, อุปกรณ์เครื่องครัว" },
  "thumbnail-brief": { label: "หัวข้อ", placeholder: "เช่น รีวิวครีมกันแดด 5 ยี่ห้อ" },
  "comparison-post": { label: "สินค้าที่เปรียบเทียบ", placeholder: "เช่น iPhone 16 vs Galaxy S25 vs Pixel 9" },
  "unboxing-script": { label: "ชื่อสินค้า", placeholder: "เช่น iPad Air M3" },
};

export function TemplateSelector({ onTaskCreated }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedTemplate || !inputValue.trim()) return;
    setCreating(true);
    setResult(null);

    try {
      const variableKey = selectedTemplate.id === "trend-research" ? "category"
        : selectedTemplate.id === "thumbnail-brief" ? "topic"
        : selectedTemplate.id === "comparison-post" ? "product_list"
        : "product";

      const res = await fetch(`/api/templates/${selectedTemplate.id}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: { [variableKey]: inputValue.trim() } }),
      });

      const data = await res.json();

      if (data.ok && data.task) {
        setResult({ ok: true, message: `✅ สร้างสำเร็จ! Task: ${data.task.title}` });
        onTaskCreated?.(data.task);

        // Auto-run the task
        fetch(`/api/tasks/${data.task.id}/run`, { method: "POST" }).catch(() => {});

        setTimeout(() => {
          setIsOpen(false);
          setSelectedTemplate(null);
          setInputValue("");
          setResult(null);
        }, 2000);
      } else {
        setResult({ ok: false, message: `❌ ${data.error || "เกิดข้อผิดพลาด"}` });
      }
    } catch {
      setResult({ ok: false, message: "❌ ไม่สามารถเชื่อมต่อ server ได้" });
    } finally {
      setCreating(false);
    }
  }, [selectedTemplate, inputValue, onTaskCreated]);

  if (templates.length === 0) return null;

  return (
    <>
      {/* Trigger Button */}
      <button onClick={() => setIsOpen(true)} style={styles.triggerBtn}>
        📝 Quick Create
      </button>

      {/* Modal */}
      {isOpen && (
        <div style={styles.overlay} onClick={() => { setIsOpen(false); setSelectedTemplate(null); setResult(null); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {selectedTemplate ? `${selectedTemplate.icon} ${selectedTemplate.nameEn}` : "📝 Quick Create — เลือก Template"}
              </h2>
              <button onClick={() => { setIsOpen(false); setSelectedTemplate(null); setResult(null); }} style={styles.closeBtn}>✕</button>
            </div>

            {!selectedTemplate ? (
              /* Template Grid */
              <div style={styles.templateGrid}>
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setSelectedTemplate(t)} style={styles.templateCard}>
                    <div style={styles.cardIcon}>{t.icon}</div>
                    <div style={styles.cardName}>{t.nameEn}</div>
                    <div style={styles.cardDesc}>{t.description}</div>
                    <div style={styles.cardMeta}>
                      <span style={{ ...styles.categoryBadge, backgroundColor: CATEGORY_COLORS[t.category] || "#94a3b8" }}>
                        {t.category}
                      </span>
                      <span style={styles.timeBadge}>⏱ {t.estimatedTime}</span>
                    </div>
                    <div style={styles.cardPlatforms}>
                      {t.platforms.map((p) => (
                        <span key={p} style={styles.platformTag}>{p}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Input Form */
              <div style={styles.inputForm}>
                <button onClick={() => { setSelectedTemplate(null); setResult(null); }} style={styles.backBtn}>← กลับ</button>

                <div style={styles.selectedInfo}>
                  <span style={styles.selectedIcon}>{selectedTemplate.icon}</span>
                  <div>
                    <div style={styles.selectedName}>{selectedTemplate.nameEn}</div>
                    <div style={styles.selectedDesc}>{selectedTemplate.description}</div>
                  </div>
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>
                    {VARIABLE_LABELS[selectedTemplate.id]?.label || "หัวข้อ"}
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={VARIABLE_LABELS[selectedTemplate.id]?.placeholder || "พิมพ์หัวข้อ..."}
                    style={styles.textInput}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>

                <div style={styles.agentInfo}>
                  🤖 Agent: <strong>{selectedTemplate.suggestedAgent}</strong> | ⏱ {selectedTemplate.estimatedTime}
                </div>

                {result && (
                  <div style={{ ...styles.resultMsg, color: result.ok ? "#10b981" : "#ef4444" }}>
                    {result.message}
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  disabled={creating || !inputValue.trim()}
                  style={{
                    ...styles.createBtn,
                    opacity: creating || !inputValue.trim() ? 0.5 : 1,
                  }}
                >
                  {creating ? "⏳ กำลังสร้าง..." : `🚀 สร้าง + สั่ง Agent ทำเลย`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  triggerBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
    transition: "all 0.2s",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "90%",
    maxWidth: 640,
    maxHeight: "80vh",
    overflow: "auto",
    boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
    animation: "fadeIn 0.2s ease",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "#1e293b",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    color: "#94a3b8",
    cursor: "pointer",
    padding: 4,
  },
  templateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 12,
    padding: 16,
  },
  templateCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#fafbfc",
    cursor: "pointer",
    transition: "all 0.15s",
    textAlign: "left" as const,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
    marginBottom: 8,
  },
  cardMeta: {
    display: "flex",
    gap: 6,
    marginBottom: 6,
  },
  categoryBadge: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    color: "#fff",
    fontWeight: 600,
  },
  timeBadge: {
    fontSize: 10,
    color: "#94a3b8",
  },
  cardPlatforms: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap" as const,
  },
  platformTag: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 3,
    background: "#f1f5f9",
    color: "#475569",
  },
  inputForm: {
    padding: 20,
  },
  backBtn: {
    background: "none",
    border: "none",
    fontSize: 13,
    color: "#6366f1",
    cursor: "pointer",
    marginBottom: 12,
    padding: 0,
    fontWeight: 500,
  },
  selectedInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    background: "#f8fafc",
    borderRadius: 10,
    marginBottom: 16,
  },
  selectedIcon: {
    fontSize: 32,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e293b",
  },
  selectedDesc: {
    fontSize: 12,
    color: "#64748b",
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 6,
  },
  textInput: {
    width: "100%",
    padding: "10px 14px",
    fontSize: 14,
    border: "2px solid #e2e8f0",
    borderRadius: 8,
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const,
  },
  agentInfo: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 16,
  },
  resultMsg: {
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 12px",
    borderRadius: 8,
    background: "#f8fafc",
    marginBottom: 12,
  },
  createBtn: {
    width: "100%",
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
  },
};
