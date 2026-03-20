"use client";

import { useState, useMemo } from "react";
import { GROUPS } from "@/data";
import type { Group } from "@/types";
import { GroupCard } from "@/components/cards/GroupCard";
import { GroupDetail } from "@/components/cards/GroupDetail";
import { FilterBar } from "@/components/ui/FilterBar";
import { SearchInput } from "@/components/ui/SearchInput";

const GROUP_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "DSO", label: "DSO" },
  { value: "PRIVATE", label: "Private" },
  { value: "NOW", label: "Has Urgent" },
  { value: "MULTI", label: "Multi-Loc" },
  { value: "MULTIDIST", label: "📦 Multi-Dist" },
];

const PAGE_SIZE = 30;

export default function GroupsPage() {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const filteredGroups = useMemo(() => {
    let list = [...GROUPS];

    if (filter === "DSO") list = list.filter((g) => g.acctType !== "Standard" && g.acctType !== "Private");
    else if (filter === "PRIVATE") list = list.filter((g) => g.acctType === "Standard" || g.acctType === "Private");
    else if (filter === "NOW") list = list.filter((g) => g.children?.some((c) => c.visitPriority === "NOW"));
    else if (filter === "MULTI") list = list.filter((g) => g.loc_count > 1);
    else if (filter === "MULTIDIST") list = list.filter((g) => g.children?.some((c) => c.cms && c.cms.length > 1));

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        g.children?.some((c) =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          (c.mainDoctor || "").toLowerCase().includes(q)
        )
      );
    }

    list.sort((a, b) => (b.py_total - b.cy_total) - (a.py_total - a.cy_total));

    return list;
  }, [filter, search]);

  return (
    <>
      <div className="px-4 pt-4">
        <FilterBar
          options={GROUP_FILTERS}
          active={filter}
          onChange={(v) => { setFilter(v); setShown(PAGE_SIZE); }}
        />

        <div className="mt-3 mb-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setShown(PAGE_SIZE); }}
            placeholder="Search account name…"
          />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-t3">Accounts by Parent Group</span>
          <span className="mono text-[11px] text-t4">{filteredGroups.length.toLocaleString()}</span>
        </div>

        {filteredGroups.slice(0, shown).map((group, i) => (
          <GroupCard key={i} group={group} onClick={setSelectedGroup} />
        ))}

        {shown < filteredGroups.length && (
          <button
            onClick={() => setShown((s) => s + PAGE_SIZE)}
            className="mt-2 w-full rounded-md bg-s2 border border-b1 py-3 text-[12px] font-semibold text-t3 transition-colors hover:bg-s3"
          >
            Load more ({filteredGroups.length - shown} remaining)
          </button>
        )}

        <div className="mt-3 mb-4 rounded-md bg-s1 border border-b2 p-3 text-[10px] text-t3">
          <strong>📦 Multi-dist</strong> = buys through 2+ distributors — totals combined. Tap any group to drill into locations.
        </div>
      </div>

      {selectedGroup && (
        <GroupDetail group={selectedGroup} onClose={() => setSelectedGroup(null)} />
      )}
    </>
  );
}
