/**
 * ContentCalendar — Weekly content scheduling grid
 */

import { useState, useEffect, useCallback } from "react";

interface CalendarEntry {
  id: string;
  day: string;
  time: string;
  platform: string;
  productName: string;
  status: "scheduled" | "posted" | "skipped";
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun",
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#ff0050",
  facebook: "#1877f2",
  instagram: "#e4405f",
  shopee: "#ee4d2d",
  lazada: "#0f146d",
};

export function ContentCalendar() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [weekOf, setWeekOf] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [formTime, setFormTime] = useState("18:00");
  const [formPlatform, setFormPlatform] = useState("tiktok");
  const [formProduct, setFormProduct] = useState("");
  const [formCaption, setFormCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const json = await res.json();
        setEntries(json.entries || []);
        setWeekOf(json.weekOf || "");
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const getEntriesForDay = (day: string) =>
    entries.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time));

  const today = new Date();
  const todayDay = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][today.getDay()];

  const openAddModal = (day: string) => {
    setSelectedDay(day);
    setFormTime("18:00");
    setFormPlatform("tiktok");
    setFormProduct("");
    setFormCaption("");
    setShowAddModal(true);
  };

  const handleSavePost = async () => {
    if (!formProduct.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          time: formTime,
          platform: formPlatform,
          productName: formProduct,
          caption: formCaption,
        }),
      });
      if (res.ok) {
        await fetchCalendar();
        setShowAddModal(false);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  return (
    <div className="calendar-widget" style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📅 Content Calendar</h2>
        <span style={styles.weekLabel}>Week: {weekOf || "—"}</span>
      </div>

      {loading ? (
        <div style={styles.loading}>⏳ Loading...</div>
      ) : (
        <div className="calendar-grid-7" style={styles.grid}>
          {DAYS.map((day) => {
            const dayEntries = getEntriesForDay(day);
            const isToday = day === todayDay;

            return (
              <div
                key={day}
                onClick={() => openAddModal(day)}
                className={`calendar-day-col ${isToday ? 'calendar-day-today' : ''}`}
                style={{
                  ...styles.dayCol,
                  ...(isToday ? styles.dayColToday : {}),
                  cursor: "pointer",
                }}
              >
                <div className={isToday ? 'calendar-day-header-today' : 'calendar-day-header'} style={{
                  ...styles.dayHeader,
                  ...(isToday ? styles.dayHeaderToday : {}),
                }}>
                  {DAY_LABELS[day]}
                </div>

                <div style={styles.dayBody}>
                  {dayEntries.length === 0 ? (
                    <div style={styles.emptySlot}>—</div>
                  ) : (
                    dayEntries.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          ...styles.entryCard,
                          borderLeft: `3px solid ${PLATFORM_COLORS[entry.platform] || "#94a3b8"}`,
                        }}
                      >
                        <div style={styles.entryTime}>{entry.time}</div>
                        <div style={styles.entryProduct}>{entry.productName}</div>
                        <div style={styles.entryMeta}>
                          <span style={{
                            ...styles.platformTag,
                            background: PLATFORM_COLORS[entry.platform] || "#94a3b8",
                          }}>
                            {entry.platform}
                          </span>
                          <span style={styles.statusIcon}>
                            {entry.status === "posted" ? "✅" : entry.status === "skipped" ? "⏭️" : "⏰"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div style={styles.empty}>
          📭 ยังไม่มีตาราง — คลิกที่คอลัมน์เพื่อเพิ่มโพสต์!
        </div>
      )}

      {/* Add Post Modal */}
      {showAddModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>📅 Schedule Post ({DAY_LABELS[selectedDay]})</h3>
            
            <div style={styles.inputGroup}>
              <label style={styles.modalLabel}>Product Name (สินค้า)</label>
              <input 
                type="text" 
                value={formProduct} 
                onChange={e => setFormProduct(e.target.value)}
                placeholder="เช่น ลิปสติก, ครีมทาหน้า, ยาดม"
                style={styles.modalInput}
                autoFocus
              />
            </div>
            
            <div style={styles.inputGroup}>
              <label style={styles.modalLabel}>Caption (AI Draft / ข้อความโพสต์)</label>
              <textarea 
                value={formCaption} 
                onChange={e => setFormCaption(e.target.value)}
                placeholder="พิมพ์แคปชันที่นี่..."
                style={{...styles.modalInput, minHeight: 60, resize: "vertical"}}
              />
            </div>
            
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.modalLabel}>Time (เวลา)</label>
                <input 
                  type="time" 
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  style={styles.modalInput}
                />
              </div>
              <div style={{ ...styles.inputGroup, flex: 1 }}>
                <label style={styles.modalLabel}>Platform</label>
                <select 
                  value={formPlatform} 
                  onChange={e => setFormPlatform(e.target.value)}
                  style={styles.modalInput}
                >
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="shopee">Shopee</option>
                  <option value="lazada">Lazada</option>
                </select>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button 
                style={styles.btnCancel} 
                onClick={() => setShowAddModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                style={{...styles.btnSave, opacity: (!formProduct.trim() || submitting) ? 0.6 : 1}}
                onClick={handleSavePost}
                disabled={!formProduct.trim() || submitting}
              >
                {submitting ? "Saving..." : "Schedule Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff", borderRadius: 14, padding: 20,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 20,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" },
  weekLabel: { fontSize: 11, color: "#94a3b8", fontWeight: 500 },
  loading: { textAlign: "center" as const, padding: 30, color: "#94a3b8" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  dayCol: {
    borderRadius: 8, overflow: "hidden", background: "#f8fafc",
    minHeight: 120, display: "flex", flexDirection: "column" as const,
  },
  dayColToday: { background: "#eff6ff", boxShadow: "0 0 0 2px #3b82f6" },
  dayHeader: {
    padding: "6px 0", textAlign: "center" as const, fontSize: 11, fontWeight: 700,
    color: "#64748b", background: "#f1f5f9", textTransform: "uppercase" as const,
  },
  dayHeaderToday: { background: "#3b82f6", color: "#fff" },
  dayBody: { padding: 4, flex: 1, display: "flex", flexDirection: "column" as const, gap: 3 },
  emptySlot: { textAlign: "center" as const, color: "#cbd5e1", padding: 8, fontSize: 12 },
  entryCard: {
    padding: "5px 6px", borderRadius: 5, background: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  entryTime: { fontSize: 10, color: "#64748b", fontWeight: 600 },
  entryProduct: {
    fontSize: 11, fontWeight: 600, color: "#1e293b", marginTop: 1,
    whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
  },
  entryMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  platformTag: {
    fontSize: 8, color: "#fff", padding: "1px 4px", borderRadius: 3,
    fontWeight: 600, textTransform: "uppercase" as const,
  },
  statusIcon: { fontSize: 10 },
  empty: { textAlign: "center" as const, padding: 20, color: "#94a3b8", fontSize: 12, marginTop: 8 },
  
  // Modal Styles
  modalOverlay: {
    position: "fixed" as const, top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(2px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 360,
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  },
  modalTitle: { margin: "0 0 16px 0", fontSize: 16, color: "#1e293b" },
  inputGroup: { marginBottom: 16, display: "flex", flexDirection: "column" as const, gap: 6 },
  modalLabel: { fontSize: 12, fontWeight: 600, color: "#64748b" },
  modalInput: {
    padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, outline: "none", background: "#f8fafc", width: "100%",
    boxSizing: "border-box" as const,
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 },
  btnCancel: {
    padding: "8px 16px", borderRadius: 8, background: "#f1f5f9",
    color: "#64748b", border: "none", fontWeight: 600, cursor: "pointer",
  },
  btnSave: {
    padding: "8px 16px", borderRadius: 8, background: "#3b82f6",
    color: "#fff", border: "none", fontWeight: 600, cursor: "pointer",
  },
};
