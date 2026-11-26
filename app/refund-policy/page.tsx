import type { Metadata } from "next";
import LegalPage, { ContactBlock } from "@/components/legal/LegalPage";
import { PRICING } from "@/lib/subscription";

export const metadata: Metadata = { title: "Refund & Cancellation Policy | FIREpath" };

export default function RefundPolicy() {
  return <LegalPage eyebrow="BILLING" title="Refund & Cancellation Policy" intro={<p>Simple and fair: try FIREpath free, cancel whenever you like, and keep what you’ve paid for.</p>}>
    <h2>Free trial</h2>
    <p>New accounts get {PRICING.trialDays} days of FIREpath Pro free. No card or payment is needed, so there’s nothing to cancel or refund. When the trial ends, you choose whether to subscribe.</p>

    <h2>Cancelling</h2>
    <ul>
      <li>Cancel any time from <b>Subscription → Cancel subscription</b> in the app. It takes a few taps and there are no cancellation fees.</li>
      <li>Your plan won’t renew again, and you <b>keep full access until the end of the period you’ve already paid for</b>.</li>
      <li>Your data stays saved, so you can come back later, unless you choose to delete your account.</li>
    </ul>

    <h2>Refunds</h2>
    <ul>
      <li><b>Monthly plan:</b> no refunds for partly used months. Cancelling stops the next charge.</li>
      <li><b>Yearly plan:</b> if you’re not happy, ask within <b>7 days</b> of your first yearly payment for a full refund. After 7 days, yearly plans aren’t refundable, but you keep access until the end of the year.</li>
      <li><b>Charged by mistake?</b> Duplicate charges, charges after a cancellation that went through, or failed payments where money left your account are always refunded in full.</li>
      <li>Approved refunds go back to your original payment method, usually within <b>5–7 working days</b> depending on your bank.</li>
      <li>Discounts from reward points aren’t paid out as cash.</li>
    </ul>

    <h2>Bought through Google Play?</h2>
    <p>Subscriptions bought inside the Android app through Google Play are billed by Google. Manage or cancel them in Google Play → Payments &amp; subscriptions. Refunds follow Google Play’s refund policy, and we’ll help where we can.</p>

    <h2>How to ask for a refund</h2>
    <p>Contact us with the email address of your FIREpath account and the payment date. We reply within 2 working days.</p>
    <ContactBlock />
  </LegalPage>;
}
