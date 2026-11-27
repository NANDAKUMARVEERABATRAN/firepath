import type { Metadata } from "next";
import LegalPage, { ContactBlock } from "@/components/legal/LegalPage";
import { SITE, operatorName } from "@/lib/site";
import { FOUNDING, PRICING, REFERRAL_REWARD, REFERRAL_TRIAL_DAYS } from "@/lib/subscription";
import { REWARDS } from "@/lib/rewards";

export const metadata: Metadata = { title: "Terms of Use | FIREpath" };

export default function Terms() {
  return <LegalPage title="Terms of Use" intro={<p>These terms are an agreement between you and {operatorName()} for using FIREpath on the web and in the Android app. By creating an account or using the app, you agree to them. Please also read our <a href="/privacy">Privacy Policy</a> and <a href="/refund-policy">Refund &amp; Cancellation Policy</a>.</p>}>
    <h2>1. What FIREpath is and isn’t</h2>
    <p>FIREpath is an <b>educational planning tool</b>. It helps you organise your finances, estimate a financial-independence number and track progress, using the numbers and assumptions you enter.</p>
    <ul>
      <li><b>It is not investment, tax, legal or insurance advice.</b> We are not a SEBI-registered investment adviser or research analyst, and we don’t recommend specific securities, funds or financial products.</li>
      <li>Projections, scores and dates are <b>estimates</b> that depend on your assumptions, such as returns, inflation and expenses. Real results will differ, and markets can fall. Nothing in the app is a guarantee.</li>
      <li>Book lessons are our own summaries of ideas from well-known personal-finance books, for education. FIREpath isn’t affiliated with or endorsed by their authors or publishers.</li>
      <li>Consider speaking to a qualified, registered professional before making major financial decisions.</li>
    </ul>

    <h2>2. Your account</h2>
    <p>You must be 18 or older. You sign in with Google and are responsible for activity on your account. Please enter accurate information; the app’s output is only as good as its inputs. You can delete your account at any time from Subscription → Delete my account, or at <a href="/delete-account">/delete-account</a>.</p>

    <h2>3. Free and Pro features</h2>
    <ul>
      <li>The FIRE calculator on our home page is free and needs no account.</li>
      <li>Features after sign-in are part of <b>FIREpath Pro</b>. New accounts get a free {PRICING.trialDays}-day trial with no card required, one trial per person.</li>
      <li>Pro is offered monthly or yearly at the prices shown on our <a href="/pricing">pricing page</a> for your country, including any applicable taxes as stated at checkout. We’ll give you notice in the app before any price change applies to you.</li>
      <li>Paid plans <b>renew automatically</b> until you cancel. You can cancel at any time and keep access until the end of the period you’ve paid for. Refunds are covered by our <a href="/refund-policy">Refund &amp; Cancellation Policy</a>. Purchases made through Google Play also follow Google Play’s terms.</li>
      <li><b>Pause:</b> instead of cancelling a paid plan, you can pause it for 1–3 months. While paused, nothing is charged and Pro-only features are off; the paused time is added to the end of your current period. You can resume early, and the unused pause is taken back off that date.</li>
      <li>Until paid checkout launches, we may continue to provide Pro features free of charge after a trial ends.</li>
      <li><b>Free plan:</b> the FIRE calculator and your freedom number are free. Everything else after sign-in is part of Pro, as listed on our pricing page. Your saved data stays in your account (and can be deleted any time) whether or not you subscribe.</li>
      <li><b>Founding members:</b> the first {FOUNDING.spots.toLocaleString("en-IN")} people who reserve a spot before {FOUNDING.until} can subscribe yearly at ₹{FOUNDING.yearly}. That price stays for as long as the yearly plan renews without a break; if you cancel and later return, normal prices apply.</li>
      <li><b>Referrals:</b> friends who sign up within 7 days of using your link get a {REFERRAL_TRIAL_DAYS}-day trial, and you earn reward points ({REFERRAL_REWARD.signup} when they join, {REFERRAL_REWARD.paid} when they first pay). Referrals must be real people; we may remove points from self-referrals or fake accounts.</li>
    </ul>

    <h2>4. Reward points</h2>
    <p>You can earn reward points for feedback ({REWARDS.perFeedback} points for each of your first {REWARDS.monthlyRewardedFeedback} suggestions a month, and more if we accept or build an idea). Points can be used as a discount on FIREpath subscriptions, up to half of a bill. They have <b>no cash value</b>, can’t be transferred or exchanged, and end when your account is deleted. We may adjust points obtained through abuse, and we may change or end the programme with notice. Points already earned remain usable for at least 90 days after such notice.</p>

    <h2>5. Feedback you send</h2>
    <p>You’re welcome to send ideas. By sending them, you allow us to use them to improve FIREpath without owing you payment beyond any reward points described above.</p>

    <h2>6. Acceptable use</h2>
    <p>Don’t misuse FIREpath: no attempting to access other people’s data, disrupting or reverse-engineering the service, automated scraping, abusing the AI features, or using it for anything unlawful. We may suspend accounts that do.</p>

    <h2>7. Our content</h2>
    <p>The FIREpath name, design, lessons and software belong to us or our licensors. You may use them for your personal planning only. Your financial data belongs to you.</p>

    <h2>8. Availability and changes</h2>
    <p>We work hard to keep FIREpath running and your data safe, but the service is provided “as is” and may occasionally be unavailable or contain errors. We may improve, change or discontinue features. If we ever shut down a paid service, we’ll refund the unused part of any prepaid period.</p>

    <h2>9. Liability</h2>
    <p>To the extent the law allows, we’re not liable for financial decisions you make or their outcomes, or for indirect or consequential losses. Our total liability to you is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits rights you have under consumer-protection law that can’t be excluded.</p>

    <h2>10. Ending the agreement</h2>
    <p>You can stop using FIREpath and delete your account at any time. We may suspend or end accounts that break these terms, and will tell you why where we can.</p>

    <h2>11. Law and disputes</h2>
    <p>These terms are governed by the laws of India. Disputes will be handled by the courts{SITE.jurisdiction ? ` at ${SITE.jurisdiction}` : " of India"}, without affecting any right you have to approach a consumer forum or the courts where you live. Please contact us first; most issues can be solved quickly.</p>

    <h2>12. Contact</h2>
    <ContactBlock />
  </LegalPage>;
}
