# TD-001 · B3.4-H — Certificação da Baseline `78cf2bc` em Produção

> **Data:** 2026-08-25
> **Autorização:** PO (Augusto) — certificação autorizada na sessão, formato de registro mandatório
> **Natureza:** Gate de validação/certificação funcional — **zero código, migration, RLS, RPC ou variável de ambiente alterados**
> **Evidências anteriores:** `TD001_POST_DEPLOY_AUDIT.md`, `TD001_B3_4_EXECUTION_MATRIX.md`, `SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md`

---

## 1. Registro Oficial de Certificação (formato PO)

```
78cf2bc — CERTIFIED BASELINE
Status: 🟢 Certificada
Comissão/financeiro: 🟢 Validado
Reversão: 🟢 Validada
Multi-tenant: 🟢 Validado
Checkout/responsável: 🔴 Known issue / backlog prioritário
Próxima intervenção: Trilha B em branch separada
```

---

## 2. Baseline e Deployment

| Item | Valor |
|------|-------|
| Commit certificado | `78cf2bc2d7eab0363c7f6f907b744711888463d2` (`78cf2bc`) |
| Branch | `fix/commission-financial-base` |
| Escopo promovido | `fb5403a..78cf2bc` = 17 commits, incluindo SUT financeiro real (não test-only): repos/RPCs de `commission_records`, handlers FinanceProvider, FinanceStrategy default, wiring de event infrastructure |
| Deployment | `dpl_9WLpjBn255FQBA3w69znaPwtWwd2` — READY, `aliasAssigned=True` |
| Domínio | `barber.soumanager.com` (+ `smg-barber.vercel.app` e aliases) |
| Bundle produção | `index-DNRUgLjd.js`; lazy chunk `reversal-3y1tVUC_.js` contém `finance_reverse_transaction` |
| Marcadores confirmados | `create_commission_record` (×3), `commission_records` (×6), `CheckoutReverted` (×5), `processed_operations`; `CommissionCalculated` ausente (correto — CommissionSubscriber não registrado, decisão B3.4-G commission-only) |
| Tag criada | `v1.4.4-commission-reversal-certified` (anotada, apontando para `78cf2bc`) |
| Banco remoto | `ushsnmlbeurfvlkieiln` — acesso **somente leitura** (service role, consultas REST GET agregadas) |

---

## 3. Ciclo #1 — Falha do ciclo (inconclusivo para o produto)

Cenário: checkout de comanda R$ 15,00 com responsável exibido como primeira conta (perfil de homologação).

| Etapa | Resultado |
|-------|-----------|
| Comanda `58ddb28e…` | `status=paid`, R$ 15,00 ✅ |
| Transações | income + expense (`full_refund`) íntegras; estorno via Cashflow OK ✅ |
| Item persistido | `staff_id=''` ❌ — a UI exibia a primeira conta, mas o valor persistido foi vazio |
| Comissão | Nenhum registro gerado |

**Cadeia de causa raiz (confirmada em código, sem alteração):**

1. `pages/Checkout.tsx:948` — default `staff_id: staff.length > 0 ? staff[0].id : ''` (primeira conta como padrão visual);
2. `application/checkout.ts:706` — `staffId: req.cart[0]?.staff_id` propagou string vazia;
3. `domain/events/subscribers/defaultFinanceStrategy.ts:86` — guard `if (staffId && total > 0)` falhou → nenhuma operação enfileirada (skip **por design**, sem risco de pagamento indevido).

**Classificação:** FAIL do ciclo #1, inconclusive para o produto. O comportamento de skip é seguro (nunca paga comissão sem responsável identificado); o defeito está na persistência da atribuição, não no pipeline financeiro.

---

## 4. Ciclo #2 — PASS WITH REVERSAL (validação completa)

Cenário dirigido pelo PO: tenant real Sanchez Barber, profissional com taxa 50%, serviço R$ 15,00, conferência visual do formulário antes de confirmar.

### Identificadores

| Entidade | ID | Detalhe |
|----------|----|---------|
| Tenant | `b716e290-f7f6-4449-b790-5ae9dcdadcab` | Barbearia Principal / Sanchez Barber |
| Profissional | `62ddf002-5c05-49fa-8ff3-6d67fa82c562` | HERON FERREIRA — barber, taxa 50%, ativo |
| Serviço | `c4158ce4-f848-43b7-8fb1-84ef894048fe` | "Penteado" — R$ 15,00 |

### Cadeia validada (horários UTC, 2026-08-25)

