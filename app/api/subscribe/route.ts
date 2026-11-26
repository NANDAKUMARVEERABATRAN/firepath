import { NextResponse } from "next/server";

/**
 * Paid checkout slot. Razorpay is not connected yet.
 *
 * To launch payments:
 * 1. Create and KYC-verify a Razorpay account; create two Subscription Plans (₹75 monthly, ₹500 yearly; see lib/country.ts).
 * 2. Add RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET as server-only env vars (never NEXT_PUBLIC_).
 * 3. Here: verify the signed-in user, create a Razorpay subscription for the chosen plan and return its id for Checkout.
 * 4. Add a webhook route that verifies the Razorpay signature and upserts public.subscriptions with the
 *    Supabase service-role key (plan, status, current_period_end, provider='razorpay', provider_ref).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const plan = body?.plan === "monthly" ? "monthly" : "yearly";
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ message: `Online payments for the ${plan} plan open very soon. Nothing has been charged, and your data stays safe until then.` }, { status: 503 });
  }
  return NextResponse.json({ message: "Checkout is not wired up yet. See app/api/subscribe/route.ts for the remaining Razorpay steps." }, { status: 501 });
}
