/**
 * Business and contact details shown on the Contact, Privacy, Terms and Refund pages.
 * Fill these in through environment variables (Vercel → Settings → Environment Variables) before launch —
 * Razorpay and Google Play both check that a real contact email, phone and address are visible.
 */
export const SITE = {
  name: "FIREpath",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "",
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS || "",
  /** Grievance Officer (India IT Rules / DPDP Act). Defaults to the contact details above. */
  grievanceName: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || "",
  /** City whose courts handle disputes, e.g. "Bengaluru". */
  jurisdiction: process.env.NEXT_PUBLIC_JURISDICTION_CITY || "",
  policiesUpdated: "26 November 2026",
} as const;

export const operatorName = () => SITE.legalName || "the FIREpath team";
export const hasContactDetails = () => Boolean(SITE.email && SITE.address);
