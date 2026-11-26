"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut } from "lucide-react";
import { START_TRIAL_KEY } from "@/lib/subscription";

export default function AuthButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !error) setUser(data.session?.user ?? null);
      else if (active && error) setMessage(error.message);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setMessage("");
    const supabase = createClient();
    if (!supabase) {
      setMessage("Add your Supabase URL and anon key to .env.local to enable Google sign-in.");
      return;
    }
    setLoading(true);
    // "Get started" = start the free trial right after sign-in (ignored if the account already has one).
    try { window.localStorage.setItem(START_TRIAL_KEY, "1"); } catch { /* storage unavailable */ }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  async function signOut() {
    setMessage("");
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      {user ? (
        <>
          <span className="auth-user" title={user.email ?? "Signed in"}>{user.email ?? "Signed in"}</span>
          <button className="button button-primary nav-cta" onClick={signOut} disabled={loading}>
            <LogOut size={16} /> {loading ? "Signing out..." : "Sign out"}
          </button>
        </>
      ) : (
        <button className="button button-primary nav-cta" onClick={signIn} disabled={loading}>
          <LogIn size={16} /> {loading ? "Connecting..." : "Get started"}
        </button>
      )}
      {message && <div className="auth-message" role="status">{message}</div>}
    </div>
  );
}
