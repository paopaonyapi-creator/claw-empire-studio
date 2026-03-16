import { describe, expect, it } from "vitest";
import {
  AFFILIATE_STUDIO_DEPARTMENTS,
  AFFILIATE_STUDIO_AGENTS,
  getAffiliateStudioProfile,
} from "./affiliate-studio-profile.ts";
import { WORKFLOW_PACK_KEYS, DEFAULT_WORKFLOW_PACK_SEEDS } from "./definitions.ts";

describe("affiliate_studio pack registration", () => {
  it("affiliate_studio is in WORKFLOW_PACK_KEYS", () => {
    expect(WORKFLOW_PACK_KEYS).toContain("affiliate_studio");
  });

  it("affiliate_studio has a seed in DEFAULT_WORKFLOW_PACK_SEEDS", () => {
    const seed = DEFAULT_WORKFLOW_PACK_SEEDS.find((s) => s.key === "affiliate_studio");
    expect(seed).toBeDefined();
    expect(seed!.name).toBe("Affiliate Content Studio");
    expect(seed!.routingKeywords).toContain("affiliate");
    expect(seed!.routingKeywords).toContain("tiktok");
    expect(seed!.routingKeywords).toContain("shopee");
    expect(seed!.routingKeywords).toContain("lazada");
    expect(seed!.routingKeywords).toContain("ปักตะกร้า");
  });

  it("seed has required inputSchema fields", () => {
    const seed = DEFAULT_WORKFLOW_PACK_SEEDS.find((s) => s.key === "affiliate_studio")!;
    expect(seed.inputSchema.required).toContain("product_or_brief");
    expect(seed.inputSchema.optional).toContain("product_url");
    expect(seed.inputSchema.optional).toContain("target_platforms");
  });

  it("seed has output template sections", () => {
    const seed = DEFAULT_WORKFLOW_PACK_SEEDS.find((s) => s.key === "affiliate_studio")!;
    expect(seed.outputTemplate.sections.length).toBeGreaterThanOrEqual(10);
    expect(seed.outputTemplate.sections).toContain("hooks");
    expect(seed.outputTemplate.sections).toContain("tiktok_affiliate_script");
    expect(seed.outputTemplate.sections).toContain("publish_package");
  });
});

describe("affiliate_studio office pack profile", () => {
  it("defines exactly 4 departments", () => {
    expect(AFFILIATE_STUDIO_DEPARTMENTS).toHaveLength(4);
  });

  it("departments have required fields", () => {
    for (const dept of AFFILIATE_STUDIO_DEPARTMENTS) {
      expect(dept.id).toBeTruthy();
      expect(dept.name).toBeTruthy();
      expect(dept.icon).toBeTruthy();
      expect(dept.color).toBeTruthy();
      expect(dept.description).toBeTruthy();
      expect(dept.prompt).toBeTruthy();
    }
  });

  it("defines exactly 10 agents", () => {
    expect(AFFILIATE_STUDIO_AGENTS).toHaveLength(10);
  });

  it("agents follow affiliate_studio-seed-N ID pattern", () => {
    for (let i = 0; i < AFFILIATE_STUDIO_AGENTS.length; i++) {
      expect(AFFILIATE_STUDIO_AGENTS[i].id).toBe(`affiliate_studio-seed-${i + 1}`);
    }
  });

  it("agents have required fields", () => {
    for (const agent of AFFILIATE_STUDIO_AGENTS) {
      expect(agent.name).toBeTruthy();
      expect(agent.department_id).toBeTruthy();
      expect(agent.role).toBeTruthy();
      expect(agent.cli_provider).toBeTruthy();
      expect(agent.avatar_emoji).toBeTruthy();
      expect(agent.personality).toBeTruthy();
    }
  });

  it("all agent department_ids reference valid departments", () => {
    const deptIds = AFFILIATE_STUDIO_DEPARTMENTS.map((d) => d.id);
    for (const agent of AFFILIATE_STUDIO_AGENTS) {
      expect(deptIds).toContain(agent.department_id);
    }
  });

  it("exactly one agent has team_leader role", () => {
    const leaders = AFFILIATE_STUDIO_AGENTS.filter((a) => a.role === "team_leader");
    expect(leaders).toHaveLength(1);
    expect(leaders[0].name).toBe("Chief Content Strategist");
  });

  it("getAffiliateStudioProfile returns departments and agents", () => {
    const profile = getAffiliateStudioProfile();
    expect(profile.departments).toHaveLength(4);
    expect(profile.agents).toHaveLength(10);
  });
});