| # | Verificação | Evidência | Status |
|---|-------------|-----------|--------|
| 1 | Comanda paga | `f859260a…` — `status=paid`, R$ 15,00 @ 23:22:14 | ✅ |
| 2 | Item persiste responsável | item `9eebd45e…` com `staff_id` = HERON | ✅ |
| 3 | Participante primário | percentage 100, `affects_commission=true` | ✅ |
| 4 | Comissão calculada | `commission_records` **+R$ 7,50** @ 23:22:24 (matemática exata: 15 × 50%) | ✅ |
| 5 | Idempotência | `processed_operations` `create_commission_record` 1:1, chave única, sem duplicidade | ✅ |
| 6 | Reversão auditada | registro **−R$ 7,50** @ 23:24:33 vinculado ao original `87070fc8…` + operação `reverse_commission` | ✅ |
| 7 | Líquido do ciclo | **R$ 0,00** (par +7,50 / −7,50) | ✅ |
| 8 | Transações | income → expense (`full_refund`) espelhando a reversão | ✅ |
| 9 | Multi-tenant | nenhum registro fora do tenant `b716e290…` | ✅ |

---

## 5. Repetibilidade e integridade do ledger

Além do ciclo dirigido, a janela de validação produziu 6 registros positivos adicionais reais (22:55–22:59 UTC), todos do profissional HERON:

| created_at (UTC) | Tipo | Valor |
|------------------|------|-------|
| 22:55:54 | commission | R$ 20,00 |
| 22:56:31 | commission | R$ 20,00 |
| 22:57:11 | commission | R$ 22,50 |
| 22:58:03 | commission | R$ 25,00 |
| 22:58:39 | commission | R$ 20,00 |
| 22:59:28 | commission | R$ 22,50 |
| 23:22:24 | commission (ciclo #2) | R$ 7,50 |
| 23:24:33 | reversal (ciclo #2) | −R$ 7,50 |

**Consolidado do ledger (`commission_records`, produção):**

- Total: 8 registros (7 positivos + 1 reversão) — líquido **R$ 130,00**
- Duplicidades de idempotência: **0**
- Registros cross-tenant: **0**
- Correspondência com `processed_operations`: **1:1** (8 operações)
- Schema legado `barber.commission_records`: 404/PGRST205 (esperado — tabela única em `public`)

---

## 6. Known Issue — atribuição de responsável no checkout (Trilha B)

- **Sintoma:** o campo Responsável do checkout pode exibir um profissional (ex.: primeira conta) enquanto `comanda_items.staff_id` é persistido vazio, quando o valor não é explicitamente re-selecionado.
- **Impacto:** comissão é corretamente *skipada* (guard `if (staffId && total > 0)`) — não há pagamento indevido; o risco é perda/sub-pagamento de comissão e divergência entre UI e persistência.
- **Âncoras:** `pages/Checkout.tsx:948` · `application/checkout.ts:706` · `defaultFinanceStrategy.ts:86`.
- **Especificação acordada com o PO (Trilha B, branch separada):**
  1. Inspecionar a região do `staff[0]` em `Checkout.tsx`;
  2. Rastrear a origem do estado até a divergência;
  3. Mapear a cadeia seleção → estado React → payload → persistência → reload;
  4. Corrigir apenas essa cadeia — **sem tocar no pipeline financeiro**;
  5. Teste de regressão: selecionar → persistir → reler → comparar `staff_id`;
  6. Validar tenant, build/tsc/diff-check; preview antes de produção.

---

## 7. Decisão do PO sobre os R$ 130,00

Os 6 registros positivos das 22:55–22:59 UTC são **dados reais de produção e permanecem preservados** (decisão: manter). Caso futuramente sejam identificados como não-comerciais, o estorno deverá ser executado **exclusivamente pela UI** (Cashflow → Estorno/devolução auditada), nunca por escrita direta no banco.

---

## 8. Gates técnicos e restrições respeitadas

- Build de produção: PASS
- Typecheck: 130 erros legados, delta 0 (baseline congelada)
- `git diff --check`: limpo
- Zero alterações de código, migration, RLS, RPC ou env durante o gate
- Banco remoto acessado somente em modo leitura (REST GET com service role; nenhuma escrita)

## 9. Encerramento

- Tag anotada `v1.4.4-commission-reversal-certified` criada sobre `78cf2bc`
- `ROADMAP.md` (entrada 8.30) e `PROJECT_STATUS.md` atualizados
- Próxima intervenção autorizada: **Trilha B** (checkout/responsável) em branch separada
