import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Signed-in users land on the Journey hub unless a local `next` path is given.
  // Only allow local paths to prevent the callback from becoming an open redirect.
  const requestedNext = searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/journey";

  if (code) {
    if (!supabaseUrl || !supabaseKey) return NextResponse.redirect(`${origin}/?auth=error`);
    const cookieStore = await cookies();
    const cookiesToWrite: { name: string; value: string; options: CookieOptions }[] = [];
    const authResponseHeaders = new Headers();
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
              cookiesToWrite.push({ name, value, options });
            });
            Object.entries(headers).forEach(([name, value]) => authResponseHeaders.set(name, value));
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      cookiesToWrite.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      authResponseHeaders.forEach((value, name) => response.headers.set(name, value));
      return response;
    }
  }
  return NextResponse.redirect(`${origin}/?auth=error`);
}
