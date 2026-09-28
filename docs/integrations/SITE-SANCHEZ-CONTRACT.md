# Contrato Canônico v1 — Integração Site Sanchez ↔ SMG Platform

> **Versão:** 1.0
> **Data:** 2026-09-27
> **Status:** Implementado (Fase 1 — DEC-001)
> **Escopo:** Lado SMG (Source of Truth) — Edge Function `site-sanchez-appointments`

---

## 1. Visão Geral

Este documento define o contrato **canônico e imutável** para a integração unidirecional **Site (Sanchez Barber) → SMG Platform**. O Site envia agendamentos (criação, cancelamento, reagendamento) via webhook para a Edge Function `site-sanchez-appointments` no Supabase.

**Princípio:** O contrato é a **única fonte de verdade** para ambas as partes. Qualquer divergência entre implementação e contrato é **bug**, não feature.

---

## 2. Endpoint

```
POST {SUPABASE_URL}/functions/v1/site-sanchez-appointments
```

### Headers Obrigatórios

| Header | Valor | Descrição |
|--------|-------|-----------|
| `Content-Type` | `application/json` | Corpo JSON |
| `Authorization` | `Bearer {SANCHEZ_WEBHOOK_SECRET}` | **OU** assinatura HMAC (ver abaixo) |
| `X-Sanchez-Signature` | `sha256=<hmac-sha256 hex do RAW body>` | Alternativa ao Bearer token |

> **Autenticação dual:** A função aceita **Bearer token** OU **HMAC-SHA256** do corpo bruto. Pelo menos um deve ser válido. Comparação é *timing-safe*.

---

## 3. Payload (JSON)

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `client_name` | string | **Sim (todos status)** | Máx. 120 chars, não vazio [RPC SQL:129] |
| `phone` | string | **Apenas `status=active`** | 10–13 dígitos (não-dígitos ignorados) [RPC SQL:145] |
| `service_id` | uuid | **Sim (todos status)** | UUID válido [RPC SQL:133] |
| `professional_id` | uuid | **Sim (todos status)** | UUID válido [RPC SQL:133] |
| `scheduled_at` | ISO 8601 | **Sim (todos status)** | Data válida; **futura apenas se `active`** [RPC SQL:133, A1] |
| `status` | enum | Não (default `active`) | `active` \| `cancelled` \| `rescheduled` |
| `site_appointment_id` | string | **Sim (todos status)** | Chave de idempotência — armazenada em `appointments.external_id` [RPC SQL:141, 271] |
| `external_id` | string | Não | Apenas auxílio para cancelar/reagendar (targeting) |
| `notes` | string | Não | Máx. 500 chars |

### Notas sobre campos

- **`site_appointment_id`** é a **chave de idempotência** principal. É gravado na coluna `external_id` da tabela `appointments` com `external_source = 'site_sanchez'`.
- **`external_id`** no payload é **opcional** e serve apenas como identificador auxiliar para localizar o agendamento original em operações de cancelamento/reagendamento (o RPC tenta `external_id` OU `site_appointment_id` OU UUID direto — ver SQL:162-165).
- **`phone`** é normalizado (apenas dígitos) antes de validação e persistência.

---

## 4. Regras de Validação (A1 — Future-check scoped to active)

| Cenário | `scheduled_at` no passado | `phone` ausente/inválido |
|---------|---------------------------|--------------------------|
| `status = active` | ❌ **Rejeitado** (400) | ❌ **Rejeitado** (400) |
| `status = cancelled` | ✅ **Aceito** | ✅ **Aceito** (não validado) |
| `status = rescheduled` | ✅ **Aceito** | ✅ **Aceito** (não validado) |

> **Racional:** O RPC SQL (linhas 129-147) exige `client_name`, `service_id`, `professional_id`, `scheduled_at`, `site_appointment_id` para **todos** os status. O `phone` e o *future-check* são as únicas validações condicionais ao `status=active`. **Não tente relaxar as validações incondicionais no Edge — o RPC rejeitará.**

---

## 5. Respostas de Sucesso

| Status HTTP | Quando |
|-------------|--------|
| `201 Created` | `status = active` (novo agendamento criado) |
| `200 OK` | `status = cancelled` ou `rescheduled` |

### Envelope de Sucesso

