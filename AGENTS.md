# AGENTS.md — SOU MANA.GER (SMG Platform)

> **Princípio (PO, 2026-09-28):** este arquivo ensina **como trabalhar** no projeto; o repositório e `docs/` são a **fonte da verdade** sobre o que o projeto contém.
> Se a informação é descoberta corretamente olhando código, tipos ou docs, ela **não** pertence aqui. Não copie inventários para o `AGENTS.md`.
> Antes de alterar um módulo, consulte a implementação e a documentação vigente — nunca assuma contrato (API, RPC, eventos) por este arquivo.
> Manutenção deste arquivo é frente documental isolada: não misturar com alteração de código, banco ou produto.

---

## 1. Identidade do projeto

- **Produto comercial ativo:** apenas **SMG Barber**. "Club dos Chefes" é módulo do SMG Barber, não um SaaS.
- **Decisão arquitetural permanente:** arquitetura sempre genérica, modular e multi-tenant; regras de negócio, docs e implementação consideram **somente** o produto ativo. Nada de feature/doc para segmentos futuros por hipótese. *"Arquitetura pensa no futuro. Negócio pensa no presente."*
- **Roadmap CONGELADO desde 2026-07-24** (`ROADMAP.md`, decisões D1–D9): nenhuma fase nova, nenhuma reorganização. Só evolução documentada por ADR.
- **Stack:** React 19 · Vite 6 · TypeScript 5.8 · Tailwind v4 (config via CSS — **não existe** `tailwind.config`) · Supabase (PG + Auth + Realtime) · Google Gemini (`@google/generative-ai`) · deploy Vercel.
- **Router: `HashRouter`, nunca `BrowserRouter`** — exigido pelo rewrite SPA do `vercel.json`.
- **Estado:** só React Context (`AuthContext` → `TenantProvider` → `AppProvider` → `ThemeProvider`). Sem Redux/Zustand.
- **Glossário obrigatório:** `docs/TAXONOMY.md` (SMG Platform = ecossistema, SMG Core = arquitetura técnica). Domínios: `{produto}.soumanager.com` — **nunca** `app.soumanager.com`.
- **Idioma:** documentação funcional/de negócio em pt-BR; código e identificadores em inglês.

### Estrutura de diretórios (fonte clássica de erro)

- Alias **`@/` aponta para a RAIZ do repositório**, não para `src/` (`vite.config.ts`).
- Existem **duas árvores de código**: na raiz (`components/`, `context/`, `hooks/`, `pages/`, `services/`, `domain/`, `application/`) **e** sob `src/`. Verifique ambas antes de criar arquivo — evite duplicatas.
- Barrel: `services/supabaseClient.ts` re-exporta tudo de `src/lib/supabase/`.

---

## 2. Regras invioláveis

### Multi-tenant e RLS

- Isolamento por `tenant_id` via RLS; helpers centrais `current_tenant_id_from_auth_uid()` e bypass `current_is_super_admin_from_auth_uid()` (ambos `SECURITY DEFINER`).
- `AuthContext` resolve o tenant efetivo pela RPC `get_auth_access_context`; `TenantContext` carrega o registro via `resolveTenantForUser()`.
- **Bug de dado entre tenants quase sempre é** regressão de política RLS ou filtro `tenant_id` ausente na query do front — nunca roteamento de schema.
- Nunca afrouxar RLS, remover filtro de `tenant_id` ou criar RPC sem autorização. Antes de mexer em RLS/RPC: ler `docs/security/SECURITY_AUDIT_RLS.md` e `docs/security/SECURITY_AUDIT_RPC.md`.
- **Hardening a confirmar antes de tocar RPC/RLS** (verificar estado — pode já estar aplicado): migration `20260723000000_security_fix_rls_critical.sql` em PROD · check de `auth.uid()` em `approve_access_request()` · destino de `close_order()` (legado) · `FOR UPDATE` em SELECTs críticos de RPCs.

### Cliente Supabase

- Importar de `services/supabaseClient.ts` ou `src/lib/supabase/client.ts`.
- `getSharedClient()` → tabelas em `public`; `getSchemaClient(schema)` / `getScopedClient({schema, tenantId})` → tabelas de domínio quando multi-schema ligado; `getClientForTable(tableName, tenantId)` escolhe sozinho.
- **Nunca** instanciar `createClient` cru em componente/página.

### Multi-schema (opcional)

- `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true` roteia tabelas de domínio para schema `barber`/`auto`/`club`; caso contrário tudo fica em `public`. Tabelas centrais (`profiles`, `tenants`, `staff`, `audit_logs`…) são sempre `public`.
- Resolução de app: `src/middleware/resolveApp.ts` (mapa explícito → heurística de subdomínio → fallback `barber`); roteamento em `src/lib/supabase/schemas.ts`.

### Migrations e banco

