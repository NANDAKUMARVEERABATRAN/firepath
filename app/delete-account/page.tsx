import type { Metadata } from "next";
import LegalPage, { ContactBlock } from "@/components/legal/LegalPage";
import DeleteAccount from "@/components/account/DeleteAccount";

export const metadata: Metadata = { title: "Delete your FIREpath account" };

export default function DeleteAccountPage() {
  return <LegalPage eyebrow="YOUR DATA" title="Delete your FIREpath account" intro={<p>You can permanently delete your FIREpath account and all its data at any time, here or in the app under <b>More → Subscription → Delete my account</b>.</p>}>
    <DeleteAccount standalone />
    <h2>What gets deleted</h2>
    <p>Everything linked to your account is deleted immediately: your profile, FIRE plan, portfolio, goals, budgets, check-ins, progress history, lessons, badges, feedback, reward points and subscription record. It disappears from our hosting provider’s backups as those backups expire, normally within 30 days.</p>
    <h2>What we may keep</h2>
    <p>If you paid for a plan, we keep payment and invoice records for as long as tax and accounting laws require. These don’t include your financial plan data.</p>
    <h2>Can’t sign in?</h2>
    <p>Contact us from the email address on your account and we’ll delete it for you within 7 days.</p>
    <ContactBlock />
  </LegalPage>;
}
