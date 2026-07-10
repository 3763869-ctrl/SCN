# Authentication

Supabase authentication owns the sign-in, sign-up, sign-out, and protected route entry points for the application shell.

Current scope:

- `/login` renders the first Supabase email/password form.
- `src/app/(app)/layout.tsx` protects all application routes.
- `middleware.ts` refreshes Supabase sessions.
- `SignOutButton` clears the browser session and returns users to `/login`.

Future scope:

- Password reset
- Email confirmation callback handling
- Role and permission helpers
- Organization membership
