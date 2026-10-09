# ADR-031 — Unified Metric Card

**Status:** Proposed
**Date:** 2026-10-06
**Scope:** Product UI (metric display components)

## Context

The product renders operational metrics (revenue, appointments, occupancy, team performance) on most manager screens. An audit found 11 parallel implementations of the same hero-metric card (icon tile, uppercase micro-label, large number, trend chip, helper text) across `components/charts/MetricCard.tsx`, `components/dashboard/KPICard.tsx`, `components/superadmin/KpiCard.tsx`, `components/strategic/StrategicKPICards.tsx`, `components/financial/FinancialSummaryCard.tsx` and local copies in Observability, EventVersioningAdmin, Comandas, Reports, KioskAdmin and `src/modules/dashboard/components/MetricsPanel.tsx`.

In parallel, the PO approved the barber palette: aged brass (`#B88A44`) as the brand voice, SMG blue restricted to operational signal. The duplicated cards each hardcode their own colors (including decorative gradients and opaque glassmorphism), so a palette change without unification reproduces the same generic look in 11 places.

The SupabaseMonitoring screen (`/#/admin/supabase-monitoring`) was disabled in this same front because it renders fictitious data (`supabaseMonitorMock`), which violates the product principle of real data first. Its route and sidebar link are commented out; the file is preserved.

## Problem

Per-screen metric redesigns keep reproducing the same generic SaaS template, and every visual decision has to be re-applied 11 times with drift.

## Decision

1. Create a single base component, `components/ui/MetricCard.tsx`, as the only authorized metric display primitive for new and migrated screens.
2. The component supports density variants (`compact`, `comfortable`) and semantic tones (`brass`, `positive`, `negative`, `info`, `neutral`) mapped exclusively to design tokens. No gradients, no glassmorphism, no side-stripe accents.
3. Trend information is always icon plus text, never color alone (WCAG AA).
4. Migration is progressive, starting with the P0 screens (BusinessIntelligence, Dashboard KPIs, Admin, StrategicDashboard). The 11 existing variants are kept untouched until their screen migrates; no mass refactor.
5. Metric calculation rules are out of scope: the component only presents values it receives.

## Alternatives Considered

- **Big-bang rewrite of all screens at once.** Rejected: high regression risk on financial and operational flows, violates minimal-change discipline.
- **Per-screen redesign keeping the duplication.** Rejected: preserves the drift the audit identified and multiplies palette-migration cost by 11.

## Consequences

- New metric UI must use `MetricCard` or justify a new primitive in a follow-up ADR.
- Template-level visual changes require updating one file instead of eleven.
- P0 migration is a separate authorized front; this ADR plus the base component are its entry gate.
- SupabaseMonitoring stays unreachable until it is fed real data or removed; re-enabling it without real data contradicts this ADR.

## Amendment-01 — Light cream + single gold identity (2026-10-08)

**Status:** Proposed (pending PO confirmation)

The PO rejected the aged-brass dark palette recorded above ("Nao gostei das cores") and supplied a Provly-inspired reference. The visual identity is therefore amended:

1. **Identity:** light cream (`--color-cream` #FAF6EE) base with a **single gold** (`--color-primary` #D99A2B, dark `#A96F14`, light `#F3D9A4`) as the brand voice. White cards (`--color-card`) on cream, ink text (`--color-ink` #191611, soft `#6B6252`), hairline borders (`--color-line` #E8DFC9).
2. **Blue fully removed.** SMG blue / `operational` tokens are deleted from the design system. No decorative or signal blue anywhere in the P0 surfaces. Operational color is gold; success/danger (`#178A50` / `#C92A2A`) reserved for status and charts only.
3. **Light is the default.** `ThemeProvider` default changed `'dark'` → `'light'`. Dark mode remains available but is no longer the first impression.
4. **CTA convention:** gold gradient (`from-[#E8B04B] to-[#C98A1F]`) with night text, buttons only — never on cards or tiles.
5. **Scope:** P0 screens (Dashboard, BusinessIntelligence, StrategicDashboard, Admin), the desktop Sidebar (white, gold active pill) and the mobile bottom bar (restyled in place; items and role logic unchanged). Kiosk / `.theme-estetica` / D8 worker are out of scope.
6. **No logic change:** metric calculation, filters, hooks, RPCs and data fetching are untouched. This is a visual-only front.

This amendment supersedes the "aged brass … SMG blue restricted to operational signal" sentence in the Context above. Migration validated by `npm run build` (exit 0), `tsc --noEmit` (only pre-existing `comandaSync.ts` errors), and a zero-blue-token grep across all P0 files.
