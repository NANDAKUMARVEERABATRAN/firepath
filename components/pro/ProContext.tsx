"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { PRICING } from "@/lib/subscription";

/** Whether the signed-in person has Pro (trial, paid, or free access while payments are off). Defaults to true outside the gate. */
export const ProContext = createContext<{ pro: boolean }>({ pro: true });
export const usePro = () => useContext(ProContext);

/** A friendly locked card for Pro-only features on free pages. */
export function ProLock({ title, text }: { title: string; text: string }) {
  return <section className="pro-lock"><span className="pro-lock-icon"><Lock size={18} /></span><div><strong>{title} <em>PRO</em></strong><p>{text}</p></div><Link href="/pricing" className="button button-primary">Try Pro free for {PRICING.trialDays} days</Link></section>;
}
