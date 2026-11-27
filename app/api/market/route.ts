import { NextResponse } from "next/server";
import { fetchMarket } from "@/lib/marketData";

export const revalidate = 21600;

/** Public, no personal data: how far the Nifty 50 is below its 1-year high. */
export async function GET() {
  const market = await fetchMarket();
  if (!market) return NextResponse.json({ market: null }, { status: 200, headers: { "Cache-Control": "public, max-age=600" } });
  return NextResponse.json({ market }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=21600" } });
}