- Mudança de schema = arquivo **timestampado** em `supabase/migrations/`. Não há runner automático no build do front.
- **Aplicar migration no banco remoto de produção exige aprovação explícita do PO.**

### Financeiro

- **ADR-001:** `domain/commission/` (comissão teórica) e `application/cashClosing/` (rateio efetivo de fechamento de caixa) são domínios **distintos**. **Nunca** substituir um pelo outro sem decisão de negócio que altere o ADR. Ver `docs/adr/ADR-001-Commission-vs-Settlement.md`.
- D8 (worker de outbox): canônicos **não se editam** em D8 — `domain/commission/{calculate,participants,types}.ts`, `shared/numbers/normalize.ts`, `domain/events/outbox/supabaseOutbox.ts`. Divergência = **STOP**: `npm run d8:verify`. Data path do worker nunca usa `service_role`.

### D8 — worker de outbox (Edge Function)

- Arquitetura: `pg_cron → pg_net → worker-dispatcher Edge Function → RPCs` via role **worker_dispatcher** (NOLOGIN, sem bypass RLS). **Nunca `service_role` no data path.**
- Secrets lidos pelo worker: `SUPABASE_PUBLISHABLE_KEYS` (auto-injetado), `APP_URL` e `EDGE_JWT_SECRET` (**custom secrets** no dashboard). Bloqueio conhecido (2026-08): `EDGE_JWT_SECRET` setado no dashboard mas não injetado no Edge Runtime → worker responde 503 e não completa o ciclo — verificar status antes de diagnosticar. **Nunca criar secret custom com prefixo `SUPABASE_`** (a plataforma rejeita).
- pg_cron: registrar com `cron.unschedule()` + `cron.schedule()` — **nunca** `UPDATE` direto em `cron.job` (permission denied). Harness em `tests/d8/harness/*.ps1` e prova de equivalência em `tests/d8/equivalence.test.ts`.
- **Stop conditions D8 (Amendment-04) — violação quebra a certificação PROD:** sem alteração no cálculo de comissão D7 · sem segunda regra financeira · sem acesso direto às tabelas do worker · sem cross-tenant · sem quebra de idempotência · sem claim antes de `retry_next_retry_at` · sem perda de item.

### Testes

- **Nunca alterar teste para fazê-lo passar.** Corrigir o código ou propor mudança de comportamento ao PO.

### Local Demo Mode (crítico para debugar)

Se **não há env do Supabase** e o host é `localhost`/`127.0.0.1`, o app sobe em modo demo silencioso: sessão falsa em `soumanager.local.demo.session`, usuário/tenant hardcoded, tudo emulado em `soumanager.local.demo.db`.

- Login demo: `teste@soumanager.local` / `12345678`.
- **Implicação forense:** bug de auth/dados em localhost pode ser artefato do modo demo. Verifique `hasSupabaseEnv` e `isLocalDemoEnabled()` em `src/lib/supabase/client.ts` antes de culpar RLS/RPC.

---

## 3. Governança e autorização

### Papéis

| Responsável | Escopo |
|---|---|
| **OpenCode** | Arquitetura, código, testes, docs técnicas, ADRs, CI/CD, automações, validações |
| **Augusto (PO)** | Produtos, módulos, nomenclatura, planos, onboarding, estratégia, domínios, infra, deploy, fornecedores, políticas, LGPD |

Itens comerciais **nunca** são decididos automaticamente pelo OpenCode.

### Protocolo SMG Change Control (precedência)

Todo trabalho de engenharia segue o **SMG Change Control Protocol** — `.opencode/SMG_CHANGE_CONTROL.md` + `.opencode/AGENTS.md` (carregado automaticamente nas sessões) + skills `smg-*` em `.opencode/skills/`:

```
INTAKE → AUDIT → CLASSIFY → STOP/GATE → ISOLATE → IMPLEMENT → VALIDATE → STOP/GATE
  → COMMIT AUTHORIZATION → COMMIT → STOP/GATE → PUSH AUTHORIZATION → PUSH → PR
  → CI/E2E → STOP/GATE → MERGE AUTHORIZATION → MERGE → POST-MERGE
  → DEPLOY AUTHORIZATION → DEPLOY → POST-DEPLOY → CLOSE
```

- Não pular etapa nem STOP/GATE; nunca misturar frentes não relacionadas; nunca implementar fora do escopo autorizado.
- Invariantes: diff isolado antes de commit · `git diff --check` sempre · separar **EVIDENCE / INTERPRETATION / GAP / DECISION** · nunca modificar produção durante investigação.
- Execução P.02 nova: começar por `smg-change-control` fazendo só `INTAKE → AUDIT → CLASSIFY → STOP` e aguardar autorização do PO.

