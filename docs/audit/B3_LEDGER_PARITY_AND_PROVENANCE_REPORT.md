# B3 — Relatório de Paridade de Ledger, Schema Drift e Proveniência de Migrations

**Data:** 2026-10-21  
**Ambientes Auditados:**
- **Produção:** `ushsnmlbeurfvlkieiln` (Supabase us-west-2)
- **Staging:** `tjcvuhynckocmvtqykxp` (Supabase us-west-1)
- **Repositório Git:** branch `chore/b3-ledger-provenance-canonicalization` (base `main` `8c15ad2`)
**Responsáveis:** PO (Augusto) + OpenCode

---

## 1. Contexto & Diagnóstico da Causa-Raiz de `remote = ""`

Historicamente, execuções do comando `supabase migration list` apontavam discrepâncias de versões e o erro de `remote = ""` (versão existente no banco remoto, mas sem nome ou arquivo no repositório local).
A auditoria forense read-only cruzada confirmou a causa-raiz:
1. **Migrations aplicadas em Produção fora do versionamento Git:**
   - Durante os incidentes de setembro (`P2.1-OUTBOX-42501` e saneamento `M4`), arquivos SQL locais foram aplicados diretamente no banco de produção e registrados na tabela `supabase_migrations.schema_migrations`.
   - No entanto, os arquivos físicos (`20260908120000_fix_grant_execute_anon_rls_functions.sql` e `20260911120000_seguranca_revoke_anon_service_role_4_m4_functions.sql`) permaneceram como `untracked` no working tree local, nunca sendo commitados na `main`.
   - Qualquer clone limpo do repositório ou pipeline de CI enxergava o banco de produção com registros remotos sem arquivos locais correspondentes.
2. **Nomes nulos pós-C1/C2/Settings:**
   - As migrations `20261020083000`, `20261020093000` e `20261020111000` foram inseridas com `version` preenchida, mas com a coluna `name` como `NULL`.
3. **Migration Legada de Abril (`20260426000001`):**
   - O arquivo `20260426000001_site_sanchez_appointments_correction.sql` já estava registrado no banco de produção sob o nome `site_sanchez_appointments_correction`, mas também estava `untracked` no Git.

---

## 2. Matriz Comparativa Cruzada (Staging × Produção × Repositório)

Auditoria realizada com a extração oficial do ledger de Staging (25 registros mais recentes) confrontada com a consulta direta em Produção e a árvore do repositório:

| Versão | Staging (`tjcvuhynckocmvtqykxp`) | Produção (`ushsnmlbeurfvlkieiln`) | Repositório Git | Diagnóstico & Ação |
| :--- | :--- | :--- | :--- | :--- |
| `20260426000001` | ✅ Registrada | ✅ Registrada (`site_sanchez...`) | ⚠️ Untracked no disco | **Canonicalizar:** Adicionar ao Git para refletir o estado de ambos os bancos. |
| `20260908120000` | ❌ Ausente | ✅ Registrada (`fix_grant...`) | ⚠️ Untracked no disco | **Canonicalizar:** Adicionar ao Git (fecha o gap do incidente Outbox). |
| `20260911120000` | ❌ Ausente | ✅ Registrada (`seguranca_revoke...`) | ⚠️ Untracked no disco | **Canonicalizar:** Adicionar ao Git (fecha o gap do saneamento M4). |
| `20260912120000` | ❌ Ausente | ✅ Registrada | ✅ Commitada no Git | Alinhado no repo e em PROD; Staging receberá quando sincronizado. |
| `20260914120000` | Registrada como `20260914215237` | Registrada como `20260914120000` | ✅ Commitada no Git | Drift histórico de timestamp gerado pelo CLI em Staging. O objeto é idêntico. |
| `20260914130000` | ❌ Ausente | ✅ Registrada | ✅ Commitada no Git | Presente em PROD e no repo; Staging receberá no próximo push. |
| `20260924000000` | ❌ Ausente | ❌ Ausente (coluna física existe) | ⚠️ Untracked no disco | **Canonicalizar:** Adicionar ao Git como DDL idempotente com guarda anti-mascaramento. |
| `20261017032000` | ✅ Registrada | ❌ Ausente | ✅ Commitada no Git | Migration de Booking Público aplicada em Staging; pendente em PROD. |
| `20261017035500` | ✅ Registrada | ❌ Ausente | ✅ Commitada no Git | Migration de Contas a Pagar aplicada em Staging; pendente em PROD. |
| `20261020083000` | ✅ Registrada (`name: NULL`) | ✅ Registrada (Regularizado `c1_commission...`) | ✅ Commitada no Git | Regularizada com sucesso em PROD via DML D-01. |
| `20261020093000` | ✅ Registrada (`name: NULL`) | ✅ Registrada (Regularizado `c2_commission...`) | ✅ Commitada no Git | Regularizada com sucesso em PROD via DML D-01. |
| `20261020111000` | ✅ Registrada (`name: NULL`) | ✅ Registrada (Regularizado `booking_settings...`) | ✅ Commitada no Git | Regularizada com sucesso em PROD via DML D-01. |
| `20261020210000` | ❌ Ausente | ❌ Ausente | ✅ Commitada no Git | Adicionada no PR #153 (`prepare_invite_user_rpc`); pendente em ambos. |

---

## 3. Regularizações Executadas

1. **Regularização de Metadados em Produção (DML D-01):**
   ```sql
   UPDATE supabase_migrations.schema_migrations 
   SET name = 'c1_commission_reopen_cycles' 
   WHERE version = '20261020083000' AND name IS NULL;

   UPDATE supabase_migrations.schema_migrations 
   SET name = 'c2_commission_item_granularity' 
   WHERE version = '20261020093000' AND name IS NULL;

   UPDATE supabase_migrations.schema_migrations 
   SET name = 'booking_settings_social_and_location_links' 
   WHERE version = '20261020111000' AND name IS NULL;
   ```
   *Resultado:* 100% de sucesso. As 3 versões agora possuem identificador formal.

2. **Recomendação para Staging:**
   O mesmo comando pode ser executado no SQL Editor de Staging para preencher os nomes de `20261020083000`, `20261020093000` e `20261020111000`.

---

## 4. Escopo do Commit de Canonicalização no Git

Arquivos incluídos na branch `chore/b3-ledger-provenance-canonicalization`:
- `supabase/migrations/20260426000001_site_sanchez_appointments_correction.sql`
- `supabase/migrations/20260908120000_fix_grant_execute_anon_rls_functions.sql`
- `supabase/migrations/20260911120000_seguranca_revoke_anon_service_role_4_m4_functions.sql`
- `supabase/migrations/20260924000000_add_comanda_items_staff_id.sql`
- `docs/audit/B3_LEDGER_PARITY_AND_PROVENANCE_REPORT.md`
