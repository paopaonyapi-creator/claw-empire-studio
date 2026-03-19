import { useEffect, useState } from "react";
import type { TFunction } from "./model";

interface TodayKpi {
  today: { done: number; created: number };
  week: { done: number; created: number };
  pipeline: { trend_reports: number; scripts: number; thumbnails: number };
  agent_productivity: Array<{ id: string; name: string; tasks_today: number; stats_xp: number }>;
}

interface DashboardTodayKpiProps {
  t: TFunction;
  numberFormatter: Intl.NumberFormat;
}

export function DashboardTodayKpi({ t, numberFormatter }: DashboardTodayKpiProps) {
  const [kpi, setKpi] = useState<TodayKpi | null>(null);
  const [linksData, setLinksData] = useState<{ total: number; totalClicks: number } | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("claw_api_auth_token") || "";
    const csrf = sessionStorage.getItem("claw_api_csrf_token") || "";
    fetch("/api/dashboard/today", {
      headers: { Authorization: `Bearer ${token}`, "x-csrf-token": csrf },
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setKpi(d))
      .catch(() => {});

    fetch("/api/links")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLinksData(d))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch("/api/dashboard/today", {
        headers: { Authorization: `Bearer ${token}`, "x-csrf-token": csrf },
        credentials: "same-origin",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setKpi(d))
        .catch(() => {});

      fetch("/api/links")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setLinksData(d))
        .catch(() => {});
    }, 15_000);

    return () => clearInterval(interval);
  }, []);

  if (!kpi) return null;

  const pipelineSteps = [
    {
      label: t({ ko: "트렌드", en: "Trends", ja: "トレンド", zh: "趋势" , th: "Trends" }),
      count: kpi.pipeline.trend_reports,
      emoji: "🔍",
      color: "#8b5cf6",
    },
    {
      label: t({ ko: "스크립트", en: "Scripts", ja: "脚本", zh: "脚本" , th: "Scripts" }),
      count: kpi.pipeline.scripts,
      emoji: "✍️",
      color: "#3b82f6",
    },
    {
      label: t({ ko: "썸네일", en: "Thumbnails", ja: "サムネイル", zh: "缩略图" , th: "Thumbnails" }),
      count: kpi.pipeline.thumbnails,
      emoji: "🎨",
      color: "#10b981",
    },
  ];

  const totalPipeline = pipelineSteps.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Today / Week Stats */}
      <div className="game-panel relative overflow-hidden p-4">
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
          style={{ background: "linear-gradient(90deg, transparent, #f59e0b, transparent)" }}
        />
        <div className="flex items-center gap-2 mb-3">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-sm"
            style={{ boxShadow: "0 0 8px rgba(245,158,11,0.3)" }}
          >
            🔥
          </span>
          <h3
            className="text-xs font-black uppercase tracking-wider"
            style={{ color: "var(--th-text-primary)" }}
          >
            TRAFFIC PERFORMANCE
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 text-center">
            <p className="text-2xl font-black text-emerald-400" style={{ textShadow: "0 0 15px rgba(16,185,129,0.4)" }}>
              {numberFormatter.format(linksData?.totalClicks || 0)}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--th-text-muted)" }}>
              TOTAL CLICKS
            </p>
          </div>
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/[0.06] p-3 text-center">
            <p className="text-2xl font-black text-blue-400" style={{ textShadow: "0 0 15px rgba(59,130,246,0.4)" }}>
              {numberFormatter.format(linksData?.total || 0)}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--th-text-muted)" }}>
              ACTIVE LINKS
            </p>
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[9px]" style={{ color: "var(--th-text-muted)" }}>
          <span>
            {t({ ko: "생성", en: "Created", ja: "作成", zh: "创建", th: "สร้าง" })}: {kpi.today.created}{" "}
            {t({ ko: "건", en: "", ja: "件", zh: "项" , th: "" })}
          </span>
          <span>
            {t({ ko: "이번 주 생성", en: "Week created", ja: "今週作成", zh: "本周创建" , th: "Week created" })}: {kpi.week.created}
          </span>
        </div>
      </div>

      {/* Content Pipeline */}
      <div className="game-panel relative overflow-hidden p-4">
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
          style={{ background: "linear-gradient(90deg, transparent, #8b5cf6, #3b82f6, #10b981, transparent)" }}
        />
        <div className="flex items-center gap-2 mb-3">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-sm"
            style={{ boxShadow: "0 0 8px rgba(139,92,246,0.3)" }}
          >
            🔄
          </span>
          <h3
            className="text-xs font-black uppercase tracking-wider"
            style={{ color: "var(--th-text-primary)" }}
          >
            {t({ ko: "파이프라인", en: "CONTENT PIPELINE", ja: "パイプライン", zh: "内容管线" , th: "CONTENT PIPELINE" })}
          </h3>
          <span className="ml-auto text-[9px] font-bold text-violet-300/60">
            {totalPipeline} {t({ ko: "건", en: "items", ja: "件", zh: "项" , th: "items" })}
          </span>
        </div>
        <div className="space-y-2.5">
          {pipelineSteps.map((step, idx) => (
            <div key={step.label} className="flex items-center gap-2.5">
              <span className="text-lg">{step.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold" style={{ color: "var(--th-text-primary)" }}>
                    {step.label}
                  </span>
                  <span className="font-mono text-[10px] font-bold" style={{ color: step.color }}>
                    {step.count}
                  </span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.04]">
                  <div
                    className="xp-bar-fill h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${totalPipeline > 0 ? Math.max((step.count / Math.max(totalPipeline, 1)) * 100, step.count > 0 ? 15 : 0) : 0}%`,
                      background: `linear-gradient(90deg, ${step.color}80, ${step.color})`,
                      boxShadow: `0 0 8px ${step.color}60`,
                    }}
                  />
                </div>
              </div>
              {idx < pipelineSteps.length - 1 && (
                <span className="text-[10px] text-white/20">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