> **Precedência registrada (decisão do PO, 2026-09-28):** o protocolo SMG (set/2026) **governa commit, push, merge e deploy**, que exigem autorização explícita. A Política de Versionamento de 2026-08-06 ("commit semântico e `git push` automáticos") fica **superada nesses pontos**, pendente de formalização em documento/ADR pelo PO. Quando os dois documentos divergirem, vale o mais restritivo: **parar e perguntar ao PO**.

### Sempre exigir aprovação explícita do PO

- Merge em `main` (merge só no encerramento da fase completa, nunca durante subfases) · deploy em produção · migration em produção · novo ADR · mudança de regra de negócio · operação destrutiva (rollback, exclusões).
- **`MERGE ≠ DEPLOY PROD`** (ADR-026): merge em main não implica deploy.

### Sempre executar automaticamente (sem perguntar)

Atualizar `ROADMAP.md`, `PROJECT_STATUS.md`, ADRs, Entry Checks (`docs/audit/`), documentos da fase e changelog; commit semântico e push **somente após a autorização do gate correspondente** (ver precedência acima).

### Sequência obrigatória por subfase (PO, 2026-08-06)

`Implementação → Testes unitários → Build → Typecheck → E2E → Auditoria → Atualização da documentação → Commit semântico → Push da branch → Push das tags`

**A subfase só é considerada encerrada após essa sequência completa** (commit/push após autorização do gate).

### Antes de iniciar qualquer nova fase (regra de entrada)

1. Auditoria documental · 2. Auditoria arquitetural · 3. Auditoria de nomenclatura · 4. Auditoria de consistência.

Cada fase documenta: objetivo, escopo, critérios de entrada/saída, dependências, arquivos alterados, testes, riscos, responsável, próxima etapa.

Baseline certificada = commit semântico + tag anotada + push da branch e da tag + ROADMAP/PROJECT_STATUS/docs da fase atualizados.

### Mudança estrutural exige ADR antes de implementar

Roadmap congelado: sem ADR não há mudança estrutural. Sem ADR também não se cria novo Repository, Application Service, camada ou abstração — na dúvida, resolver dentro do padrão existente e **interromper para propor** antes de escrever código (duplicação, inconsistência, nomenclatura errada, fluxo confuso, doc divergente).

---

## 4. Como o agente trabalha

- **Investigar primeiro, alterar minimamente.** Bugfix = correção mínima, sem refactor junto.
- **Checklist forense** (aplicar a todo bug): (1) é localhost / modo demo? (2) `tenant_id` consistente na query e na RLS? (3) `profileStatus` travado em `pending`? (4) mismatch de `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` vs ambiente? (5) listener/subscription duplicado (`onAuthStateChange`, `useEffect` sem cleanup)? (6) a causa raiz é efeito colateral ou sintoma — rastreie UI → contexto → RPC/query.
- **Padrões já observados:** `setState` duplo em bloco `finally` (cadeia de re-render) · provider sem array de dependência · retry sem backoff (nenhuma chamada embutida — verificar manualmente) · replay de eventos do Supabase Realtime se habilitado.
- **Alvos de debug** (loops, execução dupla, cascata): `src/lib/supabase/client.ts` (demo mode, subscribers) · `context/AuthContext.tsx` (session listener, `fetchAccessContext`) · `src/context/TenantContext.tsx` (`refreshTenant`) · `src/context/AppContext.tsx` (hostname, `setActiveAppContext`) · `App.tsx` (rotas e guards).
- **Guardas de rota:** `ProtectedRoute` (redireciona `pending`/`suspended` para `/pending-approval`), `ManagerRoute` (bloqueia `barber`/`receptionist`), `SuperAdminRoute`. Loop de redirect / loading infinito = corrida entre `AuthContext.loading` e `TenantContext.loading`, ou `profileStatus` preso.
- **Infra de eventos/observabilidade:** existe e está madura (`domain/events/` com bus, event store, subscribers, outbox com retry/dead-letter, finance provider idempotente, replay engine; `src/lib/observability/` com dashboard em `/#/observability`). Para contratos exatos, **ler o código** — não confiar em cópia histórica deste arquivo.

---

## 5. Comandos e gates

### Comandos

```bash
npm install
npm run dev                # Vite, porta 3000, host 0.0.0.0
npm run build              # produção → dist/
npm run typecheck          # tsc --noEmit
npm run lint               # biome — APENAS src/  (lint:fix para auto-correção)
npm run test               # vitest run (unit); exclui tests/e2e e tests/homologation
npx vitest run <caminho>   # um arquivo de teste
npm run test:e2e           # Playwright (sobe dev server se baseURL for localhost)
npm run test:e2e:smoke     # suíte @smoke
npm run test:e2e:ui        # modo interativo
npm run architecture:ci    # gate de CI (modo baseline)
npx vitest run --config vitest.h2-8.config.ts tests/homologation/h2-8/<spec>  # harness H2-8 sob demanda
npm run d8:verify          # integridade do core exportado p/ Edge Function — STOP em divergência
git diff --check           # obrigatório antes do commit
```

