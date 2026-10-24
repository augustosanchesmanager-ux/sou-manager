# Template de Release Notes — SMG Sou.Manager

> Versão do Template: 1.0.0
> Padrão de Nomenclatura: `docs/release-notes/RELEASE_NOTES_v<SEMVER>.md`
> Referência: Subfase 6.7 (Release Notes) — Fase 6: Production Readiness

---

# Release Notes — SMG Barber `v<MAJOR>.<MINOR>.<PATCH>`

- **Data da Release:** YYYY-MM-DD
- **Target Environment:** Produção (`https://barber.soumanager.com`)
- **Git Tag / Commit:** `v<X.Y.Z>` / `<COMMIT_SHA>`
- **Pull Requests Integrados:** `#PR_NUMBER`
- **Aprovação Formal:** `Augusto (PO)`

---

## 📢 Resumo Executivo

*(Breve parágrafo de 2 a 4 linhas explicando o objetivo principal desta versão e o impacto para o negócio ou estabilidade da plataforma).*

---

## 🚀 O Que Mudou (Changelog de Negócio)

### 💈 SMG Barber & Operação
- **Funcionalidade / Melhoria:** Descrição voltada para a gestão de barbearias e usuários finais.
- **Financeiro & Comissões:** Alterações de regras de rateio, caixas ou fechamento (se aplicável).
- **Agendamento & Portal:** Melhorias na experiência do cliente ou agendamento online.

---

## 🛠️ Melhorias Técnicas & Arquitetura (Changelog Técnico)

- **Governança & CI/CD:** Atualizações de pipelines, gates ou auditorias automáticas.
- **Segurança & RLS:** Hardening de políticas, papéis ou controle de acesso.
- **Testes & Qualidade:** Novos fluxos E2E cobertos, testes de regressão ou benchmarks.
- **Performance & Estabilidade:** Redução de latência, bundles ou índices de banco.

---

## 🗄️ Banco de Dados & Migrations

- [ ] **Possui Migrations:** Sim / Não
- **Arquivos de Migração:**
  - `supabase/migrations/<TIMESTAMP>_<NOME>.sql`
- **RPCs Criadas ou Modificadas:**
  - `nome_da_rpc()`
- **Procedimento Pré-Deploy:** (se houver)

---

## ⚠️ Breaking Changes & Compatibilidade

*(Listar se houver quebra de contrato de API, alteração de parâmetros obrigatórios ou descontinuação de rotas. Caso não haja, marcar como "Nenhuma breaking change identificada").*

- **Breaking Changes:** Nenhuma.

---

## 🔄 Plano de Rollback & Contingência

1. **Rollback de Aplicação (Frontend - Vercel):**
   - Acesse o Dashboard Vercel > Deployments.
   - Localize a versão anterior estável (`<PREVIOUS_DEPLOYMENT_URL>`).
   - Clique em **Instant Rollback**.
2. **Rollback de Banco de Dados (se aplicável):**
   - Script de reversão ou plano de rollback manual documentado.
3. **Contato de Suporte Operacional:** Equipe de Engenharia / PO.
