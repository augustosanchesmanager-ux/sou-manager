# H-3 — Chef Club: Regras de Plano Respeitadas (evidência)

> **Gate:** H-3 Chef Club (regras de plano — H3-3)
> **Data:** 2026-08-13
> **Ambiente:** frontend local (`localhost:3000`, `npm run dev`) contra o banco real `ushsnmlbeurfvlkieiln` (tenant Sanchez Barber — `b716e290-f7f6-4449-b790-5ae9dcdadcab`)
> **Responsável:** OpenCode (Tech Lead operacional)
> **Método:** E2E funcional via Playwright (Chromium) com a conta de homologação `homolog.sanchez@barber.soumanager.com` (manager)

---

## 1. Objetivo

Provar que as **regras vigentes do plano Chef Club são respeitadas no checkout**:

1. Serviço **coberto** pelo plano → crédito **oferecido** (modal de sugestão);
2. Serviço **não coberto** pelo plano → crédito **NÃO oferecido**, serviço entra a **preço cheio**;
3. Nenhum crédito é aplicado em serviço não coberto ("Aplicados nesta comanda: 0");
4. Nenhum erro de console/HTTP no fluxo.

---

## 2. Plano e regras de referência

**Plano CHEFE EXECUTIVO** (`customer_plan_benefits`) — cobertura exclusiva de 2 serviços:

| Serviço | Preço | Créditos do plano |
|---------|-------|-------------------|
| CORTE SIMPLES (`91b9f1f2...`) | R$ 45,00 | 4 |
| HIDRATAÇÃO (`521cd2ba...`) | R$ 25,00 | 1 |

**Serviços NÃO cobertos** (exemplos usados no teste): BARBA (R$ 35,00) e CORTE + BARBA (R$ 70,00).

**Créditos do cliente no momento do teste:** `available=4` (CORTE 3 + HIDRATAÇÃO 1) — pós-consumo do H3-2.

---

## 3. Execução

### 3.1 Cenário A — serviço NÃO coberto (CORTE + BARBA, R$ 70,00)

1. Login com a conta de homologação;
2. Checkout → seleção do cliente **HOMOLOG H3 TESTE 2026-08-11** (banner "Club dos Chefes - CHEFE EXECUTIVO" visível);
3. Adição do serviço **CORTE + BARBA** (não coberto pelo plano);

| Verificação | Resultado |
|-------------|-----------|
| Modal de sugestão de crédito ("Aplicar crédito") | ❌ **NÃO exibido** (esperado: não exibido) |
| Tag "Usando Crédito" no item | ❌ **Nenhuma** (esperado: nenhuma) |
| Total do carrinho | **R$ 70,00 — preço cheio, sem desconto** |
| Banner do plano | **"Aplicados nesta comanda: 0 / 4 Disponíveis"** |

### 3.2 Cenário B — serviço COBERTO (HIDRATAÇÃO, R$ 25,00)

| Verificação | Resultado |
|-------------|-----------|
| Modal de sugestão de crédito ("Aplicar crédito") | ✅ **Exibido** (esperado: exibido — 1 crédito disponível) |

---

## 4. Console / HTTP

| Métrica | Contagem |
|---------|----------|
| Erros de console (tipo `error`) | 0 |
| Respostas HTTP ≥ 400 | 0 |
| Avisos de console (tipo `warning`) | 5 — `src=""` (avatares sem foto) — **cosmético, P3** (mesmo achado do H3-2) |

---

## 5. Conclusão

As **regras vigentes do plano CHEFE EXECUTIVO são respeitadas no checkout**:

- ✅ Serviço não coberto → crédito NÃO oferecido, serviço a preço cheio, nenhum crédito aplicado;
- ✅ Serviço coberto com crédito disponível → modal de sugestão de crédito exibido;
- ✅ Consistência do banner (créditos disponíveis refletem o saldo real pós-H3-2);
- ✅ 0 erros de console e 0 erros HTTP.

**Nenhuma comanda foi finalizada neste teste** — sem alteração de dados no banco real além do saldo já consumido no H3-2.
