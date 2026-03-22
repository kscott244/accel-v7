import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "https://accel-v7.vercel.app"}/accelerate?gmail=error`
    );
  }

  const clientId = process.env.GMAIL_CLIENT_ID!;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://accel-v7.vercel.app"}/api/gmail-callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "https://accel-v7.vercel.app"}/accelerate?gmail=no_refresh`
    );
  }

  // Return tokens to client via URL fragment (stored in localStorage by the app)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://accel-v7.vercel.app";
  const redirectUrl = `${appUrl}/accelerate?gmail=connected&refresh_token=${encodeURIComponent(tokens.refresh_token)}&access_token=${encodeURIComponent(tokens.access_token)}`;

  return NextResponse.redirect(redirectUrl);
}
