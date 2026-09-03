# H-7 — Operação Real: Baseline Read-Only do Tenant Sanchez Barber

> **Data:** 2026-08-16 (domingo), janela ~20:25–20:35 (horário local).
> **Ambiente:** Supabase produção `ushsnmlbeurfvlkieiln` (projeto `smg-barber`), schema `public`.
> **Método:** consultas **read-only** via `supabase db query --linked -o json` (login role via pooler). **Nenhuma escrita, DDL, DML ou mutação remota.**
> **Escopo:** Fase 1 da janela H-7 (D-HOM-27) — **apenas baseline**. Nenhuma operação de escrita foi executada.
> **Referência:** `docs/audit/SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` (2026-08-08) · `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` §4.

---

## 1. Identificação do tenant

| Campo | Valor |
|-------|-------|
| `tenants.id` | `b716e290-f7f6-4449-b790-5ae9dcdadcab` |
| `tenants.name` | Barbearia Principal |
| `tenants.slug` | `sanchez` |
| `tenants.plan` | `pro` |
| `tenants.status` | `active` |
| `tenants.updated_at` | 2026-08-08 12:07:52+00 |

> Tenant **LIVE** — contagens são instantâneas e variam com a operação. Comparação abaixo com o snapshot de 2026-08-08 apenas para contexto de tendência; **não há critério de "igualdade" rígido** (o snapshot §3 admite variação por operação live).

---

## 2. Baseline B1–B10 (2026-08-16) × Snapshot (2026-08-08)

| # | Domínio | Snapshot 08-08 | Baseline 08-16 | Δ | Nota |
|---|---------|---------------:|---------------:|---:|------|
| B1 | `clients` | 293 | **302** | +9 | operação live |
| B2 | `services` | 17 | **17** | 0 | |
| B2 | `products` | 18 | **18** | 0 | |
| B3 | `appointments` | 1.361 | **1.447** | +86 | operação live |
| B4 | `comandas` | 1.294 | **1.384** | +90 | operação live |
| B5 | `transactions` | 705 | **736** | +31 | operação live |
| B6 | `customer_credits` (linhas) | 15 | **16** | +1 | 14 ativas / 2 canceladas |
| B6 | créditos disponíveis (ativas) | 69 | **77** | +8 | `available_credits` |
| B6 | créditos usados (ativas) | — | **3** | — | `used_credits` |
| B7 | `products` ativos / estoque | 18 / — | **18 / 68** | — | `stock_quantity` somado |
| B8 | `cash_closings` | 3 (`draft`) | **3 (`draft`)** | 0 | nenhum confirmado |
| B8 | `barber_closings` | 0 | **0** | 0 | fluxo 6.0.4 sem dados |
| B9 | participantes | 350 | **377** | +27 | primário/assistente |
| B10 | receivables | 43 | **47** | +4 | ver §4 |

---

## 3. B9 — Comissões (dados-fonte, participantes por staff)

| Staff | Participações |
|-------|--------------:|
| RUBENS SANCHEZ | 174 |
| HERON FERREIRA | 174 |
| LUCAS GONÇALVES DA SILVA | 21 |
| Conta Homologacao v1.5 | 6 |
| (demais) | 2 |
| **Total** | **377** |

---

## 4. B10 / S3 — Recebíveis Chef Club (quadratura a conferir no H-7)

| Status | Qtd | Valor |
|--------|----:|------:|
| `paid` | 30 | R$ 6.440,00 |
| `overdue` | **10** | **R$ 2.340,00** |
| `pending` | **7** | **R$ 1.360,00** |
| **Total** | **47** | **R$ 10.140,00** |

> **S3 (do snapshot):** 10 `overdue` + 6 `pending` → hoje **10 `overdue` + 7 `pending`** (+1 `pending` desde o snapshot).
>
> **🔴 Achado S3-1 (P1) — investigação read-only (2026-08-16):** o receivable `overdue` de **RIOS - AMIGO** (ciclo 2026-06-15, R$ 260,00, `d561a4c3…`) é **duplicado** de um receivable **já pago** (`0c1ee064…`, pago 06-06, tx `cb41ed2c`) — mesmo `billing_cycle_start`, `billing_cycle_end` divergente (08-14 vs 07-15) → `ON CONFLICT` não disparou. **S3 inflado em R$ 260,00** (sem impacto de caixa). Registro e análise completos: `docs/audit/H7_1_INVESTIGACAO_S3_READONLY_20260816.md`. **Sem correção — decisão de tratamento = PO.**

---

## 5. B8 — Cash closings (detalhe)

| ID | Business date | Status | Expected balance | Total counted | Confirmado |
|----|---------------|--------|-----------------:|--------------:|------------|
| `f5747c55-…` | 2026-05-11 | `draft` | -1.797,50 | 0 | não |
| `d7b6025d-…` | 2026-05-12 | `draft` | 675,00 | 0 | não |
| `0f8c881c-…` | 2026-08-06 | `draft` | 0,00 | 0 | não |

> Nenhum fechamento formalizado ainda — **o H-7 exercitará o fechamento profissional + fechamento de caixa** (parte do ciclo H7-1).