```json
{
  "ok": true,
  "appointment_id": "uuid-do-agendamento",
  "client_id": "uuid-do-cliente",
  "status": "confirmed" | "cancelled" | "rescheduled",
  "request_id": "uuid-da-requisicao",
  "idempotent": true,        // A2: presente apenas quando RPC retorna idempotent=true
  "not_found": true          // A2: presente apenas quando RPC retorna not_found=true
}
```

#### Campos condicionais (A2 — Forward RPC fields)

| Campo | Quando presente | Significado |
|-------|-----------------|-------------|
| `idempotent: true` | RPC detectou `site_appointment_id` já existente (SQL:278-287) | Requisição duplicada — registro existente retornado |
| `not_found: true` | Cancel/Reschedule não encontrou agendamento para cancelar (SQL:181-190) | Operação "sucesso vazio" — nada a cancelar |

> **Importante:** `idempotent` e `not_found` são **booleanos opcionais** — só aparecem quando `true`. Nunca vêm como `false`.

---

## 6. Respostas de Erro

### Envelope de Erro (Padrão Unificado)

```json
{
  "ok": false,
  "error": "Mensagem de erro legível",
  "details": ["detalhe1", "detalhe2"],  // Opcional — ver abaixo
  "request_id": "uuid-da-requisicao"
}
```

### Códigos de Status e `details`

| HTTP | Cenário | `details` |
|------|---------|-----------|
| `400` | Validação de payload falhou (campos obrigatórios, formatos, limites) | **Sim** — array com mensagens específicas por campo |
| `400` | Erro vindo do RPC (ex: serviço inválido, profissional inválido, schema não preparado) | **Sim (A3)** — array com `[message_do_rpc]` para consistência de envelope |
| `401` | Autenticação falhou (Bearer inválido + HMAC inválido/ausente) | Não |
| `403` | Origin não permitido (quando `SANCHEZ_ALLOWED_ORIGIN` configurado) | Não |
| `405` | Método não permitido (não POST/OPTIONS) | Não |
| `409` | Conflito de horário (RPC `23P01` / "Horario indisponivel") | Não |
| `500` | Configuração ausente, erro interno, RPC erro não mapeado | Não |

> **A3 — Envelope Consistency:** Erros 400 originados do RPC **também** incluem `details: [<mensagem_rpc>]`. Isso padroniza o formato para o consumidor (Site) sempre poder ler `details` em qualquer 400.

---

## 7. Idempotência

- **Chave:** `site_appointment_id` (payload) → coluna `appointments.external_id` com `external_source = 'site_sanchez'`.
- **Comportamento:** Mesmo `site_appointment_id` → retorna registro existente com `idempotent: true` (HTTP 201 se active, 200 se cancelled/rescheduled).
- **Escopo:** Por `tenant_id` + `external_source` + `external_id` (índice único SQL:70-73).
- **Cancel/Reschedule:** Usam a mesma chave para localizar o agendamento original (SQL:162-165). Se não encontrado, retorna `not_found: true` (não é erro).

---

## 8. Fluxo Cancelamento / Reagendamento (2-Fase)

> **O Site deve enviar DUAS requisições separadas:**

1. **Cancelar o agendamento antigo**
   ```json
   {
     "status": "cancelled",
     "site_appointment_id": "id-do-agendamento-antigo",
     "external_id": "id-do-agendamento-antigo",  // opcional, auxílio
     "client_name": "...",  // obrigatório pelo RPC
     "service_id": "...",   // obrigatório pelo RPC
     "professional_id": "...", // obrigatório pelo RPC
     "scheduled_at": "...", // obrigatório pelo RPC
     ...
   }
   ```
   - Retorna `200` + `not_found: true` se já cancelado/inexistente.

2. **Criar o novo agendamento (se reagendamento)**
   ```json
   {
     "status": "active",
     "site_appointment_id": "id-do-novo-agendamento",  // NOVA chave de idempotência
     "client_name": "...",
     "phone": "...",
     "service_id": "...",
     "professional_id": "...",
     "scheduled_at": "nova-data-futura",
     ...
   }
   ```
   - Retorna `201` (novo) ou `201` + `idempotent: true` se reenvio.

> **GAP (G1):** O RPC **exige payload completo** mesmo para cancelamento (client_name, service_id, professional_id, scheduled_at). Relaxar isso exigiria **migração futura + gate independente**. Não tente contornar no Edge.

