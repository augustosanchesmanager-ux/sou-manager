# Índice de auditoria — `docs/audit/`

> **Natureza:** índice de navegação. Não é fonte da verdade sobre conteúdo — cada documento é a fonte do seu próprio escopo. O inventário abaixo é derivado mecanicamente de `git log` (data do primeiro commit que adicionou o arquivo) e do primeiro título H1 de cada documento. Nenhuma descrição foi escrita à mão nem inferida.
>
> **Uso:** localize pelo tema no título; confirme pelo documento. Data de entrada **não** é data de validade — documentos antigos podem estar superados. Quando um documento contradiz outro, vale o mais recente **e** o que tiver registro de autorização do PO.

---

## Convenção de nome para novos documentos

```
YYYY-MM-DD-slug.md
```

- `YYYY-MM-DD` = data da sessão/incidente que gerou o documento.
- `slug` = curto, em kebab-case, descrevendo o assunto (ex.: `errata-production-baseline`).
- Um documento por incidente ou frente. Sem versão no nome: correção de conteúdo é errata dentro do próprio arquivo, não arquivo novo.

**Nomes legados estão congelados.** Os arquivos existentes usam prefixos de fase (`6.1.4_`, `FASE_7_`), de frente (`TD001_`, `P_AUTO_`, `H7_`) e sufixo de data (`_20260928`). Renomeá-los quebraria referências cruzadas em `docs/adr/`, `ROADMAP.md`, `PROJECT_STATUS.md` e `docs/BUSINESS_DECISIONS.md`. A convenção vale **daqui para frente**; não há renomeação retroativa prevista.

---

## Inventário

Total: **146** documentos.

