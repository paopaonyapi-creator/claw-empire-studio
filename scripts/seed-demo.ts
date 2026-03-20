/**
 * Seed Demo Data — Populate Dashboard with realistic mock data
 * Run: npx tsx scripts/seed-demo.ts
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DB_PATH = path.resolve("claw-empire.sqlite");
if (!fs.existsSync(DB_PATH)) {
  console.error("❌ Database not found:", DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000");

const now = Date.now();
const day = 86400000;

// Helpers
function ago(ms: number): number { return now - ms; }
function isoAgo(ms: number): string { return new Date(now - ms).toISOString(); }

console.log("\n🌱 Seeding demo data...\n");

// ---------------------------------------------------------------------------
// 1. Create a Demo Project
// ---------------------------------------------------------------------------
const projectId = `proj_demo_${Date.now().toString(36)}`;
const existingProject = db.prepare("SELECT id FROM projects LIMIT 1").get() as any;
if (!existingProject) {
  db.prepare(`INSERT INTO projects (id, name, project_path, core_goal, default_pack_key, last_used_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    projectId,
    "AFF - สตูดิโอคอนเทนต์พันธมิตร",
    "/projects/affiliate-studio",
    "สร้างคอนเทนต์สำหรับ affiliate marketing บน TikTok, Facebook, Instagram",
    "affiliate_studio",
    now,
    ago(30 * day),
    now
  );
  console.log("✅ Created demo project:", projectId);
} else {
  console.log("ℹ️  Project already exists:", existingProject.id);
}

const activeProjectId = existingProject?.id || projectId;

// ---------------------------------------------------------------------------
// 2. Get existing agents and departments
// ---------------------------------------------------------------------------
const agents = db.prepare("SELECT id, name, department_id FROM agents").all() as { id: string; name: string; department_id: string }[];
const departments = db.prepare("SELECT id, name FROM departments").all() as { id: string; name: string }[];

console.log(`📋 Found ${agents.length} agents, ${departments.length} departments`);

if (agents.length === 0) {
  console.log("⚠️  No agents found. The pack may not be hydrated. Skipping task seeding.");
} else {
  // ---------------------------------------------------------------------------
  // 3. Seed Demo Tasks (mix of statuses)
  // ---------------------------------------------------------------------------
  const existingTasks = db.prepare("SELECT COUNT(*) as cnt FROM tasks").get() as { cnt: number };
  if (existingTasks.cnt < 5) {
    const taskData = [
      { title: "เขียน TikTok Script: ครีมกันแดด SPF50", status: "done", daysAgo: 7 },
      { title: "วิเคราะห์เทรนด์ TikTok สัปดาห์นี้", status: "done", daysAgo: 5 },
      { title: "สร้าง Thumbnail สินค้าเซรั่มหน้าใส", status: "done", daysAgo: 4 },
      { title: "เขียน Facebook Post: รีวิวครีมบำรุง", status: "done", daysAgo: 3 },
      { title: "วิจัยคู่แข่ง: ตลาดสกินแคร์บน Shopee", status: "done", daysAgo: 2 },
      { title: "สร้าง Content Calendar เดือนหน้า", status: "done", daysAgo: 1 },
      { title: "เขียนรีวิวสินค้า: แป้งพัฟ Cathy Doll", status: "in_progress", daysAgo: 0 },
      { title: "ออกแบบ Hook สำหรับคลิป Lazada", status: "in_progress", daysAgo: 0 },
      { title: "วิเคราะห์ Engagement Rate เดือนที่ผ่านมา", status: "planned", daysAgo: 0 },
      { title: "สร้าง A/B Test Caption สำหรับ IG Reels", status: "inbox", daysAgo: 0 },
      { title: "เขียนสคริปต์ TikTok: น้ำหอมราคาถูก", status: "inbox", daysAgo: 0 },
      { title: "วางแผนแคมเปญ 7.7 Sale", status: "inbox", daysAgo: 0 },
    ];

    const insertTask = db.prepare(`INSERT OR IGNORE INTO tasks (id, title, description, department_id, assigned_agent_id, project_id, status, priority, task_type, workflow_pack_key, started_at, completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (let i = 0; i < taskData.length; i++) {
      const t = taskData[i];
      const agent = agents[i % agents.length];
      const taskId = randomUUID();
      const createdAt = ago(t.daysAgo * day + Math.random() * day);
      const startedAt = t.status !== "inbox" ? createdAt + 60000 : null;
      const completedAt = t.status === "done" ? createdAt + (Math.random() * 2 + 0.5) * 3600000 : null;

      insertTask.run(
        taskId,
        t.title,
        `งาน: ${t.title}`,
        agent.department_id,
        agent.id,
        activeProjectId,
        t.status,
        Math.floor(Math.random() * 3),
        "general",
        "affiliate_studio",
        startedAt,
        completedAt,
        createdAt,
        completedAt || createdAt
      );
    }
    console.log(`✅ Created ${taskData.length} demo tasks`);

    // Update agent stats
    for (const agent of agents) {
      const done = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE assigned_agent_id = ? AND status = 'done'").get(agent.id) as { cnt: number };
      db.prepare("UPDATE agents SET stats_tasks_done = ?, stats_xp = ? WHERE id = ?").run(done.cnt, done.cnt * 150 + Math.floor(Math.random() * 500), agent.id);
    }
    console.log("✅ Updated agent stats");
  } else {
    console.log(`ℹ️  Already have ${existingTasks.cnt} tasks, skipping task seed`);
  }
}

// ---------------------------------------------------------------------------
// 4. Seed Revenue Data
// ---------------------------------------------------------------------------
const existingRevenue = db.prepare("SELECT COUNT(*) as cnt FROM studio_revenue").get() as { cnt: number };
if (existingRevenue.cnt < 5) {
  const revenueData = [
    { amount: 450, product: "ครีมกันแดด SPF50 (Shopee)", platform: "shopee", daysAgo: 14 },
    { amount: 320, product: "เซรั่มวิตามินซี (Lazada)", platform: "lazada", daysAgo: 12 },
    { amount: 890, product: "แป้งพัฟ Cathy Doll (Shopee)", platform: "shopee", daysAgo: 10 },
    { amount: 150, product: "ลิปสติก 3CE (TikTok Shop)", platform: "tiktok", daysAgo: 8 },
    { amount: 1200, product: "เซ็ตสกินแคร์ Laneige (Lazada)", platform: "lazada", daysAgo: 6 },
    { amount: 560, product: "น้ำหอม Jo Malone (Shopee)", platform: "shopee", daysAgo: 4 },
    { amount: 280, product: "มาสก์หน้า Mediheal (TikTok Shop)", platform: "tiktok", daysAgo: 3 },
    { amount: 750, product: "ครีมบำรุง Olay (Shopee)", platform: "shopee", daysAgo: 2 },
    { amount: 420, product: "แชมพู Dove (Lazada)", platform: "lazada", daysAgo: 1 },
    { amount: 680, product: "เซ็ตเมคอัพ Maybelline (TikTok Shop)", platform: "tiktok", daysAgo: 0 },
  ];

  const insertRev = db.prepare(`INSERT INTO studio_revenue (id, amount, currency, product_name, platform, source, commission, note, timestamp)
    VALUES (?, ?, 'THB', ?, ?, ?, ?, ?, ?)`);

  for (const r of revenueData) {
    insertRev.run(
      `rev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      r.amount,
      r.product,
      r.platform,
      r.platform,
      r.amount * 0.1,
      "Demo revenue",
      isoAgo(r.daysAgo * day + Math.random() * day / 2)
    );
  }
  console.log(`✅ Seeded ${revenueData.length} revenue entries (total ฿${revenueData.reduce((s, r) => s + r.amount, 0)})`);
} else {
  console.log(`ℹ️  Already have ${existingRevenue.cnt} revenue entries, skipping`);
}

// ---------------------------------------------------------------------------
// 5. Seed Products
// ---------------------------------------------------------------------------
const existingProducts = db.prepare("SELECT COUNT(*) as cnt FROM studio_products").get() as { cnt: number };
if (existingProducts.cnt < 3) {
  const products = [
    { name: "ครีมกันแดด SPF50 Biore", category: "skincare", platform: "shopee", price: "299", commission: "8%" },
    { name: "เซรั่มวิตามินซี Garnier", category: "skincare", platform: "lazada", price: "359", commission: "10%" },
    { name: "ลิปทินต์ 3CE Velvet", category: "makeup", platform: "tiktok", price: "450", commission: "12%" },
    { name: "แป้งพัฟ Cathy Doll", category: "makeup", platform: "shopee", price: "199", commission: "8%" },
    { name: "น้ำหอม Jo Malone 30ml", category: "fragrance", platform: "shopee", price: "2490", commission: "5%" },
  ];

  const insertProd = db.prepare(`INSERT INTO studio_products (id, name, category, url, platform, price, commission, notes, pipeline_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const p of products) {
    insertProd.run(
      `prod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      p.name,
      p.category,
      `https://${p.platform}.co.th/product/${Math.random().toString(36).slice(2, 10)}`,
      p.platform,
      p.price,
      p.commission,
      "สินค้า demo",
      Math.floor(Math.random() * 5) + 1,
      isoAgo(Math.random() * 14 * day)
    );
  }
  console.log(`✅ Seeded ${products.length} products`);
} else {
  console.log(`ℹ️  Already have ${existingProducts.cnt} products, skipping`);
}

// ---------------------------------------------------------------------------
// 6. Seed Goals
// ---------------------------------------------------------------------------
const existingGoals = db.prepare("SELECT COUNT(*) as cnt FROM studio_goals").get() as { cnt: number };
if (existingGoals.cnt < 2) {
  const goals = [
    { metric: "revenue_monthly", target: 10000, current: 5700, icon: "💰" },
    { metric: "content_weekly", target: 15, current: 8, icon: "📝" },
    { metric: "clicks_daily", target: 100, current: 42, icon: "🔗" },
    { metric: "engagement_rate", target: 5, current: 3.2, icon: "📊" },
  ];

  const insertGoal = db.prepare(`INSERT OR REPLACE INTO studio_goals (id, metric, target, period, current_val, progress, icon, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const g of goals) {
    const progress = Math.round((g.current / g.target) * 100);
    insertGoal.run(
      `goal_${g.metric}`,
      g.metric,
      g.target,
      g.metric.includes("daily") ? "daily" : g.metric.includes("weekly") ? "weekly" : "monthly",
      g.current,
      progress,
      g.icon,
      isoAgo(7 * day)
    );
  }
  console.log(`✅ Seeded ${goals.length} goals`);
} else {
  console.log(`ℹ️  Already have ${existingGoals.cnt} goals, skipping`);
}

// ---------------------------------------------------------------------------
// 7. Seed Calendar
// ---------------------------------------------------------------------------
const existingCal = db.prepare("SELECT COUNT(*) as cnt FROM studio_calendar").get() as { cnt: number };
if (existingCal.cnt < 3) {
  const today = new Date();
  const daysOfWeek = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
  const calEntries = [
    { day: daysOfWeek[today.getDay() || 6], time: "10:00", platform: "tiktok", product: "ครีมกันแดด SPF50", type: "hook", status: "posted" },
    { day: daysOfWeek[today.getDay() || 6], time: "14:00", platform: "facebook", product: "เซรั่มวิตซี", type: "review", status: "scheduled" },
    { day: daysOfWeek[(today.getDay() + 1) % 7 || 6], time: "09:00", platform: "tiktok", product: "ลิปทินต์ 3CE", type: "hook", status: "scheduled" },
    { day: daysOfWeek[(today.getDay() + 1) % 7 || 6], time: "18:00", platform: "instagram", product: "น้ำหอม Jo Malone", type: "carousel", status: "scheduled" },
    { day: daysOfWeek[(today.getDay() + 2) % 7 || 6], time: "12:00", platform: "tiktok", product: "แป้งพัฟ Cathy Doll", type: "unboxing", status: "scheduled" },
  ];

  const insertCal = db.prepare(`INSERT INTO studio_calendar (id, day, time, platform, product_name, caption, template_type, status, note, week_of, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const c of calEntries) {
    insertCal.run(
      `cal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      c.day, c.time, c.platform, c.product,
      `${c.type === "hook" ? "🔥 " : "✨ "}${c.product} — ${c.type}`,
      c.type, c.status, "", "",
      new Date().toISOString()
    );
  }
  console.log(`✅ Seeded ${calEntries.length} calendar entries`);
} else {
  console.log(`ℹ️  Already have ${existingCal.cnt} calendar entries, skipping`);
}

// ---------------------------------------------------------------------------
// 8. Seed Affiliate Links
// ---------------------------------------------------------------------------
const existingLinks = db.prepare("SELECT COUNT(*) as cnt FROM studio_links").get() as { cnt: number };
if (existingLinks.cnt < 3) {
  const links = [
    { code: "spf50", url: "https://shopee.co.th/product/12345", label: "ครีมกันแดด SPF50", clicks: 87, revenue: 1350 },
    { code: "serum", url: "https://lazada.co.th/product/67890", label: "เซรั่มวิตซี Garnier", clicks: 45, revenue: 640 },
    { code: "lip3ce", url: "https://tiktok.com/shop/98765", label: "ลิปทินต์ 3CE", clicks: 123, revenue: 2100 },
    { code: "cathydoll", url: "https://shopee.co.th/product/54321", label: "แป้งพัฟ Cathy Doll", clicks: 64, revenue: 796 },
  ];

  const insertLink = db.prepare(`INSERT INTO studio_links (id, short_code, original_url, label, revenue, clicks, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  for (const l of links) {
    insertLink.run(
      `link_${l.code}`,
      l.code,
      l.url,
      l.label,
      l.revenue,
      l.clicks,
      isoAgo(Math.random() * 14 * day)
    );
  }
  console.log(`✅ Seeded ${links.length} affiliate links`);
} else {
  console.log(`ℹ️  Already have ${existingLinks.cnt} links, skipping`);
}

// ---------------------------------------------------------------------------
// Done!
// ---------------------------------------------------------------------------
db.close();
console.log("\n🎉 Demo data seeded successfully!");
console.log("   Restart the server to see populated dashboard.\n");
