/**
 * Product Manager — Manage affiliate products for content pipelines
 *
 * CRUD products, link to pipelines, TG commands
 */

import type { Express } from "express";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Data Model
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  category: string;
  url: string;
  platform: string; // shopee, lazada, tiktokshop
  price?: string;
  commission?: string;
  notes?: string;
  createdAt: string;
  pipelineCount: number;
}

const DATA_DIR = process.env.DB_PATH ? join(process.env.DB_PATH, "..") : "./data";
const PRODUCTS_FILE = join(DATA_DIR, "products.json");

function loadProducts(): Product[] {
  try {
    if (existsSync(PRODUCTS_FILE)) {
      return JSON.parse(readFileSync(PRODUCTS_FILE, "utf-8")) as Product[];
    }
  } catch { /* ignore */ }
  return [];
}

function saveProducts(products: Product[]): void {
  try {
    writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
  } catch { /* ignore */ }
}

let products: Product[] = loadProducts();

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
  shopee: "🟠",
  lazada: "🔵",
  tiktokshop: "🎵",
  amazon: "📦",
  other: "🔗",
};

// ---------------------------------------------------------------------------
// CRUD Operations
// ---------------------------------------------------------------------------

export function addProduct(name: string, url: string, category?: string): Product {
  const product: Product = {
    id: `prod_${Date.now()}`,
    name,
    category: category || "general",
    url,
    platform: detectPlatform(url),
    createdAt: new Date().toISOString(),
    pipelineCount: 0,
  };
  products.push(product);
  saveProducts(products);
  return product;
}

export function getProducts(): Product[] {
  return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProduct(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

export function deleteProduct(id: string): boolean {
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return false;
  products.splice(idx, 1);
  saveProducts(products);
  return true;
}

export function incrementPipelineCount(id: string): void {
  const p = products.find(prod => prod.id === id);
  if (p) { p.pipelineCount++; saveProducts(products); }
}

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------

export function handleProductCommand(args: string): string {
  const parts = args.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  // /product — list all
  if (!sub || sub === "list") {
    if (products.length === 0) return "📦 ยังไม่มีสินค้า\n\nเพิ่ม: /product add <ชื่อ> <url>";

    const list = getProducts()
      .slice(0, 10)
      .map((p, i) => {
        const icon = PLATFORM_ICONS[p.platform] || "🔗";
        return `${i + 1}. ${icon} <b>${p.name}</b>\n   🏷 ${p.category} | 🔄 ${p.pipelineCount} pipelines`;
      })
      .join("\n\n");

    return `📦 <b>Products</b> (${products.length})\n\n${list}\n\n💡 /product add <ชื่อ> <url>`;
  }

  // /product add <name> <url> [category]
  if (sub === "add") {
    const nameAndUrl = parts.slice(1).join(" ");
    const urlMatch = nameAndUrl.match(/(https?:\/\/\S+)/);

    if (!urlMatch) {
      return "⚠️ ใส่ URL ด้วย\n\nตัวอย่าง: /product add เครื่องปั่น Philips https://shopee.co.th/xxx";
    }

    const url = urlMatch[1];
    const name = nameAndUrl.replace(url, "").trim();

    if (!name) return "⚠️ ใส่ชื่อสินค้าด้วย";

    const p = addProduct(name, url);
    const icon = PLATFORM_ICONS[p.platform] || "🔗";

    return (
      `✅ <b>Product Added!</b>\n\n` +
      `${icon} ${p.name}\n` +
      `🏷 ${p.category}\n` +
      `🔗 ${p.url.slice(0, 50)}...\n\n` +
      `💡 สร้าง content:\n` +
      `/pipeline-tiktok ${p.name}\n` +
      `/pipeline-review ${p.name}`
    );
  }

  // /product del <number>
  if (sub === "del" || sub === "delete" || sub === "rm") {
    const idx = parseInt(parts[1]) - 1;
    const sorted = getProducts();
    if (isNaN(idx) || idx < 0 || idx >= sorted.length) {
      return "⚠️ ใส่เลขสินค้า เช่น /product del 1";
    }

    const p = sorted[idx];
    deleteProduct(p.id);
    return `🗑 ลบแล้ว: ${p.name}`;
  }

  // /product stats
  if (sub === "stats") {
    const total = products.length;
    const byPlatform = products.reduce((acc, p) => {
      acc[p.platform] = (acc[p.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const totalPipelines = products.reduce((s, p) => s + p.pipelineCount, 0);

    const platformList = Object.entries(byPlatform)
      .map(([k, v]) => `${PLATFORM_ICONS[k] || "🔗"} ${k}: ${v}`)
      .join("\n");

    return (
      `📊 <b>Product Stats</b>\n\n` +
      `📦 Total: ${total}\n` +
      `🔄 Pipelines run: ${totalPipelines}\n\n` +
      `<b>By Platform:</b>\n${platformList || "ยังไม่มี"}`
    );
  }

  return "⚠️ คำสั่ง: /product [list|add|del|stats]";
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerProductManagerRoutes(app: Express): void {
  app.get("/api/products", (_req, res) => {
    res.json({ ok: true, total: products.length, products: getProducts() });
  });

  app.post("/api/products", (req, res) => {
    const { name, url, category } = req.body as { name?: string; url?: string; category?: string };
    if (!name?.trim()) return res.status(400).json({ ok: false, error: "name required" });
    if (!url?.startsWith("http")) return res.status(400).json({ ok: false, error: "valid URL required" });

    const product = addProduct(name.trim(), url, category);
    res.json({ ok: true, product });
  });

  app.delete("/api/products/:id", (req, res) => {
    const deleted = deleteProduct(req.params.id);
    res.json({ ok: deleted, message: deleted ? "deleted" : "not found" });
  });

  console.log(`[Product Manager] ✅ ${products.length} products loaded`);
}
