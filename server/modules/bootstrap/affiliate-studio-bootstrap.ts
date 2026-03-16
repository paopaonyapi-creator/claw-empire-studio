/**
 * Affiliate Content Studio — Profile Bootstrap
 *
 * Seeds the `officePackProfiles` setting with the affiliate_studio profile
 * so that it's available for hydration when the user selects the pack.
 *
 * Called during server startup. Safe to call multiple times (idempotent).
 */

import type { DatabaseSync } from "node:sqlite";
import {
  AFFILIATE_STUDIO_DEPARTMENTS,
  AFFILIATE_STUDIO_AGENTS,
} from "../workflow/packs/affiliate-studio-profile.ts";

type DbLike = Pick<DatabaseSync, "prepare">;

function safeJsonParse(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Ensures the `officePackProfiles` setting includes the `affiliate_studio` profile.
 * If the setting doesn't exist yet, creates it with the affiliate_studio profile.
 * If it exists but doesn't have affiliate_studio, merges it in.
 * If it already has affiliate_studio, does nothing.
 */
export function seedAffiliateStudioProfile(db: DbLike): void {
  const SETTINGS_KEY = "officePackProfiles";
  const PACK_KEY = "affiliate_studio";

  // Read existing profiles
  const row = db.prepare("SELECT value FROM settings WHERE key = ? LIMIT 1").get(SETTINGS_KEY) as
    | { value?: unknown }
    | undefined;

  let profiles: Record<string, unknown> = {};

  if (row?.value) {
    const parsed = safeJsonParse(row.value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      profiles = parsed as Record<string, unknown>;
    }
  }

  // Check if affiliate_studio profile already exists
  if (profiles[PACK_KEY]) {
    return; // Already seeded
  }

  // Build the profile in the format expected by office-pack-agent-hydration
  const profile = {
    departments: AFFILIATE_STUDIO_DEPARTMENTS.map((dept) => ({
      id: dept.id,
      name: dept.name,
      name_ko: dept.name_ko,
      name_ja: dept.name_ja,
      name_zh: dept.name_zh,
      icon: dept.icon,
      color: dept.color,
      description: dept.description,
      prompt: dept.prompt,
      sort_order: dept.sort_order,
    })),
    agents: AFFILIATE_STUDIO_AGENTS.map((agent) => ({
      id: agent.id,
      name: agent.name,
      name_ko: agent.name_ko,
      name_ja: agent.name_ja,
      name_zh: agent.name_zh,
      department_id: agent.department_id,
      role: agent.role,
      acts_as_planning_leader: agent.acts_as_planning_leader,
      cli_provider: agent.cli_provider,
      avatar_emoji: agent.avatar_emoji,
      personality: agent.personality,
    })),
  };

  // Merge into existing profiles
  profiles[PACK_KEY] = profile;

  const serialized = JSON.stringify(profiles);

  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(SETTINGS_KEY, serialized);

  // Also set branding defaults for the Content Studio
  // (only on first seed — checks if companyName is still default)
  const companyRow = db.prepare("SELECT value FROM settings WHERE key = 'companyName' LIMIT 1").get() as
    | { value?: unknown }
    | undefined;
  const currentName = String(companyRow?.value ?? "").trim();
  if (!currentName || currentName === "Claw-Empire") {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run("companyName", "Content Studio");
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run("ceoName", "CEO");
  }

  // Auto-select the affiliate_studio pack if no pack is selected yet
  const packRow = db.prepare("SELECT value FROM settings WHERE key = 'officeWorkflowPack' LIMIT 1").get() as
    | { value?: unknown }
    | undefined;
  const currentPack = String(packRow?.value ?? "").trim();
  if (!currentPack || currentPack === "development") {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run("officeWorkflowPack", JSON.stringify("affiliate_studio"));
  }

  console.log(
    `[Affiliate Studio] Seeded office pack profile: ${AFFILIATE_STUDIO_DEPARTMENTS.length} departments, ${AFFILIATE_STUDIO_AGENTS.length} agents`,
  );
}
