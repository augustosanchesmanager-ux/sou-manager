-- ============================================================
-- M4 — R2 · Reexecução da FASE 4 em STAGING (read-only probes)
-- STAGING como homolog isolado (reclassificado por R1)
-- ============================================================
>
> **Fase:** M4 — Implementação pós-G1.3 · **Subfase:** R2 do preflight M4
> **Status:** ⛔ **R2 BLOCKED** — write smokes P4/P5/P7/P6 não executáveis (fixtures STAGING sem dados no tenant do manager conhecido); validações read-only confirmadas ✅
> **Data:** 2026-09-21 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Base normativa:** `M4_R1_RECLASSIFICACAO_AMBIENTE_C.md` (R1 prévio) · `M4_FASE4_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md` (FASE 4 original)
> **Regra da etapa:** Reexecutar validações FASE 4 em STAGING. NÃO criar workaround, NÃO aplicar migrations em PROD, NÃO alterar dados fora do escopo.
> **Regra do PO:** "qualquer blocker, divergência ou comportamento inesperado deve interromper a execução e retornar ao STOP."

---

## 1. Objetivo

Reexecutar as 9 janelas de smoke da FASE 4 (M4_FASE4_HOMOLOGACAO §6) contra STAGING após reclassificação R1 (D → C).

---

## 2. Pré-condições verificadas (read-only)

### 2.1 STAGING DB tem M4 RPCs/tabelas

| Artefato | Existe? | Fonte |
|----------|---------|-------|
| Tabela `comanda_unblock_audit` | ✅ | `preflight-m4-artifacts.cjs` |
| Tabela `appointment_attendance_corrections` | ✅ | idem |
| Tabela `comanda_payments` | ✅ | idem |
| Coluna `tenants.settings` | ✅ | idem |
| RPC `batch_unblock_comandas` | ✅ (responde "permission denied" para service_role probe) | `preflight-m4-rpcs.cjs` |
| RPC `register_comanda_payment` | ✅ (idem) | idem |
| RPC `unblock_comanda` (single) | ⛔ **NÃO ENCONTRADO** ("Could not find the function") | `R2-attempt-rpcs.cjs` |

> **Achado**: o migration `20260830020000_m4_p6_unblock_comanda.sql` define `unblock_comanda` E `batch_unblock_comandas`. STAGING tem apenas a versão batch. Single pode ter sido removida, ou o probe usou assinatura incorreta (verificar). Sem impacto para R2 (write smokes blocked por outro motivo).

### 2.2 STAGING DB tem dados para homologação M4 (parcial)

| Recurso | Total | Distribuição |
|---------|-------|--------------|
| Comandas | 4 (não `paid_amount` column existe; status verificado separadamente) | (estado real não confirmado nesta sessão) |
| Appointments | 12 | 12× `completed` com `attended_at` populated |
| Tenants | 108 | 108× `barber` app_slug, todos `active` |
| comanda_payments | 0 | — |
| Profiles | 130 | manager (73), barber (40), receptionist (12), superadmin (5) |
| Users totais | 197 | 100+ sintéticos (h7-*, e2e-*, gat-*) |

### 2.3 Manager conhecido: `e2e-suite-1789110611512-manager@gmail.com`

- **Tenant**: `450748c0-eeac-4a80-a228-71c548a70f15` (slug `e2e-suite-1789110611512`)
- **Comandas no tenant**: 0
- **Appointments no tenant**: 0
- **Staff row**: presente (role=manager, status=active)
- **Profile**: presente (role=manager, status=active, onboarding_completed=true)
- **User_tenants**: manager, is_primary=true

### 2.4 Outros managers e2e-suite

12 e2e-suite managers identificados. Verificação cruzada com tenants que têm dados:

```
candidates_with_data: []  ← ZERO matches
```

**Resultado**: **nenhum e2e-suite manager tem dados (comandas OU appointments) em seu próprio tenant**. As 12 appointments e 4 comandas estão em tenants cujos managers não pertencem aos e2e-suite fixtures — provavelmente criados por h7-* scripts ou outras investigations que não preservaram o user link.

