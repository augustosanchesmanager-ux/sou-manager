## Contexto
**DEC-001 Fase 1 — Contrato + Staging** (Issue #94). Roadmap congelado desde 2026-07-24; evoluções apenas via ADR. Objetivo: corrigir o contrato canônico Sanchez → `site-sanchez-appointments` → SMG, validar tenant/identificadores, fechar idempotência, definir create/cancel/reschedule, tratar `primeiro-disponivel`, criar testes de contrato, validar em STAGING. **Merge/deploy/ativação em produção NÃO autorizados** — STOP formal no PR para PO REVIEW.

## Escopo do PR
Arquivos alterados (4 arquivos principais + 2 helpers E2E, 1181+ / 175- linhas):
- `supabase/functions/site-sanchez-appointments/index.ts` — Edge Function principal com amendments A1–A3, A6
- `supabase/functions/site-sanchez-appointments/contract.ts` — **NOVO**: Contrato Canônico v1 (tipos, validação, erros padronizados)
- `docs/integrations/SITE-SANCHEZ-CONTRACT.md` — **NOVO**: Documentação do contrato (GAPs G1–G4 registrados)
- `src/test/site-sanchez-contract.test.ts` — **NOVO**: 56 testes de contrato (unit + integração)
- `tests/e2e/helpers/supabaseAdmin.ts` — Helper E2E (ajuste para staging)
- `tests/e2e/helpers/supabaseUser.ts` — Helper E2E (ajuste para staging)

## Amendments (SoT — Edge Function `site-sanchez-appointments`)
| Amendment | Descrição |
|-----------|-----------|
| **A1** | `future-check` **apenas** para `active` (não bloqueia `pending`/`cancelled`) |
| **A2** | Idempotência: `idem_key` → `200 { appointment_id, idempotent: true }`; cancel inexistente → `404 { not_found: true }` |
| **A3** | Erros RPC: `details[]` com `code`, `message`, `field` (formato padronizado) |
| **A6** | Documentação com GAPs G1–G4 explícitos no `SITE-SANCHEZ-CONTRACT.md` |

## Evidências de validação
- **Testes**: 1565 testes pass (76 arquivos) + 56 testes de contrato novos
- **Build**: ✅ Typecheck passa (únicos erros: `scripts/h7-p1-comanda-audit-probe.mjs` pré-existente, untracked, de outra frente)
- **E2E Staging (8/8 PASS)**:
  - `create` → 201
  - `idempotente` → mesmo `appointment_id` + `idempotent: true`
  - `conflito` → 409
  - `cancel` → 200 `cancelled`
  - `cancel inexistente` → 404 `not_found: true`
  - `payload inválido` → 400 + `details[]`
  - `auth errada` → 401

## Achado operacional
**Deploy da ET em staging exigiu `--no-verify-jwt`**. O `config.toml` da função com `verify_jwt=false` **NÃO é honrado pelo CLI** pois não há `supabase/config.toml` raiz com section `[functions.*]`. A flag `--no-verify-jwt` é obrigatória; **produção terá o mesmo comportamento**. A ET **não está deployada em produção** (H7).

## GAPs conhecidos (não endereçados na Fase 1)
| GAP | Descrição | Resolução futura |
|-----|-----------|------------------|
| **G1** | RPC `cancel_appointment` exige payload completo (relaxar = migração + gate) | ADR + migração futura |
| **G2** | ET não deployada em produção | Gate H7 separado |
| **G3** | Webhook inbound `api/smg/appointments.js` nunca chamado (sync unidirecional) | Requer implementação bidirecional |
| **G4** | Tenant produção não confirmado | Evidência necessária antes de H7 |

## Status
**AGUARDANDO APROVAÇÃO DO PO**. Merge para `main`, deploy produção e ativação **NÃO autorizados** nesta fase. Fluxo: PO REVIEW → (se aprovado) próximos passos.

Closes #94