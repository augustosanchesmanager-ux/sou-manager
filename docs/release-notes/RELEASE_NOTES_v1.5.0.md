# Release Notes — SMG Barber v1.5.0

- **Data da Release:** 2026-10-24
- **Target Environment:** Produção (`https://barber.soumanager.com`)
- **Git Commit Base:** `d8301c0`
- **Fase:** Fase 6 — Production Readiness (Consolidada)
- **Aprovação Formal:** `Augusto (PO)`

---

## 📢 Resumo Executivo

A versão **v1.5.0** do SMG Barber consolida a maturidade operacional e a prontidão de produção da plataforma (**Production Readiness**). Esta release entrega a esteira de promoção contínua com validação automatizada pós-deploy (`P-AUTO`), a cobertura ponta a ponta dos fluxos críticos de negócio (agendamento, comissionamento com split e blindagem multi-tenant) e a padronização operacional de health checks e governança.

---

## 🚀 O Que Mudou (Changelog de Negócio)

### 💈 SMG Barber & Operação
- **Atalhos Rápidos de Caixa na Dashboard:** Inclusão de botões de acesso direto "Abrir Caixa" e "Fechar Caixa do Dia" no cabeçalho operacional, agilizando o fechamento de turno das unidades.
- **Split de Execução de Serviços & Comissões:** Reforço na integridade do rateio de serviços entre múltiplos profissionais (ex: barbeiro titular e assistente), assegurando transparência nos relatórios de repasse em `/#/commissions`.
- **Filtro de Competência nas Comissões:** Aprimoramento no filtro por período temporal na listagem de comissões, garantindo cálculo exato de produção variável por dia ou mês.

---

## 🛠️ Melhorias Técnicas & Arquitetura (Changelog Técnico)

- **Automação de Deploy & Production Gate (`P-AUTO`):**
  - Integração do workflow `.github/workflows/deploy-production.yml` com promoção no Vercel vinculada a ambiente GitHub protegido.
  - Execução automática de Smoke Tests E2E contra a URL promovida no pós-deploy, com captura automática de artefatos em caso de falha.
- **Bateria de E2E Críticos (Fase 6.5):**
  - **Pilar P1:** Agendamento → Comanda → Fechamento de Caixa (`flow1-appointment-to-cash-closing.spec.ts`).
  - **Pilar P2:** Checkout com Split 70/30 e Prova de Idempotência Financeira (`checkout-commission-split.spec.ts`).
  - **Pilar P3:** Isolamento Multi-tenant e Prevenção de Data Leak via UI, rota direta `/checkout/:id` e exportação CSV (`rls-ui-leak.spec.ts`).
- **Health Checks Padronizados (Fase 6.9):**
  - Endpoint e rotinas de health check para monitoramento de conectividade do banco de dados e APIs essenciais.
- **Matriz de Ambientes Documentada (Fase 6.3):**
  - Formalização dos isolamentos entre Staging (`tjcvuhynckocmvtqykxp`) e Produção (`ushsnmlbeurfvlkieiln`).
- **Blindagem Contra Execuções Acidentais:**
  - Imposição da flag `E2E_ALLOW_PROD_EXECUTION=true` para testes em ambientes compartilhados.

---

## 🗄️ Banco de Dados & Migrations

- [x] **Possui Migrations:** Não nesta release (schema remoto preservado).
- **Hardening de Políticas RLS:** Validadas e reforçadas na suíte de homologação sem necessidade de mutações estruturais de schema.

---

## ⚠️ Breaking Changes & Compatibilidade

- **Breaking Changes:** Nenhuma. A compatibilidade retroativa com os contratos de API e clientes existentes foi 100% preservada.

---

## 🔄 Plano de Rollback & Contingência

1. **Rollback de Aplicação (Frontend - Vercel):**
   - Acesse o Dashboard Vercel > Projeto `smg-barber`.
   - Localize o deployment anterior estável (`2117d14` ou prévio).
   - Clique em **Instant Rollback**.
2. **Procedimentos Operacionais:**
   - Consultar `docs/runbooks/INCIDENT_MANAGEMENT.md` para acionamento de plano de contingência.
