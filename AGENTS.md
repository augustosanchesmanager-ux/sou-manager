# AGENTS.md — SOU MANA.GER

> Compact instructions for OpenCode sessions. If a fact is obvious from filenames or generic to React/Vite, it is omitted.

---

## Stack & Tooling

- **React 19** + **Vite 6** + **TypeScript 5.8** + **Tailwind CSS v4** (CSS-based config, no `tailwind.config` file).
- **Router**: `react-router-dom` with **HashRouter** (not BrowserRouter). Required for Vercel SPA deployment (`vercel.json` has a catch-all rewrite to `index.html`).
- **State**: Pure React Context — `AuthContext` → `TenantProvider` → `AppProvider` → `ThemeProvider`. No Redux/Zustand.
- **Backend**: Supabase (PostgreSQL + Auth + Realtime). Migrations live in `supabase/migrations/`.
- **AI**: Google Gemini via `@google/generative-ai`.
- **No test runner**, **no linter**, **no formatter** configured. Do not assume `npm test` or `npm run lint` exist.

---

## Dev Commands

```bash
npm install
npm run dev      # Vite dev server on port 3000, host 0.0.0.0
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
```

---

## Environment Variables

Create `.env.local` in the repo root (do not commit it):

```env
VITE_SUPABASE_URL=<url>
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_GEMINI_API_KEY=<key>
VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false   # Optional; see Multi-App Architecture
VITE_APP_HOSTNAME_MAP={"custom.domain":"barber"}  # Optional JSON hostname→appSlug map
```

`vite.config.ts` also injects `process.env.GEMINI_API_KEY` at build time from `env.GEMINI_API_KEY`.

---

## Local Demo Mode (Critical for Debugging)

If **no Supabase env vars are present** AND the browser host is `localhost`/`127.0.0.1`, the app silently boots into **local demo mode**:

- A fake session is stored in `localStorage` under `soumanager.local.demo.session`.
- A hardcoded demo user/tenant is returned (`LOCAL_DEMO_USER_ID`, `LOCAL_DEMO_TENANT_ID`).
- All Supabase reads/writes are emulated via in-memory localStorage (`soumanager.local.demo.db`).

**Forensic implication**: Auth or data bugs reported on localhost may be artifacts of demo mode, not real Supabase behavior. Always check `hasSupabaseEnv` and `isLocalDemoEnabled()` in `src/lib/supabase/client.ts` before diagnosing RLS or RPC failures.

---

## Multi-App & Multi-Tenant Architecture

The system is a **multi-tenant SaaS** with optional **multi-schema** support.

### App Slugs & Schemas

- Supported apps: `barber` (default), `auto`, `club`.
- App resolution order (see `src/middleware/resolveApp.ts`):
  1. `VITE_APP_HOSTNAME_MAP` exact match
  2. Subdomain/hostname heuristic (`barber.*`, `auto.*`, etc.)
  3. Fallback to `barber`
- Schema routing (`src/lib/supabase/schemas.ts`):
  - `SHARED_SCHEMA = 'public'` for core tables (`profiles`, `tenants`, `staff`, `audit_logs`, etc.).
  - App-specific schema (`barber`, `auto`, `club`) for domain tables (`appointments`, `clients`, `comandas`, `transactions`, etc.) **only when** `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` is true. Otherwise, everything stays in `public`.

### Tenant Isolation

- Row Level Security (RLS) policies enforce `tenant_id` isolation. See migration `20260227223434_fix_all_rls_policies_use_security_definer_function.sql`.
- `AuthContext` resolves the effective `tenantId` via Supabase RPC `get_auth_access_context`.
- `TenantContext` then fetches the full tenant record and user memberships via `resolveTenantForUser()`.

**Forensic implication**: Bugs where users see cross-tenant data are almost always RLS policy regressions or missing `tenant_id` filters in frontend queries, not schema routing issues.

---

