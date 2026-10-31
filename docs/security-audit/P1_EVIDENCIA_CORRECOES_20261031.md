# P1 — Evidência das correções de segurança (F01–F06)

> **Fonte dos achados:** `docs/security-audit/relatorio-auditoria-seguranca.pdf` (auditoria de 2026-10-30).
> **Escopo desta frente:** somente os achados **P1** — F01, F02, F03 (críticos) e F04, F05, F06 (altos).
> **Estado:** correções implementadas e validadas em **staging**; migrations **aplicadas em produção** em 2026-10-31; Edge Functions com deploy **parcialmente bloqueado** (ver §9).
> **Base:** `HEAD = 0acb399` (branch `security/p1-critical-high-fixes`, PR #215) · **Data:** 2026-10-31

Disciplina deste documento: **EVIDÊNCIA** = fato observado (comando, saída, diff) · **INTERPRETAÇÃO** = leitura do fato · **GAP** = o que segue desconhecido/não validado · **DECISÃO** = ação pendente de autorização.

---

## 1. Ambiente de validação

| Item | Valor |
|---|---|
| Staging | `sou-manager-staging` · ref `tjcvuhynckocmvtqykxp` · PostgreSQL 17.6.1.166 · `ACTIVE_HEALTHY` |
| Produção | `ushsnmlbeurfvlkieiln` (`sou-manager`) — **nenhuma escrita executada** |
| CLI | `supabase` 2.116.0 (`db query --linked --project-ref`) |
| Node | `C:\Program Files\nodejs\node.exe` |
| Deno | **não instalado** (ver GAP-06) |

---

## 2. Resumo por achado

| ID | Sev. | Superfície | Correção aplicada | Arquivos | Status |
|---|---|---|---|---|---|
| **F01** | crítico | `public.prepare_invite_user(text,text)` | Remove a escrita em `auth.users`; conta existente passa a retornar `requires_login` | `supabase/migrations/20261030120000_fix_f01_invite_takeover.sql` | **Aplicado em staging** · fase 2 pendente |
| **F02** | crítico | `claim_due_reminders`, `process_waitlist_cancellation` | `REVOKE` de `PUBLIC/anon/authenticated`; `EXECUTE` só para `service_role` e `worker_dispatcher`; recriação da função para corrigir ambiguidade `ON CONFLICT` | `supabase/migrations/20261030120100_fix_f02_engagement_cron_acl.sql` | **Aplicado em staging** |
| **F03** | crítico | `is_super_admin()`, policies de `usage_logs`/`alerts`/`notification_channels`, Edge `supabase-usage-monitor` | Fonte de verdade = `profiles.role` + `status='active'`; `user_metadata` nunca autoriza; Edge decide via RPC | migration + `_shared/usage-monitor-auth.ts` + `supabase-usage-monitor/index.ts` | **Banco aplicado** · Edge **não deployada** |
| **F04** | alto | Edge `worker-dispatcher` | Exige `x-worker-secret` (comparação em tempo constante) e sanitiza erros internos | `worker-dispatcher/index.ts`, `config.toml` | **Código pronto** · deploy bloqueado (GAP-01) |
| **F05** | alto | `public.profiles` (`tenant_id`, `status`) | Trigger `BEFORE UPDATE OF tenant_id, status` bloqueia usuário comum; libera superadmin, `service_role` e fluxos `SECURITY DEFINER` | `supabase/migrations/20261030120300_fix_f05_profiles_tenant_status_guard.sql` | **Aplicado em staging** |
| **F06** | alto | Edge `admin-create-user` | Não adota usuário existente pelo e-mail; 409 genérico; guarda de `staff` cross-tenant antes do upsert; erros sanitizados | `admin-create-user/index.ts` | **Código pronto** · deploy pendente |

---

## 3. EVIDÊNCIA — validação de aceite em staging

### 3.1 Execução

Script transacional (fixtures próprias + `ROLLBACK`) rodado com as quatro migrations **já aplicadas** no staging:

```
supabase db query --linked --project-ref tjcvuhynckocmvtqykxp -f %TEMP%\opencode\p1-staging-summary.sql
```

**Resultado: 25/25 verificações com `ok = true`.**

| # | Verificação | ok |
|---|---|---|
| 1 | F01 conta existente retorna `requires_login` | ✅ |
| 2 | F01 senha antiga da vítima continua válida | ✅ |
| 3 | F01 senha do atacante **não** funciona | ✅ |
| 4 | F01 conta nova retorna `user_exists=false` | ✅ |
| 5 | F01 `prepare_invite_user` não cria usuário em `auth.users` | ✅ |
| 6 | F01 token revogado é rejeitado | ✅ |
| 7 | F02 `anon` negado em `claim_due_reminders` | ✅ |
| 8 | F02 `authenticated` negado em `claim_due_reminders` | ✅ |
| 9 | F02 `anon` negado em `process_waitlist_cancellation` | ✅ |
| 10 | F02 `authenticated` negado em `process_waitlist_cancellation` | ✅ |
| 11 | F02 `worker_dispatcher` autorizado em `claim_due_reminders` (ACL) | ✅ |
| 12 | F02 `worker_dispatcher` autorizado em `process_waitlist_cancellation` (ACL) | ✅ |
| 13 | F02 `service_role` autorizado em `claim_due_reminders` | ✅ |
| 14 | F02 `service_role` **executa** `claim_due_reminders` sem erro de ambiguidade | ✅ |
| 15 | F03 `user_metadata.role=super_admin` isolado é **negado** | ✅ |
| 16 | F03 superadmin persistido e ativo é autorizado | ✅ |
| 17 | F03 superadmin suspenso é negado | ✅ |
| 18 | F03 `anon` negado em `is_super_admin()` | ✅ |
| 19 | F05 autopivot de `tenant_id` bloqueado (42501) | ✅ |
| 20 | F05 `tenant_id` permanece o original | ✅ |
| 21 | F05 autoaprovação de `status` bloqueada | ✅ |
| 22 | F05 `full_name` continua editável | ✅ |
| 23 | F05 superadmin pode aprovar `status` | ✅ |
| 24 | F05 `service_role` pode atualizar internamente | ✅ |
| 25 | F05 fluxo `SECURITY DEFINER` continua autorizado | ✅ |

> O teste 14 (`service_role`) substitui a execução sob `worker_dispatcher`: o role de conexão do CLI não é membro de `worker_dispatcher`, então `SET ROLE` falha com `42501 permission denied to set role "worker_dispatcher"`. A autorização ACL de `worker_dispatcher` foi verificada declarativamente (testes 11–12). Ver **GAP-05**.

### 3.2 Estado aplicado (verificação de objetos)

```
f01_no_auth_users_write = true      -- pg_get_functiondef não contém UPDATE auth.users
f02_anon_claim          = false     -- has_function_privilege('anon', ...)
f02_auth_waitlist       = false
f03_rpc                 = 1         -- current_is_super_admin_from_auth_uid existe
f03_reads_profiles      = true
f03_still_metadata      = false     -- is_super_admin não referencia user_metadata
f05_trigger             = 1         -- trg_f5_profiles_tenant_status_guard
```

Varredura adicional: **nenhuma** função em `public` referencia `user_metadata` (`pg_get_functiondef ~ 'user_metadata'` → 0 linhas). `get_auth_access_context` referencia `is_super_admin`, portanto herda a correção.

### 3.3 F01 — ataque antes/depois

| Momento | Evidência |
|---|---|
| **Antes** (staging, pré-migration) | Ataque original reproduzido: conta da vítima mantinha a senha antiga (`old_ok=false` para a senha do atacante) **e** a senha do atacante autenticava (`attack_ok=true`). |
| **Depois** | Testes 2 e 3: senha antiga válida, senha do atacante inválida. Teste 1: a RPC passa a responder `{"success":false,"user_exists":true,"requires_login":true}`. |

### 3.4 `accept_invite` (fluxo legítimo) após F05

| Cenário | Resultado |
|---|---|
| Usuário sem profile (INSERT em `profiles`) | ✅ `tenant_id`/`role` corretos, `status='active'` |
| Usuário com profile `tenant_id NULL` e `status='pending'` | ❌ bloqueado pela checagem **pré-existente** `p.tenant_id IS DISTINCT FROM v_invite.tenant_id` (ver GAP-03) |

---

## 4. EVIDÊNCIA — gates técnicos (working tree)

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ sem erros |
| Build | `npm run build` | ✅ `✓ built in 28.67s` |
| Unitários | `npm run test` | ✅ **116 arquivos / 1995 testes** |
| Arquitetura | `npm run architecture:ci` | ✅ exit 0 · repository 219 (baseline 222) · forbidden 0 · circular 0 |
| D8 core | `npm run d8:verify` | ✅ `D8:VERIFY OK — canonical Core == worker artifact (byte-identical)` |
| Edge Functions | `npx esbuild --bundle` (externos `https://*`, `jsr:*`) | ✅ `worker-dispatcher`, `admin-create-user`, `supabase-usage-monitor` bundlam sem erro (sintaxe + grafo de imports relativos) |

> `tsconfig.json` exclui `supabase/`, portanto `typecheck`/`build` **não** cobrem as Edge Functions. A validação acima é de bundle/sintaxe, não de tipos nem de runtime (GAP-06).

---

## 5. Mudanças por arquivo

**Migrations (novas, não rastreadas):**

- `supabase/migrations/20261030120000_fix_f01_invite_takeover.sql`
- `supabase/migrations/20261030120100_fix_f02_engagement_cron_acl.sql`
- `supabase/migrations/20261030120200_fix_f03_super_admin_trusted_source.sql`
- `supabase/migrations/20261030120300_fix_f05_profiles_tenant_status_guard.sql`

**Edge Functions / shared (modificadas):**

- `supabase/functions/worker-dispatcher/index.ts` — header `x-worker-secret`, `timingSafeEqual`, respostas sem detalhe interno, `correlation_id`.
- `supabase/functions/worker-dispatcher/config.toml` — documenta o secret obrigatório.
- `supabase/functions/admin-create-user/index.ts` — remove `listUsers()`/adoção por e-mail; 409 genérico; guarda de `staff` cross-tenant; erros sanitizados.
- `supabase/functions/_shared/usage-monitor-auth.ts` — `isSuperAdminUser` só considera `app_metadata`.
- `supabase/functions/supabase-usage-monitor/index.ts` — autorização via RPC `current_is_super_admin_from_auth_uid()` com o token do chamador.
- `tests/security/f2_2_usage_monitor_auth.test.ts` — contrato atualizado (nega `user_metadata`, aceita `app_metadata`).

**Documentação:** `docs/security-audit/F01-fix-proposal.sql`, `docs/security-audit/F01-test-evidence.md`, este arquivo.

---

## 6. GAPs e limitações

**GAP-01 — F04 exige infraestrutura antes do deploy.**
`WORKER_DISPATCH_SECRET` não existe em staging nem em produção (`supabase secrets list`). O job de cron de produção `d8-worker-dispatcher` (jobid 3, `* * * * *`, `active=true`) **não envia** `x-worker-secret`. Deployar F04 antes de atualizar o job faz o worker responder 401 em todos os ciclos.

**GAP-02 — D8 já está bloqueado em produção, independentemente de F04.**
`EDGE_JWT_SECRET` também não aparece em `supabase secrets list` de produção; sem ele o worker retorna 503. F04 **não cria** essa indisponibilidade, mas também não a resolve.

**GAP-03 — `accept_invite` rejeita profile com `tenant_id NULL`.**
A checagem `p.tenant_id IS DISTINCT FROM v_invite.tenant_id` (`20260806010000_fix_accept_invite_tenant_id_ambiguity.sql:70-75`) trata `NULL` como "outro time". É comportamento **pré-existente**, não introduzido por F01/F05. Precisa de decisão de produto antes de qualquer alteração.

**GAP-04 — Superfície residual de ACL (fora do P1).**
Staging tem **60** funções `SECURITY DEFINER` em `public` com `EXECUTE` para `anon`. Muitas são legítimas (booking público, `get_invite_by_token`), mas o número indica que o F02 cobriu apenas as duas funções nomeadas no relatório. Revisão sistemática de ACL é frente própria.

**GAP-05 — `worker_dispatcher` não validado funcionalmente.**
Sem `EDGE_JWT_SECRET` em staging não é possível cunhar JWT com `role=worker_dispatcher`; e o role de conexão do CLI não pode `SET ROLE`. Fica validado apenas o ACL.

**GAP-06 — Edge Functions sem runtime/teste automatizado.**
Deno não está instalado; não há teste de runtime para `worker-dispatcher`, `admin-create-user` e `supabase-usage-monitor`. A cobertura atual é bundle + revisão de código + testes unitários da parte pura (`_shared/usage-monitor-auth.ts`).

**GAP-07 — F03/F04/F06 dependem de deploy.**
As mudanças de Edge Function não têm efeito até o deploy. Enquanto isso, o `supabase-usage-monitor` em execução continua com o contrato antigo (`user_metadata`), embora as policies de banco já estejam corrigidas.

**GAP-08 — F01 fase 1 muda o contrato do fluxo de aceite.**
`inviteUserByEmail` pré-cria o usuário no Auth. Quem abre o link do e-mail chega autenticado e define a senha via `updateUser` — fluxo OK. Já o caminho de **token manual sem sessão** (usado quando `APP_URL` não está configurado ou o e-mail não chega) não consegue mais definir a senha de uma conta pré-criada: antes o `prepare_invite_user` gravava a senha digitada; agora o usuário precisa da senha existente. Não reabre o takeover, mas exige recuperação de senha ou a fase 2 (magic link). **GAP funcional da fase 1.**

**GAP-09 — Enumeração de e-mail no convite (pré-existente).**
`inviteUserByEmail` retorna 422 para e-mail já registrado e o erro é devolvido ao gestor. Fora do escopo F06 (que trata o `admin-create-user`), mas é o mesmo vetor de enumeração.

---

## 7. Pré-requisitos de promoção (referência)

> Execução em produção registrada em §9. Este bloco descreve os pré-requisitos exigidos.

1. **Migrations em produção** — exigem aprovação explícita do PO. Ordem: F01 → F02 → F03 → F05 (F05 depende do helper criado em F03).
2. **F04** — criar `WORKER_DISPATCH_SECRET` (custom secret, **sem** prefixo `SUPABASE_`) e atualizar o job `d8-worker-dispatcher` para enviar `x-worker-secret` **antes** de deployar a função.
3. **Deploy das Edge Functions** — `worker-dispatcher`, `admin-create-user`, `supabase-usage-monitor` (autorização do PO).
4. **F01 fase 2** — remover o retorno do token em `invite_team_member`, migrar o aceite para magic link e revogar `anon` de `prepare_invite_user` (autorização do PO; resolve GAP-08).

---

## 8. DECISÃO pendente (STOP/GATE)

Autorizações do PO (2026-10-31): (a) commit/push; (b) migrations em produção na ordem F01 → F02 → F03 → F05; (c) deploy das Edge Functions condicionado a secrets + cron; (d) GAP-03 → backlog P2, GAP-08 → mantém a trava e unifica na fase 2.

Executado e pendente: ver §9.

---

## 9. Execução em produção — 2026-10-31

Projeto `ushsnmlbeurfvlkieiln`. Cada migration foi aplicada isoladamente em `BEGIN … COMMIT` e verificada antes da seguinte. Nenhum rollback foi necessário.

### 9.1 Migrations

| Ordem | Migration | Resultado | Verificação pós-aplicação |
|---|---|---|---|
| 1 | F01 `20261030120000` | ✅ aplicada | `prepare_invite_user` sem `UPDATE auth.users`; `anon` mantém `EXECUTE` |
| 2 | F02 `20261030120100` | ✅ aplicada | `anon`/`authenticated` negados nas duas RPCs; `worker_dispatcher` e `service_role` autorizados; `service_role` executa `claim_due_reminders` (0 linhas, `p_limit=0`) |
| 3 | F03 `20261030120200` | ✅ aplicada | `is_super_admin` sem `user_metadata`; superadmin ativo real autorizado; `user_metadata.role=super_admin` em usuário comum **negado** |
| 4 | F05 `20261030120300` | ✅ aplicada | 5/5: trigger presente; pivot de tenant bloqueado (42501); troca de status bloqueada; no-op permitido; superadmin aprova status |

Fixtures de teste do F05 rodaram em transação com `ROLLBACK` — nenhuma linha de produção foi alterada.

**Pré-checagem F02:** produção tem **um único** job de cron (`d8-worker-dispatcher`), que não chama as RPCs de engajamento; `process-reminders` e `waitlist-notifier` **não estão deployados**. Portanto o `REVOKE` não quebra consumidor ativo.

**Pré-checagem F03:** os 2 superadmins de produção têm `role='superadmin'` e `status='active'`, compatíveis com o novo critério — sem risco de lockout.

### 9.2 F04 — preparação operacional (parcial)

| Passo | Estado |
|---|---|
| Criar `WORKER_DISPATCH_SECRET` em produção | ✅ criado (48 bytes aleatórios, base64url; valor não registrado em documento) |
| Atualizar cron `d8-worker-dispatcher` para enviar `x-worker-secret` | ✅ `cron.unschedule(3)` + `cron.schedule(...)` → novo `jobid=4`, `schedule='* * * * *'`, `active=true`, header presente (64 chars) |
| Criar `EDGE_JWT_SECRET` em produção | ❌ **bloqueado** — o valor deve ser o JWT secret legado do projeto, disponível apenas no dashboard (Settings → API → JWT Settings). Um valor aleatório faria o PostgREST rejeitar o JWT cunhado pelo worker |

O cron armazena o secret em texto claro em `cron.job`, mesma fronteira de confiança do JWT anon que já estava lá. Enquanto a função antiga (v23) estiver no ar, o header é ignorado — sem regressão.

### 9.3 Deploy das Edge Functions

| Função | Estado |
|---|---|
| `worker-dispatcher` (F04) | ⛔ não deployada — depende de `EDGE_JWT_SECRET` |
| `admin-create-user` (F06) | ⏸ aguardando decisão do PO (a condição do gate é específica do worker) |
| `supabase-usage-monitor` (F03) | ⏸ aguardando decisão do PO (idem) |

Comando previsto para o worker (após o secret): `supabase functions deploy worker-dispatcher --project-ref ushsnmlbeurfvlkieiln --no-verify-jwt` (o `config.toml` por função não é aplicado pelo CLI; o `verify_jwt` atual da função é `true`).

### 9.4 Estado final de produção

- Vulnerabilidades **F01, F02, F03 (banco/RLS) e F05** neutralizadas em produção.
- **F03 (Edge)** e **F06** seguem vulneráveis em runtime até o deploy.
- **F04** segue com a função antiga (já inoperante por ausência de `EDGE_JWT_SECRET`); cron já preparado.
- Nenhum efeito colateral observado nas verificações pós-aplicação.
