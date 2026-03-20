"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { TabBar } from "@/components/layout/TabBar";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { OfficeDetail } from "@/components/cards/OfficeDetail";
import type { Office } from "@/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAccelerate = pathname?.startsWith("/accelerate");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleOpenSearch = useCallback(() => setSearchOpen(true), []);
  const handleCloseSearch = useCallback(() => setSearchOpen(false), []);
  const handleSelectOffice = useCallback((office: Office) => {
    setSelectedOffice(office);
    setSearchOpen(false);
  }, []);

  // Accelerate page has its own header and nav — render children only
  if (isAccelerate) {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar onSearchClick={handleOpenSearch} />
      <main className="pb-20">{children}</main>
      <TabBar />

      <GlobalSearch
        open={searchOpen}
        onClose={handleCloseSearch}
        onSelectOffice={handleSelectOffice}
      />

      {selectedOffice && (
        <OfficeDetail
          office={selectedOffice}
          onClose={() => setSelectedOffice(null)}
        />
      )}
    </>
  );
}
