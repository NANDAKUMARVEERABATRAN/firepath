# FIREpath

A responsive Next.js app for personal FIRE planning, with financial profiles, portfolio classification, FIRE scoring, monthly budgets and check-ins, book-inspired principles, badges, and Google OAuth through Supabase.

## Project structure

```text
app/                    Next.js routes, global styles, and auth callback
components/
  auth/                 Sign-in controls
  landing/              Homepage sections and FIRE calculator
  layout/               Shared site header and footer
  lib/supabase/           Supabase browser client and session refresh
  proxy.ts                Supabase cookie refresh for Next.js requests
  tests/                  Core FIRE calculation and voice parsing tests
```

Keep route-specific pages and handlers in `app/`, reusable UI grouped by purpose in `components/`, and service integrations in `lib/`.

## Apply database changes

Run the SQL files in `supabase/migrations/` in filename order from the Supabase SQL Editor. The FIRE readiness inputs migration adds emergency savings and monthly investment fields. The monthly check-ins migration enables private progress tracking and investment streak badges. The financial accounts migration adds a private asset and loan ledger. The insurance details migration adds self-reported coverage context. The FIRE plans migration stores personal projection assumptions. The badge awards migration preserves earned milestones. The portfolio classification migration separates accessible and later assets. The FIRE principles migration stores user-selected principles. The monthly budget migration creates private monthly targets and spending entries. The investment income migrations separately record payouts and the projection convention used for whether they are reinvested or taken as cash. The goals and lessons migration (`202611250013`) creates `financial_goals` and `lesson_completions` for the Goals page and the Journey's daily lessons. `202611260014` adds `property_use` (home you live in vs rented/investment property). `202611260015` adds `subscriptions` and the `start_pro_trial()` function (one 14-day trial per account; users can read but not write their subscription). `202611260016` adds the "why financial freedom" answers (`fire_reasons`, `fire_why_note`, `dream_age`). `202611260017` sets the trial to 14 days. `202611260018` lets a portfolio item be earmarked for a goal (`goal_id`) — such items count toward the goal and are excluded from the FIRE-accessible portfolio. `202611260019` adds UAE investment types (gratuity, workplace savings, pension). `202611260020` adds `progress_snapshots` (one row per user per month, saved when Home is opened; powers the progress chart) and the `cancel_subscription(reason)` / `resume_subscription()` functions used by the Subscription page's cancel flow. `202611260021` adds the annual step-up plan to `fire_plans`. `202611260022` adds `feedback` and `reward_points`: users can only send feedback and read their own points; triggers award +20 per feedback (first 3 a month), +200 when you set `feedback.status = 'accepted'` and +500 for `'shipped'` in the Supabase dashboard (you can also fill `team_reply`). Points are worth ₹10 / AED 1.5 per 100, redeemable up to half of a bill once payments are live (`lib/rewards.ts`). `202611260023` adds `delete_my_account()` (self-service deletion; every table cascades from `auth.users`) and `use_ai_credit()` (10 AI budget suggestions per user per day). `202611260024` adds `financial_profiles.cut_plan`, the "Save more" pledge used by `/save-more` (savings-rate levels, Leak Hunter, pledge scoreboard; logic in `lib/savingsCoach.ts`). `202611260025` adds `source`, `external_id`, `units` and `synced_at` to `financial_accounts` for portfolio import (CAS PDFs and app exports, read in the browser; `lib/importHoldings.ts`). `202611260026` adds EPF/VPF and NPS deducted from salary (`salary_pf`, `salary_pension` on check-ins; `monthly_salary_pf`, `monthly_salary_pension` on profiles). Income is take-home; these are added on top for the savings rate and investing score, but not to the FIRE-accessible monthly investment. `202611260027` adds `gold_loan` as a loan type. `202611270029` adds `financial_profiles.track_budget` (does the person track spending by category; hides budget charts when false). `202611260028` adds optional `fire_plans.retirement_expenses` (monthly spending after you stop working, in today's money; Lean/Regular/Fat FIRE). When set, the FIRE target everywhere uses it (`targetExpenses()` in `lib/fireScore.ts`).

### Legal pages and business details

`/privacy`, `/terms`, `/refund-policy`, `/contact` and `/delete-account` are drafts written for this app. Have them reviewed by a lawyer before public launch. They read the business details from `NEXT_PUBLIC_LEGAL_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_PHONE`, `NEXT_PUBLIC_CONTACT_ADDRESS`, `NEXT_PUBLIC_GRIEVANCE_OFFICER` and `NEXT_PUBLIC_JURISDICTION_CITY` (see `lib/site.ts`). Razorpay and Google Play both check that these details are visible.

### Installable app and Google Play

- `app/manifest.ts`, the icons in `public/icons/` and `public/sw.js` make the site installable. The service worker only shows `public/offline.html` when offline and never caches pages or financial data.
- `/.well-known/assetlinks.json` (served by `app/api/assetlinks`) links the Play app to this site. Set `ANDROID_PACKAGE_NAME` and `ANDROID_SHA256_FINGERPRINTS` (comma-separated, from Play Console → App signing) in production.
- `/delete-account` is the account-deletion web link Google Play asks for. Its sign-in returns to `/auth/callback?next=/delete-account`, so add `https://<your-domain>/auth/callback**` to Supabase → Authentication → Redirect URLs.

### Countries

India is open to new users; UAE support is built but switched off (`ENABLED_COUNTRIES` in `lib/country.ts`) until its licensing, VAT and payment questions are settled. `lib/country.ts` holds each country's currency, number words (lakh/crore vs thousand/million), default assumptions, calculator ranges and pricing. The country comes from the signed-in user's profile currency, otherwise from the visitor's saved choice, a `?country=ae` link, or their time zone/language.

### Free vs Pro

The FIRE calculator on `/` is free without sign-in. Every page under `app/(pro)/` is wrapped by `components/pro/ProGate.tsx` and needs an active trial or plan once signed in (₹75/month or ₹500/year in India, AED 15/119 in the UAE; set in `lib/country.ts`). Paid checkout is not connected yet: `app/api/subscribe/route.ts` lists the Razorpay steps (server-side keys, subscription creation, and a signed webhook that updates `subscriptions` with the service-role key).

## Requirements

- Node.js 20.9 or later (Node 22 LTS recommended)
- npm
- A Supabase project
- A Google Cloud project for OAuth

## 1. Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

The landing page and calculator work without Supabase credentials. Google sign-in becomes active after you configure Supabase.

## 2. Configure Supabase

1. Create a project at https://supabase.com/.
2. Open Project Settings → API.
3. Copy the Project URL and `anon` public key into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=YOUR_SERVER_SIDE_OPENAI_API_KEY
OPENAI_MODEL=gpt-6.2-astra
```

4. In Supabase, open Authentication → Providers → Google and enable Google.
5. Create OAuth credentials in Google Cloud Console:
   - Configure the OAuth consent screen.
   - Create an OAuth Client ID of type Web application.
   - Add the Supabase callback URL shown in the Supabase Google provider settings as an Authorized redirect URI.
   - Copy the Google Client ID and Client Secret into Supabase's Google provider configuration.
6. In Supabase Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Add redirect URL: `http://localhost:3000/auth/callback`
7. Restart the Next.js server after editing `.env.local`.

Google OAuth is handled by Supabase. Never put the Google client secret or Supabase service-role key in a `NEXT_PUBLIC_` variable or browser code.

AI budget suggestions call the OpenAI Responses API from a server route and require `OPENAI_API_KEY` in the server environment. The budget remains editable without that key. Voice form filling uses browser speech recognition where available; users can also type the same instructions, and filled values must be reviewed before saving.

## 3. Configure your production domain

Before launching on a public domain:

1. Check domain availability and purchase it through a registrar.
2. Deploy the Next.js app to Vercel (or another Next.js host).
3. Add your FIREpath domain (and its `www.` version) to the hosting project and configure the DNS records supplied by the host.
4. Set production environment variables:
   - `NEXT_PUBLIC_SITE_URL=https://<your-firepath-domain>`
   - Supabase project URL and publishable key.
5. Add `https://<your-firepath-domain>/auth/callback` to Supabase Authentication → URL Configuration.
6. Add the production callback URL to the Google OAuth authorized redirect URIs only if Google/Supabase requires it. The provider callback shown by Supabase remains the OAuth redirect URI used by Google; the app callback is the post-login redirect.
7. Test Google sign-in on the production domain.

## Project checks

```bash
npm run typecheck
npm test
npm run build
```

The root `proxy.ts` refreshes Supabase sessions and sets the no-cache headers required when auth cookies change. Keep `OPENAI_API_KEY` server-side; never prefix it with `NEXT_PUBLIC_`. Configure separate environment variables and OAuth redirect URLs for preview and production.

Domain availability and trademark clearance have not been checked by this project.

## 4. Build and run production locally

```bash
npm run build
npm run start
```

## What's included

- **Journey hub (`/journey`)** — the game layer and landing page after sign-in:
  - 11-level Freedom Path (money map → cash flow → buffers → protection → debt → pay yourself first → Coast FIRE → halfway → FI → Fat FIRE at 1.5× the FIRE number; Coast and halfway swap order when the Coast number is above 50% of the target), each tied to a book idea and a "how to clear it" action (`lib/freedomPath.ts`)
  - XP from levels, badges, check-ins, streaks, lessons and goals; 10 ranks with a rank-up celebration
  - Months of freedom owned, estimated years/age to FIRE, and a "power move" showing how an extra monthly investment changes the date
  - Daily book lesson with an Indian example, quiz and micro-challenge (`lib/wisdom.ts`)
  - Goals snapshot, portfolio mix, and badges
- **Money trends (`/trends`)** — where each month's money went (invested, EPF/NPS, spent, EMIs, left over), savings rate over time with saver-level reference lines, spending by budget category vs the previous period; months/all/yearly views, hover/tap details and a table view (`lib/trends.ts`)
- **This month (`/month`)** — one page for the month: money in (take-home, EPF/NPS), spending as a single total or by category (a category = its entries + an optional typed "Monthly total" entry, so nothing double-counts; `lib/monthLog.ts`), optional category limits, investing and EMIs, plus AI one-line logging and CSV import. `/check-in` and `/budget` redirect here.
- **Goals (`/goals`)** — inflation-adjusted life goals with required monthly SIP, on-track status, quick top-ups and achievement celebrations (`lib/goals.ts`)
- Responsive marketing homepage
- Light design system and mobile navigation
- India-first experience with INR display
- Interactive illustrative FIRE calculator
- Profile, classified assets and loans, FIRE score and plan
- Monthly check-ins, budget targets and spending records
- Book-inspired principles and FIRE milestone badges
- Voice-assisted form entry with manual review
- Supabase Google OAuth button and callback route

## Important product limitations

- The calculator is a simple illustrative model. It assumes a constant annual return, monthly contributions, a selected inflation rate and a selected withdrawal rate. It does not model tax, fees, asset allocation, volatility, sequence-of-returns risk, or other retirement income.
- Monthly transaction import, account aggregation, tax modeling and regional-language voice entry are not implemented yet.
- The Privacy, Terms and Refund pages are drafts. Have them reviewed by a lawyer and fill in the business details before inviting public users.
- Do not add personalised securities recommendations unless and until the relevant regulatory requirements have been reviewed and satisfied.
