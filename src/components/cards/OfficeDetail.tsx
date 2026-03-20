"use client";

import type { Office } from "@/types";
import { SignalBadge } from "@/components/ui/SignalBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtCurrency, fmtPhone, VP_CONFIG } from "@/lib/utils";

interface OfficeDetailProps {
  office: Office | null;
  onClose: () => void;
}

export function OfficeDetail({ office, onClose }: OfficeDetailProps) {
  if (!office) return null;

  const vpConfig = VP_CONFIG[office.visitPriority] || VP_CONFIG.MONITOR;
  const retPct = office.py > 0 ? (office.cy / office.py) * 100 : 0;
  const fyRetPct = office.py > 0 ? (office.cy / office.py) * 100 : 0;

  const handleDirections = () => {
    const addr = encodeURIComponent(`${office.name}, ${office.city}, ${office.state}`);
    window.open(`https://maps.google.com/maps?daddr=${addr}`, "_blank");
  };

  const handleCall = () => {
    if (office.phone) window.open(`tel:${office.phone.replace(/\D/g, "")}`, "_self");
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-bg animate-slide-in-right">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-b1 bg-bg/90 backdrop-blur-xl">
        <div className="flex h-[52px] items-center justify-between px-4">
          <button onClick={onClose} className="flex items-center gap-1 text-[14px] font-semibold text-accent-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <div className="flex gap-2">
            {office.phone && (
              <button onClick={handleCall} className="rounded-md bg-s2 border border-b1 px-3 py-1.5 text-[11px] font-semibold text-t2">
                📞 Call
              </button>
            )}
            <button onClick={handleDirections} className="rounded-md bg-s2 border border-b1 px-3 py-1.5 text-[11px] font-semibold text-t2">
              📍 Directions
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {/* Name & Signal */}
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-[18px] font-bold leading-tight text-t1">{office.name}</h2>
          <SignalBadge signal={office.q1_signal} size="md" />
        </div>
        <div className="mb-4 text-[12px] text-t3">
          {office.mainDoctor && <span>{office.mainDoctor} · </span>}
          {office.city}, {office.state}
          {office.phone && <span> · {fmtPhone(office.phone)}</span>}
        </div>

        {/* Visit priority banner */}
        <div className="mb-4 rounded-md p-3" style={{ background: `${vpConfig.color}12`, border: `1px solid ${vpConfig.color}30` }}>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: vpConfig.color }} />
            <span className="text-[12px] font-bold" style={{ color: vpConfig.color }}>{vpConfig.label}</span>
            {(office.daysSince ?? 0) > 0 && (
              <span className="ml-auto mono text-[11px] text-t3">{office.daysSince} days since last visit</span>
            )}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="card mb-3 p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-t3">Performance</div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[9px] text-t4 mb-1">PY</div>
              <div className="mono text-[16px] font-bold text-t2">{fmtCurrency(office.py)}</div>
            </div>
            <div>
              <div className="text-[9px] text-t4 mb-1">CY</div>
              <div className="mono text-[16px] font-bold text-accent-blue">{fmtCurrency(office.cy)}</div>
            </div>
            <div>
              <div className="text-[9px] text-t4 mb-1">Gap</div>
              <div className="mono text-[16px] font-bold text-accent-red">{fmtCurrency(office.gap)}</div>
            </div>
          </div>
          <div className="text-[9px] text-t3 mb-1">Retention: <span className="mono font-bold">{retPct.toFixed(1)}%</span></div>
          <ProgressBar value={retPct} variant={retPct < 50 ? "danger" : "default"} height={5} showGlow={false} />
        </div>

        {/* Expansion Opportunity Banner */}
        {office.isExpansion && (
          <div className="card mb-3 p-4" style={{ background: "rgba(167,139,250,.06)", borderColor: "rgba(167,139,250,.2)" }}>
            <div className="text-[10px] font-bold text-accent-purple mb-1">🌱 Expansion Opportunity</div>
            <div className="text-[11px] text-t2">This location is part of <strong>{office.parent}</strong> but hasn&apos;t placed an order yet. The parent group is an active buyer — this is a warm introduction.</div>
          </div>
        )}

        {/* Full Year — removed duplicate, merged into Performance above */}
        <div className="card mb-3 p-4">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-t3">Account Info</div>
          <div className="space-y-2">
            {[
              { label: "Account Type", value: office.acctType },
              { label: "Classification", value: office.class2 },
              { label: "Accelerate Level", value: office.accelLevel || "" },
              { label: "Parent Group", value: office.isPrivate ? "Private Practice" : office.parent },
              { label: "Opco", value: office.opco },
              { label: "Top Product", value: office.topProduct },
              { label: "Email", value: office.email },
              { label: "Address", value: office.addr ? `${office.addr}, ${office.city}, ${office.state} ${office.zip}` : "" },
              { label: "Zone", value: office.zone || "" },
              { label: "Practice Manager", value: office.pm || "" },
              { label: "Last Visit", value: office.lastVisit || "" },
            ]
              .filter((r) => r.value)
              .map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b border-b3 pb-2 last:border-0">
                  <span className="text-[11px] text-t3">{row.label}</span>
                  <span className="text-[11px] font-medium text-t1 text-right max-w-[60%] truncate">{row.value}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Notes */}
        {office.lastVisitNote && (
          <div className="card mb-3 p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-t3">Last Visit Notes</div>
            <div className="text-[12px] leading-relaxed text-t2 whitespace-pre-line">{office.lastVisitNote}</div>
          </div>
        )}

        {office.badgerNotes && (
          <div className="card mb-3 p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-t3">Badger Notes</div>
            <div className="text-[12px] leading-relaxed text-t2 whitespace-pre-line">{office.badgerNotes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
