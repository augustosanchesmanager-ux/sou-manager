## Identificação do Backlog
- **ID do Item:** <!-- ex: FIN-001 -->
- **Arquivo da Frente:** <!-- ex: docs/backlog/financeiro.md -->
- **Status Alvo:** `REVIEW` <!-- ou `DONE` -->

---

## Resumo da Mudança
- **Problema / Objetivo:**
- **Solução Aplicada:**
- **Impacto em Funcionalidades Existentes:**
- **Tipo de Alteração:** <!-- Bugfix | Feature | Hardening | Refactor | Docs / Governança -->

---

## Checklist de Segurança, Multi-tenant & Supabase
- [ ] Filtro explícito por `tenant_id` preservado nas queries afetadas (quando aplicável).
- [ ] Políticas RLS ativas e validadas sem afrouxamento de isolamento.
- [ ] Migrations (se houver) são idempotentes e timestampadas em `supabase/migrations/`.
- [ ] Zero dados mockados ou fallbacks silenciosos em código de produção.
- [ ] Aprovação explícita do PO obtida para mudanças críticas (regras de negócio, ADR, RLS/RPC, deploy/migration em produção).

---

## Checklist de Qualidade & Governança
- [ ] `npm run typecheck` passando sem erros.
- [ ] `npm run lint` passando sem novos erros.
- [ ] `npm run test` passando sem regressões.
- [ ] `npm run build` passando sem erros.
- [ ] *(Recomendado quando aplicável)* Gates do projeto executados: `npm run architecture:ci` / `npm run smg:verify`.
- [ ] Critérios de aceite marcados na frente (`docs/backlog/<frente>.md`).
- [ ] `docs/backlog/INDEX.md` atualizado com o status sincronizado.

---

## Evidência de Validação (Obrigatório)
- **Build / Type-check / Testes:** <!-- colar saída resumida de typecheck, lint, test, build e gates -->
- **Teste Funcional / Preview Vercel:** <!-- link do preview ou evidência de execução -->
- **Teste de Isolamento / RLS:** <!-- evidência de verificação multi-tenant quando aplicável -->

---

## Riscos e Rollback
- **Riscos conhecidos:**
- **Plano de Rollback:**
