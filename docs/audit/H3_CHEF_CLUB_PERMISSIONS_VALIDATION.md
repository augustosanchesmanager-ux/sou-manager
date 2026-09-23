# H-3 — Chef Club: Permissões por Role (evidência)

> **Gate:** H-3 Chef Club (permissões — H3-5)
> **Data:** 2026-08-13
> **Ambiente:** frontend local (`localhost:3000`, `npm run dev`) contra o banco real `ushsnmlbeurfvlkieiln` (tenant Sanchez Barber — `b716e290-f7f6-4449-b790-5ae9dcdadcab`)
> **Responsável:** OpenCode (Tech Lead operacional)
> **Método:** E2E funcional via Playwright (Chromium) com a conta de homologação `homolog.sanchez@barber.soumanager.com` (manager) + verificação SQL da feature flag.

---

## 1. Objetivo

Provar que o **controle de acesso do Chef Club** está correto:

1. A feature `chef_club` está **habilitada** para o plano do tenant (`pro`);
2. O role **manager** acessa as páginas do Chef Club (Planos, Assinaturas, Recebimentos);
3. Roles restritos (**barber**/**receptionist**) são bloqueados pelo `ManagerRoute` (redirecionam para `/dashboard`).

---

## 2. Feature flag (SQL)

A fonte da verdade é `plan_features` (plano `pro`) + `tenants.status`. A RPC `tenant_has_feature` exige `auth.uid() IS NOT NULL` (contexto de sessão), por isso a chamada CLI sem sessão retorna `false` — verificado o dado real:

| Verificação | Resultado |
|-------------|-----------|
| `tenants.plan` | `pro` |
| `tenants.status` | `active` |
| `chef_club` em `plan_features` (plano pro) | ✅ presente |
| Conclusão | Feature **ativa** para o tenant |

---

## 3. Acesso do role manager (E2E)

| Rota | URL final | Redirecionado p/ dashboard? | Conteúdo esperado renderizado |
|------|-----------|------------------------------|-------------------------------|
| Planos | `/#/chef-club-plans` | ❌ não | "Planos" + "Club dos Chefes" |
| Assinaturas | `/#/chef-club-subscriptions` | ❌ não | "Assinaturas" + "Club dos Chefes" |
| Recebimentos | `/#/chef-club-receivables` | ❌ não | "Recebimentos" + "Contas" + "Ciclo" |

**0 erros de console e 0 erros HTTP** nas 3 rotas.

---

## 4. Bloqueio de roles restritos

O bloqueio de **barber**/**receptionist** é implementado no guard `ManagerRoute` (`App.tsx:180-186`): qualquer role `barber` ou `receptionist` → `<Navigate to="/dashboard" replace />`. O guard compõe as rotas Chef Club (`App.tsx:288-292`): `ModuleRoute chef_club` → `FeatureRoute chef_club` → `ManagerRoute`.

**Limitação de evidência:** o tenant Sanchez Barber possui apenas usuários `manager` (`189053ab...`) e `superadmin` (`828175b0...`) — **não existem usuários `barber`/`receptionist` no tenant real para exercitar o bloqueio via E2E**. O bloqueio é garantido pela implementação do guard e pela composição de rotas. Recomendação: exercitar o bloqueio com usuário `barber`/`receptionist` em tenant de teste (E2E, fora do tenant real) na sequência da homologação.

---

## 5. Console / HTTP

| Métrica | Contagem |
|---------|----------|
| Erros de console (tipo `error`) | 0 |
| Respostas HTTP ≥ 400 | 0 |

---

## 6. Conclusão

- ✅ Feature `chef_club` ativa para o plano `pro` do tenant;
- ✅ Role **manager** acessa todas as páginas Chef Club (Planos, Assinaturas, Recebimentos), com conteúdo renderizado;
- ✅ Guard de roles restritos presente na composição das rotas (ManagerRoute);
- ⚠️ **Não exercitado via E2E:** bloqueio com usuário `barber`/`receptionist` (não existem no tenant real) — recomendado em tenant de teste.
- ✅ 0 erros de console e 0 erros HTTP.

**Nenhuma alteração de dados no banco real foi realizada neste teste** (apenas leitura).

---

## 7. Gate C — Exercício da ressalva H3-5 (ManagerRoute RBAC) — RESOLVIDA (2026-09-23)

A ressalva do item 6 ("bloqueio de roles restritos não exercitado via E2E") foi **exercitada e RESOLVIDA** em **tenant E2E isolado** (nunca o tenant real Sanchez Barber), conforme exigido por D-HOM-17/D-HOM-19.

- **Spec:** `tests/e2e/homologation/h35-managerroute-rbac.spec.ts` (Playwright, Chromium)
- **Ambiente:** STAGING (`tjcvuhynckocmvtqykxp`) com `E2E_PROVISIONING=1`
- **Tenant:** isolado `gatec-h35-*` (`70aa026b-…`), provisionado com users `barber`/`receptionist`/`manager`/`owner`+`superadmin` e plano `pro` (`chef_club` ativa); teardown e2e-seed concluído
- **Data:** 2026-09-23 · **Resultado: 5/5 PASS (1.2m)**

| ID | Cenário | Resultado |
|----|---------|-----------|
| H35-1 | `barber` bloqueado nas 3 rotas Chef Club (ManagerRoute → redirect `/#/dashboard`) | ✅ PASS |
| H35-2 | `receptionist` bloqueado nas 3 rotas Chef Club | ✅ PASS |
| H35-3 | `manager` acessa as 3 rotas com conteúdo renderizado | ✅ PASS |
| H35-4 | `owner`/`superadmin` acessam as 3 rotas com conteúdo renderizado | ✅ PASS |
| H35-5 | Feature `chef_club` ativa (`pro`/`active` em `plan_features`) | ✅ PASS |

**Validações da subfase (pós-E2E):** `npm test` 1399 passed / 5 skipped (exit 0) · `npm run build` exit 0 · `npx tsc --noEmit` exit 0 · `git diff --check` limpo.

**Status:** ressalva **RESOLVIDA** e **ratificada — D-HOM-30 (2026-09-23): H-3 🟢 APROVADO, H3-5 🟢 RESOLVIDO.** Identificador formal = D-HOM-30 (D-HOM-28/29 preservados como referências históricas órfãs — um identificador de decisão nunca deve ter dois significados). **Tenant real Sanchez Barber intocado; zero mutações em produção. A ratificação não autoriza merge, tag ou deploy (gates separados); H-8 segue 🔴.**
