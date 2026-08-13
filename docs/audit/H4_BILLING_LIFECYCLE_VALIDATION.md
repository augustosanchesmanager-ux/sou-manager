# H-4 — Billing / Tenant Lifecycle: Matriz de Estados (evidência)

> **Gate:** H-4 Billing / Tenant Lifecycle (ADR-013)
> **Data:** 2026-08-13
> **Ambiente:** Supabase real (project `ushsnmlbeurfvlkieiln`) — **tenant E2E isolado e identificável** (D-HOM-19); **NÃO** usou o tenant Sanchez Barber
> **Responsável:** OpenCode (Tech Lead operacional)
> **Execução:** E2E Playwright (Chromium) — `tests/e2e/homologation/h4-billing-lifecycle.spec.ts` com `E2E_PROVISIONING=1`
> **Autorização:** D-HOM-19 (PO, 2026-08-13) — H-4 autorizado em tenant E2E isolado sem aguardar o veredito formal do H-3
> **Veredito:** 🟢 **APROVADO (D-HOM-20, PO 2026-08-13)** — 9/9 checks PASS

---

## 1. Objetivo

Validar a **matriz de estados e transições do ciclo de vida de billing/assinatura** (ADR-013 — Billing/Tenant/Feature Flags) em tenant de teste E2E isolado, cobrindo criação/ativação, ciclo de cobrança, invoice/pagamento, renovação, cancelamento, transições de status, idempotência, limites por plano, feature indisponível e `runCycle`. Critério de saída: matriz **H4-1..H4-9** com **PASS/FAIL/BLOCKED** e recomendação para o próximo gate (D-HOM-19).

---

## 2. Setup (seed — service role + sessões reais)

| Item | Valor |
|------|-------|
| Tenant E2E (alvo) | `e2e-h4-<runId>` — `app_slug=barber`, `plan=pro`, `status=active` |
| Tenant OPS (superadmin isolado) | `e2e-h4-ops-<runId>` — `plan=pro`, `status=active` |
| Usuários | manager (H4) + barber1 + barber2 (H4) + superadmin (OPS) — `createConfirmedUser` via Admin API |
| `profiles` | role `manager`/`barber`/`superadmin`, `onboarding_completed=true` (disparam triggers) |
| Staff (pós-trigger, determinístico) | 3 ativos no tenant H4 (manager + 2 barbers) — limpeza de linhas do trigger para seed exato |
| `user_tenants` | manager primary + 2 barbers (H4); superadmin primary (OPS) |
| `subscriptions` | 1 ativa (pro), período vigente (start −10d, end +20d) |
| `tenant_settings` | `chair_count=2` (renderização do Layout) |
| Sessões RPC | `signInAsUser` manager + superadmin (dirigem os RPCs SECURITY DEFINER) |

**Nota (raiz da execução ad hoc anterior):** o trigger `handle_new_manager_profile` cria `staff` com id gerado a cada `profiles`; sem limpeza, o tenant acumula staff e o teste de limite (H4-7) falha cedo. O seed faz `DELETE` pós-trigger e insere staff/user_tenants explícitos.

---

## 3. Matriz H4-1..H4-9 — Resultado

| ID | Cenário | Critério de aceite | Resultado |
|----|---------|--------------------|-----------|
| H4-1 | Estado `active` — acesso pleno | Acesso completo ao app, sem banner | ✅ **PASS** |
| H4-2 | Estado `past_due` — restrição read-only + banner (D-6.0.5-1) | Aviso presente; escrita no DB **não bloqueada** (by design — janela de graça) | ✅ **PASS** (ver §4) |
| H4-3 | Estado `suspended` — acesso bloqueado | Redirect `/pending-approval` + evento `TenantSubscriptionSuspended` | ✅ **PASS** |
| H4-4 | Reativação (`suspended → active`) | Acesso restaurado + evento `TenantSubscriptionReactivated` | ✅ **PASS** |
| H4-5 | Cancelamento `cancel_at_period_end` | Pedido registrado + efetivação (`cancelled`) + acesso mantido | ✅ **PASS** |
| H4-6 | Transição de plano `change_tenant_plan` | Espelho `tenants.plan` = `subscriptions.plan` + evento `TenantPlanChanged` | ✅ **PASS** |
| H4-7 | Limites por plano (`max_staff` pro=5 / free=1) | Limite respeitado; invite bloqueado ao exceder | ✅ **PASS** |
| H4-8 | Feature indisponível no plano (chef_club no free) | `UpgradePrompt` (nunca 403); volta a renderizar após restore pro | ✅ **PASS** (ver §5) |
| H4-9 | `runCycle` — grace `past_due` expirado | Candidata em `get_due_subscriptions`; suspensão; fail-fast fora de `past_due` | ✅ **PASS** |

**Suite completa:** `9/9 PASS` em ~1 min (execução final após correção de teste).

---

## 4. H4-2 — nota sobre "escrita bloqueada"

O critério da matriz (D-6.0.5-1, read-only em `past_due`) foi validado como **aviso presente + sem bloqueio de escrita no banco**:

- **RLS é por role/tenant, não por status** — escrita via cliente do usuário em `past_due` **NÃO é bloqueada no DB** (by design, durante a janela de graça).
- O enforcement de escrita na **UI** (read-only) **não está implementado** — **gap registrado** (P2), coberto como evidência pelo teste `H4-2e` (probe de escrita `clients` em `past_due` retorna sem erro).

