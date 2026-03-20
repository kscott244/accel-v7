"use client";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightLabel?: string;
  color?: string;
}

export function SectionHeader({ title, subtitle, rightLabel, color = "var(--t3)" }: SectionHeaderProps) {
  return (
    <div className="mb-[14px] flex items-center justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {title}
        </div>
        {subtitle && (
          <span className="ml-2 text-[10px] font-normal text-t4">{subtitle}</span>
        )}
      </div>
      {rightLabel && (
        <div className="mono text-[10px] text-t4">{rightLabel}</div>
      )}
    </div>
  );
}