---

## 3. Tentativas de execução (probes diretos via supabase-js)

Mesmo com pré-condições faltando, os RPCs foram invocados para documentar erros concretos:

### 3.1 Sign-in do manager conhecido

```json
{
  "signin": {
    "ok": true,
    "user_id": "b3bf5cd2-85c4-4ea1-a914-cf1344a2b5bb",
    "expires_at": 1790002175
  }
}
```

✅ Sessão válida obtida via `signInWithPassword` (mesmo padrão usado no gate `smg-staging-live-validation`).

### 3.2 Tentativas de RPC (todas com `p_tenant_id` = tenant do manager, targets arbitrários)

| RPC | Target | Resposta | Classificação |
|-----|--------|----------|---------------|
| `confirm_appointment_attendance` (P5) | appointment de OUTRO tenant | `P0001: Agendamento nao encontrado para este tenant` | ✅ Tenant isolation works (cross-tenant bloqueado) — mas P5 **BLOCKED** (sem appointment in_progress/confirmed no tenant) |
| `correct_appointment_attendance` (P4) | appointment de OUTRO tenant | `P0001: Agendamento nao encontrado para este tenant` | ✅ Tenant isolation — mas P4 **BLOCKED** (sem appointment completed no tenant) |
| `register_comanda_payment` (P7) | comanda fake | `P0001: Comanda nao encontrada para este tenant` | ✅ Tenant isolation — mas P7 **BLOCKED** (sem comanda open/blocked no tenant) |
| `get_comanda_payment_summary` | id de OUTRO tenant | `P0001: Comanda nao encontrada para este tenant` | ✅ Tenant isolation confirmado |
| `reverse_comanda_payment` (P1) | payment fake | `P0001: Pagamento nao encontrado para este tenant` | ✅ Tenant isolation — mas P1 **BLOCKED** (comanda_payments vazio) |
| `unblock_comanda` (P6 single) | comanda fake | `PGRST202: Could not find the function public.unblock_comanda(p_comanda_id, p_motivo, p_tenant_id)` | ⚠️ Função não encontrada (apenas `batch_unblock_comandas` existe) — **achado** separado |

### 3.3 Resumo das tentativas

- **Tenant isolation funciona corretamente** em todos os M4 RPCs (P0001 quando cross-tenant) — confirmação parcial positiva
- **Write smokes não executáveis** porque o tenant do manager conhecido (`e2e-suite-1789110611512`) **NÃO tem** comanda open/blocked, **NÃO tem** appointment completed, **NÃO tem** dados financeiros

---

## 4. Mapeamento FASE 4 → R2

| # | Validação FASE 4 | Status R2 | Evidência | Motivo do bloqueio (se aplicável) |
|---|-------------------|-----------|-----------|------------------------------------|
| 1 | P7 — registrar pagamento parcial | ⛔ **BLOCKED** | §3.2 P7 | Tenant do manager não tem comanda `open`/`blocked` |
| 2 | P7 — limite/idempotência | ⛔ **BLOCKED** | §3.2 P7 + §2.3 | Mesmo: sem comanda real |
| 3 | P7 — nova operação (nova key) | ⛔ **BLOCKED** | §2.3 + §3.2 | Sem payments registrados (tabela `comanda_payments` vazia) |
| 4 | P5 — confirmar atendimento | ⛔ **BLOCKED** | §3.2 P5 | Todos os appointments em STAGING são `completed`; nenhum `in_progress`/`confirmed` |
| 5 | P4 — correção atendimento | ⛔ **BLOCKED** | §3.2 P4 | Tenant do manager não tem appointment `completed` |
| 6 | Perfil/roles | ⏸ **PARCIAL** (read-only) | §2.2 + §2.3 | Manager conhecido tem perfil válido; outros perfis existem mas sem credenciais no `.env.local` |
| 7 | Tenant isolation real | ✅ **PASS (parcial)** | §3.2 todos retornam `P0001` cross-tenant | Confirmado para tenant-scoping nas RPCs M4 |
| 8 | Pagamento × atendimento/comissão | ⛔ **BLOCKED** | depende de P7 | P7 não executou |
| 9 | Auditoria visual viva | ✅ **PASS** (gate anterior) | `smg-staging-live-validation` Etapa 6 | UI Reports/Vendas com `getDashboardKpis` validado em STAGING após promoção `2beb9cc` |