### Gates de CI (`.github/workflows/ci.yml`, ADR-022)

- **Bloqueadores** (job agregado `validate`): `typecheck` · `build` · `unit` · `architecture:ci`.
- **Advisory** (`continue-on-error`): `lint` · `e2e-smoke`.
- E2E é obrigatório quando há mudança de fluxo crítico P0/P1 e antes de promoção final.
- Alterar workflows/CI exige PO + ADR (ADR-024 está *Proposed*).
- Override de gate: somente para **falha de infraestrutura** (nunca de lógica) e só com autorização do PO — `docs/runbooks/ci-gate-override.md`.

### Armadilhas de verificação

- **`npm run lint` só cobre `src/`.** `domain/`, `application/`, `components/`, `pages/`, `hooks/` (raiz) **não** são lintados — lint verde não significa repo limpo.
- **Nenhum formatter ativo** (biome com `formatter.enabled: false`). Não reformatar arquivos por conta própria.
- **`architecture:ci` pode passar mascarado.** O runner conta violações pela regex `Total: N violation`; guards que reportam `Total: N error(s)` (Forbidden Imports) ou `Found N circular dependency` são contados como 0. *Evidência (2026-09-28):* `architecture:ci` sai com exit 0, mas `guard-imports.mjs` e `guard-circular.mjs` saem com exit 1 (1 forbidden import: `components/billing/StatusBanner.tsx`; 1 circular: `domain/billing/repository.ts ↔ supabaseBillingRepository.ts`). Para verificação real, rodar os guards individuais. **Corrigir o runner é mudança de CI → PO + ADR.**
- Baseline de arquitetura: `architecture-baseline.json` (repo 233 / imports 0 / circular 0) — violações não podem aumentar.

### E2E (Playwright)

- Testes em `tests/e2e/` (fixtures, Page Objects, flows, smoke, regression). **Nunca** acessar seletor direto no teste — usar Page Objects e fixtures de auth. Dados demo estáticos (`tests/e2e/data/`) para reprodutibilidade.
- Roda contra a app real: exige `.env.local` com `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (login real via Supabase; helpers lançam erro sem isso). CI injeta também `SUPABASE_SERVICE_ROLE_KEY`.
- `PLAYWRIGHT_BASE_URL=<url deploy>` roda contra ambiente publicado e **não** sobe dev server.
- `expect.timeout: 30_000` de propósito — páginas são `React.lazy` compiladas sob demanda; timeout curto gera flake.

### Convenções de teste unitário

`tests/README.md` é a referência: nomes `should_<resultado>_when_<condição>()`, builders de `tests/builders/` (nunca objetos literais grandes), AAA com comentários em cenários > 5 linhas, `vi.mock` no topo do arquivo, **nunca** mockar funções puras de domínio, `vi.clearAllMocks()` em `beforeEach`. Testes de `application/` e `domain/` ficam co-localizados com o código testado.

### Ambiente (`.env.local` na raiz, não commitar)

```env
VITE_SUPABASE_URL=...          VITE_SUPABASE_ANON_KEY=...
VITE_GEMINI_API_KEY=...        # vite.config.ts injeta em process.env no build
VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false   # opcional
VITE_APP_HOSTNAME_MAP={"custom.domain":"barber"}   # opcional
```

---

## 6. Referências

| Assunto | Onde |
|---|---|
| Roadmap, decisões D1–D9 | `ROADMAP.md` · status: `PROJECT_STATUS.md` |
| Nomenclatura oficial | `docs/TAXONOMY.md` |
| Arquitetura / dados / funcionalidades / contribuição | `docs/ARQUITETURA.md`, `docs/BANCO_DE_DADOS.md`, `docs/FUNCIONALIDADES.md`, `docs/DESENVOLVIMENTO.md` |
| ADRs (índice) | `docs/adr/README.md` |
| Auditorias de segurança | `docs/security/SECURITY_AUDIT_RLS.md`, `docs/security/SECURITY_AUDIT_RPC.md` |
| Evidências de fase, Entry Checks, governança | `docs/audit/` |
| Testes (convenções, builders, mocks) | `tests/README.md` |
| Protocolo de mudança e skills | `.opencode/SMG_CHANGE_CONTROL.md`, `.opencode/AGENTS.md`, `.opencode/skills/` |
| Eventos / outbox / replay / observabilidade | `domain/events/`, `src/lib/observability/` (ler o código) |
| D8 worker + harness | `supabase/functions/worker-dispatcher/`, `tests/d8/` |

**Deploy:** Vercel, saída `dist/`, rewrite de paths para `index.html` (por isso HashRouter). Deploy em produção = decisão do PO.
