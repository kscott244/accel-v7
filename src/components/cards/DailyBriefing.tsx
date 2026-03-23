"use client";

import { useMemo } from "react";
import type { Office } from "@/types";
import type { Insight } from "@/lib/insights";
import { generateBriefing } from "@/lib/insights";
import { WEEK_ROUTES } from "@/data";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtK, fmtCurrency, fmtPct, fmtPhone, VP_CONFIG } from "@/lib/utils";

interface BriefingProps {
  onOpenSearch: () => void;
  onSelectOffice: (office: Office) => void;
}

function safeBriefing() {
  try {
    return generateBriefing();
  } catch (e) {
    console.error("[DailyBriefing] generateBriefing failed:", e);
    const now = new Date();
    return {
      greeting: "Good morning",
      dateLabel: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
      zone: "",
      quotaSnap: { pct: 0, credited: 0, target: 0, gap: 0, daysLeft: 0, dailyNeeded: 0 },
      todayStops: 0,
      criticalAlerts: [],
      opportunities: [],
      positives: [],
      topCallbacks: [],
    };
  }
}

export function DailyBriefing({ onOpenSearch, onSelectOffice }: BriefingProps) {
  const briefing = useMemo(() => safeBriefing(), []);
  const todayStops = WEEK_ROUTES.routes[briefing.dayOfWeek] || [];

  const { quotaSnap } = briefing;

  return (
    <div className="px-4 pt-4 pb-2">
      {/* ══ GREETING ══ */}
      <div className="mb-4">
        <div className="text-[22px] font-bold tracking-tight text-t1">
          {briefing.greeting}, Ken
        </div>
        <div className="mt-[2px] text-[13px] text-t3">
          {briefing.dateLabel}
          {briefing.zone && (
            <span className="ml-2 rounded-pill bg-s2 border border-b1 px-2 py-[2px] text-[10px] font-semibold text-t3">
              📍 {briefing.zone}
            </span>
          )}
        </div>
      </div>

      {/* ══ SEARCH BAR (tap to open) ══ */}
      <button
        onClick={onOpenSearch}
        className="mb-4 flex w-full items-center gap-3 rounded-xl bg-s1 border border-b1 p-3.5 text-left transition-all active:scale-[.99]"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,.3)" }}
      >
        <svg className="h-5 w-5 text-t4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="flex-1 text-[13px] text-t4">Search offices, doctors, products…</span>
        <span className="rounded-md bg-s3 px-2 py-[3px] text-[9px] font-semibold text-t4">⌘K</span>
      </button>

      {/* ══ QUOTA SNAPSHOT ══ */}
      <div
        className="card-hero mb-3 p-4"
      >
        <div className="relative z-10">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3">Q1 Pace</div>
            <div
              className="mono text-[11px] font-bold"
              style={{ color: quotaSnap.pct >= 90 ? "var(--green)" : quotaSnap.pct >= 70 ? "var(--amber)" : "var(--red)" }}
            >
              {quotaSnap.daysLeft}d left
            </div>
          </div>

          <div className="mb-1 flex items-baseline gap-3">
            <div className="mono text-[28px] font-extrabold text-t1">{fmtPct(quotaSnap.pct)}</div>
            <div className="text-[12px] text-t3">
              {fmtK(quotaSnap.credited)} / {fmtK(quotaSnap.target)}
            </div>
          </div>

          <ProgressBar value={quotaSnap.pct} animated />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-[rgba(248,113,113,.06)] border border-[rgba(248,113,113,.12)] p-2.5">
              <div className="text-[9px] text-t3">Gap to close</div>
              <div className="mono text-[16px] font-bold text-accent-red">{fmtK(quotaSnap.gap)}</div>
            </div>
            <div className="rounded-md bg-[rgba(79,142,247,.06)] border border-[rgba(79,142,247,.12)] p-2.5">
              <div className="text-[9px] text-t3">Need per day</div>
              <div className="mono text-[16px] font-bold text-accent-blue">{fmtCurrency(Math.round(quotaSnap.dailyNeeded))}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ TODAY'S ROUTE ══ */}
      {todayStops.length > 0 && (
        <div className="card mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-t3">
              Today&apos;s Route — {briefing.dayOfWeek}
            </div>
            <div className="mono text-[11px] text-accent-blue">{todayStops.length} stops</div>
          </div>

          <div className="space-y-2">
            {todayStops.slice(0, 5).map((stop, i) => {
              const vpConf = VP_CONFIG[stop.vp] || VP_CONFIG.MONITOR;
              const q1Gap = stop.q1_2025 - stop.q1_2026;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md bg-s2 p-3 transition-colors active:bg-s3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mono text-[11px] font-bold text-t3"
                    style={{ background: `${vpConf.color}15`, border: `1px solid ${vpConf.color}30` }}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-t1">{stop.name}</div>
                    <div className="text-[10px] text-t3">
                      {stop.city}, {stop.state}
                      {stop.doctor && ` · ${stop.doctor}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="mono text-[11px] font-bold text-accent-red">-{fmtK(q1Gap)}</div>
                    {stop.phone && (
                      <a
                        href={`tel:${stop.phone.replace(/\D/g, "")}`}
                        className="text-[9px] text-accent-blue"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📞
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {todayStops.length > 5 && (
            <div className="mt-2 text-center text-[10px] text-t4">
              +{todayStops.length - 5} more stops — see This Week tab
            </div>
          )}
        </div>
      )}

      {/* ══ CRITICAL ALERTS ══ */}
      {briefing.criticalAlerts.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent-red animate-pulse" />
            <div className="text-[10px] font-bold uppercase tracking-wider text-accent-red">
              Needs Attention ({briefing.criticalAlerts.length})
            </div>
          </div>

          <div className="space-y-2">
            {briefing.criticalAlerts.slice(0, 5).map((insight) => (
              <InsightCard key={insight.id} insight={insight} onSelectOffice={onSelectOffice} />
            ))}
          </div>
        </div>
      )}

      {/* ══ OPPORTUNITIES ══ */}
      {briefing.opportunities.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-accent-blue">
            Opportunities ({briefing.opportunities.length})
          </div>
          <div className="space-y-2">
            {briefing.opportunities.map((insight) => (
              <InsightCard key={insight.id} insight={insight} onSelectOffice={onSelectOffice} />
            ))}
          </div>
        </div>
      )}

      {/* ══ WINS ══ */}
      {briefing.positives.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-accent-green">
            Wins & Momentum
          </div>
          <div className="space-y-2">
            {briefing.positives.map((insight) => (
              <InsightCard key={insight.id} insight={insight} onSelectOffice={onSelectOffice} />
            ))}
          </div>
        </div>
      )}

      {/* ══ TOP CALLBACKS ══ */}
      {briefing.topCallbacks.length > 0 && (
        <div className="card mb-3 p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-t3">
            Priority Callbacks
          </div>
          <div className="space-y-2">
            {briefing.topCallbacks.map((o, i) => (
              <button
                key={i}
                onClick={() => onSelectOffice(o)}
                className="flex w-full items-center gap-3 rounded-md bg-s2 p-3 text-left transition-colors active:bg-s3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-t1">{o.name}</div>
                  <div className="text-[10px] text-t3">
                    {o.mainDoctor && `${o.mainDoctor} · `}{o.city}, {o.state}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="mono text-[11px] font-bold text-accent-red">-{fmtK(o.gap)}</div>
                  <div className="text-[9px] text-t4">{o.daysSince ?? 0}d ago</div>
                </div>
                {o.phone && (
                  <a
                    href={`tel:${o.phone.replace(/\D/g, "")}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(79,142,247,.1)] border border-[rgba(79,142,247,.2)] text-[14px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📞
                  </a>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// INSIGHT CARD SUB-COMPONENT
// ═══════════════════════════════════════════════════════════

function InsightCard({ insight, onSelectOffice }: { insight: Insight; onSelectOffice: (o: Office) => void }) {
  const colors: Record<string, { bg: string; border: string; accent: string }> = {
    critical: { bg: "rgba(248,113,113,.06)", border: "rgba(248,113,113,.15)", accent: "#f87171" },
    warning: { bg: "rgba(251,191,36,.05)", border: "rgba(251,191,36,.12)", accent: "#fbbf24" },
    info: { bg: "rgba(79,142,247,.05)", border: "rgba(79,142,247,.12)", accent: "#4f8ef7" },
    positive: { bg: "rgba(52,211,153,.05)", border: "rgba(52,211,153,.12)", accent: "#34d399" },
  };

  const c = colors[insight.priority] || colors.info;

  const icons: Record<string, string> = {
    critical: "🚨",
    warning: "⚠️",
    info: "💡",
    positive: "✅",
  };

  return (
    <button
      onClick={() => insight.office && onSelectOffice(insight.office)}
      className="w-full rounded-lg p-3.5 text-left transition-all active:scale-[.99]"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="mb-1 flex items-start gap-2">
        <span className="text-[14px]">{icons[insight.priority]}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-t1">{insight.title}</div>
          <div className="mt-[3px] text-[11px] leading-relaxed text-t3">{insight.body}</div>
        </div>
      </div>
    </button>
  );
}
