import type { Metadata } from "next";
import LegalPage, { ContactBlock } from "@/components/legal/LegalPage";
import { SITE, operatorName } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy | FIREpath" };

export default function Privacy() {
  return <LegalPage title="Privacy Policy" intro={<p>FIREpath helps you plan your path to financial independence. To do that you share personal financial information with us, so we want to be clear about what we collect, why, and the control you have. <b>We don’t sell your data and we don’t show ads.</b></p>}>
    <h2>1. Who we are</h2>
    <p>FIREpath ({SITE.url.replace(/^https?:\/\//, "")} and the FIREpath Android app) is operated by {operatorName()} (“we”, “us”). We are the data fiduciary / controller for the information described here.</p>

    <h2>2. What we collect</h2>
    <ul>
      <li><b>Account details from Google sign-in:</b> your name, email address and profile picture.</li>
      <li><b>Financial information you choose to enter:</b> age, income, expenses, savings, investments, property, loans, insurance cover, goals, budgets, spending entries and monthly check-ins.</li>
      <li><b>Your plan and preferences:</b> FIRE assumptions, step-up plan, country and currency, your reasons for wanting financial freedom and your dream age.</li>
      <li><b>App activity:</b> lessons completed, badges, levels, streaks and monthly progress snapshots that power your charts and reports.</li>
      <li><b>Feedback and rewards:</b> suggestions you send us, our replies, and your reward points.</li>
      <li><b>Subscription details:</b> your plan, trial dates and cancellation reason (if you give one). When paid plans launch, payments are processed by our payment provider; <b>we never see or store your full card or UPI details.</b></li>
      <li><b>On your device:</b> sign-in cookies, plus browser storage for your calculator inputs and country choice. The free calculator works without an account and its numbers stay on your device unless you sign up.</li>
      <li><b>Voice entry:</b> if you use the microphone, speech is converted to text by your browser or phone’s speech service (for example Google in Chrome). We only receive the resulting text, and only when you save the form.</li>
    </ul>
    <p>We don’t ask for bank logins, card numbers, Aadhaar, PAN or Emirates ID. Please don’t type them into free-text fields.</p>

    <h2>3. How we use it</h2>
    <ul>
      <li>To calculate your FIRE number, score, progress, freedom date, goals and reports, and to show your lessons, levels and reminders.</li>
      <li>To run your account, trial and subscription, and to apply reward points.</li>
      <li>To answer feedback and fix problems, and to improve FIREpath using aggregated, non-identifying statistics.</li>
      <li>To keep the service secure and prevent abuse.</li>
    </ul>
    <p>We process your information on the basis of your consent, which you give when you sign up and enter it, and where needed to provide the service you asked for or to meet legal obligations. You can withdraw consent at any time by deleting your account.</p>

    <h2>4. Who we share it with</h2>
    <p>Only with service providers who help us run FIREpath, under contracts that limit their use of it:</p>
    <ul>
      <li><b>Supabase</b>: database and sign-in hosting.</li>
      <li><b>Vercel</b>: website hosting.</li>
      <li><b>Google</b>: sign-in.</li>
      <li><b>OpenAI</b>: only when you use an AI feature. For “AI budget suggestions” we send your monthly income, fixed costs, savings target and currency. For “Tell FIREpath in one line” we send the sentence you typed or spoke, after removing long numbers (account, card and phone numbers), PAN and email addresses. We don’t send your name or email, and we ask OpenAI not to store the request.</li>
      <li><b>Our payment provider</b> (for example Razorpay, or Google Play billing in the Android app), once paid plans launch.</li>
    </ul>
    <p>We may also disclose information if required by law or to protect users’ safety. We never sell or rent your personal data, and we don’t share it with advertisers.</p>

    <h2>5. Where it’s stored and for how long</h2>
    <p>Your data is stored on servers run by the providers above, which may be outside your country (for example in Asia, Europe or the USA). We keep it while your account is active. When you delete your account, your data is deleted immediately from our live database and disappears from provider backups as those backups expire. We keep payment and tax records for as long as the law requires.</p>

    <h2>6. Security</h2>
    <p>Data is encrypted in transit (HTTPS). Database rules ensure each person can only read and change their own records. Reward points and subscription status can only be changed by our server. No system is perfectly secure; if a breach affects you, we will notify you and the authorities as the law requires.</p>

    <h2>7. Your rights</h2>
    <p>Under India’s Digital Personal Data Protection Act, 2023 and the UAE’s Personal Data Protection Law (and similar laws where you live), you can:</p>
    <ul>
      <li><b>See and correct</b> your information. Most of it is editable directly in the app.</li>
      <li><b>Delete</b> your account and all its data at any time: <a href="/delete-account">Delete my account</a>.</li>
      <li><b>Withdraw consent</b>, <b>nominate</b> someone to exercise your rights if you die or are incapacitated, and <b>raise a grievance</b> with us, and then with the Data Protection Board of India or your local regulator.</li>
    </ul>

    <h2>8. Age</h2>
    <p>FIREpath is for adults aged 18 and over. We don’t knowingly collect data from children.</p>

    <h2>9. Changes</h2>
    <p>If we make important changes, we’ll tell you in the app before they take effect. The date at the top shows the latest version.</p>

    <h2>10. Contact and Grievance Officer</h2>
    <p>Grievance Officer: {SITE.grievanceName || operatorName()}. We aim to reply within 7 days and resolve complaints within 30 days.</p>
    <ContactBlock />
  </LegalPage>;
}
