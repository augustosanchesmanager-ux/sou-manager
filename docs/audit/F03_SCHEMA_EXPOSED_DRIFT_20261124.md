# F-03 (`SEC-002`) — Drift de schema exposto no ambiente (`Accept-Profile` / `Content-Profile`)

- **Data:** 2026-11-24
- **Frente:** F-03 / `SEC-002` (hardening de cliente Supabase e testes E2E)
- **Risco:** YELLOW — configuração explícita de schema `public` no cliente e headers PostgREST em `fetch` diretos de E2E. Sem alterações em RLS, RPC, schema SQL ou `.env.local`.
- **Escopo autorizado:** Camada A (repositório) na branch `fix/f03-supabase-schema-profile`. A Camada B (Dashboard Supabase em produção) permanece sob decisão direta do PO.

---

## 1. Sintoma

Chamadas REST ao projeto apontado no `.env.local` sem os headers `Content-Profile: public` / `Accept-Profile: public` retornavam `404 PGRST202` (`Could not find the function api.<nome> ... in the schema cache`).

## 2. Evidências (`EVIDENCE`)

| # | Evidência | Origem |
|---|---|---|
| E-1 | `.env.local` aponta para o projeto de **Produção** (`https://ushsnmlbeurfvlkieiln.supabase.co`). | `.env.local` |
| E-2 | Sonda HTTP read-only em Produção (`POST /rest/v1/rpc/get_auth_access_context`) **sem** header de profile retornou **`404 PGRST202`** (`Searched for the function api.get_auth_access_context ...`). | Sonda REST ao vivo |
| E-3 | A mesma sonda com `Content-Profile: public` e `Accept-Profile: public` retornou **`401 42501`** (`permission denied for function get_auth_access_context`), confirmando que a função existe em `public` e o hardening está íntegro. | Sonda REST ao vivo |
| E-4 | No banco de Produção (`ushsnmlbeurfvlkieiln`), o schema `api` existe, porém possui **0 funções**, **0 tabelas** e **0 views**. Em Staging (`tjcvuhynckocmvtqykxp`), apenas `public` existe. | `pg_namespace` / `pg_proc` / `pg_tables` / `pg_views` (Supabase MCP) |
| E-5 | `@supabase/supabase-js` v2.119.0 envia `Content-Profile`/`Accept-Profile: public` por `DEFAULT_DB_OPTIONS = { schema: "public" }`, mas `baseClient` e `publicAnonymousClient` não declaravam `db: { schema: SHARED_SCHEMA }` explicitamente. | `src/lib/supabase/client.ts` |
| E-6 | Consumidores com `fetch` direto para `/rest/v1/` em E2E não enviavam `Content-Profile`/`Accept-Profile: public`. | `tests/e2e/flows/flow-p0-4-accounts-payable.spec.ts:346-558` |

## 3. Correção aplicada (Camada A)

1. **[src/lib/supabase/client.ts](../../src/lib/supabase/client.ts):** exportadas `BASE_SUPABASE_CLIENT_OPTIONS` e `PUBLIC_ANONYMOUS_CLIENT_OPTIONS` tipadas com `SupabaseClientOptions<SharedSchemaName>` e `db: { schema: SHARED_SCHEMA }` (`'public'`), aplicadas em `baseClient` e `publicAnonymousClient`.
2. **[tests/e2e/flows/flow-p0-4-accounts-payable.spec.ts](../../tests/e2e/flows/flow-p0-4-accounts-payable.spec.ts):** adicionados `'Content-Profile': 'public'` nos 2 `POST /rest/v1/rpc/...` e `'Accept-Profile': 'public'` nos 2 `GET /rest/v1/...`.
3. **[tests/unit/supabaseClientSchema.test.ts](../../tests/unit/supabaseClientSchema.test.ts):** 4 testes unitários validando a declaração explícita de `SHARED_SCHEMA` e a emissão dos headers `Content-Profile: public` e `Accept-Profile: public` pelo SDK.

## 4. Validação (`EVIDENCE`)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | OK (0 erros) |
| `npm run lint` | OK (exit 0; 473 warnings pré-existentes em `src/`; 0 erros) |
| `npx vitest run tests/unit/supabaseClientSchema.test.ts` | 4/4 passed |
| `npm run test` | 208 files · 2898 passed · 5 skipped |
| `npm run build` | OK (18.15 s) |
| `npm run architecture:ci` | 0 erros · baseline `0 = 0` (`repositoryViolations`, `forbiddenImports`, `circularImports`) |

## 5. Pendência de Infraestrutura (Camada B — Ação do PO)

* **Dashboard Supabase (Produção `ushsnmlbeurfvlkieiln`):** em `Settings → API → Data API → Exposed schemas`, colocar **`public` como primeiro schema** (ou remover `api`, que está vazio).
* *(Opcional)* Avaliar uso do projeto de Staging (`tjcvuhynckocmvtqykxp`) no `.env.local` de desenvolvimento.
