import { describe, expect, it } from "vitest";
import { buildWorkflowPackExecutionGuidance } from "./execution-guidance.ts";

describe("buildWorkflowPackExecutionGuidance", () => {
  it("video_preprod는 remotion 기반 실제 mp4 생성 규칙을 포함한다", () => {
    const guidance = buildWorkflowPackExecutionGuidance("video_preprod", "ko", {
      videoArtifactRelativePath: "video_output/VID_기획팀_final.mp4",
    });
    expect(guidance).toContain("video_output/VID_기획팀_final.mp4");
    expect(guidance).toContain("순서 고정");
    expect(guidance).toContain("remotion render");
    expect(guidance).toContain("pnpm exec remotion browser ensure");
    expect(guidance).toContain("[High Quality Direction]");
    expect(guidance).toContain("8~12개 이상 샷");
  });

  it("video_preprod/affiliate_studio 외 워크플로우 팩은 추가 규칙을 주지 않는다", () => {
    expect(buildWorkflowPackExecutionGuidance("development", "ko")).toBe("");
    expect(buildWorkflowPackExecutionGuidance("report", "en")).toBe("");
  });

  it("언어 정보가 없으면 영어 규칙으로 폴백한다", () => {
    const guidance = buildWorkflowPackExecutionGuidance("video_preprod", null);
    expect(guidance).toContain("Fixed order:");
  });

  it("affiliate_studio provides content pipeline execution guidance in English", () => {
    const guidance = buildWorkflowPackExecutionGuidance("affiliate_studio", "en");
    expect(guidance).not.toBe("");
    expect(guidance).toContain("Affiliate Content Studio");
    expect(guidance).toContain("Content Production Pipeline");
    expect(guidance).toContain("Product Analysis");
    expect(guidance).toContain("Hook Generation");
    expect(guidance).toContain("Publish Package");
    expect(guidance).toContain("ปักตะกร้า");
    expect(guidance).toContain("TikTok Affiliate");
    expect(guidance).toContain("Shopee/Lazada");
  });

  it("affiliate_studio provides guidance in Korean", () => {
    const guidance = buildWorkflowPackExecutionGuidance("affiliate_studio", "ko");
    expect(guidance).toContain("실행 파이프라인");
    expect(guidance).toContain("상품 분석");
  });

  it("affiliate_studio falls back to English when language is null", () => {
    const guidance = buildWorkflowPackExecutionGuidance("affiliate_studio", null);
    expect(guidance).toContain("Content Production Pipeline");
  });
});