---

## 9. Autenticação

### Método 1: Bearer Token
```
Authorization: Bearer {SANCHEZ_WEBHOOK_SECRET}
```
- Segredo configurado na Edge Function via `Deno.env.get('SANCHEZ_WEBHOOK_SECRET')`.
- Comparação *timing-safe*.

### Método 2: HMAC-SHA256
```
X-Sanchez-Signature: sha256=<hex(hmac_sha256(webhook_secret, raw_body))>
```
- Assinatura do **corpo bruto (raw body)** — não do JSON parseado.
- Prefixo `sha256=` **case-insensitive**.
- Comparação *timing-safe*.

> **Ordem de verificação:** Bearer primeiro; se não presente ou inválido, tenta HMAC. Um dos dois deve passar.

---

## 10. Configuração da Edge Function (Environment Variables)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SANCHEZ_TENANT_ID` | Sim | UUID do tenant Sanchez no SMG |
| `SANCHEZ_WEBHOOK_SECRET` | Sim | Segredo compartilhado para auth |
| `SANCHEZ_DOMAIN_SCHEMA` | Não (default `public`) | Schema de domínio: `public` ou `barber` |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role key para chamar RPC |
| `SANCHEZ_ALLOWED_ORIGIN` | Não | Origin permitido para CORS (se omitido, `*`) |

---

## 11. RPC — `create_site_sanchez_appointment`

**Arquivo:** `supabase/migrations/20260426000000_site_sanchez_appointments.sql` (linhas 79-374)

**Assinatura:**
```sql
create_site_sanchez_appointment(
  p_tenant_id UUID,
  p_client_name TEXT,
  p_phone TEXT,
  p_service_id UUID,
  p_professional_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL,
  p_domain_schema TEXT DEFAULT 'public',
  p_status TEXT DEFAULT 'active',
  p_site_appointment_id TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL
) RETURNS JSONB
```

**Principais comportamentos (fonte de verdade):**
- Validações incondicionais: linhas 129-143
- `phone` condicional: linha 145-147
- Cancel/Reschedule branch: linhas 153-199 (retorna `not_found` em 181-190)
- Advisory lock por tenant+profissional: linhas 149-151
- Idempotência por `site_appointment_id` → `external_id`: linhas 266-287
- Conflito de horário (tstzrange): linhas 289-311 → `23P01`
- Grants: apenas `service_role` (linhas 367-370)

> **NUNCA edite esta migration.** É gate de DB independente.

---

## 12. Arquitetura do Código (SMG Side)

```
supabase/functions/site-sanchez-appointments/
├── index.ts      # Deno.serve + env wiring + Supabase RPC call (APENAS I/O)
└── contract.ts   # Lógica pura: validatePayload, verifyRequestAuth, buildSuccessResponse, buildErrorResponse, getRpcErrorStatus
```

### Princípios (A4 — Extract Pure Logic)

- **`contract.ts`**: Zero APIs Deno (`Deno.*`, `Deno.env`, etc.). Crypto via `globalThis.crypto` (disponível em Deno + Node ≥18). Importável por vitest.
- **`index.ts`**: Apenas orquestração — lê env, chama `verifyRequestAuth`, `validatePayload`, RPC Supabase, `buildSuccessResponse`/`buildErrorResponse`, retorna `Response`.
- **Refatoração mínima** — não redesenhar, apenas extrair.

---

## 13. Testes de Contrato (A5)

**Arquivo:** `src/test/site-sanchez-contract.test.ts` (vitest)

### Cenários Cobertos

| Categoria | Testes |
|-----------|--------|
| Payload válido active | ✅ Passa |
| `scheduled_at` passado + active | ❌ Rejeitado |
| `scheduled_at` passado + cancelled | ✅ Aceito (A1) |
| `scheduled_at` passado + rescheduled | ✅ Aceito (A1) |
| `phone` ausente + active | ❌ Rejeitado |
| `phone` ausente + cancelled | ✅ Aceito |
| `service_id` não-UUID | ❌ Rejeitado |
| `client_name` 121 chars | ❌ Rejeitado |
| `notes` 501 chars | ❌ Rejeitado |
| Sucesso inclui `idempotent`/`not_found` | ✅ Passthrough (A2) |
| RPC 400 inclui `details[]` | ✅ Envelope consistency (A3) |
| Bearer secret válido/inválido | ✅ |
| HMAC signature válido/inválido | ✅ |

