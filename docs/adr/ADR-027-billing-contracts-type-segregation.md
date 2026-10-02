# ADR-027: Segregação de Contratos de Billing e Desacoplamento de Tipos de Tenant

**Status:** Accepted
**Date:** 2026-10-02
**Deciders:** PO (Augusto) + OpenCode
**References:** ADR-002 (repository pattern), ADR-009 (repository naming), ADR-010 Amendment-01 (architecture gate fail-closed), `architecture-baseline.json`

---

## Context

Após o HARDENING-01 (Architecture Gate fail-closed), o baseline passou a refletir a
realidade comprovada: `forbiddenImports: 1` e `circularImports: 1`. Estas duas
violações são as últimas do eixo de imports/ciclos e estão ambas no domínio de
billing.

### Violação 1 — `Components → Supabase`

`components/billing/StatusBanner.tsx` importava `TenantStatus` de
`src/lib/supabase/tenant`:

```typescript
import type { TenantStatus } from '../../src/lib/supabase/tenant';
```

O import é `type`-only (apagado em tempo de compilação), mas o guard de
imports proibidos não distingue import type-only de import de valor. O efeito
prático é que a camada de apresentação fica acoplada — por contrato de módulo —
a um arquivo que carrega dependência de infraestrutura.

`TenantStatus` já tinha definição canônica idêntica em `domain/tenant/types.ts`;
a duplicata em `src/lib/supabase/tenant.ts` era a origem do acoplamento.

### Violação 2 — ciclo em `domain/billing`

```
domain/billing/repository.ts
  └─ export { supabaseBillingRepository } from './supabaseBillingRepository';   (linha 21)
       └─ import { ...BillingRepository, Invoice, ... } from './repository';   (linhas 23-29)
```

Ciclo entre arquivos irmãos do mesmo diretório, causado por um re-export de
valor combinando com imports de tipo na direção inversa.

Impacto do re-export: `application/billing.ts` importava a instância
`supabaseBillingRepository` a partir de `../domain/billing/repository` — ou seja,
**o wiring de produção dependia do re-export que causa o ciclo**.

---

## Problem

Sem isso, o gate de arquitetura não distingue "acoplamento de runtime" de
"acoplamento de tipo", e o ciclo de re-export esconde uma dependência de
produção. Corrigir apenas o sintoma (remover o re-export) quebraria
`application/billing.ts`.

---

## Decision

### 1. `TenantStatus` passa a ser canônico em `domain/tenant/types.ts`

- `domain/tenant/types.ts` mantém a definição (não houve mudança de membros do
  union type — os dois já eram idênticos).
- `src/lib/supabase/tenant.ts` **re-exporta** o tipo a partir do domínio,
  preservando retrocompatibilidade total com módulos legados.
- `components/billing/StatusBanner.tsx` consome o tipo do domínio, sem nenhuma
  referência a `src/lib/supabase/*`.

### 2. Contratos de billing segregados em `domain/billing/contracts.ts`

Novo módulo que hospeda exclusivamente os contratos puros:

- `BillingRepository`, `Invoice`, `PaymentAttempt`
- `ApplyTransitionInput`, `RecordAttemptInput`

Dependências do módulo: `./types` (para `BillingSubscription` e `InvoiceDraft`) e
`../shared/errors` (para `RepositoryError`). **Zero** dependência de `./repository`
ou `./supabaseBillingRepository`.

### 3. Quebra do ciclo

- `domain/billing/repository.ts`: importa contratos de `./contracts`; o re-export
  `supabaseBillingRepository` é **removido**; os contratos seguem re-exportados
  para compatibilidade.
- `domain/billing/supabaseBillingRepository.ts`: importa contratos **apenas** de
  `./contracts`.
- `domain/billing/index.ts`: expõe `./contracts` no barrel.
- `application/billing.ts`: importa o **tipo** de `../domain/billing/contracts` e a
  **instância** de `../domain/billing/supabaseBillingRepository` (explícito, sem
  passar pelo re-export).

### 4. Ratchet do baseline

`forbiddenImports: 0` e `circularImports: 0`. `repositoryViolations` permanece
`227` — dívida legada de UI, frente separada.

---

## Consequences

### O que muda

- Nenhuma mudança de **assinatura** ou **comportamento em runtime**. Os tipos
  movidos são idênticos; `application/billing.ts` continua instanciando
  `supabaseBillingRepository` como valor default de parâmetro.
- O gate de arquitetura volta a ter baseline `0/0` nos eixos de import e ciclo,
  permitindo ratchet progresso sem dívida conhecida.

### O que NÃO muda

- Nenhuma alteração em regras de negócio, RPCs, migrations, RLS ou Supabase.
- Nenhuma alteração em `src/` além do re-export em `tenant.ts`.
- Nenhum consumidor existente de `domain/billing/repository` quebrou: o módulo
  continua re-exportando os mesmos símbolos.

### Trade-offs aceitos

- **Duplicação de barrel**: `index.ts` expõe `./contracts`, `./repository` e
  `./supabaseBillingRepository`, e `repository.ts` também re-exporta os
  contratos. A sobreposição é intencional — preserva compatibilidade.
- **`InvoiceDraft`/`RepositoryError`** são re-exportados por `contracts.ts` para
  que os consumidores que antes os importavam de `repository.ts` continuem
  funcionando.

---

## References

- ADR-002 — Repository pattern
- ADR-009 — Repository naming
- ADR-010 Amendment-01 — Architecture Gate fail-closed
- `architecture-baseline.json` — baseline medido
