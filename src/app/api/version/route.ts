import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(
    { sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev" },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
