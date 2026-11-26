import type { Metadata } from "next";
import LegalPage, { ContactBlock } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Contact us | FIREpath" };

export default function Contact() {
  return <LegalPage eyebrow="CONTACT" title="Contact us" intro={<p>Questions about your account, billing, privacy, or an idea for FIREpath? We’re happy to help, and we usually reply within 2 working days.</p>}>
    <ContactBlock />
    <h2>Quick links</h2>
    <ul>
      <li><a href="/refund-policy">Cancel or ask for a refund</a></li>
      <li><a href="/delete-account">Delete my account and data</a></li>
      <li><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a></li>
    </ul>
  </LegalPage>;
}
