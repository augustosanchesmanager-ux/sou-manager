# H-10 — FOTOGRAFIA DE ESTADO PÓS-RELEASE (pós-H-9 / decisão de roadmap)

> **Data:** 2026-08-16
> **Autor:** OpenCode (Tech Lead operacional)
> **Natureza:** Gate **read-only** de reconhecimento de estado — **zero código, zero migrations, zero deploy, zero merge**. Apenas auditoria documental + análise de decisão para o PO.
> **Escopo:** responder 5 perguntas de decisão de roadmap após o release H-9 (incidente `tenants.active` encerrado).
> **Regra absoluta:** nenhuma alteração de código, banco, schema, Vercel, git branch/tag. Aplica a política "Auditoria → Plano → decisão do PO" antes de qualquer nova fase.
> **Relacionado:** `H9_RELEASE_FIX_SUPERADMIN_20260816.md` · `H6_5_PRODUCTION_SAFETY_GATE.md` · `H6_SECURITY_AUDIT.md` · `H7_1_TRILHA_B_CLASSIFICACAO_DIVIDA.md` · `RELEASE_CHECKLIST_v1.5.md` · `ROADMAP.md` (8.19–8.27) · `BUSINESS_DECISIONS.md` (D-HOM-9..D-HOM-29).

---

## 1. Objetivo

Registrar a fotografia do estado da plataforma imediatamente após o H-9 (release do fix `tenants.active`, 2026-08-16), respondendo às 5 perguntas de decisão de roadmap — para que o PO decida o próximo marco com base em fatos documentados, sem risco de misturar pendências de naturezas diferentes.

---

## 2. Respostas-resumo

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | O que ficou pendente do H-6? | **Nada de P0/P1.** H-6 = 🟢 APROVADO COM RESSALVA (9/10). 9 migrations aplicadas/validadas no remoto. Pendentes: M7 bloqueada (dívida P3), produto-bug kiosk (decisão produto), decisão política suspensão. |
| 2 | As 10 migrations e risco/necessidade? | 9 aplicadas ✅; 1 bloqueada (M7) por redundância. Risco de aplicação 🟢 (nenhum 🔴). Rollbacks existem (10 arquivos). Ver matriz §4. |
| 3 | H-8 pós-H-9: pendência real ou documentação? | **Pendência REAL parcial.** 3/5 critérios ainda ❌ (produção ≠ v1.5, release não planejada, Fase 4 dívida). O que era a causa do incidente (42703) foi resolvido; o gate de liberação v1.5 permanece bloqueador — mas por motivos ESTRUTURAIS, não mais pelo 42703. |
| 4 | Fase 4: agora ou backlog? | **Pode ir ao backlog.** Confirmado não ser causa raiz do incidente. Requer decisão arquitetural B-5 + ADR antes de qualquer trabalho. Não bloqueia produção atual (caminho síncrono idempotente). |
| 5 | Próximo marco de produção? | **Decisão do PO sobre 2 rotas mutuamente exclusivas:** (A) concluir H-7/H-8 → deploy v1.5 completo; (B) manter produção no hotfix e postergar v1.5. Ambas passam antes por fechamento formal (veredoito PO) + 6.0.6 + baseline v1.5.0. |

---

## 3. Estado real do H-6 (pergunta 1)

> Fonte primária: `H6_5_PRODUCTION_SAFETY_GATE.md` §12 (linhas 302–416) · `BUSINESS_DECISIONS.md` D-HOM-26 · `RELEASE_CHECKLIST_v1.5.md:204`.

### 3.1 Veredito

**H-6 🟢 APROVADO COM RESSALVA (9/10)** — D-HOM-26, 2026-08-14. Aplicação incremental no remoto `ushsnmlbeurfvlkieiln` executada e validada (M1–M6 + M8–M10); tracking `schema_migrations` reconciliado via `migration repair`; **reauditoria P1–P7 7/7 PASS + Sanchez F1–F14 14/14 PASS; P0/P1 zero**.

### 3.2 Itens pendentes (em aberto)

