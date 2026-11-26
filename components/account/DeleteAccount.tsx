"use client";

import { useEffect, useState } from "react";
import { LogIn, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_WORD = "DELETE";

/** Permanently deletes the signed-in user's account and every FIREpath record (via the delete_my_account RPC). */
export default function DeleteAccount({ standalone = false }: { standalone?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(standalone);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setChecked(true); return; }
    void supabase.auth.getSession().then(({ data }) => { setEmail(data.session?.user.email ?? (data.session ? "" : null)); setChecked(true); });
  }, []);

  async function signIn() {
    const supabase = createClient();
    if (!supabase) { setMessage("Sign-in isn’t configured on this site yet."); return; }
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/delete-account` } });
  }

  async function remove() {
    const supabase = createClient();
    if (!supabase || typed.trim().toUpperCase() !== CONFIRM_WORD) return;
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      setMessage(error.message.includes("function") ? "Account deletion isn’t switched on yet (run supabase/migrations/202611260023_account_deletion_and_ai_limit.sql). Please contact us and we’ll delete it for you." : `Couldn’t delete your account: ${error.message}`);
      return;
    }
    await supabase.auth.signOut().catch(() => undefined);
    try {
      Object.keys(window.localStorage).filter(key => key.startsWith("ff-")).forEach(key => window.localStorage.removeItem(key));
    } catch { /* storage unavailable */ }
    setDeleted(true);
    setBusy(false);
  }

  if (deleted) return <section className="delete-card done" role="status">
    <h2>Your account has been deleted</h2>
    <p>Your profile, plan, portfolio, goals, check-ins, budgets, lessons, badges, feedback and reward points have been permanently removed. Thank you for trying FIREpath — we wish you every success on your path to freedom. 💚</p>
    <a href="/" className="button button-primary">Back to the home page</a>
  </section>;

  if (!checked) return <p className="profile-status">Checking your sign-in…</p>;

  if (email === null) return <section className="delete-card">
    <h2>Sign in to delete your account</h2>
    <p>For your security, sign in with the Google account you use for FIREpath. You’ll come straight back here.</p>
    {message && <p className="delete-error" role="alert">{message}</p>}
    <button type="button" className="button button-primary" onClick={() => void signIn()}><LogIn size={16} /> Sign in with Google</button>
  </section>;

  if (!open) return <section className="delete-card compact">
    <div><h2>Delete my account</h2><p>Permanently remove your account and all your FIREpath data.</p></div>
    <button type="button" className="button delete-button-outline" onClick={() => setOpen(true)}><Trash2 size={15} /> Delete account</button>
  </section>;

  return <section className="delete-card">
    <h2><Trash2 size={18} /> Delete my account permanently</h2>
    <p>Signed in as <b>{email || "your Google account"}</b>. This will permanently delete:</p>
    <ul>
      <li>Your financial profile, FIRE plan and “why” answers</li>
      <li>Your portfolio (assets and loans), goals and budgets</li>
      <li>Your check-ins, progress history, streaks, lessons and badges</li>
      <li>Your feedback, reward points and subscription record</li>
    </ul>
    <p className="delete-warning">This can’t be undone. If you have a paid plan, cancel it first so you aren’t charged again — deleting your account ends your access immediately and unused time isn’t refunded except as described in our <a href="/refund-policy">refund policy</a>.</p>
    <label className="delete-confirm">Type <b>{CONFIRM_WORD}</b> to confirm
      <input value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" autoCapitalize="characters" placeholder={CONFIRM_WORD} />
    </label>
    {message && <p className="delete-error" role="alert">{message}</p>}
    <div className="delete-actions">
      <button type="button" className="button delete-button" disabled={busy || typed.trim().toUpperCase() !== CONFIRM_WORD} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete everything"}</button>
      {!standalone && <button type="button" className="text-link" onClick={() => { setOpen(false); setTyped(""); }}>Keep my account</button>}
    </div>
  </section>;
}
