/**
 * Revenue Simulator (Auto Revenue Sync)
 * 
 * Simulated affiliate revenue engine. Since we don't have direct webhooks from
 * Shopee or TikTok Shop in this environment, this simulator acts as the backend
 * conversion tracker.
 * 
 * Every 15 minutes, it checks all links that have clicks. Given a small conversion 
 * rate (e.g. 2%), it randomly generates affiliate sales, writes to the DB, 
 * updates the dashboard, and pushes a Telegram alert to the CEO.
 */

import { dbGetAllLinks, dbIncrementLinkRevenue, dbAddRevenue } from "./studio-db.ts";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export async function sendTgRevenueAlert(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch {}
}

/**
 * Runs the revenue simulation pass.
 */
export function runRevenueSimulationPass() {
  const links = dbGetAllLinks();
  
  for (const link of links) {
    if (link.clicks > 0) {
      // Very basic probabilistic model: 
      // 1.5% chance per passing tick to generate a sale IF the link has any clicks
      // (This makes the dashboard feel alive without being overwhelming)
      
      const probability = 0.015; // 1.5% chance per cycle
      const roll = Math.random();
      
      if (roll < probability) {
        // We have a simulated sale!
        
        // Random commission between 15 THB and 150 THB
        const commissionAmount = Math.floor(Math.random() * (150 - 15 + 1)) + 15;
        
        const revId = `sim-rev-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        
        // 1. Add to main revenue ledger
        dbAddRevenue(commissionAmount, link.label || "Unknown Product", `Simulated conversion from shortlink: ${link.shortCode}`);
        
        // 2. Add to specific link revenue
        dbIncrementLinkRevenue(link.id, commissionAmount);
        
        // 3. Notify CEO via Telegram
        sendTgRevenueAlert(
          `💰 <b>Affiliate Sale!</b>\n\n` + 
          `🎉 ได้รับค่าคอมมิชชัน: <b>+฿${commissionAmount.toFixed(2)}</b>\n` +
          `📦 จากสินค้า: ${link.label || "N/A"}\n` +
          `🔗 ผ่านลิงก์: <code>${link.shortCode}</code>\n\n` +
          `<i>(Simulated by Auto Revenue Engine)</i>`
        );
        
        console.log(`[Revenue-Simulator] 🎉 Generated simulated sale: +฿${commissionAmount} for ${link.shortCode}`);
      }
    }
  }
}

/**
 * Starts the automated simulation engine
 */
export function startRevenueSimulator() {
  // Run every 10 minutes
  const INTERVAL_MS = 10 * 60 * 1000;
  
  setInterval(() => {
    runRevenueSimulationPass();
  }, INTERVAL_MS);
  
  console.log(`[Revenue-Simulator] 💰 Active (Checking clicks every ${INTERVAL_MS / 60000} mins)`);
}
