# Release Notes — SMG Barber `v1.8.0`

- **Data da Release:** 2026-11-04
- **Target Environment:** Produção (`https://barber.soumanager.com`)
- **Git Tag / Commit:** `v1.8.0`
- **Fase Relacionada:** Fase 7 — Product Maturity (Conclusão 100%)
- **Pull Requests Integrados:** #180 a #243
- **Aprovação Formal:** `Augusto (PO)`

---

## 📢 Resumo Executivo

A versão **v1.8.0** consolida a maturidade comercial e operacional do **SMG Barber** (*The Barbershop Intelligence*), marcando a conclusão integral da **Fase 7 (Product Maturity)**. Esta versão traz refinamentos profundos na esteira de atendimento da barbearia (recorrência de horários, agilidade de checkout, abertura de comanda expressa e modo mobile), consolida o Design System *Atelier Tech Sofisticado* (Dark-First, WCAG AA), formaliza toda a base educacional (SMG Academy) e de suporte (Central de Ajuda), e atesta a conformidade contábil estrita de tolerância zero ($\Delta = \text{R\$} 0,00$) em todos os fluxos vitais.

---

## 🚀 O Que Mudou (Changelog de Negócio)

### 💈 SMG Barber & Operação
- **Cadeira Cativa & Agendamento Recorrente:** Projeção inteligente de horários fixos (semanal, quinzenal, mensal) com confirmação prévia e disparo direto de mensagem no WhatsApp.
- **Abertura Ágil de Comandas (Atalho `N`):** Modal instantâneo no balcão com suporte a consumidor final sem cadastro obrigatório, itens mais frequentes e alerta proativo de comanda duplicada no dia.
- **Modo Barbeiro & Fila de Cadeira:** Experiência mobile ergonomicamente pensada para uso com 1 polegar, card de destaque "Na Cadeira Agora", início rápido e encaixe *walk-in* atômico.
- **Perfil 360° do Cliente & Combos:** Drawer lateral instantâneo com histórico cronológico, LTV, frequência de retorno e suporte a combos inteligentes de serviços com desconto.
- **Feedback Sensorial & Toasts 2.0:** Micro-interações táteis e sonoras para confirmação de ações de balcão, com barra de progresso regressiva nos alertas.

### 💰 Financeiro & Caixa
- **Checkout Expresso & Troco Inteligente:** Sugestão automática de cédulas em BRL, calculadora ágil de troco com bloqueio de sub-pagamento e auditoria em notas fiscais/fechamento.
- **Extrato Instantâneo de Comissões:** Visão transparente de produtividade e ganhos dos barbeiros com filtros de período e exportação limpa.
- **Tolerância Zero Contábil ($\Delta = \text{R\$} 0,00$):** Respeito estrito ao ADR-001 (separação de comissão teórica vs rateio efetivo de caixa) em pagamentos mistos e créditos do Club dos Chefes.

### 📚 Educação & Suporte
- **SMG Academy:** Hub educacional oficial com trilhas completas para Recepção, Barbeiro e Gestão, exercícios no Demo Mode e certificação com nota de corte de 80%.
- **Central de Ajuda:** Base de conhecimento orientada a sintomas, guia de contingência de hardware/redes (Plano A 4G/5G e Plano B manual) e matriz de suporte N1–N3 com SLA < 24h.

---

## 🛠️ Melhorias Técnicas & Arquitetura (Changelog Técnico)

- **UI & Design System v2.0:** Padronização canônica de componentes em `components/ui/` (`StatusBadge`, `Button`, `Modal`), Dark-First nativo em Tailwind v4 e eliminação de classes banidas (Blue/Purple Ban).
- **Consistência Funcional & Mensageria:** Dicionário canônico em pt-BR eliminando vazamentos de erros técnicos do Postgres/PostgREST para o usuário final.
- **Idempotência & Resiliência:** Guard de idempotência blindado contra falsos-positivos de UUID v4 numérico.
- **Governança & Documentação Interna:** Atualização técnica completa de `ARQUITETURA.md`, `DESENVOLVIMENTO.md` e formalização do `PROCESSOS_ENGENHARIA.md` com o princípio `MERGE ≠ DEPLOY PROD` (ADR-026/ADR-028).

---

## 🗄️ Banco de Dados & Migrations

- **Possui Migrations:** Sim (aplicadas e auditadas ao longo do ciclo da Fase 7).
- **RPCs Destacadas:**
  - `sync_comanda_from_appointment()` — Sincronização atômica entre grade de agendamentos e comandas com locks pessimistas `FOR UPDATE`.
- **Integridade:** Zero violações de isolamento por `tenant_id` e 100% de conformidade com políticas RLS.

---

## ⚠️ Breaking Changes & Compatibilidade

- **Breaking Changes:** Nenhuma breaking change identificada. Contratos e APIs existentes permanecem retrocompatíveis.

---

## 🔄 Plano de Rollback & Contingência

1. **Rollback de Aplicação (Frontend - Vercel):**
   - Acessar o Dashboard Vercel > Deployments.
   - Localizar a versão anterior estável (`v1.7.1`).
   - Acionar **Instant Rollback**.
2. **Rollback de Banco de Dados:**
   - Em caso de anomalia, utilizar os scripts de reversão mapeados nos planos de contingência em `docs/runbooks/DISASTER_RECOVERY_PLAN.md`.
3. **Contato de Suporte Operacional:** Augusto (PO) / Engenharia SMG Platform.

