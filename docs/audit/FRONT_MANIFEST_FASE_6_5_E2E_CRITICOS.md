# Front Manifest — Fase 6.5 E2E Críticos

> Protocolo: SMG Change Control v1.0.0 (INTAKE → ISOLATE → AUDIT → CLASSIFY → STOP/GATE → IMPLEMENT → VALIDATE → …)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-23
> Autor: Sisyphus (OpenCode)

## Identificação

| Campo | Valor |
|-------|-------|
| Front ID | FASE-6.5-E2E-CRITICOS |
| Fase | Fase 6 — Production Readiness |
| Subfase | 6.5 E2E Críticos |
| Base | `origin/main` @ `34414f1` (merge PR #175) |
| Branch | `feat/fase6-6-5-e2e-criticos` |
| Worktree | `C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager-fase6-6-5-e2e-criticos` |
| Escopo desta etapa | INTAKE, ISOLATE e AUDIT — inventário da suíte E2E, ambientes/mocks e lacunas nos 3 pilares |
| Escopo excluído | Implementar novos cenários, alterar `src/`, alterar CI, tocar banco, executar E2E contra produção |
| Estado atual | **P0 aplicado; matriz aprovada — implementação pendente** |

> **Atualização (2026-10-23):** PR #175 (6.9 Health Checks) **MERGEADO** em `34414f1`; branch remota removida; `main` integrada por fast-forward e esta branch rebaseada sobre `34414f1`. A premissa inicial de que #175 já estava em `main` era falsa e foi corrigida.

## Objetivo

Auditar a suíte E2E existente e propor a matriz de testes dos fluxos mais críticos do SaaS antes de escrever qualquer cenário novo:

1. Agendamento → Comanda → Fechamento.
2. Checkout com split de comissão.
3. Isolamento de tenant (RLS leak test).

## Regras da etapa

- Nenhuma alteração em `src/` (produção).
- Nenhuma execução E2E contra o projeto Supabase de produção `ushsnmlbeurfvlkieiln`.
- Execução idempotente e independente de rede externa instável.
- Sem commit, push ou PR sem autorização de gate.
- Separar EVIDENCE / INTERPRETATION / GAP / DECISION.

## Critérios de entrada

- [x] `origin/main` atualizada (`16b116d` no INTAKE; base atual `34414f1` após merge do PR #175)
- [x] Worktree isolada criada com branch própria
- [x] Dependências instaladas (`npm ci`, 369 pacotes)
- [x] `npx tsc --noEmit --pretty false` sem erros
- [x] Worktree limpa antes da criação do manifest

---

## Autorizações do PO (2026-10-23)

- **F1 tratado como P0:** proibida execução local de E2E até a blindagem; aplicada em `46f8e9c` (`fix(e2e): gate b34h and gate1 specs against accidental execution`), antes de qualquer spec nova.
- **Matriz aprovada com ajustes:** P1 em etapas verificáveis; P2 com split real 70/30 e prova de idempotência; P3 com foco em troca de ID na URL e export cross-tenant.
- **Ambiente:** execução somente em **staging** (`tjcvuhynckocmvtqykxp`), com tenants isolados.
- **Escopo:** zero alterações em `src/**`; zero alterações de CI nesta frente. Bug funcional descoberto vira registro de falha e frente separada.
- **Push/PR:** não autorizados nesta etapa.

## 1. Framework, configuração e ciclo de execução — EVIDENCE

| Item | Configuração observada |
|---|---|
| Runner | Playwright (`playwright.config.ts`), `testDir: ./tests/e2e` |
| Escopo | Somente `tests/e2e`. **Fora do run Playwright:** `tests/security`, `tests/d8`, `tests/homologation/h2-8` (vitest) |
| Execução | 29 spec files · **160 declarações `test()`** |
| Gate por env | **89 testes em 16 arquivos** protegidos por `test.skip` (`E2E_PROVISIONING`, `E2E_SANCHEZ_REGRESSION`/`E2E_SANCHEZ_PASSWORD`, `E2E_SIGNUP_UI`/`E2E_SIGNUP_EMAIL`) |
| Run default | **71 testes** sem gate de ambiente |
| CI | Apenas `npm run test:e2e:smoke` (10 testes `@smoke`) no job **advisory** `e2e-smoke` (`continue-on-error`). `npm run test:e2e` **não** roda no CI |
| Tags | Única tag real: `@smoke` (`tests/e2e/smoke/core.spec.ts:18`). `@critical` aparece apenas em comentários de `flow1`–`flow5`, sem efeito de execução |
| `test.only` | Nenhuma ocorrência; `forbidOnly` ativo em CI |

**Achado de ambiente:** `playwright.config.ts:3-4` define `isDeployedUrl` como `!baseURL.includes('localhost')`; com baseURL `127.0.0.1` o runner considera "deployed" e **não sobe o `webServer`** — configuração frágil para execução local.

## 2. Inventário de specs — EVIDENCE

| Grupo | Arquivos | Testes | Gate / papel |
|---|---:|---:|---|
| Smoke — page loads/login | 1 | 10 | `@smoke`; CI advisory |
| Flows 1–5 — shells de navegação | 5 | 10 | Sem gate; P1/P2 apenas shell |
| Flows 6/6a/7/8/9/12/13/14 — provisioning, onboarding, convites, lifecycle, RBAC | 8 | 16 | Todos env-gated; 0 no run default |
| P0.3-C cancelamento de assinatura + P0.4 contas a pagar | 2 | 27 | Sem gate; não são pilares 6.5 |
| Gate 1 — checkout settlement | 1 | 2 | Sem env gate; alvo staging |
| B34H — validação financeira | 1 | 6 | **Sem env gate; alvo produção (Vercel Preview)** |
| P2.1 — importação de clientes | 1 | 7 | Sem gate; não é pilar |
| Regression admin + Reports/Vendas | 2 | 9 | Sem gate; render-only |
| Homologation H35/H4/H5/H6/H6.5/H6.6 | 8 | 73 | Todos env-gated; 0 no run default |
| **Total** | **29** | **160** | **89 gated / 71 default** |

Arquivos com `test.skip`: `flow6`, `flow6a`, `flow7`, `flow8`, `flow9`, `flow12`, `flow13`, `flow14`, `h35`, `h4`, `h5`, `h6-security`, `h6-5-bulk-close`, `h6-5-sanchez`, `h6-5-security-probes`, `h6-6`.

## 3. Estratégia de dados e autenticação — EVIDENCE

- **Sem mock de backend nos E2E**: os specs usam Supabase real. `.env.local` exige `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; helpers administrativos usam `SUPABASE_SERVICE_ROLE_KEY` (injetada no CI).
- **Auth**: fixture própria (`tests/e2e/fixtures/auth.fixture.ts`) + login real. Dados demo estáticos em `tests/e2e/data/`.
- **Seeding**: via client admin e/ou RPCs (ex.: `h6-6` e `h6-5-bulk` fecham comandas por RPC; `gate1` semeia comanda aberta).
- **Isolamento de dados por teste**: `b34h` cria tenant dedicado `b34h-val-*` com teardown FK-aware; `h6-security`/`h6-5-*` usam tenant A/B.
- **Builders**: nenhum spec E2E importa `tests/builders`, `tests/scenarios` ou `tests/factories` (uso restrito a unit/scenario).

**GAP de isolamento:** os testes compartilham o mesmo projeto Supabase; a proteção é por gate de env e convenção de tenant, não por projeto/banco efêmero.

## 4. Cobertura vs lacunas nos 3 pilares — INTERPRETATION

| Pilar | Veredito | Evidência | Lacuna crítica |
|---|---|---|---|
| **P1 — Agendamento → Comanda → Fechamento** | **AUSENTE ponta a ponta; PARCIAL em checkout** | `flow1` só carrega/navega a agenda; `flow3` só carrega/navega o fechamento; `flow5` é, na prática, navegação de Clientes; `CashClosingPage` não expõe ação de fechar; `gate1` semeia comanda aberta e liquida apenas via checkout; `smoke`/`admin-crud` são page-load; `h6-6` fecha comandas em lote via RPC, não UI | Sem criação de agendamento por UI; sem conversão agendamento→comanda; sem comanda multi-item; sem totais/export de fechamento; sem reconciliação financeira |
| **P2 — Checkout com split de comissão** | **PARCIAL; matemática coberta em domínio, split ausente em E2E** | `b34h` prova create/reverse/idempotência/advisory lock, mas usa fallback de participante único (100%) e `rate 0.4 → 40`; `h2-8` usa um participante a 50%; `flow4` só abre a página de comissões; `domain/commission/calculate.test.ts:300-341` cobre 50/50 e 70/30; `application/commission.test.ts:630-675` verifica duas linhas e `isShared`, **não** valores monetários | Sem E2E 70/30 com dois participantes; sem assert de dois registros/valores; sem verificação na UI de comissões; sem reversal de split nem isolamento de tenant do split |
| **P3 — Isolamento de tenant / RLS leak** | **FORTE em backend/REST; PARCIAL em browser/UI** | `h6-security` cobre matriz anon, update/delete/insert cross-tenant, manipulação de `tenant_id`, tabelas legadas, usuário suspenso; `h6-5-security-probes` cobre P-1..P-7; `h6-5-bulk`/`h6-6` cobrem autorização cross-tenant de RPC; `flow-p0-3-c` AC-13 rejeita cancelamento cross-tenant; `d8` cobre staff/items | Maioria das probes usa REST/anon/service-role, não sessão de browser; sem matriz de leak na UI para clients, appointments, comandas, comissões, caixa, relatórios e exports; sem troca de rota/ID via browser |

## 5. Achados sistêmicos — EVIDENCE / INTERPRETATION

| # | Achado | Evidência | Risco |
|---|---|---|---|
| F1 | **Risco de execução contra produção — MITIGADO em `46f8e9c`** | `b34h` declara "real production Supabase via Vercel Preview" (`tests/e2e/validation/b34h-financial-validation.spec.ts:11-16`) e não tinha `test.skip`; `gate1` também não tinha gate de env. Ambos agora exigem `E2E_ALLOW_PROD_EXECUTION === 'true'`; default é SKIP | Resíduo: a flag é opt-in deliberado; execução com a flag ainda atinge ambiente compartilhado |
| F2 | **CI não valida os fluxos críticos** | CI roda somente 10 testes `@smoke`, em job advisory | Alto — regressão P1/P2 pode mergear com CI verde |
| F3 | **Sleeps** | 44 `waitForTimeout` em 11 specs (picos: `flow-p0-4` 12, `b34h` 9, `flow-p0-3-c` 7) | Médio — flakiness e tempo de execução |
| F4 | **Seletores crus / POM parcial** | 325 matches `locator/getBy*` em 37 arquivos; POMs em 15; `CheckoutPage` ainda usa CSS/texto frouxo; `CashClosingPage` expõe só `goto`/`isLoaded` | Médio — manutenção e falsos negativos |
| F5 | **Documentação desatualizada** | `tests/README.md` declara 412 testes e lista apenas `flow1`–`flow5` de E2E; omite `gate1`, `b34h`, H6/H6.5/H6.6 e os 89 gated | Médio — auditorias futuras partem de inventário errado |

## 6. Matriz de testes proposta — DECISION (sujeita a aprovação; não implementar antes do GATE)

### P1 — `tests/e2e/flows/flow1-appointment-to-cash-closing.spec.ts`

Etapas isoladas e verificáveis (sem monólito encadeado de execução longa), cada uma com assert intermediário determinístico:

1. Criar agendamento via UI (cliente, serviço, barbeiro, horário) → assertar status `SCHEDULED` e vínculos tenant/cliente/serviço/staff.
2. Converter o agendamento em comanda → assertar comanda `OPEN` com os itens corretos.
3. Liquidar via checkout (dinheiro/PIX) → assertar comanda `CLOSED` e pagamento final único.
4. Conferir o fechamento de caixa do dia → assertar totais e breakdown iguais aos da comanda, sem concorrência de datas.

### P2 — `tests/e2e/flows/checkout-commission-split.spec.ts`

1. Semear comanda com dois participantes 70/30 sobre R$100; checkout; assertar repasse de R$70 e margem de R$30 para a casa, com dois registros de comissão.
2. Assertar que a página de comissões exibe as duas linhas compartilhadas com os valores corretos.
3. Repetir com pagamento parcial e assertar repasse/margem proporcionais ao valor recebido.
4. Reverter os dois registros; assertar cada reversal e saldo líquido zero.
5. Chamar a liquidação repetidamente; assertar que nenhum lançamento é duplicado no extrato do barbeiro (idempotência).
6. Logar como tenant B; assertar invisibilidade dos registros do split.

### P3 — `tests/e2e/homologation/rls-ui-leak.spec.ts`

1. Manager A autenticado abre clients/comandas/comissões; assertar ausência de linhas do tenant B.
2. Manager A manipula a URL direta (`/comandas/[id_do_tenant_b]`); assertar redirect para 404/Home ou tela vazia, **nunca** renderização de dados do vizinho.
3. Exportar relatório via UI; assertar que o arquivo contém estritamente registros do `tenant_id` da sessão ativa.
4. Tentativa cross-tenant de fechamento/export de caixa; assertar ausência de dados.
5. RPC cross-tenant com IDs do tenant B; assertar rejeição/negação.

### Regra de execução da matriz

- Rodar P1/P2/P3 somente contra **staging**, com tenants isolados e teardown dedicado.
- Não incluir esses cenários no caminho default que aponta para produção/preview.
- Não alterar CI nesta frente (exige PO + ADR).

## 7. Critérios de saída desta etapa

- [x] Framework, configuração e ciclo de execução documentados
- [x] Inventário de specs existentes com tags e status (29 arquivos / 160 testes / 89 gated)
- [x] Estratégia de dados/auth (mock vs real) documentada
- [x] Cobertura vs lacunas nos 3 pilares (P1 ausente; P2 parcial; P3 backend forte/UI parcial)
- [x] Matriz de testes proposta (sem implementar)
- [x] Aprovação do PO no GATE (2026-10-23) — matriz aprovada com ajustes operacionais

## 8. Decisão registrada (2026-10-23)

1. **F1 é P0.** Proibida execução local de E2E até a blindagem. Concluída em `46f8e9c`: `b34h` e `gate1` exigem `E2E_ALLOW_PROD_EXECUTION === 'true'`; default é SKIP.
2. **Matriz P1/P2/P3 aprovada com ajustes** registrados nas seções acima (P1 em etapas; P2 com 70/30 e idempotência; P3 com URL direta e export).
3. **Ambiente:** staging `tjcvuhynckocmvtqykxp`, tenants isolados/fixo staging, teardown dedicado.
4. **Expansão de Escopo Autorizada pelo PO:** Inclusão de atalhos no `DashboardHeader` para "Abrir caixa" e "Fechar caixa do dia" direcionando para `/cash-closing`, com seletores estáveis `data-testid="dashboard-open-cash-btn"` e `data-testid="dashboard-close-cash-btn"`.
5. **Implementação do Pilar P1 Concluída:**
   - Spec implementada em `tests/e2e/flows/flow1-appointment-to-cash-closing.spec.ts`.
   - Page Object `CashClosingPage.ts` enriquecido com suporte a abertura, conferência e fechamento.
   - 4 etapas cobertas: (0) Atalhos na Dashboard, (1) Agendamento com vínculos, (2) Comanda vinculada OPEN, (3) Liquidação via Checkout na UI, (4) Conferência e Fechamento de Caixa.
6. **Push/PR:** pendentes de autorização específica do PO.

### Próximo passo autorizado

Implementar Pilar P2 (`checkout-commission-split.spec.ts` com split 70/30 e idempotência) e Pilar P3 (`rls-ui-leak.spec.ts`).

## Log de transições

| Data | Transição | Ator | Observação |
|------|-----------|------|------------|
| 2026-10-23 | INTAKE | Sisyphus | Subfase 6.5 selecionada pelo PO; escopo restrito a auditoria |
| 2026-10-23 | ISOLATE | Sisyphus | Worktree `feat/fase6-6-5-e2e-criticos` a partir de `origin/main` (`16b116d`); `npm ci` OK; `tsc` 0 |
| 2026-10-23 | AUDIT | Sisyphus | Inventário, ambientes, cobertura e matriz concluídos; risco F1 (b34h em produção) registrado |
| 2026-10-23 | MERGE 6.9 | Sisyphus | PR #175 mergeado em `34414f1`; branch remota removida; `main` fast-forward; branch 6.5 rebaseada |
| 2026-10-23 | COMMIT P0 | Sisyphus | `46f8e9c` — gate de ambiente em `b34h` e `gate1`; default SKIP |
| 2026-10-23 | GATE | PO | Matriz aprovada com ajustes; staging `tjcvuhynckocmvtqykxp`; zero `src/**`; zero CI |
| 2026-10-23 | GATE 2 | PO | Autorizada expansão de escopo para botões de Caixa na Dashboard; execução com tenant fixo em staging |
| 2026-10-23 | IMPLEMENT P1 | Antigravity | DashboardHeader/Dashboard atualizados; Page Object `CashClosingPage` atualizado; spec P1 implementado |
| 2026-10-23 | VALIDATE P1 | Antigravity | `git diff --check` PASS; `tsc --noEmit` PASS (0 erros) |

**STATUS:** Pilar P1 implementado e validado estaticamente; implementação de P2 e P3 a seguir; push/PR não autorizados.
