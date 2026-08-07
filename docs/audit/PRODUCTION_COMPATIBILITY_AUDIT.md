# PRODUCTION COMPATIBILITY AUDIT — Release v1.5

> **Fase:** 6.0.5.6 — Production Compatibility Audit (PCA)
> **Status:** ⏳ **PLANNED** (registrada em 2026-08-07 — decisão do PO)
> **Resultado:** ⬜ *a definir na execução — **`READY`** ou **`BLOCKED`** (obrigatório)*
> **Modo:** **Somente leitura** — nenhuma alteração de dados, migrations, correções automáticas, criação de registros ou repair migration.
> **Documento de referência:** `ROADMAP.md` (seção 6.0.5.6)

---

## Localização no fluxo da release v1.5

```
6.0.5.5
      ↓
Production Compatibility Audit (6.0.5.6)  ← este documento
      ↓
Deploy Runbook
      ↓
Janela Única de Deploy
      ↓
Smoke Pós-Deploy
      ↓
Release v1.5 Certification
```

---

## ⚠️ Gate de Release

> **Nenhuma migration de produção poderá ser aplicada sem `PRODUCTION_COMPATIBILITY_AUDIT.md = READY`.**
>
> Referência (obrigatória): *"Antes da janela única de deploy da Release v1.5 será **obrigatória** a execução da **Production Compatibility Audit** utilizando o **banco real dos tenants produtivos**."*

---

## Objetivo

Realizar auditoria **somente leitura** do ambiente produtivo **antes** da primeira aplicação das migrations SaaS da release v1.5.

A auditoria deve garantir que os dados existentes dos tenants em produção são compatíveis com:

- novo modelo de planos (`plans` / `features` / `plan_features`);
- Feature Flags (`feature_flags` / `tenant_has_feature`);
- Tenant Lifecycle (`tenant_status`, `subscriptions.status` + `suspended`);
- Billing (`invoices` / `billing_events` / `payment_attempts`);
- limites por plano (`plans.limits`);
- regras de acesso (Estado Efetivo — ADR-013 §2.4);
- novas relações de banco (FKs, CHECKs, RLS).

## Regras desta etapa

- ✅ **somente analisa e gera relatório;**
- ❌ não altera dados;
- ❌ não aplica migrations;
- ❌ não corrige inconsistências automaticamente;
- ❌ não cria registros;
- ❌ não executa repair migration.

---

## Critérios de Entrada

A auditoria só pode iniciar quando:

- [x] 6.0.5.1 concluída
- [x] 6.0.5.2 concluída
- [x] 6.0.5.3 concluída
- [x] 6.0.5.4 concluída (implementação — unit 874/874 + migration `20260807010000` validada T1–T7 em docker; E2E flow14 adiado à janela única — decisão PO 2026-08-07)
- [ ] 6.0.5.5 concluída
- [ ] Schema final da release congelado
- [ ] Runbook de deploy aprovado

## Critérios de Saída

- [ ] `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` atualizado com resultado **`READY`** ou **`BLOCKED`**;
- [ ] (se `BLOCKED`) lista de incompatibilidades encontradas e tenants afetados;
- [ ] (se `READY`) liberação formal para a Janela Única de Deploy.

---

## Escopo da Auditoria (a executar no banco real dos tenants produtivos)

### 1. Tenants

- [ ] tenants sem plano;
- [ ] planos inválidos;
- [ ] planos obsoletos (`elite`);
- [ ] status inválidos;
- [ ] inconsistências de lifecycle.

### 2. Plans

Validar os planos `free`, `pro`, `premium` contra:

- [ ] `plans`;
- [ ] `features`;
- [ ] `plan_features`;
- [ ] `FEATURE_KEYS` / `PlanCatalog` (paridade banco ↔ TS).

### 3. Subscriptions

- [ ] subscriptions órfãs;
- [ ] subscriptions inexistentes;
- [ ] planos incompatíveis;
- [ ] estados inválidos (CHECK sem `suspended` até 6.0.5.4).

### 4. Billing

- [ ] `invoices`;
- [ ] `billing_events`;
- [ ] `payment_attempts`.

### 5. Feature Flags

- [ ] feature keys existentes;
- [ ] overrides;
- [ ] inconsistências entre banco e catálogo.

### 6. Limites

Validar para cada tenant: **Plano atual → Limite permitido → Uso real → Possível incompatibilidade**.

| Tenant | Plano | Uso (profissionais) | Limite (`plans.limits.max_staff`) | Resultado |
|--------|-------|---------------------|-----------------------------------|-----------|
| Sanchez Barber | Pro | 4 | 5 | ✅ **OK** (exemplo) |
| _(preenchido na execução)_ | | | | |

### 7. Chef Club

- [ ] utilização atual;
- [ ] compatibilidade com plano;
- [ ] possíveis conflitos após Feature Flags.

### 8. Segurança

- [ ] RLS;
- [ ] policies;
- [ ] grants;
- [ ] RPC permissions;
- [ ] anon access.

### 9. Integridade

- [ ] FK;
- [ ] índices críticos;
- [ ] dados órfãos.

---

## Resultado Final

| Campo | Valor |
|-------|-------|
| Data da execução | ⬜ |
| Auditor responsável | ⬜ |
| Ambiente auditado | ⬜ (Supabase produtivo — project ref `ushsnmlbeurfvlkieiln`) |
| **Resultado** | ⬜ **READY** / ⬜ **BLOCKED** |
| Incompatibilidades críticas | ⬜ |
| Ação subsequente | ⬜ (Janela Única de Deploy / correções pré-deploy) |

> *Preenchido exclusivamente na execução da auditoria. Enquanto `PLANNED`, nenhuma migration de produção pode ser aplicada.*