| Item | Severidade | Estado | Natureza | Ação |
|------|-----------|--------|----------|------|
| **M7** (`20260813120500`, F6-1 `approve_access_request`) | P3 | 🔴 Bloqueada formalmente (D-HOM-26) | Migration redundante (efeito já no banco desde `20260728`); **não corrige o vetor real** | Virar **dívida P3 separada**: adicionar guarda `auth.uid()`/superadmin + teste dedicado. **Não misturar com release.** |
| **Produto-bug kiosk** (booking anon provavelmente bloqueado + mismatch `duration_minutes`/`is_active`) | — | ⏳ Pendente decisão de produto | Decisão de negócio (não técnica) | PO decide se produto-bug entra no roadmap |
| **Decisão política: bloqueio REST por `tenants.status`** (suspensão real não altera `profiles.status`) | — | ⏳ Pendente decisão PO | Política de negócio | PO decide |
| **Consequência aceita do M6** (`tiodon2d@gmail.com` perdeu acesso) | — | ✅ Intencional (D-HOM-27) | Aceito | Nenhuma |

**Conclusão:** o H-6 **não tem pendência técnica bloqueadora**. O que resta são decisões de negócio/backlog — e NENHUMA delas se mistura com o incidente encerrado no H-9.

---

## 4. As 10 migrations H-6 (pergunta 2)

> Rollbacks em `docs/audit/H6_5_PRODUCTION_SAFETY_GATE/rollback/` (10 arquivos). Não há pasta `supabase/migrations/rollback/`.

| # | Migration | Achado (Sev) | O que faz | Estado remoto | Risco aplicação | Necessidade |
|---|-----------|--------------|-----------|---------------|----------------|-------------|
| M1 | `20260813120000` | F6-3 (P2) | Guarda fail-closed `tenant_has_feature` | ✅ Aplicada | 🟢 | Corretiva (info disclosure) |
| M2 | `20260813120100` | F6-4 (P2) | Guarda ownership `get_role_permissions` | ✅ Aplicada | 🟢 | Corretiva |
| M3 | `20260813120200` | F6-5 (P2) | Policies superadmin-only `plan_change_requests` | ✅ Aplicada | 🟢 | Corretiva |
| M4 | `20260813120300` | F6-7 (P2) | Policies tenant-scope `kiosk_addons` | ✅ Aplicada | 🟡 (anon perde leitura) | Corretiva |
| M5 | `20260813120400` | F6-8 (P2) | Helper exige `status='active'` em profiles+staff | ✅ Aplicada | 🟡 (baseline B-8) | Corretiva |
| M6 | `20260813130000` | F6-A (P0/P1) | Policies anon scoped + column grants mínimos (`tenants`/`services`) | ✅ Aplicada | 🟡 (exposição anon reduzida) | Corretiva — **fechou exposição de dado real** |
| M7 | `20260813120500` | F6-1 (P3) | `REVOKE anon/PUBLIC` `approve_access_request` | 🔴 **BLOQUEADA** | 🟢 (redundante) | **Não necessária** (efeito já existia) |
| M8 | `20260813130100` | F6-B (P0/P1) | Policy `profiles` `TO authenticated` | ✅ Aplicada | 🟢 | Corretiva — **fechou exposição de dado real** |
| M9 | `20260813130200` | F6-2 (P0/P1) | `REVOKE` de `close_order` (desativação) | ✅ Aplicada | 🟢 (sem call site) | Corretiva |
| M10 | `20260813130300` | F6-6 (P0/P1) | Policies v2 `ticket_messages` (JOIN tenant/user) | ✅ Aplicada | 🟢 | Corretiva — **fechou exposição de dado real** |

**Leitura gerencial:** das 10, **9 são correções de segurança aplicadas** e **1 (M7) foi formalmente dispensada**. Risco de aplicação remota já consumido — não há "10 migrations pendentes" esperando deploy. Isso desfaz a premissa de que o H-6 ainda segura um lote de migrations.

---

