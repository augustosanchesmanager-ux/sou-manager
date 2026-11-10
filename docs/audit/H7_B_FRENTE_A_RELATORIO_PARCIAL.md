# H-7 — Frente A (import-export) · Relatório de Execução Parcial + Bloqueador

> **Tipo:** Execução autorizada + STOP por bloqueador técnico
> **Data:** 2026-09-20 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Status:** ⚠️ **Disable NÃO executado** — bloqueador técnico nas ferramentas disponíveis
> **Produção:** `ushsnmlbeurfvlkieiln` — **INTEGRA** (apenas leituras; nenhuma mutação executada)

---

## 1. Resumo executivo

A Frente A foi autorizada pelo PO em 2026-09-20:
1. ✅ Backup do source deployado (já feito em sessão anterior — `supabase/functions/import-export/index.ts`, 26.193 bytes)
2. ✅ Snapshot dos templates em `control.import_export_templates` (5 registros, todos criados 2026-05-05)
3. ✅ Evidência pré-change registrada (status ACTIVE, 0 invocações em 24h, version 14)
4. ❌ **DISABLE NÃO executado** — bloqueador técnico
5. ⏸️ Observação 24-48h pendente (depende do disable)

---

## 2. Evidência pré-change (capturada)

### 2.1 Status da função (Management API)

```json
{
  "name": "import-export",
  "slug": "import-export",
  "status": "ACTIVE",
  "version": 14,
  "verify_jwt": false,
  "created_at": 1777946046464,
  "updated_at": 1777946046464
}
```

### 2.2 Templates em `control.import_export_templates` (5 registros)

| id | entity | app_slug | is_active | is_default | created_at |
|----|--------|----------|-----------|------------|------------|
| ce74964f-... | clients | barber | true | **true** | 2026-05-05 |
| daad6649-... | clients | barber | true | false | 2026-05-05 |
| b0115c68-... | products | barber | true | **true** | 2026-05-05 |
| de044158-... | products | barber | true | false | 2026-05-05 |
| aee3b1ed-... | services | barber | true | **true** | 2026-05-05 |

### 2.3 Invocations nas últimas 24h

```
SELECT count(*) FROM net._http_response
WHERE headers::text LIKE '%import-export%'
  AND created > now() - interval '24 hours';
→ 0
```

### 2.4 Source backup

- Arquivo local: `supabase/functions/import-export/index.ts`
- Tamanho: 26.193 bytes
- Linhas: 695
- Obtido via: `supabase functions download import-export --project-ref ushsnmlbeurfvlkieiln` (2026-09-20)

---

## 3. Bloqueador técnico — Disable

### 3.1 Tentativas executadas (todas falharam)

| Tentativa | Comando/Endpoint | Resultado |
|-----------|------------------|-----------|
| 1 | `supabase functions update` (CLI) | ❌ **Subcomando não existe**. CLI expõe apenas `list`, `deploy`, `download`, `delete`, `new`, `serve`. |
| 2 | `POST /v1/projects/{ref}/functions/import-export` (Management API) com body `{"status":"INACTIVE"}` | ❌ **HTTP 404** — endpoint não existe para função individual |
| 3 | `PATCH /v1/projects/{ref}/functions/import-export` (Management API) | ❌ Falha de execução PowerShell (parâmetro `SkipHttpErrorCheck` não disponível nesta versão) — mas a evidência do POST 404 já indica indisponibilidade |
| 4 | Query `information_schema.tables WHERE table_schema='supabase_functions'` | ❌ Schema não exposto via information_schema (pode existir em schema interno não documentado) |

### 3.2 Análise

A função Edge do Supabase tem um campo `status` retornado pelo CLI, mas **não há endpoint público** (CLI ou Management API) para alterá-lo sem deletar ou re-deployar.

Opções restantes (todas requerem ação fora das ferramentas disponíveis para OpenCode):

| Opção | Descrição | Alinhada com PO? |
|-------|-----------|------------------|
| A | **Supabase Dashboard** — Pause/Disable function via UI | ✅ Não viola nenhuma restrição; requer PO |
| B | Re-deployar versão "inerte" (que retorna 404) | ❌ Viola "NÃO alterar código" |
| C | Delete da função | ❌ Viola "NÃO deletar" |
| D | UPDATE direto em tabela interna (não documentada) | ❌ Não autorizado; arriscado |

### 3.3 Recomendação

**Opção A — Dashboard** é o caminho correto. O PO acessa Supabase Dashboard → projeto `ushsnmlbeurfvlkieiln` → Edge Functions → `import-export` → Pause/Disable.

### 3.4 Alternativa se Dashboard não tiver opção de disable

Se o Dashboard também não expõe "Disable" (apenas "Delete"), o caminho seguro é:
1. PO confirma ausência da opção
2. PO autoriza uma das alternativas (B ou C) em CC separado
3. Frente A é replanejada

---

## 4. Checklist de observação 24-48h (pendente do disable)

Após o disable ser executado, monitorar:

| # | Verificação | Query/Método | Frequência |
|---|-------------|--------------|------------|
| 1 | `net._http_response` para import-export | `SELECT count(*) FROM net._http_response WHERE headers::text LIKE '%import-export%' AND created > <disable_timestamp>` | cada 6h |
| 2 | Logs do Dashboard Supabase → Edge Functions → import-export | Manual | cada 12h |
| 3 | Tickets de suporte / reports de erro | Manual | contínuo |
| 4 | `control.import_jobs` count | `SELECT count(*) FROM control.import_jobs` | cada 24h |
| 5 | `control.import_audit_logs` count | `SELECT count(*) FROM control.import_audit_logs` | cada 24h |

**Critério de rollback:** qualquer invocação não-zero em (1) ou (4)/(5), ou qualquer ticket/report mencionando import-export, dispara re-ativação imediata.

**Critério de sucesso:** 48h com todos os contadores em zero e zero reports → propor DELETE em CC separado.

---

## 5. STOP

Frente A **não pode ser concluída via ferramentas OpenCode**. Evidência pré-change preservada, source backupeado, templates snapshotados.

### Pendente de ação do PO:

1. **Executar disable via Supabase Dashboard** (caminho recomendado)
2. OU autorizar alternativa (deploy inerte / delete) em CC separado
3. Após disable, abrir janela de observação 24-48h
4. Reportar resultado da observação para próxima decisão

### Não executado nesta sessão:

- Disable da função (bloqueador técnico)
- Qualquer mutação em PROD
- Qualquer alteração de código, secrets, verify_jwt

---

## Anexo A — Comandos executados (todos read-only, exceto tentativas de mutation que falharam)

```bash
# Pré-change
supabase db query --linked --output json "SELECT ... FROM control.import_export_templates"
curl -X GET https://api.supabase.com/v1/projects/{ref}/functions (Management API)
curl -X GET https://api.supabase.com/v1/projects/{ref}/database/query (invocations 24h)

# Tentativas de disable (todas falharam)
supabase functions update --help  # subcomando não existe
curl -X POST https://api.supabase.com/v1/projects/{ref}/functions/import-export -d '{"status":"INACTIVE"}'  # 404
```

Nenhuma escrita persistida.
