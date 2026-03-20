"use client";

interface TopBarProps {
  onSearchClick?: () => void;
}

export function TopBar({ onSearchClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-b1" style={{
      paddingTop: "env(safe-area-inset-top, 0px)",
      background: "rgba(10,10,15,.85)",
      backdropFilter: "blur(32px) saturate(180%)",
      WebkitBackdropFilter: "blur(32px) saturate(180%)",
    }}>
      <div className="flex h-[52px] items-center justify-between px-[18px]">
        <div className="text-[15px] font-bold tracking-tight text-t1">
          Ken <span className="text-accent-blue">Scott</span>
        </div>
        <div className="flex items-center gap-2">
          {onSearchClick && (
            <button
              onClick={onSearchClick}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-s2 border border-b1 text-t3 transition-colors hover:bg-s3 active:bg-s4"
              aria-label="Search"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
          )}
          <div className="mono rounded-pill border border-b1 bg-s2 px-[10px] py-[3px] text-[11px] font-medium text-t3">
            CT / MA
          </div>
        </div>
      </div>
    </header>
  );
}
