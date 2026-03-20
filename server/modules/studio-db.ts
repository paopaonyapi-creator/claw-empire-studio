/**
 * Studio DB — SQLite-backed storage for affiliate studio modules
 *
 * Replaces JSON file storage for: Links, Click Logs, Calendar, Goals,
 * Products, Revenue, FB Posts, Alert Rules, Active Alerts
 * Auto-migrates existing JSON data on first boot.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// ---------------------------------------------------------------------------
// Singleton DB Instance (reuses same claw-empire.sqlite)
// ---------------------------------------------------------------------------
const DATA_ROOT = (() => {
  const envDir = process.env.APP_DATA_DIR;
  if (envDir) return envDir;
  if (fs.existsSync("/data")) return "/data";       // Railway
  if (fs.existsSync("/app/data")) return "/app/data"; // Docker
  return process.cwd();
})();

const DB_PATH = process.env.DB_PATH ?? path.join(DATA_ROOT, "claw-empire.sqlite");

let _db: DatabaseSync | null = null;

export function getStudioDb(): DatabaseSync {
  if (_db) return _db;
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA busy_timeout = 5000");
  _db.exec("PRAGMA foreign_keys = ON");
  initStudioTables(_db);
  runAutoMigration(_db);
  console.log("[Studio-DB] SQLite studio tables initialized ✓");
  return _db;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
function initStudioTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_links (
      id TEXT PRIMARY KEY,
      short_code TEXT UNIQUE NOT NULL,
      original_url TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      image_url TEXT DEFAULT NULL,
      revenue REAL DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_studio_links_short ON studio_links(short_code);

    CREATE TABLE IF NOT EXISTS studio_link_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      user_agent TEXT DEFAULT '',
      referer TEXT DEFAULT '',
      FOREIGN KEY (link_id) REFERENCES studio_links(id)
    );
    CREATE INDEX IF NOT EXISTS idx_studio_clicks_link ON studio_link_clicks(link_id);
    CREATE INDEX IF NOT EXISTS idx_studio_clicks_ts ON studio_link_clicks(timestamp);

    CREATE TABLE IF NOT EXISTS studio_calendar (
      id TEXT PRIMARY KEY,
      day TEXT NOT NULL,
      time TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'tiktok',
      product_name TEXT NOT NULL DEFAULT '',
      caption TEXT DEFAULT '',
      template_type TEXT NOT NULL DEFAULT 'hook',
      status TEXT NOT NULL DEFAULT 'scheduled',
      note TEXT DEFAULT '',
      week_of TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS studio_goals (
      id TEXT PRIMARY KEY,
      metric TEXT NOT NULL,
      target REAL NOT NULL DEFAULT 0,
      period TEXT NOT NULL,
      current_val REAL DEFAULT 0,
      progress REAL DEFAULT 0,
      icon TEXT DEFAULT '🎯',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_goals_mp ON studio_goals(metric, period);

    CREATE TABLE IF NOT EXISTS studio_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      url TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'other',
      price TEXT DEFAULT '',
      commission TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      pipeline_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS studio_revenue (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'THB',
      product_name TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'other',
      source TEXT NOT NULL DEFAULT 'manual',
      commission REAL DEFAULT 0,
      note TEXT DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_studio_revenue_ts ON studio_revenue(timestamp);

    CREATE TABLE IF NOT EXISTS studio_fb_posts (
      id TEXT PRIMARY KEY,
      fb_post_id TEXT DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      link TEXT DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'facebook',
      status TEXT NOT NULL DEFAULT 'scheduled',
      error TEXT DEFAULT '',
      scheduled_time TEXT DEFAULT '',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS studio_alert_rules (
      id TEXT PRIMARY KEY,
      metric TEXT NOT NULL,
      operator TEXT NOT NULL DEFAULT '<',
      value REAL NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS studio_alerts (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'warning',
      icon TEXT DEFAULT '⚠️',
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      metric TEXT NOT NULL DEFAULT '',
      current_value REAL DEFAULT 0,
      threshold REAL DEFAULT 0,
      acknowledged INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS studio_knowledge (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// ---------------------------------------------------------------------------
// Auto-Migration (JSON → SQLite, one-time)
// ---------------------------------------------------------------------------
function resolveJsonPath(filename: string): string {
  const envDbPath = process.env.DB_PATH;
  const dataDir = envDbPath ? path.join(path.dirname(envDbPath), "..") : "./data";
  try {
    fs.unlinkSync(path.join(dataDir, "fb-posts.json"));
  } catch {}
  return path.resolve(dataDir, filename);
}

// ---------------------------------------------------------------------------
// Knowledge Base (Agent Memory / RAG)
// ---------------------------------------------------------------------------
export interface StudioKnowledge {
  id: string;
  topic: string;
  content: string;
  category: string;
  timestamp: string;
}

export function dbAddKnowledge(knowledge: StudioKnowledge): void {
  const db = getStudioDb();
  const insert = db.prepare(`INSERT OR REPLACE INTO studio_knowledge (id, topic, content, category, timestamp) VALUES (?, ?, ?, ?, ?)`);
  insert.run(knowledge.id, knowledge.topic, knowledge.content, knowledge.category, knowledge.timestamp);
}

export function dbGetRelevantKnowledge(query: string, limit = 3): StudioKnowledge[] {
  const db = getStudioDb();
  // Basic substring matching for lightweight RAG
  const select = db.prepare(`
    SELECT * FROM studio_knowledge 
    WHERE topic LIKE ? OR content LIKE ?
    ORDER BY timestamp DESC LIMIT ?
  `);
  return select.all(`%${query}%`, `%${query}%`, limit) as unknown as StudioKnowledge[];
}

export function dbGetAllKnowledge(): StudioKnowledge[] {
  const db = getStudioDb();
  return db.prepare(`SELECT * FROM studio_knowledge ORDER BY timestamp DESC`).all() as unknown as StudioKnowledge[];
}

export function dbDeleteKnowledge(id: string): void {
  const db = getStudioDb();
  db.prepare(`DELETE FROM studio_knowledge WHERE id = ?`).run(id);
}

function runAutoMigration(db: DatabaseSync): void {
  migrateLinks(db);
  migrateCalendar(db);
  migrateGoals(db);
  migrateProducts(db);
  migrateRevenue(db);
  migrateFbPosts(db);
  migrateAlertRules(db);
  migrateAlerts(db);
}

function migrateLinks(db: DatabaseSync): void {
  const jsonFile = resolveJsonPath("affiliate-links.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_links").get() as { cnt: number };
    if (existing.cnt > 0) return; // already migrated

    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insertLink = db.prepare(`INSERT OR IGNORE INTO studio_links (id, short_code, original_url, label, image_url, revenue, clicks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertClick = db.prepare(`INSERT INTO studio_link_clicks (link_id, timestamp, user_agent, referer) VALUES (?, ?, ?, ?)`);

    for (const l of data) {
      insertLink.run(l.id, l.shortCode, l.originalUrl, l.label || '', l.imageUrl || null, l.revenue || 0, l.clicks || 0, l.createdAt || new Date().toISOString());
      if (l.clickLog && Array.isArray(l.clickLog)) {
        for (const c of l.clickLog.slice(-200)) { // Import last 200 clicks max
          insertClick.run(l.id, c.timestamp, c.userAgent || '', c.referer || '');
        }
      }
    }
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} links from JSON → SQLite ✓`);
  } catch (e) {
    console.error("[Studio-DB] Link migration error:", e);
  }
}

function migrateCalendar(db: DatabaseSync): void {
  const jsonFile = path.resolve("data/calendar.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_calendar").get() as { cnt: number };
    if (existing.cnt > 0) return;

    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insert = db.prepare(`INSERT OR IGNORE INTO studio_calendar (id, day, time, platform, product_name, caption, template_type, status, note, week_of, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const e of data) {
      insert.run(e.id, e.day, e.time, e.platform || 'tiktok', e.productName || '', e.caption || '', e.templateType || 'hook', e.status || 'scheduled', e.note || '', e.weekOf || '', e.createdAt || new Date().toISOString());
    }
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} calendar entries from JSON → SQLite ✓`);
  } catch (e) {
    console.error("[Studio-DB] Calendar migration error:", e);
  }
}

function migrateGoals(db: DatabaseSync): void {
  const jsonFile = path.resolve("data/goals.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_goals").get() as { cnt: number };
    if (existing.cnt > 0) return;

    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insert = db.prepare(`INSERT OR IGNORE INTO studio_goals (id, metric, target, period, current_val, progress, icon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const g of data) {
      insert.run(g.id, g.metric, g.target || 0, g.period, g.current || 0, g.progress || 0, g.icon || '🎯', g.createdAt || new Date().toISOString());
    }
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} goals from JSON → SQLite ✓`);
  } catch (e) {
    console.error("[Studio-DB] Goals migration error:", e);
  }
}

// ---------------------------------------------------------------------------
// CRUD — Links
// ---------------------------------------------------------------------------
export interface StudioLink {
  id: string;
  shortCode: string;
  originalUrl: string;
  label: string;
  imageUrl?: string | null;
  revenue: number;
  clicks: number;
  createdAt: string;
}

export function dbCreateLink(id: string, shortCode: string, originalUrl: string, label: string, imageUrl?: string): StudioLink {
  const db = getStudioDb();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO studio_links (id, short_code, original_url, label, image_url, revenue, clicks, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)`).run(id, shortCode, originalUrl, label, imageUrl || null, now);
  return { id, shortCode, originalUrl, label, imageUrl: imageUrl || null, revenue: 0, clicks: 0, createdAt: now };
}

export function dbGetAllLinks(): StudioLink[] {
  const db = getStudioDb();
  const rows = db.prepare("SELECT * FROM studio_links ORDER BY created_at DESC").all() as any[];
  return rows.map(toStudioLink);
}

export function dbGetLinkByShortCode(shortCode: string): StudioLink | null {
  const db = getStudioDb();
  const row = db.prepare("SELECT * FROM studio_links WHERE short_code = ?").get(shortCode) as any;
  return row ? toStudioLink(row) : null;
}

export function dbGetLinkById(id: string): StudioLink | null {
  const db = getStudioDb();
  const row = db.prepare("SELECT * FROM studio_links WHERE id = ? OR short_code = ?").get(id, id) as any;
  return row ? toStudioLink(row) : null;
}

export function dbRecordClick(linkId: string, userAgent: string, referer: string): void {
  const db = getStudioDb();
  db.prepare("UPDATE studio_links SET clicks = clicks + 1 WHERE id = ?").run(linkId);
  db.prepare("INSERT INTO studio_link_clicks (link_id, timestamp, user_agent, referer) VALUES (?, ?, ?, ?)").run(linkId, new Date().toISOString(), userAgent.slice(0, 200), referer.slice(0, 200));
}

export function dbUpdateRevenue(shortCode: string, revenue: number): StudioLink | null {
  const db = getStudioDb();
  db.prepare("UPDATE studio_links SET revenue = ? WHERE short_code = ?").run(revenue, shortCode);
  return dbGetLinkByShortCode(shortCode);
}

export function dbGetClicksByLinkId(linkId: string): Array<{ timestamp: string; userAgent: string; referer: string }> {
  const db = getStudioDb();
  const rows = db.prepare("SELECT timestamp, user_agent, referer FROM studio_link_clicks WHERE link_id = ? ORDER BY timestamp DESC LIMIT 1000").all(linkId) as any[];
  return rows.map(r => ({ timestamp: r.timestamp, userAgent: r.user_agent, referer: r.referer }));
}

export function dbGetTotalClicks(): number {
  const db = getStudioDb();
  const row = db.prepare("SELECT COALESCE(SUM(clicks), 0) as total FROM studio_links").get() as any;
  return row?.total || 0;
}

export function dbIncrementLinkRevenue(id: string, amount: number): void {
  const db = getStudioDb();
  db.prepare("UPDATE studio_links SET revenue = revenue + ? WHERE id = ?").run(amount, id);
}

export function dbGetUnderperformingLinks(): StudioLink[] {
  const db = getStudioDb();
  // Links older than 1 day with < 5 clicks
  const rows = db.prepare(`
    SELECT * FROM studio_links 
    WHERE julianday('now') - julianday(created_at) > 1 
    AND clicks < 5
  `).all() as any[];
  return rows.map(toStudioLink);
}

function toStudioLink(row: any): StudioLink {
  return {
    id: row.id,
    shortCode: row.short_code,
    originalUrl: row.original_url,
    label: row.label,
    imageUrl: row.image_url,
    revenue: row.revenue || 0,
    clicks: row.clicks || 0,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD — Calendar
// ---------------------------------------------------------------------------
export interface StudioCalendarEntry {
  id: string;
  day: string;
  time: string;
  platform: string;
  productName: string;
  caption: string;
  templateType: string;
  status: string;
  note: string;
  weekOf: string;
  createdAt: string;
}

export function dbGetCalendar(): StudioCalendarEntry[] {
  const db = getStudioDb();
  const rows = db.prepare("SELECT * FROM studio_calendar ORDER BY created_at DESC").all() as any[];
  return rows.map(toCalEntry);
}

export function dbAddCalendarEntry(entry: StudioCalendarEntry): void {
  const db = getStudioDb();
  db.prepare(`INSERT OR REPLACE INTO studio_calendar (id, day, time, platform, product_name, caption, template_type, status, note, week_of, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    entry.id, entry.day, entry.time, entry.platform, entry.productName, entry.caption, entry.templateType, entry.status, entry.note, entry.weekOf, entry.createdAt
  );
}

export function dbDeleteCalendarEntry(id: string): boolean {
  const db = getStudioDb();
  const result = db.prepare("DELETE FROM studio_calendar WHERE id = ?").run(id);
  return (result as any).changes > 0;
}

export function dbClearCalendar(): void {
  const db = getStudioDb();
  db.prepare("DELETE FROM studio_calendar").run();
}

function toCalEntry(row: any): StudioCalendarEntry {
  return {
    id: row.id,
    day: row.day,
    time: row.time,
    platform: row.platform,
    productName: row.product_name,
    caption: row.caption,
    templateType: row.template_type,
    status: row.status,
    note: row.note,
    weekOf: row.week_of,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD — Goals
// ---------------------------------------------------------------------------
export interface StudioGoal {
  id: string;
  metric: string;
  target: number;
  period: string;
  current: number;
  progress: number;
  icon: string;
  createdAt: string;
}

export function dbGetGoals(): StudioGoal[] {
  const db = getStudioDb();
  const rows = db.prepare("SELECT * FROM studio_goals ORDER BY created_at DESC").all() as any[];
  return rows.map(toGoal);
}

export function dbUpsertGoal(goal: StudioGoal): void {
  const db = getStudioDb();
  db.prepare(`INSERT OR REPLACE INTO studio_goals (id, metric, target, period, current_val, progress, icon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    goal.id, goal.metric, goal.target, goal.period, goal.current, goal.progress, goal.icon, goal.createdAt
  );
}

export function dbDeleteGoal(metric: string): void {
  const db = getStudioDb();
  db.prepare("DELETE FROM studio_goals WHERE metric = ?").run(metric);
}

function toGoal(row: any): StudioGoal {
  return {
    id: row.id,
    metric: row.metric,
    target: row.target,
    period: row.period,
    current: row.current_val,
    progress: row.progress,
    icon: row.icon,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Auto-Migration Round 34: Products, Revenue, FB Posts, Alerts
// ---------------------------------------------------------------------------
function migrateProducts(db: DatabaseSync): void {
  const jsonFile = resolveJsonPath("products.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_products").get() as { cnt: number };
    if (existing.cnt > 0) return;
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insert = db.prepare(`INSERT OR IGNORE INTO studio_products (id, name, category, url, platform, price, commission, notes, pipeline_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const p of data) insert.run(p.id, p.name, p.category || 'general', p.url || '', p.platform || 'other', p.price || '', p.commission || '', p.notes || '', p.pipelineCount || 0, p.createdAt || new Date().toISOString());
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} products from JSON → SQLite ✓`);
  } catch (e) { console.error("[Studio-DB] Product migration error:", e); }
}

function migrateRevenue(db: DatabaseSync): void {
  const jsonFile = resolveJsonPath("revenue.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_revenue").get() as { cnt: number };
    if (existing.cnt > 0) return;
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insert = db.prepare(`INSERT OR IGNORE INTO studio_revenue (id, amount, currency, product_name, platform, source, commission, note, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const e of data) insert.run(e.id, e.amount || 0, e.currency || 'THB', e.productName || '', e.platform || 'other', e.source || 'manual', e.commission || 0, e.note || '', e.timestamp || new Date().toISOString());
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} revenue entries from JSON → SQLite ✓`);
  } catch (e) { console.error("[Studio-DB] Revenue migration error:", e); }
}

function migrateFbPosts(db: DatabaseSync): void {
  const jsonFile = resolveJsonPath("fb-posts.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_fb_posts").get() as { cnt: number };
    if (existing.cnt > 0) return;
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insert = db.prepare(`INSERT OR IGNORE INTO studio_fb_posts (id, fb_post_id, message, link, platform, status, error, scheduled_time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const p of data) insert.run(p.id, p.fbPostId || '', p.message || '', p.link || '', p.platform || 'facebook', p.status || 'posted', p.error || '', p.scheduledTime || '', p.timestamp || new Date().toISOString());
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} FB posts from JSON → SQLite ✓`);
  } catch (e) { console.error("[Studio-DB] FB posts migration error:", e); }
}

function migrateAlertRules(db: DatabaseSync): void {
  const jsonFile = resolveJsonPath("alert-rules.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_alert_rules").get() as { cnt: number };
    if (existing.cnt > 0) return;
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insert = db.prepare(`INSERT OR IGNORE INTO studio_alert_rules (id, metric, operator, value, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const r of data) insert.run(r.id, r.metric, r.operator || '<', r.value || 0, r.enabled !== false ? 1 : 0, r.createdAt || new Date().toISOString());
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} alert rules from JSON → SQLite ✓`);
  } catch (e) { console.error("[Studio-DB] Alert rules migration error:", e); }
}

function migrateAlerts(db: DatabaseSync): void {
  const jsonFile = resolveJsonPath("active-alerts.json");
  if (!fs.existsSync(jsonFile)) return;
  try {
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM studio_alerts").get() as { cnt: number };
    if (existing.cnt > 0) return;
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf-8")) as any[];
    const insert = db.prepare(`INSERT OR IGNORE INTO studio_alerts (id, rule_id, type, icon, title, message, metric, current_value, threshold, acknowledged, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const a of data) insert.run(a.id, a.ruleId || '', a.type || 'warning', a.icon || '⚠️', a.title || '', a.message || '', a.metric || '', a.currentValue || 0, a.threshold || 0, a.acknowledged ? 1 : 0, a.timestamp || new Date().toISOString());
    fs.renameSync(jsonFile, jsonFile + ".migrated");
    console.log(`[Studio-DB] Migrated ${data.length} alerts from JSON → SQLite ✓`);
  } catch (e) { console.error("[Studio-DB] Alerts migration error:", e); }
}

// ---------------------------------------------------------------------------
// CRUD — Products
// ---------------------------------------------------------------------------
export interface StudioProduct {
  id: string; name: string; category: string; url: string; platform: string;
  price?: string; commission?: string; notes?: string; pipelineCount: number; createdAt: string;
}

export function dbAddProduct(name: string, url: string, category: string, platform: string): StudioProduct {
  const db = getStudioDb();
  const id = `prod_${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO studio_products (id, name, category, url, platform, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, name, category, url, platform, now);
  return { id, name, category, url, platform, pipelineCount: 0, createdAt: now };
}

export function dbGetProducts(): StudioProduct[] {
  const db = getStudioDb();
  return (db.prepare("SELECT * FROM studio_products ORDER BY created_at DESC").all() as any[]).map(toProduct);
}

export function dbGetProduct(id: string): StudioProduct | null {
  const db = getStudioDb();
  const row = db.prepare("SELECT * FROM studio_products WHERE id = ?").get(id) as any;
  return row ? toProduct(row) : null;
}

export function dbDeleteProduct(id: string): boolean {
  const db = getStudioDb();
  return ((db.prepare("DELETE FROM studio_products WHERE id = ?").run(id) as any).changes || 0) > 0;
}

export function dbIncrementPipelineCount(id: string): void {
  const db = getStudioDb();
  db.prepare("UPDATE studio_products SET pipeline_count = pipeline_count + 1 WHERE id = ?").run(id);
}
function toProduct(r: any): StudioProduct {
  return { id: r.id, name: r.name, category: r.category, url: r.url, platform: r.platform, price: r.price, commission: r.commission, notes: r.notes, pipelineCount: r.pipeline_count || 0, createdAt: r.created_at };
}

// ---------------------------------------------------------------------------
// CRUD — Revenue
// ---------------------------------------------------------------------------
export interface StudioRevenue {
  id: string; amount: number; currency: string; productName: string; platform: string;
  source: string; commission: number; note: string; timestamp: string;
}

export function dbAddRevenue(amount: number, productName: string, note = ""): StudioRevenue {
  const db = getStudioDb();
  const id = `rev_${Date.now().toString(36)}`;
  const platform = productName.toLowerCase().includes("shopee") ? "shopee" : productName.toLowerCase().includes("lazada") ? "lazada" : productName.toLowerCase().includes("tiktok") ? "tiktok" : "other";
  const commission = amount * 0.1;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO studio_revenue (id, amount, currency, product_name, platform, source, commission, note, timestamp) VALUES (?, ?, 'THB', ?, ?, ?, ?, ?, ?)`).run(id, amount, productName, platform, platform, commission, note, now);
  return { id, amount, currency: 'THB', productName, platform, source: platform, commission, note, timestamp: now };
}

export function dbGetRevenueEntries(limit = 100): StudioRevenue[] {
  const db = getStudioDb();
  return (db.prepare("SELECT * FROM studio_revenue ORDER BY timestamp DESC LIMIT ?").all(limit) as any[]).map(toRevenue);
}

export function dbGetRevenueSummary(period: "day" | "week" | "month"): { total: number; commission: number; count: number; byPlatform: Record<string, { total: number; count: number }>; topProducts: Array<{ name: string; total: number; count: number }> } {
  const db = getStudioDb();
  let cutoffSql: string;
  if (period === "day") cutoffSql = "date('now')";
  else if (period === "week") cutoffSql = "date('now', '-7 days')";
  else cutoffSql = "date('now', 'start of month')";

  const rows = db.prepare(`SELECT * FROM studio_revenue WHERE timestamp >= ${cutoffSql}`).all() as any[];
  const byPlatform: Record<string, { total: number; count: number }> = {};
  const byProduct: Record<string, { total: number; count: number }> = {};
  let total = 0, commission = 0;
  for (const r of rows) {
    total += r.amount; commission += r.commission;
    if (!byPlatform[r.platform]) byPlatform[r.platform] = { total: 0, count: 0 };
    byPlatform[r.platform].total += r.amount; byPlatform[r.platform].count++;
    const pn = r.product_name;
    if (!byProduct[pn]) byProduct[pn] = { total: 0, count: 0 };
    byProduct[pn].total += r.amount; byProduct[pn].count++;
  }
  const topProducts = Object.entries(byProduct).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total).slice(0, 5);
  return { total, commission, count: rows.length, byPlatform, topProducts };
}

function toRevenue(r: any): StudioRevenue {
  return { id: r.id, amount: r.amount, currency: r.currency, productName: r.product_name, platform: r.platform, source: r.source, commission: r.commission, note: r.note, timestamp: r.timestamp };
}

// ---------------------------------------------------------------------------
// CRUD — FB Posts
// ---------------------------------------------------------------------------
export interface StudioFbPost {
  id: string; fbPostId: string; message: string; link?: string; platform: string;
  status: "posted" | "failed" | "scheduled"; error?: string; scheduledTime?: string; timestamp: string;
}

export function dbAddFbPost(post: StudioFbPost): void {
  const db = getStudioDb();
  db.prepare(`INSERT OR REPLACE INTO studio_fb_posts (id, fb_post_id, message, link, platform, status, error, scheduled_time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    post.id, post.fbPostId, post.message, post.link || '', post.platform, post.status, post.error || '', post.scheduledTime || '', post.timestamp
  );
}

export function dbGetFbPosts(limit = 20): StudioFbPost[] {
  const db = getStudioDb();
  return (db.prepare("SELECT * FROM studio_fb_posts ORDER BY timestamp DESC LIMIT ?").all(limit) as any[]).map(toFbPost);
}

export function dbGetScheduledFbPosts(): StudioFbPost[] {
  const db = getStudioDb();
  return (db.prepare("SELECT * FROM studio_fb_posts WHERE status = 'scheduled'").all() as any[]).map(toFbPost);
}

export function dbUpdateFbPostStatus(id: string, status: string, fbPostId?: string, error?: string): void {
  const db = getStudioDb();
  db.prepare("UPDATE studio_fb_posts SET status = ?, fb_post_id = COALESCE(?, fb_post_id), error = COALESCE(?, error) WHERE id = ?").run(status, fbPostId || null, error || null, id);
}

function toFbPost(r: any): StudioFbPost {
  return { id: r.id, fbPostId: r.fb_post_id, message: r.message, link: r.link || undefined, platform: r.platform, status: r.status, error: r.error || undefined, scheduledTime: r.scheduled_time || undefined, timestamp: r.timestamp };
}

// ---------------------------------------------------------------------------
// CRUD — Alert Rules & Active Alerts
// ---------------------------------------------------------------------------
export interface StudioAlertRule {
  id: string; metric: string; operator: "<" | ">" | "="; value: number; enabled: boolean; createdAt: string;
}
export interface StudioAlert {
  id: string; ruleId: string; type: "warning" | "critical" | "info"; icon: string;
  title: string; message: string; metric: string; currentValue: number; threshold: number;
  acknowledged: boolean; timestamp: string;
}

export function dbGetAlertRules(): StudioAlertRule[] {
  const db = getStudioDb();
  return (db.prepare("SELECT * FROM studio_alert_rules ORDER BY created_at DESC").all() as any[]).map(r => ({
    id: r.id, metric: r.metric, operator: r.operator, value: r.value, enabled: !!r.enabled, createdAt: r.created_at
  }));
}

export function dbAddAlertRule(rule: StudioAlertRule): void {
  const db = getStudioDb();
  db.prepare(`INSERT INTO studio_alert_rules (id, metric, operator, value, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    rule.id, rule.metric, rule.operator, rule.value, rule.enabled ? 1 : 0, rule.createdAt
  );
}

export function dbGetAlerts(unacknowledgedOnly = false): StudioAlert[] {
  const db = getStudioDb();
  const sql = unacknowledgedOnly ? "SELECT * FROM studio_alerts WHERE acknowledged = 0 ORDER BY timestamp DESC LIMIT 50" : "SELECT * FROM studio_alerts ORDER BY timestamp DESC LIMIT 50";
  return (db.prepare(sql).all() as any[]).map(toAlert);
}

export function dbAddAlert(alert: StudioAlert): void {
  const db = getStudioDb();
  db.prepare(`INSERT INTO studio_alerts (id, rule_id, type, icon, title, message, metric, current_value, threshold, acknowledged, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    alert.id, alert.ruleId, alert.type, alert.icon, alert.title, alert.message, alert.metric, alert.currentValue, alert.threshold, alert.acknowledged ? 1 : 0, alert.timestamp
  );
}

export function dbClearAlerts(): void {
  const db = getStudioDb();
  db.prepare("DELETE FROM studio_alerts").run();
}

export function dbHasRecentAlert(ruleId: string, withinMs: number): boolean {
  const db = getStudioDb();
  const cutoff = new Date(Date.now() - withinMs).toISOString();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM studio_alerts WHERE rule_id = ? AND timestamp > ?").get(ruleId, cutoff) as { cnt: number };
  return row.cnt > 0;
}

function toAlert(r: any): StudioAlert {
  return { id: r.id, ruleId: r.rule_id, type: r.type, icon: r.icon, title: r.title, message: r.message, metric: r.metric, currentValue: r.current_value, threshold: r.threshold, acknowledged: !!r.acknowledged, timestamp: r.timestamp };
}

// ---------------------------------------------------------------------------
// Metric Helpers (for performance-alerts to query from SQLite)
// ---------------------------------------------------------------------------
export function dbGetTodayClickCount(): number {
  const db = getStudioDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM studio_link_clicks WHERE timestamp >= date('now')").get() as { cnt: number };
  return row.cnt;
}

export function dbGetTodayRevenue(): number {
  const db = getStudioDb();
  const row = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM studio_revenue WHERE timestamp >= date('now')").get() as { total: number };
  return row.total;
}

export function dbGetTotalRevenueSum(): number {
  const db = getStudioDb();
  const row = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM studio_revenue").get() as { total: number };
  return row.total;
}

export function dbGetFbPostCount(): number {
  const db = getStudioDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM studio_fb_posts WHERE status = 'posted'").get() as { cnt: number };
  return row.cnt;
}
