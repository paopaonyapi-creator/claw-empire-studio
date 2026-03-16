/**
 * Affiliate Content Studio — Profile Bootstrap
 *
 * Seeds the `officePackProfiles` setting with the affiliate_studio profile
 * so that it's available for hydration when the user selects the pack.
 *
 * Called during server startup. Safe to call multiple times (idempotent).
 */

import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  AFFILIATE_STUDIO_DEPARTMENTS,
  AFFILIATE_STUDIO_AGENTS,
} from "../workflow/packs/affiliate-studio-profile.ts";
import { encryptSecret } from "../../oauth/helpers.ts";

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

/**
 * Seeds API providers (Anthropic, OpenAI, Google) into the `api_providers`
 * table so agents configured with `cli_provider: 'api'` can use them.
 *
 * Also registers CLI-based providers as API-accessible alternatives.
 * CLI tools (claude, codex, gemini) are installed globally, so agents
 * can use either CLI or API pathways.
 *
 * Idempotent — skips providers that already exist.
 */
export function seedAnthropicApiProvider(db: DbLike): void {
  const sessionSecret = process.env.SESSION_SECRET ?? process.env.OAUTH_ENCRYPTION_SECRET ?? "";
  if (!sessionSecret) {
    console.log("[Affiliate Studio] Skipping API provider seed — SESSION_SECRET not set");
    return;
  }

  const providers = [
    {
      envKey: "ANTHROPIC_API_KEY",
      name: "Anthropic",
      type: "anthropic",
      base_url: "https://api.anthropic.com/v1",
      models: ["claude-sonnet-4-20250514", "claude-haiku-35-20241022"],
    },
    {
      envKey: "OPENAI_API_KEY",
      name: "OpenAI",
      type: "openai",
      base_url: "https://api.openai.com/v1",
      models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    },
    {
      envKey: "GOOGLE_AI_API_KEY",
      name: "Google AI",
      type: "google",
      base_url: "https://generativelanguage.googleapis.com/v1beta",
      models: ["gemini-2.0-flash", "gemini-2.0-pro"],
    },
  ];

  for (const prov of providers) {
    const apiKey = process.env[prov.envKey] ?? "";
    if (!apiKey) {
      console.log(`[Affiliate Studio] Skipping ${prov.name} provider — ${prov.envKey} not set`);
      continue;
    }

    // Check if this provider type already exists
    const existingRow = db
      .prepare(`SELECT id FROM api_providers WHERE type = ? LIMIT 1`)
      .get(prov.type) as { id?: string } | undefined;

    if (existingRow?.id) {
      console.log(`[Affiliate Studio] ${prov.name} API provider already exists: ${existingRow.id}`);
      continue;
    }

    const providerId = randomUUID();
    const now = Date.now();

    try {
      db.prepare(
        `INSERT INTO api_providers (
          id, name, type, base_url, api_key_enc, preset_key, enabled,
          models_cache, models_cached_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      ).run(
        providerId,
        prov.name,
        prov.type,
        prov.base_url,
        encryptSecret(apiKey),
        null,
        JSON.stringify(prov.models),
        now,
        now,
        now,
      );
      console.log(`[Affiliate Studio] Seeded ${prov.name} API provider: ${providerId}`);
    } catch (err: any) {
      console.error(`[Affiliate Studio] Failed to seed ${prov.name} provider: ${err.message}`);
    }
  }
}

