# Relatório de DRY-RUN e EXECUÇÃO — Regularização Financeira de Comandas em Aberto (até 31/07/2026)

**Status:** ✅ **EXECUTADA em PRODUÇÃO (2026-09-02)** — 354/354 baixas concluídas, validação pós-exec íntegra
**Tenant alvo:** Sanchez Barber (`b716e290-f7f6-4449-b790-5ae9dcdadcab`)
**Projeto (produção):** `ushsnmlbeurfvlkieiln`
**Data do relatório:** 2026-09-02
**Autor:** OpenCode (Tech Lead operacional) — execução autorizada e disparada pelo PO (conta `augustosanchesb@outlook.com`, role admin)

---

## 1. Objetivo

Regularizar financeiramente (quitar) as comandas **em aberto** do tenant Sanchez Barber com `created_at <= 31/07/2026`, registrando a receita via o mecanismo oficial do domínio.

## 2. Mecanismo de baixa (confirmado por leitura da produção)

**RPC:** `finance_settle_comanda(p_tenant_id, p_comanda_id, p_payment_method, p_paid_amount, p_payment_date_real, p_source, p_notes, p_idempotency_key)` — confirmado em produção (definição lida via `pg_get_functiondef`, idêntica à migration `20260514000001_finance_settle_comanda_rpc.sql`).

O que a RPC faz por comanda (atômico, SECURITY DEFINER, advisory lock `finance_settle_comanda:<tenant>:<comanda>` + `FOR UPDATE`):
- `UPDATE comandas` → `status='paid'`, `payment_method` (definido), `financial_effect=true`, `payment_date_real=p_payment_date_real`, `settled_at=now()`, `settled_by_user_id=<auth.uid()>`, `closed_at=p_payment_date_real`, `closure_mode` (se vazio → `standard`).
- `INSERT transactions` → `income`, category `Receita de Comanda`, `amount=p_paid_amount`, `payment_method`, `date=p_payment_date_real`, `status='paid'`, `source_type='comanda'`, `source_id`, `idempotency_key`, `metadata` (com `comanda_total`, `paid_amount`, `amount_difference`, `payment_date_real`, `settled_at`, `settled_by_user_id`, `notes`, `idempotency_key`).
- `UPDATE appointments` → `status='completed'` (se `appointment_id` presente e ainda não concluído).
- Idempotência: rejeita chave já usada; retorna `{idempotent:true}` na reexecução.

**Decisões do PO:** usar `finance_settle_comanda`; `p_payment_method='regularizacao'`; `p_source='regularizacao'`; `p_payment_date_real = created_at` da comanda (histórica); chave de idempotência `regularizacao-set-<comanda_id>`.

## 3. Universo analisado

Critério: tenant `b716e290...`, `status='open'`, `created_at <= '2026-07-31T23:59:59Z'`.

| Métrica | Valor |
|---|---|
| Comandas elegíveis (open até 31/07) | **357** |
| Soma dos `total` | R$ 18.755,00 |
| Comandas com saldo > 0 (a baixar) | **354** |
| Soma do saldo a baixar | **R$ 18.670,00** |
| Comandas com saldo ≤ 0 (excluídas) | **3** |
| Comandas sem cliente | 6 (incluídas na baixa) |
| Comandas sem `financial_effect` | 0 |
| `comanda_payments` existentes nas 357 | 0 |
| Transações `income` existentes nas 357 | 2 (casos especiais, excluídos) |
| Reversões/estornos nas 357 | 0 |

### Distribuição por mês (created_at → payment_date_real histórico)

| Mês | Valor a baixar |
|---|---|
| 2026-03 | R$ 45,00 |
| 2026-04 | R$ 45,00 |
| 2026-05 | R$ 3.310,00 |
| 2026-06 | R$ 9.295,00 |
| 2026-07 | R$ 5.975,00 |
| **Total** | **R$ 18.670,00** |

