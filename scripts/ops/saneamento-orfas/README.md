# Runner de Saneamento de Comandas Orfas

Runner operacional automatizado para sanear comandas orfas historicas do tenant
`b716e290-f7f6-4449-b790-5ae9dcdadcab` (Sanchez Barber), separando rigidamente o
momento de **auditar** do momento de **mutar**.

> STATUS: PREPARADO. Nao commitado. Nao executa DML nesta etapa. Nao e migration.
> Todos os arquivos vivem FORA de `supabase/migrations/`.

## Visao geral do fluxo

```
PRE-FLIGHT (read-only)
    |  valida todos os invariantes de A e B
    v
confirmacao dos invariantes
    |  -preflight imprime cada invariante e aborta se qualquer um divergir
    v
FASE A (membership_credit_effect true->false, 24 alvos)
    |  transacao propria, guards repetidos antes do UPDATE, idempotente
    v
POST-GATE A (postflight-a.sql, read-only)
    |  obrigatorio: prova estado apos A (somente invariantes A) antes de liberar B
    v
CAPTURE B (capture-b.sql, read-only)
    |  materializa a IDENTIDADE do lote (25 comanda_ids) antes de mutar
    v
FASE B (status open->cancelled, 25 alvos)
    |  transacao propria, guards repetidos antes do UPDATE, idempotente
    v
POST-GATE B (postflight-b.sql, read-only)
    |  prova o estado dos MESMOS 25 ids capturados (identidade do lote)
    v
relatorio final (logs auditaveis)
```

## Conexao escolhida (justificativa)

**Mecanismo:** `supabase db query --linked` do Supabase CLI.

- O projeto ja esta **linkado** (`supabase/.temp/linked-project.json` ->
  `ushsnmlbeurfvlkieiln`) e o CLI esta **autenticado** (sessao `supabase login`).
- Executa SQL contra o banco via **Management API**, retornando **JSON** parseavel.
- **Nenhuma credencial e gravada no repositorio nem passada pelo runner**: o token
  e resolvido da sessao autenticada do CLI. `.gitignore` continua ignorando
  `*.local` e `supabase/.temp/`.
- Nao requer `psql` local (nao instalado), nem `SUPABASE_ACCESS_TOKEN` em var de
  ambiente, nem senha do pooler no repo.
- E o padrao ja adotado pelo projeto (o CLI linkado e usado para `db push/pull/diff`).

**Variante Docker (nao-default, documentada):** para isolamento ainda maior, o mesmo
comando pode rodar dentro de um container
`docker run --rm -v "${PWD}":/work -e SUPABASE_ACCESS_TOKEN=<token> supabase/cli db query --linked -f /work/...sql`. Nao e o **default** porque exigiria re-gravar o token
no ambiente; o CLI host ja autenticado e mais simples e igualmente seguro.

## Comandos exatos

### Modo PRE-FLIGHT (100% read-only, NUNCA executa DML)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\saneamento-orfas\run.ps1 -preflight
```

Saida esperada (exit `0` quando APROVADO): cada invariante listado como `OK`,
seguido de `PRE-FLIGHT APROVADO: invariantes A(24) e B(25) confirmados`.
Qualquer divergencia -> exit `1` + `PRE-FLIGHT REPROVADO` (nao executar).

### Modo EXECUTE (exige aprovacao explicita)

```powershell
# Ambas as fases, com as DUAS aprovacoes:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\saneamento-orfas\run.ps1 -execute -fase all -approveA -approveB

# Somente FASE A:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\saneamento-orfas\run.ps1 -execute -fase a -approveA

# Somente FASE B (exige post-gate A ja aprovado em execucao anterior):
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\saneamento-orfas\run.ps1 -execute -fase b -approveB
```

### Dry-run (seguro, nao toca o banco)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\saneamento-orfas\run.ps1 -preflight -dryrun
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ops\saneamento-orfas\run.ps1 -execute -fase all -approveA -approveB -dryrun
```

## Como a aprovacao impede execucao acidental

1. `-execute` sem `-approveA`/`-approveB` **aborta imediatamente** (exit `2`), antes
   de qualquer chamada a mutacao.
2. Em `-fase all`, `-approveA` e `-approveB` sao ambos exigidos: aprovar A nao aprova
   B automaticamente.
3. O runner **sempre executa o preflight (read-only) como gate inicial** de `-execute`;
   se qualquer invariante divergir, nenhuma fase roda.
4. **FASE B so roda apos o POST-GATE A ser aprovado** (quando `-fase all`). Se o
   post-gate A reprovar, B nao e executada.
5. Cada `fase-*.sql` re-executa os guards (`RAISE EXCEPTION`) **imediatamente antes** do
   seu `UPDATE`, dentro de transacao propria, com post-check e `ROLLBACK` em falha.
6. `-preflight` e `-execute` sao mutuamente exclusivos.

## Guards implementados

`preflight.sql` (read-only) valida:

| Grupo | Invariante | Esperado |
|-------|-----------|----------|
| A | alvos do tenant (FASE A JÁ APLICADA: `membership=false`) | 24 |
| A | restam com `membership_credit_effect = true` | 0 |
| A | itens com `unit_price = 0` | 0 |
| A | assinatura cobrindo `created_at` | 0 |
| B | alvos do tenant | 25 |
| B | `status = open` | 25 |
| B | appointment `cancelled` | 25 |
| B | `financial_effect = true` | 25 |
| B | `transactions` | 0 |
| B | `status = paid` | 0 |
| B | excecoes financeiras presentes (`d2845e32`, `4077d722`) | 0 |
| B | coluna `appointments.cancellation_type` existe | 1 |

## Escopo das mutacoes

**FASE A** altera somente `comandas.membership_credit_effect` (`true -> false`) nos 24
alvos validados. Nao toca status, financial_effect, total, items, transactions,
subscriptions, credits ou comissao.

**FASE B** altera somente, em `comandas`:
- `status = 'cancelled'`
- `cancellation_type = appointments.cancellation_type` (convencao `cancelAppointment`)
- `cancelled_at = now()`
- `cancelled_by_user_id = NULL`
- `closure_note = 'Saneamento historico: comanda orfa vinculada a appointment cancelado.'`

Nao cria/estorna/apaga transaction, nao altera valores financeiros, nao cancela `paid`,
e nao toca as excecoes `d2845e32-a20c-47c7-9484-7992487c744b` e
`4077d722-327b-4fd1-a0ba-06850aec9d03`.

## Idempotencia

Cada fase usa `UPDATE ... WHERE <criterio> AND <flag-ainda-ativa>` e transacao:
uma segunda execucao encontra zero alvos e o guard de cardinalidade (`RAISE EXCEPTION`)
aborta sem causar dano.

## Logs

Cada execucao grava um log auditavel em `scripts/ops/saneamento-orfas/logs/`,
sem expor secrets (stderr nao-protocolo do CLI vai para arquivo temporario, nao para o log).
