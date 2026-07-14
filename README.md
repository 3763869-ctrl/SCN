# SCN Contractor Manager

SCN Contractor Manager is a professional Next.js application foundation for managing contractor operations. The initial build focuses on long-term structure, maintainability, and production readiness without implementing business logic yet.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase-ready authentication, PostgreSQL, and storage structure
- ESLint and Prettier

## Getting Started

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Supabase is not connected yet. The structure is prepared for these values when the project is ready:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe.
`SUPABASE_SERVICE_ROLE_KEY` must stay server-only in local `.env.local` and
Vercel Project Environment Variables. Never commit it to GitHub.

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are optional but
recommended in production so login and password reset rate limits work
reliably across Vercel serverless instances.

## Project Structure

```text
src/
  app/
    (app)/
      dashboard/
      clients/
      workers/
      time-tracking/
      production/
      payroll/
      invoices/
      expenses/
      taxes/
      reports/
      settings/
    globals.css
    layout.tsx
    page.tsx
  components/
    layout/
    ui/
  features/
    auth/
  lib/
    supabase/
    env.ts
    utils.ts
  types/
    database.ts
```

## Available Scripts

```bash
npm run dev
npm run build
npm run lint
npm run format
npm run format:check
```

## Supabase Readiness

The app includes typed browser and server Supabase client factories under `src/lib/supabase`. They intentionally throw when environment variables are missing, which keeps accidental unauthenticated integration work obvious during future development.

The `src/features/auth` area owns private sign-in, sign-out, role-based route protection, and auth UI.

Run the migrations in `supabase/migrations` before creating production users and testing worker activity. Public self-registration is not exposed in the app.

Migration order:

```text
0001_profiles_and_roles.sql
0002_worker_time_and_units.sql
0003_allow_trusted_profile_maintenance.sql
0004_worker_pay_breaks_and_bonuses.sql
```

GitHub Actions can apply future migrations automatically with
`.github/workflows/supabase-migrations.yml`. Add the pooled Supabase database
URI as a repository secret named `SUPABASE_DB_URL`; do not commit database
passwords or service-role keys.

## Security Checklist

- Keep Vercel Deployment Protection or password protection enabled for production.
- Store production variables in Vercel Project Settings, not in GitHub code.
- Disable public signups in Supabase Auth for this private internal app.
- Require strong passwords in Supabase Auth settings.
- Enable MFA for admin accounts when available.
- Keep Row Level Security enabled on application tables.
- Rotate the Supabase service-role key if it was ever exposed outside secure
  environment-variable storage.
- Apply `0018_admin_audit_events.sql` so sensitive admin and financial actions
  are recorded in `admin_audit_events`.

### Creating the First Users

Create the first admin user in Supabase Authentication, then run this SQL in the Supabase SQL editor with that user's real auth user id and email:

```sql
insert into public.profiles (id, full_name, email, role, active)
values (
  'USER_UUID_HERE',
  'Admin Name',
  'admin@example.com',
  'admin',
  true
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = 'admin',
  active = true;
```

Create worker users in Supabase Authentication, then run:

```sql
insert into public.profiles (id, full_name, email, role, active)
values (
  'USER_UUID_HERE',
  'Worker Name',
  'worker@example.com',
  'worker',
  true
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = 'worker',
  active = true;
```

## Version Control

Git is initialized on the `main` branch. Create the initial commit before pushing to GitHub:

```bash
git add .
git commit -m "Initial SCN Contractor Manager foundation"
```
