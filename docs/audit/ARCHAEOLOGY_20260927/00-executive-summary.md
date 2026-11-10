# SMG Repository Archaeology — Relatório Executivo

**Data da auditoria:** 2026-09-27
**Escopo:** READ-ONLY — arqueologia de 6 repositórios externos + baseline local `sou-manager`
**Status:** **AUDIT COMPLETE**
**Modo:** Nenhuma implementação autorizada. Gate PO pendente.

---

## 1. Objetivo

Mapear o ecossistema de repositórios que cercam a plataforma `sou-manager`, identificando ativos reutilizáveis, riscos críticos, divergências de nomenclatura e oportunidades estratégicas — tudo com evidência verificável (FATO / HIPÓTESE / OPORTUNIDADE), sem inventar dados.

## 2. Repositórios Auditados

| # | Repositório | HEAD | Recência | Classificação Geral |
|---|---|---|---|---|
| 1 | `augustosanchesmanager-ux/sanchez-barber-iastudio` | `6228e6cf` (2026-05-30) | 120 dias | 🔴 Integração quebrada + código morto |
| 2 | `augustosanchesmanager-ux/SMG_LOUGE` | `5f86533` (2026-06-04) | ~4 meses | 🟠 Split-brain schema + RLS gaps |
| 3 | `augustosanchesmanager-ux/gerador_orcamentos` | `10ad103` (2026-05-18) | ~4 meses | 🔴 service_role vaza em produção |
| 4 | `augustosanchesmanager-ux/smg-core` | `df85ea6` (2026-04-30) | ~5 meses | 🔴 Duas stacks + RBAC morto |
| 5 | `augustosanchesmanager-ux/SMG_AUTOCONTROL` | `e101157` (2026-03-18) | 193 dias | 🟡 Mockup estático — domínio valioso |
| 6 | `augustosanchesmanager-ux/SMG_LADINGPAGE` | `fb041ad` (2026-04-24) | 156 dias | 🟠 Landing não-deployada, 7 âncoras quebradas |
| — | **`sou-manager` (baseline local)** | `c40d342` (2026-09-27) | Ativo | ✅ Produto comercial ativo |

## 3. Achados que Mudam a Decisão

### 3.1 🔴 Risco Crítico — `gerador_orcamentos` expõe `service_role` em produção

O arquivo `index.html` do deploy `https://geradororcamentos1.vercel.app` contém um JWT `service_role` do Supabase commitado no bundle do navegador. O payload decodificado declara `"role": "service_role"` com validade até 2036. Combinado com RLS `USING(true)` nas tabelas `budgets` e RLS explicitamente desabilitado em `customers`, qualquer visitante do site tem acesso total de leitura/escrita ao banco. **Isso é um comprometimento total de dados de clientes reais (Colégio Visconde de Porto Seguro, Will Nei, Marcelo Alves de Lima — 8 PDFs reais no repositório).**

### 3.2 🔴 Risco Crítico — Integração `sanchez-barber-iastudio` → SMG é estruturalmente inoperante

A Edge Function `site-sanchez-appointments` em `sou-manager` é production-grade (advisory lock, idempotência por `external_id`, detecção de conflito por `tstzrange`, matching por telefone). Mas o site envia para `/appointments` em vez de `/site-sanchez-appointments`, com 7 nomes de campo errados e sem os 2 UUIDs obrigatórios (`service_id`, `professional_id`). O teste unitário `smgIntegration.test.ts` codifica o contrato errado como correto. A integração falha em 404 antes mesmo da validação.

### 3.3 🔴 Risco Crítico — `SMG_LOUGE` tem mock `super_admin` sem gating de localhost

Sem variáveis de ambiente, o app boota como `super_admin` com acesso total. O `SupabaseSync.tsx` assina tabelas `public.*` sem tenant filter, e `database/schema.sql` explicitamente desabilita RLS em `public.events`, `public.lounges`, `public.promoters`, `public.reservations`, `public.sessions`, `public.orders`. Há um split-brain entre o schema `lounge.*` (serviços reais) e `public.*` (realtime legado).

### 3.4 🔴 Risco Crítico — `smg-core` tem zero RLS no schema `platform` + RBAC morto + escalação de privilégio

O schema Prisma `platform` (14 tabelas) tem zero políticas RLS. O login só aceita `isPlatformAdmin = true`, e o `PermissionsGuard` faz bypass total para platform admin. Um `viewer` pode escalar para `super_admin` atualizando o próprio role na policy `FOR ALL` de `admin_profiles`. Quatro rotas do admin (`/audit-logs`, `/api-logs`, `/error-logs`, `/system-health`) apontam para a API NestJS cuja sessão nunca é criada (login é Supabase).

### 3.5 🟠 `SMG_LADINGPAGE` tem 7 âncoras de conversão sem alvo

