"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { OFFICES, GROUPS, PRODUCTS } from "@/data";
import type { Office, Group, Product } from "@/types";
import { fmtK, fmtPhone, SIGNAL_CONFIG, VP_CONFIG } from "@/lib/utils";

type ResultType = "office" | "group" | "product";

interface SearchResult {
  type: ResultType;
  name: string;
  sub: string;
  meta: string;
  color: string;
  raw: Office | Group | Product;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onSelectOffice?: (office: Office) => void;
  onSelectGroup?: (group: Group) => void;
}

export function GlobalSearch({ open, onClose, onSelectOffice, onSelectGroup }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!open) {
          // Parent should handle opening
        }
      }
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const results = useMemo((): SearchResult[] => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    const out: SearchResult[] = [];

    // Search offices
    OFFICES.forEach((o) => {
      const match =
        o.name.toLowerCase().includes(q) ||
        (o.mainDoctor || "").toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        (o.phone || "").includes(q) ||
        (o.pm || "").toLowerCase().includes(q) ||
        o.parent.toLowerCase().includes(q);

      if (match) {
        const vpConf = VP_CONFIG[o.visitPriority] || VP_CONFIG.MONITOR;
        out.push({
          type: "office",
          name: o.name,
          sub: `${o.mainDoctor ? o.mainDoctor + " · " : ""}${o.city}, ${o.state}`,
          meta: `${fmtK(o.cy)} CY · ${fmtK(o.gap)} gap${o.isExpansion ? " · 🌱 Expansion" : ""}`,
          color: vpConf.color,
          raw: o,
        });
      }
    });

    // Search groups
    GROUPS.forEach((g) => {
      const match =
        g.name.toLowerCase().includes(q) ||
        g.children?.some(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.mainDoctor || "").toLowerCase().includes(q)
        );

      if (match) {
        out.push({
          type: "group",
          name: g.name,
          sub: `${g.loc_count} locations · ${g.acctType}`,
          meta: `${fmtK(g.cy_total)} CY · ${fmtK(g.py_total - g.cy_total)} gap`,
          color: "#a78bfa",
          raw: g,
        });
      }
    });

    // Search products
    PRODUCTS.forEach((p) => {
      if (p.name.toLowerCase().includes(q)) {
        const ret = p.py > 0 ? (p.cy / p.py * 100).toFixed(1) : "0";
        out.push({
          type: "product",
          name: p.name,
          sub: `${fmtK(p.py)} PY → ${fmtK(p.cy)} CY`,
          meta: `${ret}% retention · ${p.growthPct > 0 ? "+" : ""}${p.growthPct.toFixed(1)}%`,
          color: "#22d3ee",
          raw: p,
        });
      }
    });

    // Sort: offices first, then by relevance (exact match first, then starts-with, then contains)
    out.sort((a, b) => {
      const aExact = a.name.toLowerCase() === q ? 0 : a.name.toLowerCase().startsWith(q) ? 1 : 2;
      const bExact = b.name.toLowerCase() === q ? 0 : b.name.toLowerCase().startsWith(q) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      // Offices first
      const typeOrder = { office: 0, group: 1, product: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    return out.slice(0, 20);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (result.type === "office" && onSelectOffice) {
        onSelectOffice(result.raw as Office);
      } else if (result.type === "group" && onSelectGroup) {
        onSelectGroup(result.raw as Group);
      }
      onClose();
    },
    [onClose, onSelectOffice, onSelectGroup]
  );

  const typeIcons: Record<ResultType, string> = {
    office: "🏢",
    group: "👥",
    product: "📦",
  };

  const typeLabels: Record<ResultType, string> = {
    office: "Office",
    group: "Group",
    product: "Product",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />

      {/* Search Panel */}
      <div className="relative mx-auto mt-[env(safe-area-inset-top,12px)] w-full max-w-lg px-4 pt-3 animate-slide-up">
        {/* Input */}
        <div className="relative mb-2">
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-t3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search offices, doctors, groups, products…"
            className="w-full rounded-xl bg-s1 border border-b1 py-4 pl-12 pr-12 text-[15px] text-t1 outline-none placeholder:text-t4"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(79,142,247,.1)" }}
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-s3 px-2 py-1 text-[10px] font-semibold text-t3"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div
            className="max-h-[60vh] overflow-y-auto rounded-xl bg-s1 border border-b1"
            style={{ boxShadow: "0 12px 48px rgba(0,0,0,.5)" }}
          >
            {results.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-t3">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              <>
                <div className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-wider text-t4">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </div>
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.name}-${i}`}
                    onClick={() => handleSelect(r)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-s2 active:bg-s3"
                    style={{ borderBottom: i < results.length - 1 ? "1px solid var(--b3)" : "none" }}
                  >
                    {/* Type icon */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-s3 text-[16px]">
                      {typeIcons[r.type]}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-t1">{r.name}</span>
                        <span
                          className="shrink-0 rounded-pill px-[6px] py-[1px] text-[8px] font-bold"
                          style={{ background: `${r.color}18`, border: `1px solid ${r.color}30`, color: r.color }}
                        >
                          {typeLabels[r.type]}
                        </span>
                      </div>
                      <div className="mt-[2px] truncate text-[11px] text-t3">{r.sub}</div>
                      <div className="mt-[1px] mono text-[10px] text-t4">{r.meta}</div>
                    </div>

                    {/* Arrow */}
                    <svg className="mt-2 h-4 w-4 shrink-0 text-t4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Empty state hints */}
        {query.length < 2 && (
          <div className="rounded-xl bg-s1 border border-b1 p-5" style={{ boxShadow: "0 12px 48px rgba(0,0,0,.5)" }}>
            <div className="mb-3 text-[11px] font-semibold text-t3">Quick Search</div>
            <div className="space-y-2">
              {["Blue Back Dental", "Dr. Strazza", "CaviWipes", "Stamford"].map((hint) => (
                <button
                  key={hint}
                  onClick={() => setQuery(hint)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-s2"
                >
                  <span className="text-[12px] text-t4">→</span>
                  <span className="text-[12px] text-t2">{hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 text-center text-[10px] text-t4">
              Search by name, doctor, city, phone, or product
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
