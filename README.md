# Loan Dashboard

A multi-user loan and reserve tracking dashboard built with **React**, **TypeScript**, **Tailwind CSS**, and **Supabase**. Uses **Supabase Auth** for login/register; each user’s data is isolated. Owners can invite users by email; invited users sign up and then view and interact with the owner’s loans and reserves.

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Enable **Authentication** (Auth is on by default). Optionally under **Authentication → Providers** disable “Confirm email” if you want immediate sign-in without confirmation.
3. In the dashboard, open **SQL Editor** and run the migrations in order:
   - Run `supabase/migrations/001_initial.sql` (creates `loans` and `reserves`).
   - Run `supabase/migrations/002_auth_multi_user.sql` (adds `owner_id`, `team_members`, and RLS for multi-user).
   - Run `supabase/migrations/003_fix_team_members_rls.sql` (fixes “permission denied for table users” by using JWT email instead of reading `auth.users`).

### 2. Configure the app

1. Copy `.env.example` to `.env`.
2. In Supabase: **Project Settings → API**.
3. Set in `.env`:
   - `VITE_SUPABASE_URL` — Project URL
   - `VITE_SUPABASE_ANON_KEY` — anon public key

Do not commit `.env` (with real keys) to version control.

### 3. Install and run

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (e.g. http://localhost:5173). You’ll see a **Login / Register** page. After signing in, you get the dashboard. To build for production:

```bash
npm run build
npm run preview
```

### 4. Deploy to GitHub Pages

1. In your repo: **Settings → Secrets and variables → Actions**. Add:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
2. **Settings → Pages**. Under **Build and deployment**:
   - **Source**: choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to `main`; the workflow builds and deploys. The site will be at `https://<username>.github.io/LoanTracker/`.

## Project structure

- `src/` — React + TypeScript source
  - `App.tsx` — Root layout, auth gate, sidebar, pages, modals
  - `contexts/AuthContext.tsx` — Auth state, sign in/up/out, effective owner (for team members)
  - `components/` — Sidebar (with Users tab and Sign out), StatCard, Section, Badge, CheckBox, Modal
  - `components/modals/` — LoanDetailModal, ReserveDetailModal, AddLoanModal, AddReserveModal
  - `pages/` — AuthPage (login/register), OverviewPage, LoansPage, ReservesPage, ClosedPage, UsersPage
  - `hooks/useData.ts` — Load loans/reserves (scoped by auth), mutation helpers
  - `lib/` — Supabase client, DB layer (`supabase-db.ts`), utils
  - `types/` — Loan, Reserve, TeamMember, DB row types
- `supabase/migrations/001_initial.sql` — Base schema (loans, reserves)
- `supabase/migrations/002_auth_multi_user.sql` — owner_id, team_members, RLS
- `index.html` — Vite entry

## Auth and multi-user

- **Register** creates an account; you only see your own data (loans/reserves with your `owner_id`).
- **Users tab** (navbar): Account owners can add users by email. Invited users appear as “Pending invite” until they sign up with that email; then they become “Active” and can open the dashboard and view/interact with the owner’s loans and reserves (mark paid, reverse, etc.). They cannot see other owners’ data.
- **Sign out** is in the sidebar (hover to reveal).

## Data

- **Loans**: client, ref, total, installment, schedule, paid count, payment dates; tied to `owner_id`.
- **Reserves**: client, amount per deduction, installments, schedule, deduction dates; tied to `owner_id`.
- **team_members**: owner_id, email, member_id (set when invited user signs up).

All state is persisted in Supabase; there is no localStorage and no seed data.
