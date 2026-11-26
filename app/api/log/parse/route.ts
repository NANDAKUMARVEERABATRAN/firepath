import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getProStatus, hasPro, PAYMENTS_LIVE, type SubscriptionRow } from "@/lib/subscription";
import { basicQuickLog, isEmptyLog, maskSensitive, normalizeQuickLog, QUICK_LOG_SCHEMA, quickLogInstructions, type QuickLogResult } from "@/lib/quickLog";
import { parseSpokenAmount } from "@/lib/voiceForms";

const DAILY_LIMIT = 30;

/** AI one-line logging: extracts check-in fields, spending entries and balances from a sentence. Nothing is saved here. */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const cookieStore = await cookies();
  const authHeaders = new Headers();
  const respond = (body: unknown, status = 200) => { const r = NextResponse.json(body, { status }); authHeaders.forEach((v, k) => r.headers.set(k, v)); return r; };
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list, headers) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); Object.entries(headers).forEach(([k, v]) => authHeaders.set(k, v)); },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return respond({ error: "Sign in to use quick log." }, 401);

  const { data: subscription } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  const allowed = PAYMENTS_LIVE ? hasPro(getProStatus(subscription as SubscriptionRow | null)) : Boolean(subscription);
  if (!allowed) return respond({ error: "Quick log is part of FIREpath Pro. Start your free trial to use it." }, 403);

  let body: { text?: unknown; currency?: unknown };
  try { body = await request.json(); } catch { return respond({ error: "Send some text to log." }, 400); }
  const text = typeof body.text === "string" ? maskSensitive(body.text.trim()) : "";
  if (text.length < 3) return respond({ error: "Type or say what happened with your money, e.g. “salary 1.2L, rent 25k, Swiggy 3k”." }, 400);
  const currency = body.currency === "AED" ? "AED" : "INR";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // Basic mode: on-device rules, used whenever the AI is unavailable (no key, no credit, errors).
  const basic = (reason: string) => {
    const parsed: QuickLogResult = basicQuickLog(text, today, parseSpokenAmount);
    if (isEmptyLog(parsed)) return respond({ ...parsed, mode: "basic", error: "I couldn’t find any amounts in that. Try: “salary 1.2L, rent 25k, Swiggy 3k, SIP 25k”." }, 422);
    console.warn(`[quicklog] basic mode: ${reason}`);
    return respond({ ...parsed, mode: "basic" });
  };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return basic("no OPENAI_API_KEY");

  const { data: creditOk, error: creditError } = await supabase.rpc("use_ai_credit", { feature: "quicklog", daily_limit: DAILY_LIMIT });
  if (creditError) return basic("AI usage limit table missing (migration 0023)");
  if (!creditOk) return basic("daily AI limit reached"); // basic mode is free, so the person can keep logging

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6.2-astra",
        instructions: quickLogInstructions(currency, today),
        input: text,
        max_output_tokens: 1500,
        store: false,
        text: { format: { type: "json_schema", name: "quick_log", schema: QUICK_LOG_SCHEMA, strict: true } },
      }),
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) return basic(`AI error ${response.status} ${result?.error?.code ?? ""}`);
    const output = (result.output ?? []).flatMap((item: { content?: { type?: string; text?: string }[] }) => item.content ?? []).filter((c: { type?: string }) => c.type === "output_text").map((c: { text?: string }) => c.text ?? "").join("");
    const parsed = normalizeQuickLog(JSON.parse(output), today);
    if (isEmptyLog(parsed)) return respond({ ...parsed, error: parsed.unclear[0] ?? "I couldn’t find any amounts in that. Try: “salary 1.2L, rent 25k, Swiggy 3k, SIP 25k”." }, 422);
    return respond({ ...parsed, mode: "ai" });
  } catch {
    return basic("AI reply unreadable");
  }
}
