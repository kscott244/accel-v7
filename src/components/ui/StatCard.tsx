"use client";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  labelColor?: string;
}

export function StatCard({ label, value, sub, color = "var(--t1)", labelColor = "var(--t3)" }: StatCardProps) {
  return (
    <div className="card rounded-lg p-[14px]">
      <div
        className="mb-[6px] text-[9px] font-bold uppercase tracking-wider"
        style={{ color: labelColor }}
      >
        {label}
      </div>
      <div
        className="mono text-[26px] font-extrabold"
        style={{ color }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-[2px] text-[10px] text-t3">{sub}</div>
      )}
    </div>
  );
}
