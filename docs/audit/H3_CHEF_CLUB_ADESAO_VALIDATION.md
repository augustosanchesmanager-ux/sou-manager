# H-3 — Chef Club: Validação da Adesão (evidência)

> **Gate:** H-3 Chef Club (adesão — H3-1)
> **Data:** 2026-08-13
> **Ambiente:** banco real `ushsnmlbeurfvlkieiln` (tenant Sanchez Barber — `b716e290-f7f6-4449-b790-5ae9dcdadcab`)
> **Responsável:** OpenCode (Tech Lead operacional)
> **Método:** SQL — execução da RPC canônica `create_chef_club_subscription` (a mesma chamada pela UI) dentro de transação com `ROLLBACK` (nada persistido)

---

## 1. Objetivo

Provar que o fluxo de adesão ao Chef Club cria a assinatura corretamente:

1. Assinatura **ativa** para o cliente;
2. **Ciclo vigente** (início/fim) e **próxima cobrança** coerentes;
3. **Plano correto** (o plano solicitado é o aplicado);
4. **Créditos correspondentes ao plano** (mapa de saldo por serviço espelha o plano);
5. Créditos disponíveis iniciam em **0** (entram após pagamento do recebível);
6. **Recebível do ciclo** criado automaticamente.

---

## 2. Setup

| Item | Valor |
|------|-------|
| Tenant | `b716e290-f7f6-4449-b790-5ae9dcdadcab` (Barbearia Principal / `sanchez`, plano `pro`) |
| Cliente | criado ad-hoc na transação: **HOMOLOG H3-1 ADESÃO 2026-08-13** (`3d33ae53-1597-4585-8c81-1be71aef4032`) |
| Plano | CHEFE EXECUTIVO (`87f35175-d12b-4ada-a211-81ca9a4e81cc`) — esperado: 4 CORTE SIMPLES + 1 HIDRATAÇÃO |
| Próxima cobrança | `2026-09-13` |
| `p_replace_existing` | `false` |

---

## 3. Execução — RPC `create_chef_club_subscription`

```sql
SELECT public.create_chef_club_subscription(
  p_tenant_id         => 'b716e290-f7f6-4449-b790-5ae9dcdadcab',
  p_client_id         => '<client HOMOLOG H3-1 ADESÃO>',
  p_plan_id           => '87f35175-d12b-4ada-a211-81ca9a4e81cc',
  p_next_billing_date => DATE '2026-09-13',
  p_replace_existing  => false
);
```

Tudo dentro de `BEGIN; ... ROLLBACK;` — **nenhum dado persistido** no banco real.

---

## 4. Resultado (evidência da execução)

| Verificação | Esperado | Obtido | ✅ |
|-------------|----------|--------|----|
| `subscription.status` | `active` | `active` | ✅ |
| `subscription.plan_id` | `87f35175-...` (CHEFE EXECUTIVO) | `87f35175-d12b-4ada-a211-81ca9a4e81cc` | ✅ |
| `cycle_start` | agora (2026-08-13) | `2026-08-13T18:36:46.971665+00:00` | ✅ |
| `cycle_end` | próxima cobrança + fim do dia (2026-09-13 12:00 UTC) | `2026-09-13T12:00:00+00:00` | ✅ |
| `next_billing_date` | `2026-09-13` | `2026-09-13` | ✅ |
| `credits.available_credits` | `0` (entram após pagamento) | `0` | ✅ |
| `credits.used_credits` | `0` | `0` | ✅ |
| `credits.service_balance_map` | espelha o plano (4 CORTE + 1 HIDRA, `available=0`) | CORTE SIMPLES `{available:0, used:0}`, HIDRATAÇÃO `{available:0, used:0}` | ✅ |
| Recebível do ciclo | criado | `f6af4d27-790c-414e-ba66-89921342541e` | ✅ |
| `client_id` | criado | `3d33ae53-1597-4585-8c81-1be71aef4032` | ✅ |
| `subscription_id` | gerado | `3968bc93-ade2-4e31-8b94-3dd3c41083f2` | ✅ |

---

## 5. Mapa de créditos do plano (definição de referência — `build_chef_club_service_balance_map`)

| Serviço | Créditos |
|---------|----------|
| CORTE SIMPLES (`91b9f1f2-...`) | 4 |
| HIDRATAÇÃO (`521cd2ba-...`) | 1 |
| **Total** | **5** |

O `service_balance_map` gravado na assinatura espelha exatamente este mapa (com `available` zerado até o pagamento do recebível).

---

## 6. Conclusão

O fluxo de adesão ao Chef Club está íntegro no banco real:

- ✅ Assinatura criada com `status=active`;
- ✅ Ciclo vigente coerente (start = agora; end = próxima cobrança 12:00 UTC);
- ✅ Plano correto aplicado (CHEFE EXECUTIVO);
- ✅ Créditos espelham o plano (4 CORTE + 1 HIDRA = 5), iniciando em `available=0`;
- ✅ Recebível do ciclo criado automaticamente (`ensure_club_receivable_for_cycle`).

**Nenhum dado de produção alterado** — a execução foi descartada com `ROLLBACK`. O cliente e a assinatura de validação existem apenas dentro da transação de teste.