> **Execução:** `npm test` (vitest roda todos os `*.test.ts` em `src/`, `application/`, `domain/`, `tests/` exceto `tests/e2e/**` e `tests/homologation/**`).

---

## 14. GAPs Conhecidos (Não Endereçados na Fase 1)

| ID | Descrição | Classificação | Ação Necessária |
|----|-----------|---------------|-----------------|
| **G1** | RPC exige payload completo (client_name, service_id, professional_id, scheduled_at) mesmo para cancelamento. Relaxar precisa migração + gate independente. | **FATO** (SQL:129-135, 153-179) | Futura ADR + migração |
| **G2** | Edge Function **NÃO deployada em produção** (evidência H7, `docs/audit/H7_B_TRILHO_B_P1_P4_READONLY_RELATORIO.md:179`). | **FATO** | Deploy requer autorização PO |
| **G3** | Webhook inbound `api/smg/appointments.js` no lado Site **nunca chamado pelo SMG** — sincronização é **unidirecional Site→SMG** apenas. | **FATO** (grep nos dois repositórios 2026-09-28: zero chamadores inbound no SMG e no Site; ressalva: consumidores externos fora dos dois repos — validar com o time do Site) | Limitação declarada pelo PO (2026-09-28); evolução bidirecional = decisão futura |
| **G4** | Tenant da integração hardcoded nos scripts e exigido pelo RPC: `b716e290-f7f6-4449-b790-5ae9dcdadcab` (D-8). Questão "tenant correto para prod?" **respondida**: é o tenant de produção. | **FATO** (evidência PROD 2026-09-27: "Barbearia Principal", slug `sanchez`, único candidato ativo; 18 services / 7 staff / 2040 appointments; staff map 2/2) | Checklist H7 (distribuição dos 22 serviços + realinhamento do `SMG_SERVICE_ID_MAP`) |

> **Legenda:** **FATO** = evidência direta no código/docs; **HIPÓTESE** = inferência, precisa validação.

---

## 15. Checklist de Implementação (Fase 1 — DEC-001)

- [x] **A1** — `scheduled_at` future-check apenas para `status=active` (`contract.ts:107-109`)
- [x] **A2** — Forward `idempotent` e `not_found` do RPC no envelope de sucesso (`contract.ts:147-156`)
- [x] **A3** — RPC 400 errors incluem `details: [message]` (`index.ts:118-120`)
- [x] **A4** — Lógica pura extraída para `contract.ts` (sem `Deno.*`, crypto via `globalThis.crypto`)
- [x] **A5** — Testes vitest em `src/test/site-sanchez-contract.test.ts` (todos passando)
- [x] **A6** — Este documento (`docs/integrations/SITE-SANCHEZ-CONTRACT.md`)
- [x] `npm test` verde (suite completa 412+ testes)
- [x] `npm run typecheck` verde
- [ ] **NÃO** commit, **NÃO** push, **NÃO** deploy, **NÃO** migration (fase posterior, gated)

---

## 16. Referências

- **RPC Migration:** `supabase/migrations/20260426000000_site_sanchez_appointments.sql`
- **Edge Function (antes):** `supabase/functions/site-sanchez-appointments/index.ts` (294 linhas, tudo inline)
- **Edge Function (depois):** `index.ts` (orchestration) + `contract.ts` (pure logic)
- **Testes:** `src/test/site-sanchez-contract.test.ts`
- **Evidência H7 (não deployado):** `docs/audit/H7_B_TRILHO_B_P1_P4_READONLY_RELATORIO.md:179`
- **ADR Relacionado:** ADR-001 (Commission vs Settlement — não aplicável aqui, mas padrão de separação de domínios)

---

## 17. Controle de Versão do Contrato

| Versão | Data | Autor | Mudança |
|--------|------|-------|---------|
| 1.0 | 2026-09-27 | SMG Platform Team | Contrato inicial canônico v1 (DEC-001 Fase 1) |

> **Regra:** Qualquer alteração neste contrato **exige nova versão + ADR + aprovação PO**. Ambos os lados (Site e SMG) devem sincronizar na mesma versão.
