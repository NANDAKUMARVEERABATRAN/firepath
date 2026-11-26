"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, CheckCircle2 } from "lucide-react";
import { moneyPrinciples } from "@/lib/moneyPrinciples";
import { createClient } from "@/lib/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function LearnPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          if (active) setSignedIn(false);
          return;
        }
        if (active) setSignedIn(true);
        const { data, error } = await supabase.from("financial_profiles").select("selected_fire_principles").eq("user_id", session.user.id).maybeSingle();
        if (error) throw error;
        if (active) setSelected(data?.selected_fire_principles ?? []);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? `Could not load your saved principles: ${error.message}` : "Could not load your saved principles.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  function togglePrinciple(id: string) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    setMessage("");
  }

  async function saveSelection() {
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setMessage("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) {
        setSignedIn(false);
        throw new Error("Sign in to save your principles.");
      }
      const { error } = await supabase.from("financial_profiles").upsert({ user_id: session.user.id, selected_fire_principles: selected, updated_at: new Date().toISOString() });
      if (error) throw error;
      setMessage("Your FIRE principles are saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your principles.");
    } finally {
      setSaving(false);
    }
  }

  return <><Header /><main className="learn-page container">
    <div className="profile-heading"><p className="eyebrow"><BookOpen size={14} /> YOUR FIRE PRINCIPLES</p><h1>Choose ideas you want to practice.</h1><p>Pick the principles that fit your approach. Your choices are saved to your account so you can revisit them as your plan changes.</p></div>
    <section className="principle-selection-bar" aria-live="polite"><div><strong>{selected.length} selected</strong><span>{selected.length ? "Choose a few you can put into practice." : "Select the ideas you want to follow."}</span></div>{signedIn ? <button className="button button-primary" type="button" onClick={() => void saveSelection()} disabled={saving || loading}>{saving ? "Saving…" : "Save my principles"}</button> : <Link className="button button-primary" href="/#fire-calculator">Sign in to save</Link>}</section>
    {message && <p className="profile-status principles-status" role="status">{message}{message.includes("migration") || message.includes("column") ? <> Apply the selected FIRE principles migration in Supabase, then refresh.</> : null}</p>}
    {loading && <p className="profile-status">Loading your saved choices…</p>}
    <div className="principle-grid">{moneyPrinciples.map((principle, index) => {
      const isSelected = selected.includes(principle.id);
      return <article className={`principle-card selectable-principle${isSelected ? " selected" : ""}`} key={principle.id}>
        <span className="principle-number">{String(index + 1).padStart(2, "0")}</span>
        <p className="eyebrow">INSPIRED BY {principle.inspiration.toUpperCase()}</p>
        <h2>{principle.title}</h2>
        <p>{principle.idea}</p>
        <div className="principle-action"><strong>Put it into practice</strong><span>{principle.action}</span><Link className="text-link" href={principle.href}>{principle.link} <ArrowRight size={14} /></Link></div>
        <button className="principle-toggle" type="button" aria-pressed={isSelected} onClick={() => togglePrinciple(principle.id)}>{isSelected ? <><CheckCircle2 size={16} /> Following</> : <><Check size={16} /> I’ll follow this</>}</button>
      </article>;
    })}</div>
    <p className="profile-privacy learn-note">These are original educational prompts inspired by broad ideas associated with the named books. They are not quotations, endorsements, or personalised investment advice. Your selected principles do not change your FIRE score.</p>
  </main><Footer /></>;
}