## Module Boundaries & Path Aliases

- `@/` maps to the **repo root** (`path.resolve(__dirname, '.')`), not `src/`.
- There are **dual directory structures** — some code lives at root (`components/`, `context/`, `hooks/`, `pages/`, `services/`) and some under `src/`. Check both before creating duplicates.
- Barrel file: `services/supabaseClient.ts` re-exports everything from `src/lib/supabase/`.

---

## Auth & Routing Hierarchy

Provider nesting (inner → outer):

```
ThemeProvider
  AppProvider      (resolves appSlug/schema from hostname)
    AuthProvider   (session + accessRole + profileStatus)
      TenantProvider (tenant record + memberships)
        HashRouter
```

### Route Guards

- `ProtectedRoute`: Blocks unauthenticated users and redirects `pending`/`suspended` non-superadmins to `/pending-approval`.
- `ManagerRoute`: Blocks `barber` and `receptionist` from admin/financial pages.
- `SuperAdminRoute`: Blocks non-superadmins from `/superadmin`.

**Forensic implication**: Redirect loops or infinite loading states usually stem from race conditions between `AuthContext.loading` and `TenantContext.loading`, or from `profileStatus` being stuck in `pending`.

---

## Supabase Client Patterns

- Always import from `services/supabaseClient.ts` (or `src/lib/supabase/client.ts`).
- Use `getSharedClient()` for `public` schema tables.
- Use `getSchemaClient(schema)` or `getScopedClient({ schema, tenantId })` for domain tables when multi-schema is enabled.
- `getClientForTable(tableName, tenantId)` automatically picks the correct schema based on `isDomainTable()` and `isSharedTable()`.

**Do not** instantiate a raw `createClient` in page components.

---

## Database Migrations

All schema changes must be added as timestamped SQL files in `supabase/migrations/`.

Notable historical fixes to be aware of:
- `20260227223434_fix_all_rls_policies_use_security_definer_function.sql` — central RLS fix.
- `20260226052610_fix_manager_trigger_and_backfill_staff.sql` — auto-insert manager into `staff`.
- `20260308_multitenant_hotfix.sql` — multitenancy patch.

There is **no automated migration runner** in the frontend build; migrations are applied via Supabase CLI or dashboard.

---

## Common Debugging Targets

When investigating loops, duplicate execution, or cascading failures, prioritize these files:

1. `src/lib/supabase/client.ts` — demo mode, auth subscribers, client instantiation.
2. `context/AuthContext.tsx` — session listener, `onAuthStateChange`, `fetchAccessContext`.
3. `src/context/TenantContext.tsx` — `refreshTenant` triggered by auth session changes.
4. `src/context/AppContext.tsx` — hostname resolution, `setActiveAppContext` side effects.
5. `App.tsx` — route definitions and guard composition.

Check for:
- **useEffect without cleanup** on `onAuthStateChange` subscriptions.
- **Dual `setState` in `finally` blocks** causing re-render chains.
- **Missing dependency arrays** in context providers.
- **Retry without backoff** in any service call (none are built-in; verify manually).
- **Event replay** from Supabase Realtime if enabled later.

---

## Deployment

- Platform: **Vercel**.
- Build output: `dist/`.
- `vercel.json` rewrites all paths to `index.html` (SPA behavior). HashRouter is required because of this.

---

## Forensic Checklist (Apply to Every Bug)

1. **Is this localhost?** Verify if local demo mode is active.
2. **Is `tenant_id` consistent?** Check query filters and RLS policy context.
3. **Is `profileStatus` blocking the user?** Check `AuthContext` state before blaming routes.
4. **Is there a schema mismatch?** Compare `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` with the migration target environment.
5. **Is there a duplicate listener/subscription?** Search for `onAuthStateChange` and `useEffect` without cleanup.
6. **Is the root cause a side effect or a symptom?** Trace the error backward from the UI to the context to the RPC/query.

