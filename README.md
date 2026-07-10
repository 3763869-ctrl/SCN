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
```

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

Run the migration in `supabase/migrations/0001_profiles_and_roles.sql` before creating production users. Public self-registration is not exposed in the app.

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