---

## 5. Achados laterais (não-bloqueantes)

### A1. Função `unblock_comanda` (single) não encontrada

- Migration `20260830020000_m4_p6_unblock_comanda.sql` define `unblock_comanda` E `batch_unblock_comandas`
- STAGING DB responde "permission denied" para `batch_unblock_comandas` (existe)
- STAGING DB responde "Could not find the function" para `unblock_comanda` (não existe ou signature mismatch)
- **Recomendação**: validar se a single foi removida intencionalmente (decisão arquitetural) ou se é signature mismatch no probe. Sem impacto para R2.

### A2. Coluna `comandas.paid_amount` não existe

- Probe retornou `column comandas.paid_amount does not exist`
- M4 RPC `get_comanda_payment_summary` usa campo `total_paid` (não `paid_amount`) — confirmado via código em `src/lib/finance/payment.ts`
- **Recomendação**: schema drift entre docs e DB — investigar (sem impacto para R2)

### A3. STAGING tem dados scattered sem user link

- 12 completed appointments em 12 tenants distintos
- 4 comandas em 4 tenants distintos
- Nenhum `e2e-suite-*` manager tem acesso a esses tenants
- **Implicação**: dados foram criados via service_role (não via manager autenticado), possivelmente em investigations anteriores (h7-* scripts, FASE 3/4 homologation antigas)

---

## 6. Avaliação global R2

**R2: BLOCKED** — write smokes P4/P5/P7/P1 não executáveis nas fixtures atuais de STAGING.

### Causas-raiz identificadas

1. **Fixtures STAGING sem dados no tenant de teste conhecido** (manager `e2e-suite-1789110611512-manager`)
2. **12 e2e-suite managers existentes mas nenhum tem dados em seus tenants**
3. **Dados existentes em STAGING estão em tenants "órfãos"** (criados por Admin API sem link a usuário e2e)

### Por que não foi corrigido por iniciativa própria

Per PO:
- "Não realizar qualquer alteração adicional por iniciativa própria"
- "Não criar workaround"
- "Não corrigir problemas fora do escopo"

Criar test data (comandas/appointments novos) seria "alteração adicional por iniciativa própria" — **explicitamente fora do escopo R2**.

---

## 7. Não-autorizados nesta etapa (R2)

Conforme autorização do PO:

- ❌ Nenhuma migration aplicada em PROD
- ❌ Nenhuma migration aplicada em STAGING (R2 é read-only)
- ❌ Nenhuma alteração em código, branches, RLS, schema
- ❌ Nenhum dado criado em STAGING (fixtures existentes usadas como estão)
- ❌ Nenhum merge, push, deploy
- ❌ R3, R4, R5, R6 NÃO EXECUTADOS
- ❌ Único efeito colateral: **criação deste audit doc** em `docs/audit/M4_R2_FASE4_HOMOLOGACAO_REEXEC.md`

---

## 8. STOP — Aguardando decisão do PO

R1: **PASS** (reclassificação D → C documentada)
R2: **BLOCKED** (write smokes não executáveis — fixtures STAGING sem dados no tenant do manager conhecido)

**Próximos movimentos possíveis** (todos dependem de autorização PO):
- **R2-alt**: provisionar dados de teste em STAGING (comanda open + appointment in_progress no tenant do manager) — exige autorização explícita para criar dados
- **R3**: `npm run d8:verify` (gate separado)
- **R4**: aplicar M4 em PROD (gate separado)
- **R5**: ADR para CI workflow (gate separado)
- **R6**: sincronizar `homologacao` (gate separado)

**Em STOP aguardando novo gate do PO.**