## 4. As 3 comandas EXCLUÍDAS da baixa (saldo ≤ 0)

Baixá-las por `finance_settle_comanda` com chave nova criaria **receita duplicada** (proibido). Tratamento: **excluir da baixa e zerar excesso** (decisão do PO).

| Comanda | Total | Já pago | Saldo | Situação |
|---|---|---|---|---|
| `d2845e32-a20c-47c7-9484-7992487c744b` | R$ 45,00 | R$ 45,00 | 0,00 | Já quitada de fato (transaction pix 15/05) com `status='open'`. Exceção financeira do saneamento H7.2. |
| `00f8d667-77ef-4f34-aa4b-c361ad457768` (BLESSED ALEMÃO) | R$ 40,00 | R$ 45,00 | -5,00 | Já quitada de fato, **pagou R$ 5,00 em excesso** (transaction pix 18/07). Excesso a zerar/estornar. |
| `ac5711a5-5b84-4081-b4c2-b77fd7a192be` | R$ 0,00 | R$ 0,00 | 0,00 | Total zero — nada a baixar. |

**⚠ Pendência do "zerar excesso":** para `00f8d667` (excesso de R$ 5,00) e para `d2845e32` (normalizar status sem duplicar receita), o caminho exato de correção **não está definido** e fica **fora do escopo desta baixa**. A RPC `finance_settle_comanda` não comporta quitação sem criar transaction. Necessária decisão posterior do PO (ex.: reversão/estorno do excesso via transaction `expense`, ou ajuste manual de status) — **não será executado agora**.

## 5. O que SERÁ alterado (plano de execução — 354 baixas)

Para **cada uma** das 354 comandas, `finance_settle_comanda` executará atomicamente:
1. `comandas`: status `open` → `paid`; `payment_method='regularizacao'`; `payment_date_real=created_at`; `settled_by_user_id=<usuário da sessão>`; `closed_at=created_at`; `financial_effect=true`.
2. `transactions`: +1 registro `income` `Receita de Comanda`, `amount=saldo`, `date=created_at`, `idempotency_key='regularizacao-set-<id>'`.
3. `appointments` (385→ conferido por comanda): `status → 'completed'` onde aplicável.

**Total projetado:**
- 354 UPDATE em `comandas`.
- 354 INSERT em `transactions` (total R$ 18.670,00).
- Até 354 UPDATE em `appointments` (para as comandas com appointment não concluído).
- 0 alterações em `comanda_payments`, `commission_records`, `customer_credits`, `customer_subscriptions` (esta RPC não toca essas tabelas).

**⚠ Impacto colateral a validar:** a RPC altera `appointments → completed`. Comissões e Chef Club NÃO são recalculados por esta RPC (fora do escopo do mecanismo). Se houver expectativa de comissão sobre estas comandas, isso **não** é gerado nesta operação e deve ser tratado à parte.

## 6. Requisito de execução (auth)

A RPC exige `auth.uid()` de papel de gestão (admin/manager/owner/superadmin). **`supabase db query --linked` (CLI) usa service_role e NÃO satisfaz `auth.uid()`** → falharia com "Usuário autenticado obrigatório".

**Único staff de gestão do tenant com `auth.users` correspondente:** AUGUSTO SANCHES (`1021f3d1-...`, admin, email `augustosanchesb@outlook.com`). RUBENS SANCHEZ e "Conta Homologacao" (managers) **não têm** `auth.users` → não podem autenticar.

**Caminho escolhido pelo PO:** **Via serviço/API autenticada** (autenticar o usuário admin e chamar cada RPC por PostgREST com `Authorization: Bearer <token>`). **Este executor ainda não está montado/validado nesta etapa.**

## 7. Artefatos gerados (todos read-only)