---

## 6. B7 — Estoque relevante (produtos ativos com estoque)

Total: **18 produtos ativos, 68 unidades** em estoque (`stock_quantity`). Destaques (para controle do ciclo H7-1): Balm creme 2 · Balm Vidro 3 · GEL FIXADOR 4 · GEL PREMIUM 9 · Kit shamp. cond.G10 1+1 · LAQUE ISACARE 2+4 · MINOXIDIL DOM PELO 6 · etc.

---

## 7. Integridade / Veredito da fase baseline

- **Nenhuma escrita executada** — 100% das consultas foram `SELECT` read-only.
- Contagens coerentes com operação live (aumentos naturais entre 08-08 e 08-16).
- **Aguardando a janela acompanhada** (dia/horário + equipe) definida pelo PO para executar a **Fase 2 — Ciclo H7-1** (única fase com operações de escrita de teste, identificáveis como homologação).
- Estado do gate permanece: **H-6 🟢 → H-7 ⏳ (baseline pronto) → H-8 🔴**.

---

## 8. BASELINE OFICIAL DA JANELA H-7 — SNAPSHOT 2026-09-02 08:24

> **Decisão do PO (2026-09-02):** o snapshot **09-02 08:24** passa a ser o **baseline oficial desta janela H-7** (substituindo o 08-16 como referência operacional do ciclo). O 08-16 permanece como **evidência histórica**. Quadratura pós-ciclo deve utilizar este baseline e o **schema atual (FASE 6)**.
> **Modo:** read-only via Management API · **Tenant:** Sanchez Barber `b716e290-f7f6-4449-b790-5ae9dcdadcab` · **Produção:** `ushsnmlbeurfvlkieiln` · **Schema vigente:** comissões em `commission_records`, participantes em `service_execution_participants`, pagamentos em `comanda_payments`.

### 8.1 Contagens B1–B10 (09-02 08:24)

| # | Domínio | 08-16 (histórico) | **09-02 (oficial)** | Δ | Nota |
|---|---------|------------------:|--------------------:|---:|------|
| B1 | `clients` | 302 | **338** | +36 | operação live |
| B2 | `services` | 17 | **17** | 0 | |
| B2 | `products` | 18 (estoque 68) | **18 (estoque 68)** | 0 | |
| B3 | `appointments` | 1.447 | **1.707** | +260 | operação live |
| B4 | `comandas` | 1.384 | **1.646** | +262 | operação live |
| B5 | `transactions` | 736 | **957** | +221 | operação live |
| B6 | `customer_credits` | 16 (77/3) | **18 (74 usadas 22)** | +2 | schema atual (`available_credits`/`used_credits`) |
| B8 | `cash_closings` | 3 draft | **1 confirmed + 5 draft** | — | `f1c5182f` (08-16, R$45) confirmed; drafts 08-20/08-25 |
| B8 | `barber_closings` | 0 | **1** | +1 | |
| B9 | `commission_records` | — (tabela antiga `commissions`) | **39** | — | schema FASE 6 |
| B9 | `service_execution_participants` | 377 (`participants`) | **545** | — | schema FASE 6 |
| B10 | receivables | 47 (30/10/7) | **63 (44 paid/R$9.470 · 7 overdue/R$1.600 · 11 pending/R$2.190 · 1 cancelled/R$260)** | +16 | |

### 8.2 S3-1 — reconciliação (FECHADO)

- **S3-1 (RIOS R$260)** = **FECHADO** — recevable duplicado `d561a4c3` cancelado conforme `H7_1_INVESTIGACAO_S3_READONLY_20260816.md` §8 (S3-4, 2026-08-16). **Reconciliado com o `notes` no banco** (`[S3-4] Cancelado em 2026-08-16 por OpenCode… Aprovado pelo PO`), `status=cancelled`, `updated_at=2026-08-17 00:33` (operação cruzou meia-noite). **Pendência financeira S3 removeu o fantasma de R$260.**
- **Decisão PO (2026-09-02):** S3-1 tratado como **RESOLVIDO OPERACIONALMENTE** — não reabrir, não cancelar novamente, não modificar `d561a4c3`, não remover o finding histórico. **Fora das ações operacionais da janela de hoje.**

### 8.3 Regras operacionais da janela (09-02)

- **Dados anteriores a 09-02 08:24 = pré-existentes** (não efeitos da janela).
- Nomes antigos `commissions`/`participants` **não são referência operacional** — usar `commission_records`/`service_execution_participants`.
- Registros a criar pelo ciclo H7-1 identificáveis com sufixo **"HOMOLOG H7"**.
- Critério de parada (D-HOM-27 §4) permanece vigente: qualquer divergência financeira/duplicidade/perda de crédito/comissão incorreta/alteração inesperada de saldo/quebra de fechamento = **PARAR imediatamente, registrar achado, apresentar ao PO** (sem correção no banco).

> **Estado H-7:** H-6 🟢 → **H-7 ⏳ (baseline 09-02 oficial pronto; janela acompanhada em execução com Rubens, 2026-09-02)** → H-8 🔴.
