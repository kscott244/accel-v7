import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Accelerate",
  description: "Territory Sales Intelligence Platform",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh bg-bg text-t1 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