- `scripts/ops/regularizacao/dryrun-comandas-abertas-ate-2026-07-31.json` — 357 registros detalhados.
- `scripts/ops/regularizacao/baixa-354-comandas-DRY-RUN.sql` — 354 chamadas RPC (validadas: 354 SELECTs, 354 idempotency keys únicas, soma R$ 18.670,00).
- `scripts/ops/regularizacao/gerar-script-baixa.ps1` — gerador reproduzível.

## 8. Riscos e pontos de decisão pendentes

1. **Requisito de execução não resolvido:** executor "via serviço/API autenticada" precisa de infra (obter token de sessão do admin + chamar RPC por PostgREST). Definir concretamente antes de executar.
2. **"Zerar excesso" (3 comandas) fora do escopo:** caminho de estorno/normalização a decidir pelo PO em etapa separada.
3. **Appointments → completed:** impacto de mudar o status dos atendimentos; validar se desejado.
4. **Comissões:** esta RPC não gera comissão; confirmar se comissões das comandas regularizadas serão tratadas (fora do escopo).
5. **Data histórica:** receita alocada no `created_at` (período correto), alterando o diário de caixa retroativo — decisão do PO (confirmada: usar histórica).

## 9. PRÓXIMO PASSO — bloqueado

**Nenhuma escrita será executada até autorização explícita do PO** deste relatório + definição do executor autenticado. Aguardando aprovação.

---

## 10. ATUALIZAÇÃO — AUTORIZAÇÃO DO PO RECEBIDA (2026-09-02)

O PO **autorizou explicitamente** a execução das 354 baixas (R$ 18.670,00) com:
- mecanismo `finance_settle_comanda`; `payment_method='regularizacao'`; `source='regularizacao'`; `payment_date_real=created_at`; key `regularizacao-set-<comanda_id>`;
- appointments → `completed` autorizado; **NÃO gerar comissão**;
- 3 exceções (`d2845e32`, `00f8d667`, `ac5711a5`) permanecem FORA;
- **proibido**: service_role, SQL direto substituindo RPC, bypass RLS, impersonação, alteração da lógica de segurança.

### Pré-condições verificadas (read-only) — TODAS ATENDIDAS
1. ✅ `tenant_id = b716e290-f7f6-4449-b790-5ae9dcdadcab`.
2. ✅ Conjunto atual = DRY-RUN aprovado: **354 comandas** (query de paridade reexecutada, ids idênticas).
3. ✅ Total: **R$ 18.670,00**.
4. ✅ Idempotency keys únicas (354 únicas, 0 duplicatas).
5. ✅ Sem alteração do conjunto desde o DRY-RUN (nenhuma escrita feita).
6. ✅ Nenhuma das 3 exceções presente no conjunto das 354.

### BLOQUEIO DE EXECUÇÃO — autenticação real (regra de parada)
O mecanismo oficial `finance_settle_comanda` exige `auth.uid()` com permissão de gestão. O `supabase db query` (CLI) usa service_role e NÃO satisfaz `auth.uid()`. O único admin do tenant com `auth.users` é **AUGUSTO SANCHES** (`1021f3d1-...`, email `augustosanchesb@outlook.com`).

A autorização **proíbe impersonação, service_role e qualquer bypass de autenticação/RPC/RLS**. Portanto, o caminho de execução deve autenticar **de fato** como o Augusto (via Supabase Auth, `signInWithPassword` → `supabase.rpc('finance_settle_comanda', ...)` por comanda, idêntico ao `settleCheckoutComanda` do app).

Impedimento: **não possuo a senha do Augusto** e não devo solicitá-la/obtê-la inseguramente. **PARADO — aguardando o PO indicar como prover a sessão autenticada real** (ex.: o próprio Augusto autentica e dispara um script; fornecimento seguro de um token/sessão de curta duração; ou outro mecanismo 100% aderente à segurança). Nenhuma escrita foi feita.

