# GATE 1 CORREÇÃO — Relatório Final: `confirm_appointment_attendance` (P5) Tenant-Scoped

> **Fase:** GATE 1 (Correção autorizada pelo PO após auditoria CRITICAL) · **Tipo:** migration corretiva + re-homologação em staging
> **Data:** 01/09/2026 · **Responsável:** OpenCode (Tech Lead)
> **Base:** ADR-021 (D-1/D-2) · `docs/audit/GATE1_AUDITORIA_CONFIRM_APPOINTMENT_ATTENDANCE.md` (finding CRITICAL)
> **Ambiente:** staging `tjcvuhynckocmvtqykxp` · **Produção:** `ushsnmlbeurfvlkieiln` **INTOCADA**

---

## 1. Finding e decisão

- **GATE 1 (read-only, 01/09/2026):** `confirm_appointment_attendance` apresentava o padrão global-first
  `v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '')` — papel global
  (`profiles/staff.role`) vencia o COALESCE e os gates de **gestão** e **recepção** autorizavam sem
  pertencimento ao tenant alvo → escrita cross-tenant possível (`UPDATE appointments` em `tenant_id = p_tenant_id`
  arbitrário). VERDICT **CRITICAL** (mesma classe do finding P4/P7 da FASE 3, já comprovado com escrita real).
- **Decisão do PO (01/09/2026):** corrigir exclusivamente `confirm_appointment_attendance` aplicando o
  **padrão ADR-021** já usado nas RPCs P4/P7 — sem alterar regras de negócio, RLS, comandas, checkout, frontend,
  outras RPCs ou migrations históricas.

## 2. Alteração executada

| Item | Valor |
|---|---|
| Migration | `supabase/migrations/20260901160100_fix_confirm_appointment_attendance_tenant_scoped.sql` (nova, aditiva) |
| Aplicação | **Staging somente** — transplante via `supabase db query --linked -f` + `migration repair --status applied` (NUNCA `db push`) |
| Função | `public.confirm_appointment_attendance(UUID, UUID) RETURNS JSONB` — assinatura preservada |
| Definer | `SECURITY DEFINER` + `SET search_path = public` — preservados |
| Grants | `REVOKE ALL ... GRANT EXECUTE TO authenticated` — preservados |
| Gate gestão | `v_normalized_role` agora **membership-first** (ADR-021): `COALESCE(NULLIF(v_membership_role,''), CASE WHEN current_tenant_id_from_auth_uid() = p_tenant_id THEN NULLIF(v_access_role,'') ELSE NULL END, '')` — papel global só autoriza no **tenant canônico** do usuário |
| Gate recepção | `v_normalized_role = 'receptionist'` — agora tenant-scoped (mesma fórmula) |
| Gate barbeiro | **Preservado intacto** (`staff WHERE id = auth.uid() AND tenant_id = p_tenant_id` + `appointment.staff_id = auth.uid()`) |
| Superadmin | **Bypass canônico preservado** (`current_is_super_admin_from_auth_uid()`) — invariavel |
| Regras funcionais | status `cancelled`/`no_show` bloqueado, `attended_at` duplicado bloqueado, UPDATE atendimento transacional — inalteradas |
| Comment | Atualizado para refletir autorização tenant-scoped (ADR-021) |

**Verificação live após aplicação:** `pg_get_functiondef(oid)` no staging confirmou a nova definição —
fórmula ADR-021 presente, padrão global-first **não existe mais**, barbeiro/superadmin/assinatura/definer intactos.

## 3. Matriz de homologação (staging) — 15/15 PASS

Execução real via Admin API (guard: URL deve conter `tjcvuhynckocmvtqykxp`) + sessões reais
(`signInWithPassword`). Evidência: `test-results/rehomolog-confirm-evidence.json`.

| Cenário | Ator | Alvo | Resultado |
|---|---|---|---|
| P5.1 Barbeiro próprio | barber A | tenant A, appt próprio | **ALLOW** (completed + attended_at set) |
| P5.2 Barbeiro alheio | barber A | tenant A, appt de outro staff | **DENY** + zero-write |
| P5.3 Barbeiro cross-tenant | barber A | tenant B | **DENY** + zero-write |
| P5.4 Gestão same-tenant | manager A | tenant A | **ALLOW** (completed + attended_at set) |
| P5.5 **Gestão cross-tenant (fix)** | manager A | tenant B | **DENY** + **ZERO-WRITE** — appt B byte a byte idêntico |
| P5.6 Recepção same-tenant | reception A | tenant A | **ALLOW** (completed + attended_at set) |
| P5.7 **Recepção cross-tenant (fix)** | reception A | tenant B | **DENY** + **ZERO-WRITE** — appt B byte a byte idêntico |
| P5.8 Sem autorização | manager B (sem membership em A) | tenant A | **DENY** + zero-write |
| P5.9 Duplicado | manager A | tenant A (já confirmado) | erro `Atendimento ja foi confirmado` (regra intacta) |
| P5.10 Cancelled | manager A | tenant A (status cancelled) | erro (regra intacta) |
| SA-0 Superadmin resolvido | — | — | id `8506c9fa-10d1-4e4e-b395-7a5d590c895a` |
| SA-1 **Superadmin cross-tenant** | superadmin | tenant B | **ALLOW** (bypass PRESERVADO), depois appt B restaurado |
| FINAL | — | — | appt B restaurado ao estado pré-homologação (pending/null) |

**Prova zero-write cross-tenant:** snapshot do appt B (tenant B) antes/depois de cada DENY —
status `pending`, `attended_at null`, `attended_at_source null` idênticos em todas as tentativas
(P5.3, P5.5, P5.7). Nenhuma escrita em tenant indevido.