## 5. Estado real do H-8 pós-H-9 (pergunta 3)

> Fonte: `HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (D-HOM-9/D-HOM-10) · `ROADMAP.md:1950` (análise D-HOM-29) · `H9_*` §7 nota residual.

### 5.1 Os 5 critérios do H-8

| Critério | Status | Nota |
|----------|--------|------|
| 1. Origem oficial única | ✅ | `smg-barber` / `barber.soumanager.com` |
| 2. Produção com release v1.5 | ❌ | Produção = hotfix `c44ca6d`; v1.5 não deployada |
| 3. Double-deploy eliminado | ✅ | Git link do `sou-manager` desconectado (D-HOM-11) |
| 4. Env limpo/seguro | ✅ | Sem segredos em runtime |
| 5. Deploy de produção da release v1.5 planejado | ❌ | Só o hotfix foi deployado |

### 5.2 Pendência REAL vs documentação

- **O que o H-9 resolveu (não era documentação):** a causa técnica que impedia operação (42703 `tenants.active`) foi eliminada do runtime (código + bundle de produção). `/superadmin`, Comissões, TenantContext validados em produção (smoke 10/10).
- **O que ainda é pendência REAL do H-8 (não é só veredito):** o critério #2 e #5 dependem do **deploy da release v1.5** — que envolve migrations já aplicadas no banco (✅) e o **deploy do frontend v1.5 na Vercel** (❌ ainda não executado). Este é o único item técnico-operacional que separa o H-8 do status "pronto para fechar".
- **O que é apenas fechamento formal:** veredito do PO sobre o gate (D-HOM-29 já analisou o hotfix; falta o veredito final do H-8 para a release v1.5) + registro nos docs.

**Conclusão:** H-8 pós-H-9 = **1 pendência operacional real (deploy frontend v1.5) + veredito formal**. Não há pendência de código para o incidente encerrado; a pendência é do gate de liberação da v1.5 (decisão de roadmap, não de bug).

---

## 6. Dívida da Fase 4 (pergunta 4)

> Fonte: `H7_1_TRILHA_B_CLASSIFICACAO_DIVIDA.md` (B-4) · `ROADMAP.md:1941` (D6) · D-HOM-28.

### 6.1 Fato

Fase 4 (Event Driven) implementada em código/testes (certificada 4.10, 631 testes), porém **zero bootstrap no runtime de produção**: `event_store` 0 rows, `processed_operations` 0 rows, Subscribers/Outbox/Dispatcher/FinanceProvider/ReplayEngine não inicializados (`index.tsx`/`App.tsx`). Única infra inicializada = Observability (`App.tsx:326`).

### 6.2 Veredito já registrado

- **Não é a causa raiz** do incidente de Comissões (Trilha A: produção defasada + `tenants.active`). Confirmado pelo PO (D-HOM-28).
- **Idempotência financeira validada** via caminho síncrono (`finance_settle_comanda`, sem duplicidade) — a não-bootstrap da Fase 4 não causa risco financeiro ativo.

### 6.3 Tratar agora ou backlog?

**Recomendação: BACKLOG (decisão arquitetural pendente B-5).**

- **Não bloqueia produção:** o caminho de produção é síncrono e idempotente; não há fila vazia causando perda de dados.
- **Custo de entrada alto:** exige decisão arquitetural B-5 → ADR de implementação → bootstrap → migração de consumidores → teste de integração em produção. Não é trabalho "de fim de sprint".
- **Quando tratar:** como fase própria de plataforma, com janela dedicada (não junto de homologação/release do produto), após estabilização da v1.5.

**Restrição:** NENHUM trabalho de Fase 4 pode começar sem decisão formal do PO sobre a solução (B-5) e sem ADR aprovado — conforme o congelamento do roadmap.

---

## 7. Próximo marco de produção (pergunta 5)

### 7.1 Estado atual de produção

- **Frontend:** `barber.soumanager.com` → `dpl_X88oDRwznSVaaRYiLaEspB8VLDts` (Ready) = hotfix `c44ca6d` (+docs `202633e`). **Não é a release v1.5.**
- **Banco:** migrations 6.0.5 (janela 2026-08-08) + H-6 (janela incremental) **já aplicadas**. Banco está ADIANTE do frontend.
- **Última baseline:** `v1.4.3-effective-state-6.0.5.1`. **`v1.5.0-feature-flags-6.0.5` não criada.**

### 7.2 Rotas possíveis (decisão do PO)

| Rota | Descrição | Custo | Risco | Desbloqueia |
|------|-----------|-------|-------|-------------|
| **A — Deploy v1.5** | Fechar H-7 (ciclo acompanhado) + veredito H-8 + deploy frontend v1.5 + 6.0.6 + baseline | Médio (operações já prontas) | Baixo (features já validadas E2E) | Release v1.5 certificada |
| **B — Postergar v1.5** | Manter produção no hotfix; H-7/H-8/6.0.6/v1.5 entram como fase futura | Baixo | Médio (produção defasada em features) | — |

### 7.3 Sequência obrigatória (independente da rota)

```
Veredito formal do H-8 (PO)  ← requer decisão sobre deploy v1.5
  → H-7 ciclo acompanhado (janela PO)  [rota A]
  → Deploy frontend v1.5 (Vercel)      [rota A]
  → 6.0.6 Compliance & Legal           [gate de certificação]
  → Baseline v1.5.0 + tag anotada + push
  → Fechamento ROADMAP/PROJECT_STATUS