### ATUALIZAÇÃO — OUTRO MODO ENCONTRADO (superadmin real)
Existe uma conta **superadmin humana ativa** com `auth.users`:
- **`adm.sanchezbarber@gmail.com`** — "Administrador", `id=828175b0-ac50-444f-bd90-51b9a399c28c`, `role='superadmin'`, `status='active'`.

Confirmado via `pg_get_functiondef` que `current_is_super_admin_from_auth_uid()` retorna `true` para `role IN ('super admin','superadmin')`. A RPC `finance_settle_comanda` **libera superadmin** no gate de permissão e **pula o check de tenant** para superadmin → pode baixar comandas de qualquer tenant, incluindo o Sanchez Barber.

**Portanto o "outro modo" é:** autenticar como `adm.sanchezbarber@gmail.com` (superadmin real, cuja senha o PO/equipe controla) no lugar do Augusto. É o **mesmo mecanismo oficial** `finance_settle_comanda` com **sessão autenticada real** — sem impersonação, sem service_role, sem bypass de RLS/RPC. O executor `executar-baixa.mjs` já suporta (basta passar `REG_ADMIN_EMAIL=adm.sanchezbarber@gmail.com`). O `settled_by_user_id` ficará `828175b0-...` (id do superadmin), registrado como autor da baixa — aceitável e auditável.

---

## 11. CORREÇÃO DE AMBIENTE — alvo PRODUÇÃO

Detectado pelo PO que o `.env.local` deste repositório aponta para o **STAGING** (`tjcvuhynckocmvtqykxp`), não para produção. Corrigido:
- Produção (Sanchez Barber / SMG Barber) = **`ushsnmlbeurfvlkieiln`**.
- Staging/homologação = **`tjcvuhynckocmvtqykxp`**.
- `executar-baixa.mjs` e `validar-baixa.mjs` agora **fixam produção**, **recusam staging** (exit 2 se `tjcvuhynckocmvtqykxp` na URL) e **não leem o `.env.local`** — exigem `SUPA_PRODUCTION_ANON` + `REG_ADMIN_EMAIL` + `REG_ADMIN_PASSWORD` via ambiente.
- Confirmado que o `supabase db query --linked` local está linkado à **produção** (`supabase/.temp/project-ref` = `ushsnmlbeurfvlkieiln`), portanto o DRY-RUN e todas as verificações read-only foram sempre sobre produção.

## 12. EXECUÇÃO EM PRODUÇÃO (2026-09-02) — CONCLUÍDA

Executado `executar-baixa.mjs` (sessão real autenticada como `augustosanchesb@outlook.com`, uid `1021f3d1-...`, role `admin` no tenant) contra produção `ushsnmlbeurfvlkieiln`:

```
Processadas: 354 | OK: 354 | Erros: 0
Relatório CSV: scripts/ops/regularizacao/resultado-baixa.csv
```

### Validação pós-exec (read-only, produção, via SQL):
| Verificação | Resultado | Status |
|---|---|---|
| Comandas `paid` + `payment_method='regularizacao'` | **354** | ✅ |
| Transactions criadas (`regularizacao-set-*`) | **354** — soma **R$ 18.670,00** | ✅ |
| Appointments → `completed` (via `comandas.appointment_id`) | **354** | ✅ |
| Comandas quitadas c/ appointment `<> completed` | **0** | ✅ |
| **Comissões criadas nas 354** | **0** | ✅ |
| **Exceções alteradas** (`d2845e32`/`00f8d667`/`ac5711a5`) | **0** — permanecem `open` | ✅ |
| Autoria (`settled_by_user_id`) | **354** = `1021f3d1-c7c2-4c55-a490-91bb05e41e46` (Augusto) | ✅ |

**Integridade: OK.** Operação aderente a todos os critérios da autorização — mecanismo oficial, sessão autenticada real, 0 comissões, 3 exceções intactas, autoria auditável. Nenhuma alteração em staging. Sem `service_role`, sem impersonação, sem bypass de RLS/RPC.
