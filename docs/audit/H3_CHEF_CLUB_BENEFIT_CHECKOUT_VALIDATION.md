# H-3 — Chef Club: Validação do Benefício no Checkout (evidência)

> **Gate:** H-3 Chef Club (benefício no checkout — H3-2)
> **Data:** 2026-08-13
> **Ambiente:** frontend local (`localhost:3000`, `npm run dev`) contra o banco real `ushsnmlbeurfvlkieiln` (tenant Sanchez Barber — `b716e290-f7f6-4449-b790-5ae9dcdadcab`)
> **Responsável:** OpenCode (Tech Lead operacional)
> **Método:** E2E funcional via Playwright (Chromium) com a conta de homologação `homolog.sanchez@barber.soumanager.com` (manager)

---

## 1. Objetivo

Provar o fluxo de **utilização do benefício Chef Club no checkout**:

1. Cliente assinante é reconhecido no checkout (banner do plano + créditos);
2. Serviço coberto pelo plano é elegível a crédito;
3. Crédito é **aplicado** (item zerado na comanda);
4. Fechamento usa origem `club_credit` (zero-close auditado — crédito não gera caixa);
5. Comanda fechada com `membership_credit_effect=true` e `payment_method="Club dos Chefes"`;
6. Crédito é debitado corretamente (exatamente 1, do serviço certo);
7. Nenhum erro de console/HTTP no fluxo.

---

## 2. Setup

| Item | Valor |
|------|-------|
| Conta | `homolog.sanchez@barber.soumanager.com` (manager, tenant `b716e290...`) |
| Cliente | **HOMOLOG H3 TESTE 2026-08-11** (`394dc685-aa85-4b0b-9aeb-ecf47719405b`) |
| Subscription | `7b92c958-486c-4ba7-932f-5f9cf76ac80a` (CHEFE EXECUTIVO, `active`) |
| Receivable do ciclo vigente | pago (`8b1cdee8-...`, 2026-08-11 a 2026-09-10) |
| Créditos no baseline (pré-teste) | `available=5` · `used=0` · CORTE SIMPLES 4/0 · HIDRATAÇÃO 1/0 |
| Serviço no checkout | CORTE SIMPLES (`91b9f1f2-...`) — coberto pelo plano (4 créditos) |

---

## 3. Execução (passo a passo do E2E)

1. **Login** com a conta de homologação → `/dashboard` (sem redirect indevido);
2. Navegação para `/#/checkout`;
3. **Seleção do cliente** via modal "Buscar cliente..." → HOMOLOG H3 TESTE 2026-08-11;
   - Badge "Cliente selecionado" ✅
4. **Banner do benefício** visível: "Club dos Chefes - CHEFE EXECUTIVO / Cliente possui créditos disponíveis para resgate / Aplicados nesta comanda: 0 / 5 Disponíveis" ✅
5. **Adição do serviço** CORTE SIMPLES;
   - **Modal de sugestão de crédito** exibido ("Cliente assinante com crédito disponível. Use 1 crédito do Club dos Chefes para zerar este serviço na comanda.")
6. Clique em **"Aplicar crédito"** → item entra no carrinho com crédito;
   - Banner atualiza: "Aplicados nesta comanda: 1" ✅
7. **Fechamento zero auditado** — selecionada origem **"Pagamento via Club dos Chefes"** (`club_credit`);
8. Clique em **"Concluir venda"** → navega para `/operation-success` (**"Comanda Finalizada"**) ✅

### Observação de UI

Há **dois botões "Concluir venda"** (header e painel de pagamento). O clique no botão do **painel de pagamento** (último) é o que dispara o `handleFinish` corretamente.

---

## 4. Reflexo no banco real

### 4.1 Comanda criada

| Campo | Valor |
|-------|-------|
| `id` | `80c94c1a-48cb-4b13-af98-a2a114e8851b` |
| `client_id` | `394dc685-...` (HOMOLOG H3 TESTE 2026-08-11) |
| `status` | `paid` |
| `closure_mode` | `standard` |
| `membership_credit_effect` | `true` |
| `payment_method` | `Club dos Chefes` |
| `total` | `0` |
| `closed_at` | 2026-08-13T19:00:36Z |
| `closure_note` | `{"zero_close_origin":"club_credit","zero_close_reason":"Crédito do Club dos Chefes consumido no checkout: 1 serviço(s).","authorized_by":"189053ab...","source":"checkout"}` |

### 4.2 Créditos debitados

| Item | Antes | Depois |
|------|-------|--------|
| `available_credits` | 5 | **4** |
| `used_credits` | 0 | **1** |
| CORTE SIMPLES (available/used) | 4/0 | **3/1** |
| HIDRATAÇÃO (available/used) | 1/0 | 1/0 (inalterado) |

**Consumo confirmado: exatamente 1 crédito, do serviço correto (CORTE SIMPLES).**

### 4.3 Reflexo financeiro

`transactions` por comanda: **0** e por cliente: **0** — correto. Crédito do Clube não gera entrada de caixa (ADR-001: benefício consumido ≠ receita nova).

---

## 5. Console / HTTP

| Métrica | Contagem |
|---------|----------|
| Erros de console (tipo `error`) | 0 |
| Respostas HTTP ≥ 400 | 0 |
| Avisos de console (tipo `warning`) | 5 — `An empty string ("") was passed to the %s attribute ... src` (avatares de cliente sem foto) — **cosmético, P3** |

---

## 6. Conclusão

O fluxo de **benefício Chef Club no checkout** está íntegro no banco real:

- ✅ Cliente assinante reconhecido (banner do plano + créditos disponíveis);
- ✅ Sugestão de crédito exibida para serviço coberto;
- ✅ Crédito aplicado na comanda (item zerado);
- ✅ Fechamento zero-close com origem `club_credit` (sem caixa);
- ✅ Comanda `paid` com `membership_credit_effect=true` e `payment_method="Club dos Chefes"`;
- ✅ Consumo de exatamente 1 crédito do serviço correto (5→4; CORTE 4→3);
- ✅ 0 erros de console e 0 erros HTTP no fluxo.

**Achado menor (P3, cosmético):** avisos de console `src=""` para avatares de cliente sem foto — sem impacto funcional.

**Dados de produção alterados:** 1 crédito consumido do cliente de validação (HOMOLOG H3 TESTE) na comanda `80c94c1a...`, dentro do escopo autorizado da homologação H-3.
