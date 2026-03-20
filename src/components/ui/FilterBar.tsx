"use client";

import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
  emoji?: string;
}

interface FilterBarProps {
  options: FilterOption[];
  active: string;
  onChange: (value: string) => void;
}

export function FilterBar({ options, active, onChange }: FilterBarProps) {
  return (
    <div className="scrollbar-hide flex gap-[6px] overflow-x-auto pb-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "filter-pill shrink-0 whitespace-nowrap",
            active === opt.value && "active"
          )}
        >
          {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
