import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface BackupInfo {
  lastSync?: string;
  syncEnabled?: boolean;
  supabaseStatus?: string;
}

export function BackupManagerWidget() {
  const { token } = useAuth();
  const [backupInfo, setBackupInfo] = useState<BackupInfo>({});
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState("");

  const loadBackupStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/supabase/status", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setBackupInfo({
        lastSync: data.lastSync || data.lastBackup,
        syncEnabled: data.enabled !== false,
        supabaseStatus: data.connected ? "connected" : "disconnected",
      });
    } catch {
      setBackupInfo({ supabaseStatus: "error" });
    }
  }, [token]);

  useEffect(() => { loadBackupStatus(); }, [loadBackupStatus]);

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);
    setExportResult("");
    try {
      const res = await fetch(`/api/data-export?format=${format}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) {
        // Create downloadable content
        const content = format === "json"
          ? JSON.stringify(data.data || data, null, 2)
          : (data.csv || data.data || "No data");
        const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `studio-export-${new Date().toISOString().split("T")[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        setExportResult(`✅ Export ${format.toUpperCase()} สำเร็จ`);
      } else {
        setExportResult(`⚠️ ${data.error || "Export ไม่สำเร็จ"}`);
      }
    } catch {
      setExportResult("❌ เกิดข้อผิดพลาดในการ export");
    }
    setExporting(false);
  };

  const handleManualSync = async () => {
    try {
      const res = await fetch("/api/supabase/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      setExportResult(data.ok ? "☁️ Sync สำเร็จ" : "⚠️ Sync ไม่สำเร็จ");
      loadBackupStatus();
    } catch {
      setExportResult("❌ Sync error");
    }
  };

  const statusIcon = backupInfo.supabaseStatus === "connected" ? "🟢" : backupInfo.supabaseStatus === "error" ? "🔴" : "🟡";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>📋</div>
        <h3 style={styles.title}>Export & Backup</h3>
      </div>

      {/* Backup Status */}
      <div style={styles.statusCard}>
        <div style={styles.statusRow}>
          <span>☁️ Supabase</span>
          <span>{statusIcon} {backupInfo.supabaseStatus || "unknown"}</span>
        </div>
        {backupInfo.lastSync && (
          <div style={styles.statusRow}>
            <span>🕐 Last sync</span>
            <span>{new Date(backupInfo.lastSync).toLocaleString("th-TH")}</span>
          </div>
        )}
        <button onClick={handleManualSync} style={styles.syncBtn}>🔄 Manual Sync</button>
      </div>

      {/* Export Buttons */}
      <div style={styles.exportSection}>
        <div style={styles.exportLabel}>📤 Export Data</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => handleExport("json")} disabled={exporting} style={styles.exportBtn}>
            {exporting ? "⏳..." : "📄 JSON"}
          </button>
          <button onClick={() => handleExport("csv")} disabled={exporting} style={{ ...styles.exportBtn, background: "#16a34a" }}>
            {exporting ? "⏳..." : "📊 CSV"}
          </button>
        </div>
      </div>

      {exportResult && (
        <div style={styles.resultMsg}>{exportResult}</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  iconBox: { fontSize: 22, background: "#fef3c7", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  statusCard: { background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 14, border: "1px solid #e2e8f0" },
  statusRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", padding: "4px 0" },
  syncBtn: { width: "100%", marginTop: 8, padding: "7px 0", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#475569" },
  exportSection: { marginBottom: 12 },
  exportLabel: { fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8 },
  exportBtn: { flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "opacity 0.2s" },
  resultMsg: { fontSize: 12, padding: 8, borderRadius: 6, background: "#f0fdf4", color: "#16a34a", textAlign: "center", fontWeight: 500 },
};