5 referências a `#contato` e 2 a `#solucoes` — nenhum elemento com esses IDs existe no repositório. O CTA principal ("Agendar demonstração") é inoperante em 5 pontos. O WhatsApp é um número fictício (`551140000000`). A produção `soumanager.com` serve um app diferente (Supabase + router chunks, fonte Plus Jakarta Sans).

### 3.6 🟡 Descoberta Estratégica — `estetica` é um produto ativo e não documentado

`APP_SLUGS = ['barber', 'auto', 'club', 'estetica']`. O slot `auto` tem todos os 21 módulos bloqueados (reservado). O slot `estetica` tem 16 módulos habilitados mas **não aparece em `AGENTS.md` nem em `docs/TAXONOMY.md`**. Isso é uma divergência documental que requer atenção do PO.

## 4. Ativos Reutilizáveis Identificados

| Ativo | Origem | Classificação | Destino |
|---|---|---|---|
| Wizard de booking (`SchedulingFlow.tsx`) | sanchez | 🟡 ADAPTAR | `src/modules/publicBooking/` |
| Catálogo de serviços (`scheduling/data.ts`) | sanchez | 🟡 REFERÊNCIA | Seed de `services` por tenant |
| Design system dark/gold | sanchez | 🟡 REFERÊNCIA | Tema SMG |
| UX components (CommandPalette, KpiCard, OperationalAlerts, rankings, drawer/modal, DoorCheckin, Stock) | LOUGE | 🟡 ADAPTAR/REFERÊNCIA | Módulos do SMG Barber |
| Pipeline PDF (Puppeteer + Handlebars) + padrão catalog (tenant_id + ativo + partial unique index) | gerador_orcamentos | 🟡 REFERÊNCIA | Padrão de catálogo |
| `security-events` table + `smg_client_apps` / `app_health_checks` / `app_incidents` | smg-core | ⭐ smg-core tem, sou-manager não | Gap de segurança |
| Copy (PainPoints, Differentiators, brand tokens) | LADINGPAGE | 🟢 COPIAR/ADAPTAR | Landing institucional |
| Domínio automotivo (OS, vehicles, PF/PJ, "aguardando peça") | AUTOCONTROL | 🟡 REFERÊNCIA | Seed do módulo `auto` |

## 5. Classificação de Reuso Consolidada

| Classificação | Quantidade (6 repos) | Significado |
|---|---|---|
| 🟢 COPIAR | ~5 | Reuso direto, sem modificação |
| 🟡 ADAPTAR | ~15 | Reuso com adaptação de schema/routing |
| 🟡 REFERÊNCIA | ~20 | Inspiração conceitual, não código |
| 🟠 REESCREVER | ~5 | Padrão correto mas implementação quebrada |
| 🟣 MANTER SEPARADO | ~8 | Domínio específico, não acoplar |
| 🔴 DESCARTAR | ~25 | Código morto, inseguro ou incompatível |

## 6. Riscos Consolidados (Top 10)

| # | Risco | Origem | Impacto | Probabilidade |
|---|---|---|---|---|
| R1 | `service_role` JWT em produção pública | gerador_orcamentos | Comprometimento total do banco | **ALTA** (já publicado) |
| R2 | Integração site→SMG inoperante | sanchez | Perda de receita de agendamento | **ALTA** |
| R3 | Mock super_admin sem gating | LOUGE | Elevação de privilégio em deploy | **MÉDIA** |
| R4 | Zero RLS no schema `platform` | smg-core | Exposição de dados cross-tenant | **MÉDIA** |
| R5 | Escalão de privilégio viewer→super_admin | smg-core | Tomada de controle do control-plane | **MÉDIA** |
| R6 | 7 âncoras quebradas + WhatsApp fake | LADINGPAGE | Zero conversão de leads | **ALTA** |
| R7 | Split-brain schema (public vs lounge) | LOUGE | Leitura de dados inconsistente | **ALTA** |
| R8 | `company_id` vs `tenant_id` | AUTOCONTROL | Divergência taxonômica | **ALTA** |
| R9 | `estetica` ativo e não documentado | sou-manager | Risco de governança | **MÉDIA** |
| R10 | 4 rotas quebradas + 4 páginas órfãs | smg-core | Dead code no admin | **ALTA** |

## 7. Backlog de Próximos Fronts (P0..P3)

Ver `13-next-fronts.md` para o backlog completo com problema/oportunidade/origem/evidência/impacto/complexidade/risco/dependências/recomendação.

## 8. Veredito

**Nenhuma implementação foi autorizada.** Este relatório é um mapa de evidências para decisão do PO. O roadmap está congelado desde 2026-07-24. Todas as ações requerem aprovação explícita de Augusto (PO).

---

Gerado por frente SMG Repository Archaeology — AUDIT → EVIDENCE → REPORT → STOP. Nenhuma implementação autorizada. Gate PO pendente.