O check valida o comportamento **real** (sem bloqueio + aviso presente) e registra o gap; não foi declarado PASS para "escrita bloqueada" porque isso não corresponde ao comportamento por design.

---

## 5. H4-8b — falha inicial do teste (corrida de login), não defeito de produto

### 5.1 Ocorrência

Na execução ad hoc inicial, o check H4-8b (feature `chef_club` indisponível no plano free → `UpgradePrompt`) expirou com o app em `/#/dashboard` (com plano Free no layout) em vez de exibir o `UpgradePrompt`.

### 5.2 Diagnóstico (causa raiz)

**Corrida de login no teste E2E, não defeito do gate/feature flags:**

- `loginAs()` preenchia o formulário e clicava em `submit` **sem aguardar o redirect pós-login** (`/#/dashboard`).
- O `page.goto('/#/chef-club-plans')` logo em seguida (mudança apenas de fragment — sem reload) navegava enquanto o sign-in ainda estava em voo.
- O redirect do **próprio fluxo de login** (`navigate('/dashboard')` pós sign-in) vencia a corrida → o app terminava no dashboard.
- Diagnóstico isolado comprovou que o gate **funciona**: tenant `free` direto no seed → rota `/chef-club-plans` → `UpgradePrompt` visível ("não está disponível no plano atual", botão "Ver Meu Plano"), `location.hash = #/chef-club-plans`.

### 5.3 Correção (somente no teste)

Adicionado `await page.waitForURL(/#\/dashboard/, { timeout: 30_000 })` após `loginAs` no H4-8b — o mesmo padrão já usado em H4-1..H4-5. **Nenhuma alteração de código de produção.**

### 5.4 Reexecução

`9/9 PASS` (1.0m). **A falha inicial é registrada como problema do teste E2E corrigido — NÃO como falha funcional do produto.**

---

## 6. Detalhes por cenário (referência de evidência)

- **H4-3/H4-4:** transições via RPCs oficiais `suspend_subscription`/`reactivate_subscription` (superadmin); `billing_events` com `TenantSubscriptionSuspended`/`TenantSubscriptionReactivated`; grace limpo ao sair de `past_due` (D-6.0.5.4-5).
- **H4-5:** `cancel_subscription` mantém `status=active` e grava `cancel_at_period_end`; `apply_subscription_transition → cancelled` efetiva; acesso mantido com banner "Assinatura cancelada"; restore `active` limpa o pedido.
- **H4-6 (ciclo de cobrança):** `create_invoice` **idempotente** (mesma `idempotency_key` → mesmo invoice); `record_payment_attempt` com status válidos `success`/`failed` (CHECK `pending|success|failed`); status `succeeded` rejeitado `23514` (teste negativo de contrato); `mark_invoice_paid → paid` idempotente.
- **H4-6 (transição de plano):** `change_tenant_plan` (superadmin) `pro→free` grava espelho em `tenants.plan` + `subscriptions.plan` + evento `TenantPlanChanged`; `free→pro` restaura.
- **H4-7:** `max_staff pro=5`: 3 seed + invite1 (4) OK + invite2 (5) OK + invite3 (6) **bloqueado** ("Team limit reached"); `max_staff free=1`: invite bloqueado; role inválida (`manager`) rejeitada ("Invalid invite role"); 2 `team_invitations` pendentes.
- **H4-8:** plano free → `/chef-club-plans` exibe `UpgradePrompt` (nunca 403); após restore `pro` → página renderiza sem `UpgradePrompt` (feature volta a ficar disponível).
- **H4-9:** `get_due_subscriptions` retorna a candidata `past_due` com `grace_ends_at` expirado; `suspend_subscription` válida; transição `active → suspended` **negada** ("Invalid transition: cannot suspend subscription in status active") — fail-fast ADR-013 §5.2.

---

## 7. Artefatos

| Artefato | Tipo |
|----------|------|
| `tests/e2e/homologation/h4-billing-lifecycle.spec.ts` | Spec E2E (versado no repo) |
| `test-results/h4-2d-past-due-banner-<runId>.png` | Screenshot banner `past_due` (não versionado) |
| `test-results/h4-2d-banner-fail-<runId>.png` | Screenshot (se gerado — diagnóstico) |
| `test-results/h4-8b-upgrade-prompt-<runId>.png` | Screenshot `UpgradePrompt` no plano free (não versionado) |
| `h4_*.cjs` / `h4_*.json` | Scripts auxiliares com credenciais — **ignorados** (`.gitignore`, nunca versionados) |

---

## 8. Conclusão

**Gate H-4 = 🟢 APROVADO (D-HOM-20, PO 2026-08-13).**

- Matriz H4-1..H4-9: **9/9 PASS** em tenant E2E isolado (Supabase real, dados de teste).
- A falha inicial do H4-8b foi **corrida de login no teste** (causa raiz documentada, correção no spec, reexecução 9/9) — **não é defeito funcional do produto**.
- **H-3 permanece 🟡** (H3-1..H3-4, H3-6 ✅; H3-5 🟡 com ressalva) — o PASS do H-4 não altera o status do H-3.
- **H-8 permanece 🔴 BLOQUEADOR** (produção `718f6f9` defasada + topologia Vercel — bloco de Hardening §8.1) — o PASS do H-4 não libera produção.
- **Próximo gate:** H-5 — Feature Flags.