```

**Pré-requisito imediato (esta decisão):** o PO deve escolher **A ou B**. Nenhuma outra ação é recomendada até essa escolha, pois as duas rotas são mutuamente exclusivas e não devem ser misturadas.

---

## 8. Itens descartados durante a fotografia (verificação cruzada)

| Achado alegado | Verificação | Veredito |
|----------------|-------------|----------|
| "Migration `20260720000001_commission_schema_fix.sql` com `t.active` desatualizada" | Arquivo **não existe**; zero `t.active` em migrations; view `v_commission_summary_by_barber` não existe no repo (criada no banco, não versionada) | ❌ **FALSO — descartado** |
| "10 migrations pendentes de aplicação" | 9 aplicadas/validadas; 1 bloqueada (M7) | ❌ **FALSO — apenas M7 (dispensada)** |
| "H-8 pós-H-9 só documentação" | 1 pendência operacional real (deploy v1.5) | ⚠️ **PARCIAL — 1 item real** |

---

## 9. Conclusão executiva

1. **Incidente encerrado e isolado.** O H-9 resolveu o que era técnico (42703). Não misturar com outras pendências.
2. **H-6 não é pendência técnica** — apenas decisões de negócio/backlog (M7 P3, kiosk, política suspensão).
3. **H-8 tem 1 pendência real de operação** (deploy frontend v1.5) — depende da decisão de rota A/B.
4. **Fase 4 vai para o backlog**, condicionada à decisão B-5 + ADR.
5. **Próximo marco = decisão A/B do PO.** Nada de código até lá.

---

## 10. Recomendação do Tech Lead (para o PO decidir)

Recomendo a **Rota A** quando o PO validar a janela do H-7 (ciclo acompanhado), pois: features já validadas (E2E flow1–14, smoke 10/10, H-2/H-4/H-5 🟢), banco já adiantado, e o adiamento prolongado aumenta o gap frontend×banco. Porém, a **Rota B é defensável** se o PO priorizar estabilidade pós-incidente e quiser consolidar a operação real antes de mais release.

**Ação imediata requerida do PO:** escolher A ou B (e, se A, definir a janela acompanhada do H-7).

---

## 11. Arquivos alterados nesta fotografia

| Arquivo | Mudança |
|---------|---------|
| `docs/audit/H10_FOTOGRAFIA_POS_RELEASE_20260816.md` | Novo (esta evidência) |
| `ROADMAP.md` | Linha 8.28 adicionada |
| `PROJECT_STATUS.md` | Linha do reconhecimento adicionada |
