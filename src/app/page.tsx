"use client";

import { useState, useMemo, useCallback } from "react";
import { OFFICES, PRODUCTS } from "@/data";
import type { Office } from "@/types";
import { DailyBriefing } from "@/components/cards/DailyBriefing";
import { QuotaHero } from "@/components/cards/QuotaHero";
import { FullYearTracker } from "@/components/cards/FullYearTracker";
import { OfficeCard } from "@/components/cards/OfficeCard";
import { OfficeDetail } from "@/components/cards/OfficeDetail";
import { ProductCard } from "@/components/cards/ProductCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { SearchInput } from "@/components/ui/SearchInput";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { cn } from "@/lib/utils";

const OFFICE_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "NOW", label: "Visit Now", emoji: "🔴" },
  { value: "SOON", label: "Soon", emoji: "🟡" },
  { value: "PROTECT", label: "On Track", emoji: "🟢" },
  { value: "EXPANSION", label: "Expansion", emoji: "🌱" },
  { value: "PRIVATE", label: "Private" },
  { value: "DSO", label: "DSO" },
];

const PAGE_SIZE = 25;

export default function HomePage() {
  const [view, setView] = useState<"briefing" | "territory">("briefing");
  const [pane, setPane] = useState<"offices" | "products">("offices");
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  // Filter and sort offices
  const filteredOffices = useMemo(() => {
    let list = [...OFFICES];
    if (filter === "NOW") list = list.filter((o) => o.visitPriority === "NOW");
    else if (filter === "SOON") list = list.filter((o) => o.visitPriority === "SOON");
    else if (filter === "PROTECT") list = list.filter((o) => o.visitPriority === "PROTECT");
    else if (filter === "EXPANSION") list = list.filter((o) => o.isExpansion);
    else if (filter === "PRIVATE") list = list.filter((o) => o.isPrivate);
    else if (filter === "DSO") list = list.filter((o) => !o.isPrivate);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.mainDoctor || "").toLowerCase().includes(q) ||
          o.city.toLowerCase().includes(q) ||
          o.parent.toLowerCase().includes(q) ||
          (o.email || "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [filter, search]);

  const filteredProducts = useMemo(() => {
    let list = [...PRODUCTS].sort((a, b) => b.cy - a.cy);
    if (productSearch) {
      const q = productSearch.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [productSearch]);

  const maxPY = Math.max(...PRODUCTS.map((p) => p.py));

  const handleSelectOffice = useCallback((office: Office) => {
    setSelectedOffice(office);
  }, []);

  return (
    <>
      {/* View Toggle */}
      <div className="sticky top-[52px] z-40 border-b border-b3 px-4 py-2" style={{
        background: "rgba(10,10,15,.9)",
        backdropFilter: "blur(20px)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}>
        <div className="flex gap-1">
          <button
            onClick={() => setView("briefing")}
            className={cn(
              "flex-1 rounded-lg py-2 text-[12px] font-semibold transition-all",
              view === "briefing"
                ? "bg-[rgba(79,142,247,.12)] border border-[rgba(79,142,247,.25)] text-accent-blue"
                : "bg-s2 border border-b2 text-t3"
            )}
          >
            ⚡ Today
          </button>
          <button
            onClick={() => setView("territory")}
            className={cn(
              "flex-1 rounded-lg py-2 text-[12px] font-semibold transition-all",
              view === "territory"
                ? "bg-[rgba(79,142,247,.12)] border border-[rgba(79,142,247,.25)] text-accent-blue"
                : "bg-s2 border border-b2 text-t3"
            )}
          >
            🏢 Territory
          </button>
        </div>
      </div>

      {/* ══ BRIEFING VIEW ══ */}
      {view === "briefing" && (
        <DailyBriefing
          onOpenSearch={() => setSearchOpen(true)}
          onSelectOffice={handleSelectOffice}
        />
      )}

      {/* ══ TERRITORY VIEW ══ */}
      {view === "territory" && (
        <>
          <QuotaHero />
          <FullYearTracker />

          <div className="px-4 pt-3">
            <div className="mb-3 flex gap-[6px]">
              <button
                onClick={() => setPane("offices")}
                className={cn("filter-pill", pane === "offices" && "active")}
              >
                Offices
              </button>
              <button
                onClick={() => setPane("products")}
                className={cn("filter-pill", pane === "products" && "active")}
              >
                Products
              </button>
            </div>

            {pane === "offices" && (
              <>
                <FilterBar options={OFFICE_FILTERS} active={filter} onChange={(v) => { setFilter(v); setShown(PAGE_SIZE); }} />
                <div className="mt-3 mb-3">
                  <SearchInput
                    value={search}
                    onChange={(v) => { setSearch(v); setShown(PAGE_SIZE); }}
                    placeholder="Search office, doctor, city…"
                  />
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-t3">Q1 Priority</span>
                  <span className="mono text-[11px] text-t4">{filteredOffices.length.toLocaleString()}</span>
                </div>

                {filteredOffices.slice(0, shown).map((office, i) => (
                  <OfficeCard key={i} office={office} onClick={handleSelectOffice} />
                ))}

                {shown < filteredOffices.length && (
                  <button
                    onClick={() => setShown((s) => s + PAGE_SIZE)}
                    className="mt-2 w-full rounded-md bg-s2 border border-b1 py-3 text-[12px] font-semibold text-t3 transition-colors hover:bg-s3"
                  >
                    Load more ({filteredOffices.length - shown} remaining)
                  </button>
                )}
              </>
            )}

            {pane === "products" && (
              <>
                <div className="mb-3">
                  <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Search products…" />
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-t3">Products — Q1 2026 vs Q1 2025</span>
                  <span className="mono text-[11px] text-t4">{filteredProducts.length}</span>
                </div>
                {filteredProducts.map((product, i) => (
                  <ProductCard key={i} product={product} maxPY={maxPY} />
                ))}
              </>
            )}
          </div>
        </>
      )}

      {/* Global Search Overlay */}
      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectOffice={handleSelectOffice}
      />

      {/* Office Detail Panel */}
      {selectedOffice && (
        <OfficeDetail
          office={selectedOffice}
          onClose={() => setSelectedOffice(null)}
        />
      )}
    </>
  );
}
