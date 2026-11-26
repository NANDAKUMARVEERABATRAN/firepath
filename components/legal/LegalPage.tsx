import type { ReactNode } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { SITE, operatorName } from "@/lib/site";

export function ContactBlock() {
  return <ul className="legal-contact">
    <li><b>Operator:</b> {operatorName()}</li>
    {SITE.email && <li><b>Email:</b> <a href={`mailto:${SITE.email}`}>{SITE.email}</a></li>}
    {SITE.phone && <li><b>Phone:</b> {SITE.phone}</li>}
    {SITE.address && <li><b>Address:</b> {SITE.address}</li>}
    <li><b>In the app:</b> signed-in users can also write to us from <a href="/feedback">Ideas &amp; rewards</a>.</li>
  </ul>;
}

export default function LegalPage({ eyebrow = "LEGAL", title, intro, children }: { eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return <><Header /><main className="legal-page container">
    <p className="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p className="legal-updated">Last updated: {SITE.policiesUpdated}</p>
    {intro && <div className="legal-intro">{intro}</div>}
    <div className="legal-body">{children}</div>
  </main><Footer /></>;
}
