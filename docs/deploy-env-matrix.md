# Deploy and Environment Matrix

This document separates the current Barber deployment from the new institutional portal deployment.
Do not copy secret values into this file.

## Vercel Projects

### `smg-barber`

- Current root directory: repository root
- Domain: `barber.soumanager.com`
- Framework preset: Vite
- Build command: `npm run build`
- Expected output directory: `dist`
- Status in this PR: unchanged. The Barber app stays at the repository root.

Manual Vercel settings to confirm:

- Keep Root Directory as the repository root for now.
- Set Framework Preset to `Vite`.
- Set Build Command to `npm run build`.
- Set Output Directory to `dist`.
- Attach only `barber.soumanager.com` to this project.

### `sou-manager` or `smg-portal`

- Future root directory: `apps/portal`
- Domains: `soumanager.com`, `www.soumanager.com`
- Framework preset: Vite
- Build command: `npm run build`
- Expected output directory: `dist`
- Status in this PR: portal app scaffolded without authentication or Supabase integration.

Manual Vercel settings to apply later:

- Use a new project named `smg-portal`, or repurpose the existing `sou-manager` project.
- Set Root Directory to `apps/portal`.
- Set Framework Preset to `Vite`.
- Set Build Command to `npm run build`.
- Set Output Directory to `dist`.
- Attach `soumanager.com` and `www.soumanager.com`.
- Remove `barber.soumanager.com` from the portal/institutional project if it is attached there.

## Variable Classification

### Barber

Client-side variables used by the current Barber app:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_MULTI_SCHEMA_ENABLED`
- `VITE_APP_HOSTNAME_MAP`
- `VITE_APP_PUBLIC_HOSTNAME_MAP`
- `VITE_LOCAL_APP_SLUG`

Server-side or Supabase Edge Function variables used by Barber-related functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORTAL_JWT_SECRET`
- `SANCHEZ_TENANT_ID`
- `SANCHEZ_WEBHOOK_SECRET`
- `SANCHEZ_DOMAIN_SCHEMA`
- `SANCHEZ_ALLOWED_ORIGIN`

### Portal

The portal created in `apps/portal` does not require environment variables in this PR.

Future minimal portal variables may include:

- `VITE_APP_PUBLIC_HOSTNAME_MAP`
- `VITE_PORTAL_LOGIN_URL` if login routing becomes configurable

Do not add Supabase variables to the portal until authentication or data access is intentionally implemented.

### Shared

These may be shared only when both projects intentionally need the same public configuration:

- `VITE_APP_PUBLIC_HOSTNAME_MAP`

Supabase URL and anon key may be shared only if the portal later reads public/authenticated Supabase data by design:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Sensitive / Server-Only

These must never be exposed to the browser and must never use a `VITE_` prefix:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_JWT_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `PORTAL_JWT_SECRET`
- `SANCHEZ_WEBHOOK_SECRET`

### Public / Client-Side

Any variable prefixed with `VITE_` is bundled into the frontend by Vite and can be inspected in the browser.

Client-side variables must be treated as public:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_HOSTNAME_MAP`
- `VITE_APP_PUBLIC_HOSTNAME_MAP`
- `VITE_SUPABASE_MULTI_SCHEMA_ENABLED`
- `VITE_LOCAL_APP_SLUG`
## Secret Handling Alert

`.vercel-temp.env` was removed from version control in this PR and is now ignored. If that file contained real values, rotate the exposed credentials and review Git history because the values may have been committed previously.

Never commit real environment files. Keep examples limited to empty placeholders.
