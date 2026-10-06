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
