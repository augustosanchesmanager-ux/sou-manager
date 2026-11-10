# H-7 — Frente B · Instrumento de Enumeração B1 (Vercel Dashboard)

> **Propósito:** Coletar as 25 envs reais do projeto Vercel `sou-manager` legado, classificá-las e mapear consumidores/uso.
> **Quem preenche:** Augusto (PO) — único com acesso ao Vercel Dashboard.
> **Quem analisa:** OpenCode (Tech Lead) — recebe o resultado e classifica.
> **Mutação:** ZERO. Apenas leitura do Dashboard.
> **Data:** 2026-09-20

---

## Instruções para o PO

### Passo 1 — Acessar o Dashboard

1. Abra https://dashboard.vercel.com
2. Navegue até o projeto **`sou-manager`** (Project ID: `prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3`, se ainda estiver acessível)
3. Vá em **Settings → Environment Variables**

### Passo 2 — Capturar a lista

Liste **todas as env vars configuradas** no ambiente **Production**. Use a tabela abaixo — uma linha por env var.

### Passo 3 — Para cada env var, preencher:

| Campo | Descrição | Valores possíveis |
|-------|-----------|------------------|
| **Nome** | Nome exato da env var | (texto) |
| **Ambiente** | Onde está configurada | `Production` / `Preview` / `Development` |
| **Valor (parcial)** | Primeiros 6 caracteres ou tipo | (NÃO cole o valor completo) |
| **Categoria** | Tipo de variável | ver §Abaixo |
| **Consumidor conhecido** | Onde é usada | ver §Abaixo |
| **Evidência de uso** | Como você sabe que é usada | ver §Abaixo |

---

## Categorias (escolher uma por env)

- **CREDENCIAL_SENSÍVEL** — chave/segredo/token que dá acesso a recurso sensível (DB, API, service_role, JWT secret, POSTGRES_PASSWORD, etc.)
- **CONFIG_PUBLICA** — URL pública, feature flag, valor não-seguro que pode ser exposto (VITE_*, NEXT_PUBLIC_*, hostname map, etc.)
- **VARIAVEL_OPERACIONAL** — configuração interna do framework/tooling (NX_DAEMON, TURBO_*, VERCEL_* auto-injected, etc.)
- **DESCONHECIDA** — não sabe o que é nem se é usada

---

## Consumidores conhecidos (escolher todos que se aplicam)

- `Frontend` — bundle do Vite (`src/` lê via `import.meta.env`)
- `Edge Function` — alguma das 5 deployadas em PROD (`admin-create-user`, `portal-auth`, `invite-team-member`, `import-export`, `worker-dispatcher`)
- `Server-side Vercel` — Serverless Function (não-Edge)
- `Tests locais` — algum spec em `tests/`
- `Build tool` — `vite.config.ts`, `tailwind.config.js`, `next.config.js`, etc.
- **NENHUM_CONHECIDO** — não há referência no código atual
- `Outro` — especificar

---

## Evidência de uso (escolher uma)

- `Código fonte atual referencia` — grep atual retorna match
- `Código fonte histórico referencia` — só aparece em commits antigos
- `Documentação referencia` — algum `.md` ou doc menciona
- `Indeterminado` — não há como confirmar

---

## Tabela para preenchimento (25 linhas esperadas)

| # | Nome | Ambiente | Valor (6 chars ou tipo) | Categoria | Consumidor conhecido | Evidência de uso |
|---|------|----------|------------------------|-----------|----------------------|------------------|
| 1 | _(preencher)_ | _Production_ | _(preencher)_ | _(escolher)_ | _(escolher)_ | _(escolher)_ |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |
| 10 | | | | | | |
| 11 | | | | | | |
| 12 | | | | | | |
| 13 | | | | | | |
| 14 | | | | | | |
| 15 | | | | | | |
| 16 | | | | | | |
| 17 | | | | | | |
| 18 | | | | | | |
| 19 | | | | | | |
| 20 | | | | | | |
| 21 | | | | | | |
| 22 | | | | | | |
| 23 | | | | | | |
| 24 | | | | | | |
| 25 | | | | | | |

---

## Após preencher

1. Salve a tabela preenchida em um arquivo local (ou cole aqui)
2. Me passe o resultado
3. Eu classifico adicionalmente, separo:
   - **Comprovadamente utilizada** (código atual referencia)
   - **Potencialmente utilizada** (código histórico ou doc referencia)
   - **Sem consumidor conhecido** (nenhuma referência encontrada)
   - **Indeterminada** (categoria ou uso incerto)

4. STOP. Nenhuma remoção nesta etapa.

---

## Restrições absolutas

- ❌ NÃO remova nenhuma env var
- ❌ NÃO altere valores
- ❌ NÃO substitua por dummies
- ❌ NÃO delete o projeto
- ❌ NÃO altere domínios
- ❌ NÃO altere DNS
- ❌ NÃO faça deploy
- ❌ NÃO revele valores completos de credenciais (apenas 6 chars ou tipo)

Apenas leitura e preenchimento desta tabela.

---

## Observações para o PO

- As 25 envs foram inferidas como contendo (lista parcial do audit 2026-08-08):
  - `VITE_SUPABASE_*` (URL, ANON_KEY, PUBLISHABLE_KEY, MULTI_SCHEMA_ENABLED)
  - `NEXT_PUBLIC_SUPABASE_*`
  - `SUPABASE_*` (URL, ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET, SECRET_KEY, ACCESS_TOKEN)
  - `POSTGRES_*` (URL, PASSWORD, HOST, DATABASE, USER)
  - `SMG_*` (API_BASE_URL, API_TOKEN, WEBHOOK_SECRET, SERVICE_ID_MAP, PROFESSIONAL_ID_MAP)
  - `E2E_SANCHEZ_PASSWORD`
  - `VERCEL_AUTOMATION_BYPASS_SECRET`
- O `.env.local` local contém 16 envs únicas (algumas duplicadas para PROD+STAGING) — pode ajudar a cruzar com a lista do Dashboard
- O `.vercel-temp.env` histórico (commit `124a099^`) continha variáveis com `SUPABASE_JWT_SECRET`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD` **VAZIOS** — pode ajudar a identificar quais envs são realmente armazenadas vs placeholders
