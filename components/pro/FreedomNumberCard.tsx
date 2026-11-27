"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadFinancialState } from "@/lib/financialState";
import { getFireScore } from "@/lib/fireScore";
import { countryFromCurrency, formatCountryMoney } from "@/lib/country";

/** Free for everyone: your own freedom number (and how far along you are), shown above the paywall. */
export default function FreedomNumberCard() {
  const [data, setData] = useState<{ target: number; progress: number; code: ReturnType<typeof countryFromCurrency> } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const state = await loadFinancialState(supabase, session.user.id);
        const profile = state.scoreProfile ?? state.profile;
        if (!profile) return;
        const score = getFireScore(profile);
        if (score.fireTarget > 0) setData({ target: score.fireTarget, progress: score.fireProgress, code: countryFromCurrency(profile.currency) });
      } catch { /* the paywall still works without it */ }
    })();
  }, []);

  if (!data) return null;
  return <section className="free-number">
    <span>🔥 Your freedom number</span>
    <strong>{formatCountryMoney(data.target, data.code)}</strong>
    <div className="free-number-bar"><i style={{ width: `${Math.min(100, Math.max(1, data.progress))}%` }} /></div>
    <small>You’re <b>{data.progress.toFixed(1)}%</b> of the way there. Pro shows your freedom date, a step-by-step path and everything that gets you there faster.</small>
  </section>;
}
