/**
 * Product Manager — Manage affiliate products for content pipelines
 * NOW BACKED BY SQLite (via studio-db.ts).
 */

import type { Express } from "express";
import {
  dbAddProduct, dbGetProducts, dbGetProduct, dbDeleteProduct, dbIncrementPipelineCount,
  getStudioDb, type StudioProduct,
} from "./studio-db.ts";

// ---------------------------------------------------------------------------
// Platform Detection
// ---------------------------------------------------------------------------
function detectPlatform(url: string): string {
  if (url.includes("shopee")) return "shopee";
  if (url.includes("lazada")) return "lazada";
  if (url.includes("tiktok")) return "tiktokshop";
  if (url.includes("amazon")) return "amazon";
  return "other";
}

const PLATFORM_ICONS: Record<string, string> = {
  shopee: "🟠", lazada: "🔵", tiktokshop: "🎵", amazon: "📦", other: "🔗",
};

// ---------------------------------------------------------------------------
// CRUD Operations (delegated to studio-db)
// ---------------------------------------------------------------------------
export function addProduct(name: string, url: string, category?: string): StudioProduct {
  return dbAddProduct(name, url, category || "general", detectPlatform(url));
}

export function getProducts(): StudioProduct[] {
  return dbGetProducts();
}

export function getProduct(id: string): StudioProduct | undefined {
  return dbGetProduct(id) || undefined;
}

export function deleteProduct(id: string): boolean {
  return dbDeleteProduct(id);
}

export function incrementPipelineCount(id: string): void {
  dbIncrementPipelineCount(id);
}

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------
export function handleProductCommand(args: string): string {
  const parts = args.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  if (!sub || sub === "list") {
    const products = dbGetProducts();
    if (products.length === 0) return "📦 ยังไม่มีสินค้า\n\nเพิ่ม: /product add <ชื่อ> <url>";

    const list = products.slice(0, 10).map((p, i) => {
      const icon = PLATFORM_ICONS[p.platform] || "🔗";
      return `${i + 1}. ${icon} <b>${p.name}</b>\n   🏷 ${p.category} | 🔄 ${p.pipelineCount} pipelines`;
    }).join("\n\n");

    return `📦 <b>Products</b> (${products.length})\n\n${list}\n\n💡 /product add <ชื่อ> <url>`;
  }

  if (sub === "add") {
    const nameAndUrl = parts.slice(1).join(" ");
    const urlMatch = nameAndUrl.match(/(https?:\/\/\S+)/);
    if (!urlMatch) return "⚠️ ใส่ URL ด้วย\n\nตัวอย่าง: /product add เครื่องปั่น Philips https://shopee.co.th/xxx";

    const url = urlMatch[1];
    const name = nameAndUrl.replace(url, "").trim();
    if (!name) return "⚠️ ใส่ชื่อสินค้าด้วย";

    const p = addProduct(name, url);
    const icon = PLATFORM_ICONS[p.platform] || "🔗";
    return `✅ <b>Product Added!</b>\n\n${icon} ${p.name}\n🏷 ${p.category}\n🔗 ${p.url.slice(0, 50)}...\n\n💡 สร้าง content:\n/pipeline-tiktok ${p.name}\n/pipeline-review ${p.name}`;
  }

  if (sub === "del" || sub === "delete" || sub === "rm") {
    const idx = parseInt(parts[1]) - 1;
    const sorted = dbGetProducts();
    if (isNaN(idx) || idx < 0 || idx >= sorted.length) return "⚠️ ใส่เลขสินค้า เช่น /product del 1";
    const p = sorted[idx];
    deleteProduct(p.id);
    return `🗑 ลบแล้ว: ${p.name}`;
  }

  if (sub === "stats") {
    const products = dbGetProducts();
    const byPlatform = products.reduce((acc, p) => { acc[p.platform] = (acc[p.platform] || 0) + 1; return acc; }, {} as Record<string, number>);
    const totalPipelines = products.reduce((s, p) => s + p.pipelineCount, 0);
    const platformList = Object.entries(byPlatform).map(([k, v]) => `${PLATFORM_ICONS[k] || "🔗"} ${k}: ${v}`).join("\n");
    return `📊 <b>Product Stats</b>\n\n📦 Total: ${products.length}\n🔄 Pipelines run: ${totalPipelines}\n\n<b>By Platform:</b>\n${platformList || "ยังไม่มี"}`;
  }

  return "⚠️ คำสั่ง: /product [list|add|del|stats]";
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
export function registerProductManagerRoutes(app: Express): void {
  getStudioDb();

  app.get("/api/products", (_req, res) => {
    const products = dbGetProducts();
    res.json({ ok: true, total: products.length, products });
  });

  app.post("/api/products", (req, res) => {
    const { name, url, category } = req.body as { name?: string; url?: string; category?: string };
    if (!name?.trim()) return res.status(400).json({ ok: false, error: "name required" });
    if (!url?.startsWith("http")) return res.status(400).json({ ok: false, error: "valid URL required" });
    const product = addProduct(name.trim(), url, category);
    res.json({ ok: true, product });
  });

  app.delete("/api/products/:id", (req, res) => {
    const deleted = deleteProduct(String(req.params.id));
    res.json({ ok: deleted, message: deleted ? "deleted" : "not found" });
  });

  const products = dbGetProducts();
  console.log(`[Product Manager] ✅ ${products.length} products loaded from SQLite`);
}
