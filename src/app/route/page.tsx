"use client";

import { useState, useMemo } from "react";
import { WEEK_ROUTES } from "@/data";
import type { RouteStop } from "@/types";
import { RouteStopCard } from "@/components/cards/RouteStopCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { fmtK } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function RoutePage() {
  const days = Object.keys(WEEK_ROUTES.routes);
  const [activeDay, setActiveDay] = useState(days[0] || "Tuesday");
  const [visited, setVisited] = useState<Record<string, boolean>>({});

  const stops: RouteStop[] = useMemo(() => {
    return WEEK_ROUTES.routes[activeDay] || [];
  }, [activeDay]);

  const allStops = useMemo(() => {
    return Object.values(WEEK_ROUTES.routes).flat();
  }, []);

  const totalStops = allStops.length;
  const visitedCount = Object.values(visited).filter(Boolean).length;
  const progressPct = totalStops > 0 ? (visitedCount / totalStops) * 100 : 0;

  const toggleVisit = (name: string) => {
    setVisited((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const resetWeek = () => {
    setVisited({});
  };

  const openDirections = (stop: RouteStop) => {
    if (stop.lat && stop.lng) {
      window.open(`https://maps.google.com/maps?daddr=${stop.lat},${stop.lng}`, "_blank");
    } else {
      const addr = encodeURIComponent(`${stop.name}, ${stop.city}, ${stop.state}`);
      window.open(`https://maps.google.com/maps?daddr=${addr}`, "_blank");
    }
  };

  // Day stops visited count
  const dayVisitedCount = stops.filter((s) => visited[s.name]).length;

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-t3">Visit Queue</div>
          <div className="mt-[1px] text-[10px] text-t4">
            By $ opportunity · <span className="mono">{totalStops - visitedCount}</span> remaining
          </div>
        </div>
        <button
          onClick={resetWeek}
          className="rounded-pill bg-s2 border border-b1 px-[14px] py-[7px] text-[11px] font-bold text-t2 transition-colors hover:bg-s3"
        >
          ↺ New Week
        </button>
      </div>

      {/* Progress */}
      <div className="card mb-3 p-[12px_14px]">
        <div className="mb-[7px] flex items-center justify-between">
          <div className="text-[11px] font-semibold text-t2">This Round</div>
          <div className="mono text-[12px] text-t1">
            {visitedCount} / {totalStops} visited
          </div>
        </div>
        <ProgressBar value={progressPct} variant="green" showGlow={false} />
      </div>

      {/* Day Tabs */}
      <div className="scrollbar-hide mb-3 flex gap-[6px] overflow-x-auto">
        {days.map((day) => {
          const dayStops = WEEK_ROUTES.routes[day] || [];
          const dayDone = dayStops.filter((s) => visited[s.name]).length;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={cn(
                "filter-pill shrink-0 whitespace-nowrap",
                activeDay === day && "active"
              )}
            >
              {day}
              <span className="ml-1 mono text-[9px] opacity-60">
                {dayDone}/{dayStops.length}
              </span>
            </button>
          );
        })}
        {WEEK_ROUTES.unplaced.length > 0 && (
          <button
            onClick={() => setActiveDay("_unplaced")}
            className={cn(
              "filter-pill shrink-0 whitespace-nowrap",
              activeDay === "_unplaced" && "active"
            )}
          >
            Unplaced
            <span className="ml-1 mono text-[9px] opacity-60">{WEEK_ROUTES.unplaced.length}</span>
          </button>
        )}
      </div>

      {/* Route Stops */}
      {activeDay !== "_unplaced" ? (
        <>
          {/* Not visited */}
          {stops
            .filter((s) => !visited[s.name])
            .map((stop, i) => (
              <RouteStopCard
                key={stop.name}
                stop={stop}
                index={i}
                visited={false}
                onToggleVisit={() => toggleVisit(stop.name)}
                onDirections={() => openDirections(stop)}
              />
            ))}

          {/* Visited section */}
          {dayVisitedCount > 0 && (
            <>
              <div className="mt-4 mb-2 text-[10px] font-bold uppercase tracking-wider text-accent-green">
                ✓ Visited ({dayVisitedCount})
              </div>
              {stops
                .filter((s) => visited[s.name])
                .map((stop, i) => (
                  <RouteStopCard
                    key={stop.name}
                    stop={stop}
                    index={i}
                    visited={true}
                    onToggleVisit={() => toggleVisit(stop.name)}
                    onDirections={() => openDirections(stop)}
                  />
                ))}
            </>
          )}
        </>
      ) : (
        /* Unplaced stops */
        <>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-t3">
            Unplaced Accounts ({WEEK_ROUTES.unplaced.length})
          </div>
          {WEEK_ROUTES.unplaced.map((stop, idx) => (
            <div key={idx} className="card mb-2 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-semibold text-t1">{stop.name}</div>
                  <div className="text-[10px] text-t3">{stop.city}, {stop.state} · {stop.zone}</div>
                </div>
                <div className="mono text-[11px] font-bold text-t2">{fmtK(stop.py)}</div>
              </div>
              {stop.flag && (
                <div className="mt-2 text-[10px] text-accent-amber">{stop.flag}</div>
              )}
              {stop.phone && (
                <a href={`tel:${stop.phone.replace(/\D/g, "")}`} className="mt-2 inline-block text-[10px] text-accent-blue">
                  📞 {stop.phone}
                </a>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