**Idempotência da homologação:** reruns resilientes (IDs descobertos por Admin API, appointments de teste criados
com UUID novo e template do schema real — `start_time`/`duration`/NOT NULLs; 5 appointments sintéticos criados em
tenant A como evidência, nenhum dado pré-existente alterado além da restauração do appt B no SA-1).

## 4. Validações técnicas

| Validação | Comando | Resultado |
|---|---|---|
| Testes financeiros | `npx vitest run src/lib/finance/attendance.test.ts src/lib/finance/payment.test.ts` | **17/17 PASS** (attendance 8 + payment 9) |
| Build | `npm run build` | **PASS** (3052 módulos, 18.0s) |
| TypeScript | `npx tsc --noEmit --pretty false` | Sem erros em arquivos do escopo; erros reportados são **pré-existentes** fora do escopo (`application/`, `domain/`, `pages/`, `tests/`, observability, schemas) — nenhum em `src/lib/finance/` |
| Whitespace | `git diff --check` | **LIMPO** (apenas aviso de CRLF→LF numa migration antiga já modificada por outro workstream) |
| DRY-run diff | `git diff --stat` | Escopo restrito: 1 migration nova + docs ADR-021/audit + script de evidência (test-results gitignored). Outros arquivos modificados são de workstreams alheios e **não foram tocados** |

## 5. Critérios de aceite do PO — cobertura

| # | Critério | Status |
|---|---|---|
| 1 | Gestor autorizado no tenant A opera no tenant A | ✅ P5.4 ALLOW |
| 2 | Mesmo gestor bloqueado no tenant B | ✅ P5.5 DENY + zero-write |
| 3 | Recepção autorizada no tenant A opera no tenant A | ✅ P5.6 ALLOW |
| 4 | Mesma recepção bloqueada no tenant B | ✅ P5.7 DENY + zero-write |
| 5 | Barbeiro respeita tenant + atribuição do appointment | ✅ P5.1/P5.2/P5.3 |
| 6 | Bypass superadmin funcionando | ✅ SA-1 cross-tenant ALLOW |
| 7 | Sem escrita cross-tenant | ✅ prova zero-write byte a byte no appt B |
| 8 | Live sem padrão global-first | ✅ `pg_get_functiondef` verificado após aplicação |
| 9 | Testes passam | ✅ 17/17 unit + 15/15 matriz staging |
| 10 | Diff restrito ao escopo | ✅ 1 migration + docs do gate; produção intacta |

## 6. Arquivos alterados (escopo do gate)

- **Novo:** `supabase/migrations/20260901160100_fix_confirm_appointment_attendance_tenant_scoped.sql`
- **Alterado:** `docs/adr/ADR-021-rpc-tenant-scoped-authorization.md` (D-4 atualizado: latente → RESOLVIDO; Consequences atualizada)
- **Novo:** `docs/audit/GATE2_CORRECAO_CONFIRM_APPOINTMENT_ATTENDANCE_RELATORIO_FINAL.md` (este relatório)
- **Gerado:** `test-results/rehomolog-confirm.cjs` + `test-results/rehomolog-confirm-evidence.json` (gitignored, evidência)
- **Anterior:** `docs/audit/GATE1_AUDITORIA_CONFIRM_APPOINTMENT_ATTENDANCE.md` (auditoria que originou o gate)

## 7. Riscos restantes

1. **Legado global sem membership (fora do tenant canônico)** — usuário com papel global mas sem linha em
   `user_tenants` perde autorização em tenants que não sejam o próprio canônico. Comportamento **correto** sob
   ADR-003/ADR-021 (D-1) e equivalente ao que já foi aceito nas RPCs P4/P7. Ação **não** executada nesta correção.
2. **Aprovação de produção pendente** — a migration **não** está aplicada em `ushsnmlbeurfvlkieiln`. Aplicação em
   produção exige decisão formal do PO (fluxo: `db query -f` transplante ou `db push` sob aprovação + repair + matriz).
3. **RPCs legadas `approve_access_request`/`close_order`** — pendências conhecidas do Security Audit (fora do escopo
   deste gate; aguardam o Gate 2 definido pelo PO).
4. **Rollback** — como é `CREATE OR REPLACE` sem backup de definição no repo, restaauração manual a partir do
   histórico git (`20260830010000`) é possível se necessário; baixo risco pois assinatura coincide.
5. **Appointments sintéticos de teste** — 5 registros criados no tenant A (4 confirmados + 1 cancelled) como evidência
   de homologação, análogos ao padrão FASE 3; nenhum impacto em dados reais de produção.

## 8. Pontos que ainda precisam de decisão do PO

1. **Aplicação em produção** da `20260901160100` (staging-only até aqui) — autorização explícita necessária.
2. **Gate 2:** auditoria das RPCs legadas `approve_access_request` e `close_order` (Security Audit pendente).
3. **Gate 3:** versionamento/commit da branch com todo o trabalho M4/FASE 3/ADR-021/GATE 1 (nada foi commitado).

## 9. Status final

```text
GATE 1 CORREÇÃO — confirm_appointment_attendance
STATUS: CORRIGIDO E RE-HOMOLOGADO (staging)
MATRIZ: 15/15 PASS · ESCRITA CROSS-TENANT: ZERO (prova byte a byte)
LIVE: padrão global-first ELIMINADO · ADR-021 conforme
PRODUÇÃO: INTOCADA · COMMIT/PUSH/DEPLOY: NÃO REALIZADOS
DECISÕES PENDENTES DO PO: produção, Gate 2 (RPCs legadas), Gate 3 (versionamento)
```