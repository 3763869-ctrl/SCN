# Authentication

Supabase authentication owns private sign-in, sign-out, role checks, and protected route entry points for the application shell.

Current scope:

- `/login` renders email/password sign-in and forgot password only.
- `src/app/(app)/layout.tsx` protects all administrative application routes.
- `/worker` is available to active workers and admins.
- `middleware.ts` refreshes Supabase sessions.
- `SignOutButton` clears the browser session and returns users to `/login`.
- `profiles.role` controls access with `admin` and `worker` values.

Future scope:

- Password reset confirmation page
- Email confirmation callback handling
- Deeper permission helpers
- Organization membership
