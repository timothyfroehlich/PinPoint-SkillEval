/* eslint-disable eslint-comments/no-restricted-disable, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Auth callback requires direct Supabase client usage which returns any */
/**
 * Auth callback route requires direct use of createServerClient with custom cookie handling
 * to properly set cookies in the response. Standard SSR wrapper cannot be used here.
 * The `any` types from createServerClient are unavoidable in this context.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSiteUrl, isInternalUrl } from "~/lib/url";

/**
 * Resolves the safe redirect path.
 *
 * @param nextParam - The URL or path to redirect to.
 * @param allowedHosts - List of allowed hosts for absolute URLs.
 * @returns A safe internal path (e.g. "/dashboard") or "/" if invalid.
 */
export function resolveRedirectPath(
  nextParam: string | null,
  allowedHosts: string[]
): string {
  const fallback = "/";

  if (!nextParam) {
    return fallback;
  }

  if (isInternalUrl(nextParam)) {
    return nextParam;
  }

  try {
    // Parse the URL. We use a dummy base because nextParam might be absolute or relative.
    // If it's absolute, the base is ignored.
    const parsed = new URL(nextParam, "http://localhost");

    // Only allow absolute URLs if their host is in the allowedHosts list
    if (allowedHosts.includes(parsed.host)) {
      const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (isInternalUrl(normalizedPath)) {
        return normalizedPath;
      }
    }
  } catch {
    // swallow parse errors and fall through to fallback
  }

  return fallback;
}

/**
 * Auth callback route for OAuth flows (Google, GitHub, etc.)
 *
 * Required for CORE-SSR-004 compliance
 *
 * Flow:
 * 1. User clicks "Sign in with Google" → redirected to Google
 * 2. Google redirects back to this route with auth code
 * 3. This route exchanges code for session
 * 4. Redirects to home page
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const nextParam = searchParams.get("next") ?? "/";

  // Security: Use the canonical site URL for redirects
  const siteUrl = getSiteUrl();
  const siteHost = new URL(siteUrl).host;

  // Only allow redirects to the canonical site host
  const allowedHosts = [siteHost];

  const next = resolveRedirectPath(nextParam, allowedHosts);

  const shouldUseLoadingScreen = next === "/reset-password";
  const redirectPath = shouldUseLoadingScreen
    ? `/auth/loading?next=${encodeURIComponent(next)}`
    : next;

  const redirectToTarget = (): NextResponse => {
    // Always redirect using the canonical siteUrl
    // This prevents Host Header Injection via X-Forwarded-Host
    return NextResponse.redirect(`${siteUrl}${redirectPath}`);
  };

  const supabaseClient = createSupabaseClient(request);
  const { supabase, pendingCookies } = supabaseClient;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user: _user },
      } = await supabase.auth.getUser();
      return applyCookies(redirectToTarget(), pendingCookies);
    }

    console.error("auth/callback: exchangeCodeForSession failed", {
      error: error.message,
    });
  }

  const otpType = isValidEmailOtpType(typeParam);
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });

    if (!error) {
      const {
        data: { user: _user },
      } = await supabase.auth.getUser();
      return applyCookies(redirectToTarget(), pendingCookies);
    }

    console.error("auth/callback: verifyOtp failed", {
      error: error.message,
      type: otpType,
    });
  }

  // Auth failed or no code - redirect to error page
  return applyCookies(
    NextResponse.redirect(`${siteUrl}/auth/auth-code-error`),
    pendingCookies
  );
}

function isValidEmailOtpType(value: string | null): value is EmailOtpType {
  if (!value) {
    return false;
  }

  return (
    value === "signup" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "recovery" ||
    value === "email_change" ||
    value === "email"
  );
}

function createSupabaseClient(request: NextRequest): {
  supabase: ReturnType<typeof createServerClient>;
  pendingCookies: { name: string; value: string; options?: CookieOptions }[];
} {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseKey = process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars: ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set."
    );
  }

  const pendingCookies: {
    name: string;
    value: string;
    options?: CookieOptions;
  }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  return { supabase, pendingCookies };
}

function applyCookies(
  response: NextResponse,
  cookies: { name: string; value: string; options?: CookieOptions }[]
): NextResponse {
  cookies.forEach(({ name, value, options }) => {
    if (options) {
      response.cookies.set(name, value, options);
    } else {
      response.cookies.set(name, value);
    }
  });
  return response;
}
