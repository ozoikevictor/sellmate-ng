import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function rateLimit(request: Request, key: string, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  const rateKey = `${key}:${getClientIp(request)}`;
  const current = rateLimitStore.get(rateKey);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(rateKey, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (current.count >= limit) {
    return NextResponse.json(
      { message: "Too many attempts. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  current.count += 1;
  return null;
}

export function getServerEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return null;
  }

  return { supabaseUrl, anonKey, serviceRoleKey };
}

export async function requireSeller(request: Request) {
  const env = getServerEnv();
  if (!env) {
    return {
      error: NextResponse.json({ message: "Server security keys are not configured." }, { status: 500 }),
      user: null,
    };
  }

  const accessToken = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!accessToken) {
    return {
      error: NextResponse.json({ message: "Log in again before continuing." }, { status: 401 }),
      user: null,
    };
  }

  const authClient = createClient(env.supabaseUrl, env.anonKey);
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      error: NextResponse.json({ message: "Your login session could not be verified." }, { status: 401 }),
      user: null,
    };
  }

  return { error: null, user: data.user, env };
}
