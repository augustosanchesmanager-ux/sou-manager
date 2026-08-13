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