| Entrada | Documento | Título (H1 do próprio arquivo) |
|---|---|---|
| 2026-11-17 | [2026-11-17-deploy-gate-implementation-plan.md](./2026-11-17-deploy-gate-implementation-plan.md) | Plano cirúrgico — Gate de Deploy Pré-Atribuição |
| 2026-11-17 | [ERRATA_20261117_PRODUCTION_BASELINE.md](./ERRATA_20261117_PRODUCTION_BASELINE.md) | ERRATA — Baseline real de produção (Vercel `smg-barber`) |
| 2026-11-17 | [MERGE_ROUND_20261116_PR319_PR321_PR322.md](./MERGE_ROUND_20261116_PR319_PR321_PR322.md) | Rodada de Merge 2026-11-16 — PRs #319, #321, #322 |
| 2026-11-08 | [UNIFIED_RELEASE_NOTE_20261108.md](./UNIFIED_RELEASE_NOTE_20261108.md) | Auditoria de Liberação de Produção — Lote Unificado |
| 2026-11-06 | [FASE_8_SAAS_CERTIFICATION_REPORT.md](./FASE_8_SAAS_CERTIFICATION_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 8.11 (SaaS Certification) |
| 2026-11-05 | [PHASE_8_ENTRY_AUDIT.md](./PHASE_8_ENTRY_AUDIT.md) | PHASE 8 — ENTRY AUDIT (Commercial Scalability) |
| 2026-11-04 | [FASE_7_1_UX_REVIEW_CLOSING_REPORT.md](./FASE_7_1_UX_REVIEW_CLOSING_REPORT.md) | Relatório de Conclusão e Certificação — Fase 7.1 (UX Review Operacional) |
| 2026-11-04 | [FASE_7_10_PRODUCT_CERTIFICATION_REPORT.md](./FASE_7_10_PRODUCT_CERTIFICATION_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.10 (Product Certification) |
| 2026-11-04 | [FASE_7_2_BUSINESS_RULES_INVENTORY.md](./FASE_7_2_BUSINESS_RULES_INVENTORY.md) | FASE 7.2 — INVENTÁRIO E AUDITORIA DE REGRAS DE NEGÓCIO (BUSINESS RULES AUDIT) |
| 2026-11-04 | [FASE_7_2_BUSINESS_RULES_VALIDATION_REPORT.md](./FASE_7_2_BUSINESS_RULES_VALIDATION_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.2 (Business Rules Audit) |
| 2026-11-04 | [FASE_7_3_FUNCTIONAL_CONSISTENCY_INVENTORY.md](./FASE_7_3_FUNCTIONAL_CONSISTENCY_INVENTORY.md) | FASE 7.3 — INVENTÁRIO E AUDITORIA DE CONSISTÊNCIA FUNCIONAL (FUNCTIONAL CONSISTENCY AUDIT) |
| 2026-11-04 | [FASE_7_3_FUNCTIONAL_CONSISTENCY_VALIDATION_REPORT.md](./FASE_7_3_FUNCTIONAL_CONSISTENCY_VALIDATION_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.3 (Functional Consistency Audit) |
| 2026-11-04 | [FASE_7_4_UI_STANDARDIZATION_REPORT.md](./FASE_7_4_UI_STANDARDIZATION_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.4 (UI Standardization) |
| 2026-11-04 | [FASE_7_5_INTERNAL_DOCS_REPORT.md](./FASE_7_5_INTERNAL_DOCS_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.5 (Internal Documentation) |
| 2026-11-04 | [FASE_7_6_TRAINING_DOCS_REPORT.md](./FASE_7_6_TRAINING_DOCS_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.6 (Training Documentation) |
| 2026-11-04 | [FASE_7_7_ACADEMY_REPORT.md](./FASE_7_7_ACADEMY_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.7 (SMG Academy) |
| 2026-11-04 | [FASE_7_8_HELP_CENTER_REPORT.md](./FASE_7_8_HELP_CENTER_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.8 (Help Center) |
| 2026-11-04 | [FASE_7_9_BUSINESS_FLOW_REPORT.md](./FASE_7_9_BUSINESS_FLOW_REPORT.md) | Relatório Formal de Validação e Certificação — Fase 7.9 (Business Flow Certification) |
| 2026-10-24 | [FRONT_MANIFEST_FASE_6_11_DISASTER_RECOVERY.md](./FRONT_MANIFEST_FASE_6_11_DISASTER_RECOVERY.md) | Front Manifest — Fase 6.11 Disaster Recovery |
| 2026-10-24 | [FRONT_MANIFEST_FASE_6_5_E2E_CRITICOS.md](./FRONT_MANIFEST_FASE_6_5_E2E_CRITICOS.md) | Front Manifest — Fase 6.5 E2E Críticos |
| 2026-10-24 | [FRONT_MANIFEST_FASE_6_7_6_8_OPERACIONAL.md](./FRONT_MANIFEST_FASE_6_7_6_8_OPERACIONAL.md) | Front Manifest — Fase 6.7 e 6.8: Documentação Operacional & Release Notes |
| 2026-10-24 | [FRONT_MANIFEST_FASE_6_SUBFASES_RESTANTES.md](./FRONT_MANIFEST_FASE_6_SUBFASES_RESTANTES.md) | Front Manifest — Fase 6: Production Readiness (Subfases Restantes) |
| 2026-10-23 | [6.2_AUDIT_OBSERVABILIDADE.md](./6.2_AUDIT_OBSERVABILIDADE.md) | 6.2 — Auditoria de Observabilidade (Diagnóstico) |
| 2026-10-23 | [BRANCH_PROTECTION_RULES.md](./BRANCH_PROTECTION_RULES.md) | Regras de Proteção de Branch — `main` |
| 2026-10-23 | [FRONT_MANIFEST_FASE_6_2_OBSERVABILIDADE.md](./FRONT_MANIFEST_FASE_6_2_OBSERVABILIDADE.md) | Front Manifest — Fase 6.2 Observabilidade |
| 2026-10-23 | [FRONT_MANIFEST_FASE_6_3_AMBIENTES.md](./FRONT_MANIFEST_FASE_6_3_AMBIENTES.md) | Front Manifest — Fase 6.3 Ambientes |
| 2026-10-23 | [FRONT_MANIFEST_FASE_6_9_HEALTH_CHECKS.md](./FRONT_MANIFEST_FASE_6_9_HEALTH_CHECKS.md) | Front Manifest — Fase 6.9 Health Checks |
| 2026-09-30 | [CI_FINDING_01_02_LINT_ARCHITECTURE_GATES_20260928.md](./CI_FINDING_01_02_LINT_ARCHITECTURE_GATES_20260928.md) | CI FINDING-01/02 — Cobertura de lint incompleta e máscara de guards em `architecture:ci` |
| 2026-09-28 | [DEC001_H7_ATIVACAO_DIAGNOSTICO_20260928.md](./DEC001_H7_ATIVACAO_DIAGNOSTICO_20260928.md) | DEC-001 — Diagnóstico da Frente H7 (Ativação PROD Site↔SMG) |
| 2026-09-28 | [DEC001_H7_EVIDENCIAS_ATIVACAO_20260928.md](./DEC001_H7_EVIDENCIAS_ATIVACAO_20260928.md) | DEC-001/H7 — Evidências da Ativação PROD Site↔SMG + Checklist Executável |
| 2026-09-28 | [H7_B_TRILHO_B_INVESTIGACAO_ADICIONAL_RELATORIO.md](./H7_B_TRILHO_B_INVESTIGACAO_ADICIONAL_RELATORIO.md) | H-7 — Trilho B · Investigação Adicional Read-Only (import-export + sou-manager legado) |
| 2026-09-28 | [H7_B_TRILHO_B_P1_P4_READONLY_RELATORIO.md](./H7_B_TRILHO_B_P1_P4_READONLY_RELATORIO.md) | H-7 — Trilho B · Pré-condições P1–P4 (Read-Only) |
| 2026-09-28 | [P_AUTO_GATE409_DIAGNOSTIC_20260927.md](./P_AUTO_GATE409_DIAGNOSTIC_20260927.md) | P-AUTO — Diagnóstico READ-ONLY do Gate PR #93 (HTTP 409 no `promote`) |
| 2026-09-28 | [P_AUTO_STAGED_CERTIFICATION_20260928.md](./P_AUTO_STAGED_CERTIFICATION_20260928.md) | P-AUTO — Registro de Certificação do Production Gate (Release A) |
| 2026-09-28 | [P_AUTO_STAGED_CHANGE_PLAN_20260927.md](./P_AUTO_STAGED_CHANGE_PLAN_20260927.md) | P-AUTO — Plano de Mudança Staged Production (v1) + Change-Control |
| 2026-09-27 | [P_AUTO_FASE15_OPERATIONAL_PROOF_20260927.md](./P_AUTO_FASE15_OPERATIONAL_PROOF_20260927.md) | P-AUTO — Fase 1.5: Prova Operacional Controlada (2026-09-27) |
| 2026-09-22 | [H7_JANELA_ACOMPANHADA_PREPARACAO.md](./H7_JANELA_ACOMPANHADA_PREPARACAO.md) | H-7 — PREPARAÇÃO DA JANELA ACOMPANHADA (GATE B.1) |
| 2026-09-12 | [6.1.4_ACL_20260908120000_ABERTURA.md](./6.1.4_ACL_20260908120000_ABERTURA.md) | 6.1.4 — ABERTURA DA FRENTE: ACL `20260908120000` (Opção 3) |
| 2026-09-12 | [6.1.4_B2_FASE2_VALIDACAO_FRENTES_A.md](./6.1.4_B2_FASE2_VALIDACAO_FRENTES_A.md) | 6.1.4-B2 — FASE 2: VALIDAÇÃO FORMAL DAS 4 FRENTES A (M4, P0.3, P0.4, P2.1) |
| 2026-09-11 | [6.1.4_P0_3_RELATORIO_FINAL.md](./6.1.4_P0_3_RELATORIO_FINAL.md) | 6.1.4-B B2 — P0.3-C — Relatório Final de Implementação (D2/D3/D7/E2E) |
| 2026-09-11 | [6.1.4_P0_3_STOP_GATE.md](./6.1.4_P0_3_STOP_GATE.md) | 6.1.4-B B2 — STOP GATE FRENTE P0.3 (decisão formal do PO — 2026-09-11) |
| 2026-09-11 | [6.1.4_P0_4_DRIFT_EVIDENCIA_B3.md](./6.1.4_P0_4_DRIFT_EVIDENCIA_B3.md) | 6.1.4-B B2 — Evidência B3 — Drift do corpo `create_accounts_payable_from_recurring` (P0.4, PROD) |
| 2026-09-11 | [6.1.4_P0_4_STOP_GATE.md](./6.1.4_P0_4_STOP_GATE.md) | 6.1.4-B B2 — STOP GATE FRENTE P0.4 — ABERTURA/PREFLIGHT (decisões do PO registradas — 2026-09-11) |
| 2026-09-11 | [6.1.4_SMG_PR_APPROVE_AUTOMATION.md](./6.1.4_SMG_PR_APPROVE_AUTOMATION.md) | 6.1.4 — SMG: Automação de Aprovação Controlada de PR |
| 2026-09-11 | [P0_4_RELATORIO_FINAL.md](./P0_4_RELATORIO_FINAL.md) | P0.4 — Relatório Final da Frente (Abertura/Preflight + Validação D1–D7) |
| 2026-09-10 | [6.1.3_EVIDENCIA_A_CONSUMIDORES_FUNCOES.md](./6.1.3_EVIDENCIA_A_CONSUMIDORES_FUNCOES.md) | 6.1.3 — Evidência A: Auditoria de Consumidores das 9 Funções Críticas + Necessidade de Role |
| 2026-09-10 | [6.1.3_EVIDENCIA_B_MATRIZ_14_MIGRATIONS.md](./6.1.3_EVIDENCIA_B_MATRIZ_14_MIGRATIONS.md) | 6.1.3 — Evidência B: Matriz Definitiva das 14 Migrations (Repair Read-Only) |
| 2026-09-10 | [6.1.3_STAGING_READINESS_PLAN.md](./6.1.3_STAGING_READINESS_PLAN.md) | 6.1.3 — STAGING READINESS & IMPLEMENTATION PLAN |
| 2026-09-10 | [6.1.3_STOP_GATE_RECONCILIACAO_RELATORIO.md](./6.1.3_STOP_GATE_RECONCILIACAO_RELATORIO.md) | 6.1.3 — STOP GATE: Relatório de Reconciliação Git × Supabase (Staging × Produção) |
| 2026-09-10 | [6.1.4_A1_EXTRACAO_SANEAMENTO_MATRIZ.md](./6.1.4_A1_EXTRACAO_SANEAMENTO_MATRIZ.md) | 6.1.4-A.1 — Extração de Saneamento: Matriz de Proveniência Sanitizada (READ-ONLY) |
| 2026-09-10 | [6.1.4_B_STOP_GATE_CLASSIFICACAO.md](./6.1.4_B_STOP_GATE_CLASSIFICACAO.md) | 6.1.4-B — STOP GATE: Classificação Técnica dos Itens da Matriz Sanitizada (PRODUÇÃO) |
| 2026-09-10 | [6.1.4_B1_BASELINE_PROD_ROLLBACK.md](./6.1.4_B1_BASELINE_PROD_ROLLBACK.md) | 6.1.4-B B1 — Baseline de PROD capturado (material de rollback) |
| 2026-09-10 | [6.1.4_B3_LEDGER_PROVENIENCIA.md](./6.1.4_B3_LEDGER_PROVENIENCIA.md) | 6.1.4-B B3 — Proveniência e Ledger: Investigação Read-Only (P1.3 e lacunas do ledger) |
| 2026-09-06 | [P1_1_DESIGN_GATE.md](./P1_1_DESIGN_GATE.md) | P1.1 — Central de Relatórios (`/reports`) Design Gate |
| 2026-09-06 | [P1_3_ENTRY_AUDIT.md](./P1_3_ENTRY_AUDIT.md) | P1.3 — Entry Audit: Canonical KPIs via RPC `get_dashboard_kpis` |
| 2026-09-06 | [P1_3_PRODUCTION_GATE.md](./P1_3_PRODUCTION_GATE.md) | P1.3 — Production Gate: Canonical KPIs via RPC `get_dashboard_kpis` |
| 2026-09-05 | [G1_1_REVISAO_M4_FINANCE_SETTLE.md](./G1_1_REVISAO_M4_FINANCE_SETTLE.md) | G1.1 — Revisão Isolada da M4: Separação de Pagamento × Atendimento em `finance_settle_comanda` |
| 2026-09-05 | [G1_2_DECISOES_DOMINIO_M4.md](./G1_2_DECISOES_DOMINIO_M4.md) | G1.2 — Fechamento das Decisões de Domínio da M4 (Pagamento ≠ Atendimento ≠ Comissão) |
| 2026-09-05 | [M4_FASE2_MAPA_ESTADO_ATUAL.md](./M4_FASE2_MAPA_ESTADO_ATUAL.md) | M4 — Fase 2: MAPA DO ESTADO ATUAL (checklist de auditoria para implementação P1/P4/P5/P6/P7/P8) |
| 2026-09-05 | [M4_FASE2_UI_RELATORIO_FINAL.md](./M4_FASE2_UI_RELATORIO_FINAL.md) | M4 — FASE 2 · Relatório Final de Implementação (UI P4/P5/P7) |
| 2026-09-05 | [M4_FASE3_UI_E2E_RELATORIO_FINAL.md](./M4_FASE3_UI_E2E_RELATORIO_FINAL.md) | M4 — FASE 3 · Relatório Final (Revisão Funcional + E2E/Smoke da UI P4/P5/P7) |
| 2026-09-05 | [M4_FASE4_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md](./M4_FASE4_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md) | M4 — FASE 4 · Relatório Final (Homologação Funcional Real da UI P4/P5/P7) |
| 2026-09-05 | [M4_RELATORIO_FINAL.md](./M4_RELATORIO_FINAL.md) | M4 — Relatório Final de Implementação (P1/P4/P5/P6/P7/P8) |
| 2026-09-05 | [P0_4_A8_DESIGN_GATE.md](./P0_4_A8_DESIGN_GATE.md) | P0.4-A8 — Recurring Bill Idempotency Design Gate |
| 2026-09-05 | [P0_4_A8_FINDING.md](./P0_4_A8_FINDING.md) | P0.4-A8 — Recurring Bill Creation Lacks Idempotency Protection |
| 2026-09-05 | [P1_3_MATRIZ_DEFINICAO_KPIS_PROPOSAL.md](./P1_3_MATRIZ_DEFINICAO_KPIS_PROPOSAL.md) | P1.3 — Matriz de Definição de KPIs Canônicos (ISOLATE) |
| 2026-09-03 | [FASE_6_GAP_ANALYSIS.md](./FASE_6_GAP_ANALYSIS.md) | FASE 6 — Production Readiness |
| 2026-09-02 | [GATE1_AUDITORIA_CONFIRM_APPOINTMENT_ATTENDANCE.md](./GATE1_AUDITORIA_CONFIRM_APPOINTMENT_ATTENDANCE.md) | GATE 1 — Auditoria Read-Only: `confirm_appointment_attendance` (P5) |
| 2026-09-02 | [GATE2_CORRECAO_CONFIRM_APPOINTMENT_ATTENDANCE_RELATORIO_FINAL.md](./GATE2_CORRECAO_CONFIRM_APPOINTMENT_ATTENDANCE_RELATORIO_FINAL.md) | GATE 1 CORREÇÃO — Relatório Final: `confirm_appointment_attendance` (P5) Tenant-Scoped |
| 2026-09-02 | [H7_3_DRYRUN_REGULARIZACAO_COMPANADAS_ABERTAS.md](./H7_3_DRYRUN_REGULARIZACAO_COMPANADAS_ABERTAS.md) | Relatório de DRY-RUN e EXECUÇÃO — Regularização Financeira de Comandas em Aberto (até 31/07/2026) |
| 2026-09-02 | [STAGING_ADR021_REHOMOLOGACAO_P4_P7_RELATORIO_FINAL.md](./STAGING_ADR021_REHOMOLOGACAO_P4_P7_RELATORIO_FINAL.md) | STAGING GATE — ADR-021 · Relatório de Implementação do Fix + Re-Homologação P4/P7 (Isolamento Multi-Tenant) |
| 2026-09-02 | [STAGING_FASE1_READONLY_RELATORIO_FINAL.md](./STAGING_FASE1_READONLY_RELATORIO_FINAL.md) | STAGING GATE — FASE 1 · Relatório de Auditoria READ-ONLY (Homologação Isolada M4/P4/P5/P7) |
| 2026-09-02 | [STAGING_FASE2_PROVISIONAMENTO_RELATORIO_FINAL.md](./STAGING_FASE2_PROVISIONAMENTO_RELATORIO_FINAL.md) | STAGING GATE — FASE 2 · Relatório de Provisionamento Controlado |
| 2026-09-02 | [STAGING_FASE3_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md](./STAGING_FASE3_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md) | STAGING GATE — FASE 3 · Relatório de Homologação P4/P5/P7 (Isolamento Multi-Tenant) |
| 2026-09-02 | [STAGING_FASE4_AUDITORIA_POS_TESTE_RELATORIO_FINAL.md](./STAGING_FASE4_AUDITORIA_POS_TESTE_RELATORIO_FINAL.md) | STAGING GATE — FASE 4 · Relatório de Auditoria Pós-Teste (Estado Persistido) |
| 2026-09-02 | [STAGING_FASE5_TEARDOWN_RELATORIO_FINAL.md](./STAGING_FASE5_TEARDOWN_RELATORIO_FINAL.md) | STAGING GATE — FASE 5 · Relatório de Teardown (Restauração Pré-Homologação) |
| 2026-09-02 | [STAGING_GATE_RELATORIO_CONSOLIDADO.md](./STAGING_GATE_RELATORIO_CONSOLIDADO.md) | STAGING GATE — Relatório Consolidado (FASE 6) |
| 2026-08-29 | [AUDITORIA_FLUXO_FINANCEIRO_BAIXA.md](./AUDITORIA_FLUXO_FINANCEIRO_BAIXA.md) | Auditoria Técnica do Fluxo Financeiro — Comanda, Contas a Receber e Baixa |
| 2026-08-29 | [DESIGN_DOMINIO_FINANCEIRO_ATENDIMENTO.md](./DESIGN_DOMINIO_FINANCEIRO_ATENDIMENTO.md) | Modelo de Domínio Definitivo — Evolução Financeira, Atendimento e Pagamentos |
| 2026-08-29 | [G1_SCHEMA_DESIGN_M1-M3.md](./G1_SCHEMA_DESIGN_M1-M3.md) | G1 — Schema Design: M1-M3 (implementadas — A1 aprovado) |
| 2026-08-29 | [H7_2_PLANO_SANEAMENTO_ORFAOS.md](./H7_2_PLANO_SANEAMENTO_ORFAOS.md) | H7.2 — Plano de Saneamento de Comandas Órfãs (Fase 3.7) |
| 2026-08-29 | [PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md](./PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md) | Plano de Evolução — Fluxo Financeiro, Atendimento, Pagamentos e Auditoria |
| 2026-08-29 | [PLANO_TECNICO_FINANCEIRO_ATENDIMENTO.md](./PLANO_TECNICO_FINANCEIRO_ATENDIMENTO.md) | Plano Técnico — Evolução Financeira, Atendimento e Pagamentos |
| 2026-08-28 | [D8_DEPLOY_GATE_RUNBOOK_20260828.md](./D8_DEPLOY_GATE_RUNBOOK_20260828.md) | D8 — Deploy Gate Runbook |
| 2026-08-27 | [D8_AMD04_GATE_20260828.md](./D8_AMD04_GATE_20260828.md) | D8 / ADR-016 Amendment-04 — Retry/Requeue & Dead-Letter Gate (Audit) |
| 2026-08-27 | [D8_CONCURRENCY_GATE_20260827.md](./D8_CONCURRENCY_GATE_20260827.md) | D8 — Concurrency / Isolation / Idempotency Gate (DB Surface) |
| 2026-08-27 | [D8_DEPLOY_PLAN_20260828.md](./D8_DEPLOY_PLAN_20260828.md) | D8 — Production Deploy Plan & Pre-Deploy Gate (READ-ONLY) |
| 2026-08-27 | [D8_READONLY_DIAGNOSTIC_20260827.md](./D8_READONLY_DIAGNOSTIC_20260827.md) | D8 — Dispatcher Server-side: Read-Only Diagnostic |
| 2026-08-27 | [D8_WORKER_GATE_20260827.md](./D8_WORKER_GATE_20260827.md) | D8 — Worker Gate (Implementation: Gates B/C/D) |
| 2026-08-22 | [TD001_B3_4_A_DOMAIN_CONTRACT.md](./TD001_B3_4_A_DOMAIN_CONTRACT.md) | TD-001 B3.4-A — Contrato de Dominio: Comissao |
| 2026-08-22 | [TD001_B3_4_A1_REVERSAL_CONTRACT.md](./TD001_B3_4_A1_REVERSAL_CONTRACT.md) | TD-001 B3.4-A.1 — Contrato de Reversao de Comissao |
| 2026-08-22 | [TD001_B3_4_B_ACCEPTANCE_TESTS.md](./TD001_B3_4_B_ACCEPTANCE_TESTS.md) | TD-001 B3.4-B — Testes de Aceitacao (8 Cenarios) |
| 2026-08-22 | [TD001_B3_4_B_MIGRATION_PLAN.md](./TD001_B3_4_B_MIGRATION_PLAN.md) | TD-001 B3.4-B — Plano Tecnico: Migration `commission_records` |
| 2026-08-22 | [TD001_B3_4_B1_CORRECTIONS.md](./TD001_B3_4_B1_CORRECTIONS.md) | TD-001 B3.4-B.1 — Correcao do Migration Plan |
| 2026-08-22 | [TD001_B3_4_D_POST_IMPL_AUDIT.md](./TD001_B3_4_D_POST_IMPL_AUDIT.md) | TD-001 B3.4-D: Post-Implementation Audit |
| 2026-08-22 | [TD001_B3_4_EXECUTION_MATRIX.md](./TD001_B3_4_EXECUTION_MATRIX.md) | TD-001 B3.4 — Matriz de Execucao Financeira |
| 2026-08-22 | [TD001_B3_4_TECHNICAL_PLAN.md](./TD001_B3_4_TECHNICAL_PLAN.md) | TD-001 B3.4 — Plano Tecnico: FinanceProvider |
| 2026-08-21 | [CHEF_CLUB_POSITIVE_TEST_PLAN.md](./CHEF_CLUB_POSITIVE_TEST_PLAN.md) | Clube do Chefe — Teste Positivo (Caminho Feliz) |
| 2026-08-21 | [TD001_B3_1_FINANCIAL_CONTRACT.md](./TD001_B3_1_FINANCIAL_CONTRACT.md) | TD-001 B3.1 — Contrato Financeiro Completo |
| 2026-08-21 | [TD001_B3_3_POST_IMPL_AUDIT.md](./TD001_B3_3_POST_IMPL_AUDIT.md) | TD-001 B3.3 — Post-Implementation Audit |
| 2026-08-21 | [TD001_B3_4_C_POST_IMPL_AUDIT.md](./TD001_B3_4_C_POST_IMPL_AUDIT.md) | TD-001 B3.4-C — Post-Implementation Audit |
| 2026-08-21 | [TD001_POST_DEPLOY_AUDIT.md](./TD001_POST_DEPLOY_AUDIT.md) | TD-001 — Pós-Deploy Audit (B1+B2) |
| 2026-08-20 | [H7_REMEDIATION_FINANCIAL_MODEL_SPEC.md](./H7_REMEDIATION_FINANCIAL_MODEL_SPEC.md) | H7-REMEDIATION — Especificação Formal do Modelo Financeiro do Fechamento |
| 2026-08-20 | [TD001_PHASE4_EVENT_WIRING.md](./TD001_PHASE4_EVENT_WIRING.md) | TD-001: Phase 4 Event Infrastructure Runtime Wiring |
| 2026-08-19 | [DEV001_FINANCIAL_SEMANTICS.md](./DEV001_FINANCIAL_SEMANTICS.md) | DEV-001 — Contrato Financeiro Oficial |
| 2026-08-19 | [FINANCIAL_AUDIT_FRAMEWORK_20260817.md](./FINANCIAL_AUDIT_FRAMEWORK_20260817.md) | Framework de Auditoria Financeira — SMG Barber |
| 2026-08-16 | [H10_FOTOGRAFIA_POS_RELEASE_20260816.md](./H10_FOTOGRAFIA_POS_RELEASE_20260816.md) | H-10 — FOTOGRAFIA DE ESTADO PÓS-RELEASE (pós-H-9 / decisão de roadmap) |
| 2026-08-16 | [H7_1_AUDITORIA_TECNICA.md](./H7_1_AUDITORIA_TECNICA.md) | H-7.1 — Auditoria Técnica Formal do Ciclo H7-1 (Investigação Read-Only) |
| 2026-08-16 | [H7_1_INVESTIGACAO_S3_READONLY_20260816.md](./H7_1_INVESTIGACAO_S3_READONLY_20260816.md) | H-7 — Investigação S3 (Recebíveis) — Read-Only |
| 2026-08-16 | [H7_1_TRILHA_A_REPRODUCAO.md](./H7_1_TRILHA_A_REPRODUCAO.md) | H-7.1 — Trilha A: Reprodução do Incidente Original — Causa Raiz Confirmada |
| 2026-08-16 | [H7_1_TRILHA_B_CLASSIFICACAO_DIVIDA.md](./H7_1_TRILHA_B_CLASSIFICACAO_DIVIDA.md) | H-7.1 — Trilha B: Classificação Formal da Dívida Arquitetural — Gate B-4 |
| 2026-08-16 | [H7_1_TRILHA_B_DOCUMENTAL.md](./H7_1_TRILHA_B_DOCUMENTAL.md) | H-7.1 — Trilha B: Auditoria Documental da Fase 4 (Event Driven) — Gate B-3 |
| 2026-08-16 | [H7_BASELINE_READONLY.md](./H7_BASELINE_READONLY.md) | H-7 — Operação Real: Baseline Read-Only do Tenant Sanchez Barber |
| 2026-08-16 | [H9_RELEASE_FIX_SUPERADMIN_20260816.md](./H9_RELEASE_FIX_SUPERADMIN_20260816.md) | H-9 — RELEASE DO FIX `tenants.active` (merge + deploy + smoke pós-deploy) |
| 2026-08-14 | [H6_5_PRODUCTION_SAFETY_GATE.md](./H6_5_PRODUCTION_SAFETY_GATE.md) | H-6.5 — PRODUCTION SAFETY GATE (aplicação das 10 migrations de remediação H-6) |
| 2026-08-14 | [H7_OPERACAO_REAL_ROTEIRO.md](./H7_OPERACAO_REAL_ROTEIRO.md) | H-7 — Operação Real: Roteiro de Execução e Checklist de Evidências |
| 2026-08-13 | [H3_CHEF_CLUB_ADESAO_VALIDATION.md](./H3_CHEF_CLUB_ADESAO_VALIDATION.md) | H-3 — Chef Club: Validação da Adesão (evidência) |
| 2026-08-13 | [H3_CHEF_CLUB_BENEFIT_CHECKOUT_VALIDATION.md](./H3_CHEF_CLUB_BENEFIT_CHECKOUT_VALIDATION.md) | H-3 — Chef Club: Validação do Benefício no Checkout (evidência) |
| 2026-08-13 | [H3_CHEF_CLUB_CREDITS_VALIDATION.md](./H3_CHEF_CLUB_CREDITS_VALIDATION.md) | H-3 — Chef Club: Validação do Consumo de Créditos (evidência) |
| 2026-08-13 | [H3_CHEF_CLUB_PERMISSIONS_VALIDATION.md](./H3_CHEF_CLUB_PERMISSIONS_VALIDATION.md) | H-3 — Chef Club: Permissões por Role (evidência) |
| 2026-08-13 | [H3_CHEF_CLUB_PLAN_RULES_VALIDATION.md](./H3_CHEF_CLUB_PLAN_RULES_VALIDATION.md) | H-3 — Chef Club: Regras de Plano Respeitadas (evidência) |
| 2026-08-13 | [H3_CHEF_CLUB_SUBSCRIPTIONS_VALIDATION.md](./H3_CHEF_CLUB_SUBSCRIPTIONS_VALIDATION.md) | H-3 — Chef Club: Assinaturas Preservadas (evidência) |
| 2026-08-13 | [H4_BILLING_LIFECYCLE_VALIDATION.md](./H4_BILLING_LIFECYCLE_VALIDATION.md) | H-4 — Billing / Tenant Lifecycle: Matriz de Estados (evidência) |
| 2026-08-13 | [H5_FEATURE_FLAGS_VALIDATION.md](./H5_FEATURE_FLAGS_VALIDATION.md) | H-5 — Feature Flags: Matriz por Plano + Enforcement de UI (evidência) |
| 2026-08-13 | [H6_SECURITY_AUDIT.md](./H6_SECURITY_AUDIT.md) | H-6 — Segurança: Auditoria adversarial RLS/RPC (evidência) |
| 2026-08-08 | [HOMOLOG_ACCOUNT_PROVISIONING.md](./HOMOLOG_ACCOUNT_PROVISIONING.md) | HOMOLOG ACCOUNT PROVISIONING — Sanchez Barber (ETAPA B, §8.1#3) |
| 2026-08-08 | [HOMOLOGATION_PLAN_SANCHEZ_BARBER.md](./HOMOLOGATION_PLAN_SANCHEZ_BARBER.md) | HOMOLOGATION PLAN — SANCHEZ BARBER (gate formal da v1.5.0) |
| 2026-08-08 | [SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md](./SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md) | SNAPSHOT PRÉ-HOMOLOGAÇÃO — SANCHEZ BARBER — v1.5.0 |
| 2026-08-08 | [VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md](./VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md) | VERCEL DEPLOYMENT TOPOLOGY AUDIT — SMG BARBER (H-8) |
| 2026-08-07 | [PHASE_6_0_5_3_ENTRY_AUDIT.md](./PHASE_6_0_5_3_ENTRY_AUDIT.md) | PHASE 6.0.5.3 — ENTRY AUDIT (FeatureFlagService + Feature Flags Enforcement) |
| 2026-08-07 | [PHASE_6_0_5_4_ENTRY_AUDIT.md](./PHASE_6_0_5_4_ENTRY_AUDIT.md) | PHASE 6.0.5.4 — ENTRY AUDIT (TenantLifecycleService + `suspended` aditivo) |
| 2026-08-07 | [PHASE_6_0_5_5_ENTRY_AUDIT.md](./PHASE_6_0_5_5_ENTRY_AUDIT.md) | PHASE 6.0.5.5 — ENTRY AUDIT (Transições RPCs: `change_tenant_plan` + banner + UpgradePrompt + correção `Adm... |
| 2026-08-07 | [PHASE_6_0_6_ENTRY_AUDIT.md](./PHASE_6_0_6_ENTRY_AUDIT.md) | PHASE 6.0.6 — ENTRY AUDIT (Compliance & Legal) |
| 2026-08-07 | [PRODUCTION_COMPATIBILITY_AUDIT.md](./PRODUCTION_COMPATIBILITY_AUDIT.md) | PRODUCTION COMPATIBILITY AUDIT — Release v1.5 |
| 2026-08-06 | [PHASE_6_0_4_4_EXECUTION_PLAN.md](./PHASE_6_0_4_4_EXECUTION_PLAN.md) | PHASE 6.0.4.4 — Billing Engine (Execution Plan) |
| 2026-08-06 | [PHASE_6_0_4_AUDIT.md](./PHASE_6_0_4_AUDIT.md) | Phase 6.0.4 — Billing (Tenant Lifecycle): Auditoria |
| 2026-08-06 | [PHASE_6_0_4_EXECUTION_PLAN.md](./PHASE_6_0_4_EXECUTION_PLAN.md) | Phase 6.0.4 — Billing (Tenant Lifecycle): Execution Plan |
| 2026-08-06 | [PHASE_6_0_5_1_ENTRY_CHECK.md](./PHASE_6_0_5_1_ENTRY_CHECK.md) | PHASE 6.0.5.1 — ENTRY CHECK (Estado Efetivo / Camada de Autorização) |
| 2026-08-06 | [PHASE_6_0_5_2_ENTRY_AUDIT.md](./PHASE_6_0_5_2_ENTRY_AUDIT.md) | PHASE 6.0.5.2 — ENTRY AUDIT (BillingService + Modelagem de Plans) |
| 2026-08-06 | [PHASE_6_0_5_ENTRY_AUDIT.md](./PHASE_6_0_5_ENTRY_AUDIT.md) | PHASE 6.0.5 — ENTRY AUDIT (Feature Flags / Suspensão / Reativação) |
| 2026-08-05 | [MIGRATION_EXCEPTION_20260801.md](./MIGRATION_EXCEPTION_20260801.md) | Exceção Operacional — Aplicação Manual da Migration #91 (Phase 6.0.1) |
| 2026-08-05 | [PHASE_6_0_3_EXECUTION_PLAN.md](./PHASE_6_0_3_EXECUTION_PLAN.md) | Phase 6.0.3 — Team Onboarding & Invitations: Execution Plan |
| 2026-07-28 | [DEPLOYMENT_PLAN_20260728.md](./DEPLOYMENT_PLAN_20260728.md) | Plano de Implantação — Sprint 1 (v1.0 RC → v1.0) |
| 2026-07-28 | [FINAL_READINESS_REPORT_20260728.md](./FINAL_READINESS_REPORT_20260728.md) | Relatório Final de Prontidão para Produção |
| 2026-07-28 | [POST_EXECUTION_REPORT_20260728.md](./POST_EXECUTION_REPORT_20260728.md) | Relatório Pós-Execução — Sprint 1 (Tenant Lifecycle) |
| 2026-07-28 | [PRE_MIGRATION_AUDIT_20260728.md](./PRE_MIGRATION_AUDIT_20260728.md) | Auditoria Pré-Migration — Sprint 1 Tenant Lifecycle |

---

## Dívida declarada deste índice

1. **Data no nome não é confiável quando existe.** De 23 documentos com `_YYYYMMDD` no nome, **7 divergem** da data de entrada no git. A coluna `Entrada` é a do git; o nome registra a intenção da frente, não o commit.
2. **Data ausente no nome** na maioria dos documentos — a coluna "Entrada" resolve isso.
3. **Nomes com numeração de fase** (`6.1.4_`, `FASE_7_`) não ordenam alfabeticamente por data; a ordenação útil é a da coluna "Entrada".
4. **Sem campo de status** (ativo / superado / encerrado) — hoje o status vive no documento ou no `PROJECT_STATUS.md`, não aqui.
5. **Sem checagem automática** de que documento novo entrou no índice: este arquivo é regenerado manualmente.

Resolver (1)–(4) exige decisão do PO sobre renomeação; (5) exigiria script em CI, o que é mudança de CI (PO + ADR).
