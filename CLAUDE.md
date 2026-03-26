# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

Always respond to the user and summarize work in **Hebrew**. Code, file names, and identifiers remain in English.

## Commands

```bash
yarn dev        # Start dev server
yarn build      # Production build
yarn start      # Run production server
yarn lint       # ESLint
```

No test runner is configured yet. When adding tests, use **Vitest**.

## Architecture

**SmartShift** is a Next.js App Router application for shift management, backed by Supabase (PostgreSQL + Auth + RLS).

### Feature-Based Structure

Business logic lives in `features/`, organized by domain:

```
features/{assignments,constraints,profile,workers}/
  components/   # Feature-specific UI
  contexts/     # React Context for client state
  hooks/        # Custom hooks
  server/       # Service functions (server-only business logic)
  types.ts
```

API routes in `app/api/` are **thin** — they validate auth, parse the request, call a `features/*/server/*.service.ts` function, and return JSON. Keep business logic out of route files.

### Data Flow

1. Client calls `lib/api/apiFetch.ts` — this wrapper injects the Supabase Bearer token automatically. Always use it for client-side API calls.
2. API route validates auth with `requireUser()` (any authenticated user) or `requireManager()` (manager/commander roles only) from `lib/auth/`.
3. Route calls a service function from `features/*/server/`.
4. Service uses the appropriate Supabase client:
   - `lib/db/supabaseServer.ts` — server-side (respects RLS)
   - `lib/db/supabaseBrowser.ts` — browser-side singleton
   - `lib/db/supabaseAdmin.ts` — bypasses RLS (use only when justified and authorized)

### Authentication & Roles

- Auth via Supabase (email/password). Session JWT stored in browser by Supabase SDK.
- Roles: `manager`, `commander`, `worker`, `guest` — defined in `lib/utils/enums/role.ts`.
- `canManage(role)` returns true for manager/commander.
- `ProfileContext` (`features/profile/contexts/`) holds the current user profile globally.
- Dashboard layout redirects unauthenticated users to login.

### Styling

- Tailwind CSS v4 (via `@tailwindcss/postcss`) is the default. Migrate away from `styled-components` when touching existing components.
- Dark mode: class-based (`.dark` on `<html>`). CSS variables defined in `app/globals.css`.
- RTL: `dir="rtl"` on `<html>`. Theme pre-rendered by `ThemeScript` to prevent flash.

### Database

- No ORM. Raw Supabase JS SDK queries.
- RLS is enforced on all tables. Never bypass without explicit authorization and justification.
- New migrations go in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`.

### Key Domain Models

Defined in `lib/utils/interfaces/domain.ts`:
- `Profile` — user accounts with roles and `system_id`
- `Worker` — assignable employees (may not have a user account; `user_id` nullable)
- `Shift` — date + type (`day`/`night`/`full_day`) + `required_count`
- `Assignment` — maps a shift to a worker
- `Constraint` — worker unavailability (hard/soft/partial, supports recurring via `recurring_group_id`)

## Important Rules

- All client-side API calls must go through `apiFetch` — never call fetch/axios directly from the client.
- Every protected API route must call `requireUser` or `requireManager` before doing anything.
- Do not edit `.env.local` unless explicitly asked.
- Do not add heavy dependencies without approval.
- When adding Zod validation, place schemas in `lib/utils/schemas/<domain>.ts`.
- Tests belong in `features/*/server/__tests__/` or `app/api/**/__tests__/`. Unit tests must not depend on a real DB — mock Supabase.

## Environment Variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
Optional: `SUPABASE_SERVICE_ROLE_KEY` (admin client only)
