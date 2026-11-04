import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('FASE 7.10: Product Certification (Certificação Master dos 10 Pilares de Maturidade)', () => {
    const rootDir = process.cwd();

    // =========================================================================
    // PILAR 1: UX REVIEW (FASE 7.1)
    // =========================================================================
    describe('1. Pilar de UX Review (Atelier Tech & Acessibilidade WCAG)', () => {
        it('CERT-P1-001: deve possuir a especificação do Design System Atelier Tech documentada', () => {
            const designDocPath = path.join(rootDir, 'docs', 'design', 'DESIGN_SYSTEM_SMG_BARBER.md');
            expect(fs.existsSync(designDocPath), 'DESIGN_SYSTEM_SMG_BARBER.md deve existir').toBe(true);
            const content = fs.readFileSync(designDocPath, 'utf-8');
            expect(content).toContain('Atelier Tech');
            expect(content).toContain('WCAG');
            expect(content).toContain('Dark-First');
        });

        it('CERT-P1-002: deve possuir o relatório formal de encerramento da Fase 7.1 (UX Review)', () => {
            const closingReportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_1_UX_REVIEW_CLOSING_REPORT.md');
            expect(fs.existsSync(closingReportPath), 'FASE_7_1_UX_REVIEW_CLOSING_REPORT.md deve existir').toBe(true);
            const content = fs.readFileSync(closingReportPath, 'utf-8');
            expect(content).toContain('13 Frentes Operacionais');
            expect(content).toContain('PR #180');
            expect(content).toContain('PR #243');
        });
    });

    // =========================================================================
    // PILAR 2: REGRAS DE NEGÓCIO (FASE 7.2)
    // =========================================================================
    describe('2. Pilar de Regras de Negócio (27 RNs & Casos Extremos)', () => {
        it('CERT-P2-001: deve possuir o relatório de validação das 27 regras de negócio', () => {
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_2_BUSINESS_RULES_VALIDATION_REPORT.md');
            const inventoryPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_2_BUSINESS_RULES_INVENTORY.md');

            expect(fs.existsSync(reportPath), 'FASE_7_2_BUSINESS_RULES_VALIDATION_REPORT.md deve existir').toBe(true);
            expect(fs.existsSync(inventoryPath), 'FASE_7_2_BUSINESS_RULES_INVENTORY.md deve existir').toBe(true);

            const content = fs.readFileSync(reportPath, 'utf-8');
            expect(content).toContain('27 Regras Canônicas');
            expect(content).toContain('RN-AUTH-001');
            expect(content).toContain('RN-SCH-001');
        });

        it('CERT-P2-002: deve conter a validação dos 4 casos extremos de fronteira financeira', () => {
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_2_BUSINESS_RULES_VALIDATION_REPORT.md');
            const content = fs.readFileSync(reportPath, 'utf-8');
            expect(content).toContain('Casos Extremos Financeiros');
            expect(content).toContain('ADR-001');
        });
    });

    // =========================================================================
    // PILAR 3: CONSISTÊNCIA FUNCIONAL (FASE 7.3)
    // =========================================================================
    describe('3. Pilar de Consistência Funcional (5 Fluxos & Dicionário pt-BR)', () => {
        it('CERT-P3-001: deve possuir o relatório formal de consistência funcional', () => {
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_3_FUNCTIONAL_CONSISTENCY_VALIDATION_REPORT.md');
            const inventoryPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_3_FUNCTIONAL_CONSISTENCY_INVENTORY.md');

            expect(fs.existsSync(reportPath), 'FASE_7_3_FUNCTIONAL_CONSISTENCY_VALIDATION_REPORT.md deve existir').toBe(true);
            expect(fs.existsSync(inventoryPath), 'FASE_7_3_FUNCTIONAL_CONSISTENCY_INVENTORY.md deve existir').toBe(true);

            const content = fs.readFileSync(reportPath, 'utf-8');
            expect(content).toContain('5 Fluxos Operacionais');
            expect(content).toContain('pt-BR');
        });

        it('CERT-P3-002: deve possuir a taxonomia oficial em docs/TAXONOMY.md', () => {
            const taxDocPath = path.join(rootDir, 'docs', 'TAXONOMY.md');
            expect(fs.existsSync(taxDocPath), 'TAXONOMY.md deve existir').toBe(true);
            const content = fs.readFileSync(taxDocPath, 'utf-8');
            expect(content).toContain('SMG Barber');
            expect(content).toContain('SMG Intelligence');
        });
    });

    // =========================================================================
    // PILAR 4: PADRONIZAÇÃO DE UI (FASE 7.4)
    // =========================================================================
    describe('4. Pilar de Padronização de UI (Design System v2.0)', () => {
        it('CERT-P4-001: deve possuir o relatório da auditoria de padronização de UI', () => {
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_4_UI_STANDARDIZATION_REPORT.md');
            expect(fs.existsSync(reportPath), 'FASE_7_4_UI_STANDARDIZATION_REPORT.md deve existir').toBe(true);
            const content = fs.readFileSync(reportPath, 'utf-8');
            expect(content).toContain('StatusBadge');
            expect(content).toContain('Design System');
        });

        it('CERT-P4-002: deve possuir o componente canônico StatusBadge implementado', () => {
            const statusBadgePath = path.join(rootDir, 'components', 'ui', 'StatusBadge.tsx');
            expect(fs.existsSync(statusBadgePath), 'StatusBadge.tsx deve existir').toBe(true);
            const content = fs.readFileSync(statusBadgePath, 'utf-8');
            expect(content).toContain('StatusBadge');
            expect(content).toContain('StatusBadgeProps');
            expect(content).toContain('statusMap');
        });
    });

    // =========================================================================
    // PILAR 5: DOCUMENTAÇÃO INTERNA (FASE 7.5)
    // =========================================================================
    describe('5. Pilar de Documentação Interna de Engenharia', () => {
        it('CERT-P5-001: deve possuir os documentos pilares de arquitetura e desenvolvimento', () => {
            const arqPath = path.join(rootDir, 'docs', 'ARQUITETURA.md');
            const devPath = path.join(rootDir, 'docs', 'DESENVOLVIMENTO.md');
            const procPath = path.join(rootDir, 'docs', 'PROCESSOS_ENGENHARIA.md');
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_5_INTERNAL_DOCS_REPORT.md');

            expect(fs.existsSync(arqPath), 'ARQUITETURA.md deve existir').toBe(true);
            expect(fs.existsSync(devPath), 'DESENVOLVIMENTO.md deve existir').toBe(true);
            expect(fs.existsSync(procPath), 'PROCESSOS_ENGENHARIA.md deve existir').toBe(true);
            expect(fs.existsSync(reportPath), 'FASE_7_5_INTERNAL_DOCS_REPORT.md deve existir').toBe(true);
        });

        it('CERT-P5-002: os documentos de engenharia devem cobrir ADRs e segurança', () => {
            const arqContent = fs.readFileSync(path.join(rootDir, 'docs', 'ARQUITETURA.md'), 'utf-8');
            expect(arqContent).toContain('ADR-001');
            expect(arqContent).toContain('ADR-026');
            expect(arqContent).toContain('Multi-Tenant');
        });
    });

    // =========================================================================
    // PILAR 6: DOCUMENTAÇÃO DE TREINAMENTO (FASE 7.6)
    // =========================================================================
    describe('6. Pilar de Documentação de Treinamento Operacional', () => {
        it('CERT-P6-001: deve possuir os manuais e guias de treinamento dos módulos', () => {
            const trainingDir = path.join(rootDir, 'docs', 'training');
            const manualPath = path.join(trainingDir, 'MANUAL_DO_USUARIO_SMG_BARBER.md');
            const rolesPath = path.join(trainingDir, 'TUTORIAIS_POR_ROLE.md');
            const quickstartPath = path.join(trainingDir, 'GUIA_INICIO_RAPIDO.md');
            const faqPath = path.join(trainingDir, 'FAQ_OPERACIONAL.md');
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_6_TRAINING_DOCS_REPORT.md');

            expect(fs.existsSync(manualPath), 'MANUAL_DO_USUARIO_SMG_BARBER.md deve existir').toBe(true);
            expect(fs.existsSync(rolesPath), 'TUTORIAIS_POR_ROLE.md deve existir').toBe(true);
            expect(fs.existsSync(quickstartPath), 'GUIA_INICIO_RAPIDO.md deve existir').toBe(true);
            expect(fs.existsSync(faqPath), 'FAQ_OPERACIONAL.md deve existir').toBe(true);
            expect(fs.existsSync(reportPath), 'FASE_7_6_TRAINING_DOCS_REPORT.md deve existir').toBe(true);
        });
    });

    // =========================================================================
    // PILAR 7: SMG ACADEMY (FASE 7.7)
    // =========================================================================
    describe('7. Pilar do SMG Academy (Capacitação e Certificação)', () => {
        it('CERT-P7-001: deve possuir o ecossistema completo do SMG Academy', () => {
            const academyDir = path.join(rootDir, 'docs', 'academy');
            const hubPath = path.join(academyDir, 'README.md');
            const trilhaBarbeiro = path.join(academyDir, 'TRILHA_BARBEIRO_BANCADA.md');
            const trilhaGestao = path.join(academyDir, 'TRILHA_GESTAO_E_DONO.md');
            const trilhaRecepcao = path.join(academyDir, 'TRILHA_RECEPCAO_E_CAIXA.md');
            const certPath = path.join(academyDir, 'SISTEMA_DE_CERTIFICACAO.md');
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_7_ACADEMY_REPORT.md');

            expect(fs.existsSync(hubPath), 'Hub Academy deve existir').toBe(true);
            expect(fs.existsSync(trilhaBarbeiro), 'TRILHA_BARBEIRO_BANCADA.md deve existir').toBe(true);
            expect(fs.existsSync(trilhaGestao), 'TRILHA_GESTAO_E_DONO.md deve existir').toBe(true);
            expect(fs.existsSync(trilhaRecepcao), 'TRILHA_RECEPCAO_E_CAIXA.md deve existir').toBe(true);
            expect(fs.existsSync(certPath), 'SISTEMA_DE_CERTIFICACAO.md deve existir').toBe(true);
            expect(fs.existsSync(reportPath), 'FASE_7_7_ACADEMY_REPORT.md deve existir').toBe(true);
        });

        it('CERT-P7-002: deve possuir a suíte de testes do Academy ativa', () => {
            const testPath = path.join(rootDir, 'tests', 'docs', 'fase7_7_academy.test.ts');
            expect(fs.existsSync(testPath), 'fase7_7_academy.test.ts deve existir').toBe(true);
        });
    });

    // =========================================================================
    // PILAR 8: CENTRAL DE AJUDA & SUPORTE (FASE 7.8)
    // =========================================================================
    describe('8. Pilar da Central de Ajuda & Suporte Operacional', () => {
        it('CERT-P8-001: deve possuir a base completa da Central de Ajuda', () => {
            const helpDir = path.join(rootDir, 'docs', 'help');
            const hubPath = path.join(helpDir, 'README.md');
            const troubleshotPath = path.join(helpDir, 'ARTIGOS_SOLUCAO_PROBLEMAS.md');
            const contPath = path.join(helpDir, 'GUIA_CONTINGENCIA_HARDWARE.md');
            const supPath = path.join(helpDir, 'SISTEMA_DE_SUPORTE_E_TICKETS.md');
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_8_HELP_CENTER_REPORT.md');

            expect(fs.existsSync(hubPath), 'Hub Central de Ajuda deve existir').toBe(true);
            expect(fs.existsSync(troubleshotPath), 'ARTIGOS_SOLUCAO_PROBLEMAS.md deve existir').toBe(true);
            expect(fs.existsSync(contPath), 'GUIA_CONTINGENCIA_HARDWARE.md deve existir').toBe(true);
            expect(fs.existsSync(supPath), 'SISTEMA_DE_SUPORTE_E_TICKETS.md deve existir').toBe(true);
            expect(fs.existsSync(reportPath), 'FASE_7_8_HELP_CENTER_REPORT.md deve existir').toBe(true);
        });

        it('CERT-P8-002: deve possuir a suíte de testes do Help Center ativa', () => {
            const testPath = path.join(rootDir, 'tests', 'docs', 'fase7_8_help_center.test.ts');
            expect(fs.existsSync(testPath), 'fase7_8_help_center.test.ts deve existir').toBe(true);
        });
    });

    // =========================================================================
    // PILAR 9: BUSINESS FLOW CERTIFICATION (FASE 7.9)
    // =========================================================================
    describe('9. Pilar de Certificação dos Fluxos de Negócio (5 Fluxos Vitais)', () => {
        it('CERT-P9-001: deve possuir o Dossiê de Certificação dos Fluxos de Negócio', () => {
            const certFlowPath = path.join(rootDir, 'docs', 'certification', 'BUSINESS_FLOW_CERTIFICATION.md');
            const reportPath = path.join(rootDir, 'docs', 'audit', 'FASE_7_9_BUSINESS_FLOW_REPORT.md');

            expect(fs.existsSync(certFlowPath), 'BUSINESS_FLOW_CERTIFICATION.md deve existir').toBe(true);
            expect(fs.existsSync(reportPath), 'FASE_7_9_BUSINESS_FLOW_REPORT.md deve existir').toBe(true);

            const content = fs.readFileSync(certFlowPath, 'utf-8');
            expect(content).toContain('Tolerância Zero');
            expect(content).toContain('ADR-001');
            expect(content).toContain('Fluxo 1: Agenda');
            expect(content).toContain('Fluxo 2: Financeiro');
            expect(content).toContain('Fluxo 3: Caixa');
            expect(content).toContain('Fluxo 4: Comissão');
            expect(content).toContain('Fluxo 5: Club dos Chefes');
        });

        it('CERT-P9-002: deve possuir a suíte de testes ponta a ponta dos fluxos vitais', () => {
            const flowTestPath = path.join(rootDir, 'tests', 'flows', 'fase7_9_business_flow.test.ts');
            expect(fs.existsSync(flowTestPath), 'fase7_9_business_flow.test.ts deve existir').toBe(true);
        });
    });

    // =========================================================================
    // PILAR 10: PRODUCT CERTIFICATION DOSSIER & GOVERNANÇA (FASE 7.10)
    // =========================================================================
    describe('10. Pilar de Certificação Master de Produto & Governança', () => {
        const certMasterPath = path.join(rootDir, 'docs', 'certification', 'PRODUCT_CERTIFICATION.md');

        it('CERT-P10-001: o Dossiê Master de Certificação de Produto deve existir e estar em conformidade', () => {
            expect(fs.existsSync(certMasterPath), 'PRODUCT_CERTIFICATION.md deve existir').toBe(true);
            const content = fs.readFileSync(certMasterPath, 'utf-8');

            expect(content).toContain('SMG Barber');
            expect(content).toContain('SMG Intelligence');
            expect(content).toContain('The Barbershop Intelligence');
            expect(content).toContain('ADR-026');
            expect(content).toContain('MERGE');
            expect(content).toContain('DEPLOY PROD');
            expect(content).toContain('ADR-001');
            expect(content).toContain('Tolerância Zero Contábil');
        });

        it('CERT-P10-002: deve cobrir a matriz dos 10 pilares de maturidade e sign-off formal', () => {
            const content = fs.readFileSync(certMasterPath, 'utf-8');
            expect(content).toContain('UX Review (7.1)');
            expect(content).toContain('Business Rules (7.2)');
            expect(content).toContain('Functional Consistency (7.3)');
            expect(content).toContain('UI Standardization (7.4)');
            expect(content).toContain('Internal Documentation (7.5)');
            expect(content).toContain('Training Documentation (7.6)');
            expect(content).toContain('SMG Academy (7.7)');
            expect(content).toContain('Help Center (7.8)');
            expect(content).toContain('Business Flow (7.9)');
            expect(content).toContain('Suporte & Governança');
            expect(content).toContain('Sign-off Formal de Homologação');
            expect(content).toContain('Augusto');
            expect(content).toContain('OpenCode / Antigravity');
        });

        it('CERT-P10-003: os contratos de governança formal e Change Control devem estar ativos', () => {
            const procPath = path.join(rootDir, 'docs', 'PROCESSOS_ENGENHARIA.md');
            const agentsPath = path.join(rootDir, 'AGENTS.md');

            expect(fs.existsSync(procPath), 'PROCESSOS_ENGENHARIA.md deve existir').toBe(true);
            expect(fs.existsSync(agentsPath), 'AGENTS.md deve existir').toBe(true);

            const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
            expect(agentsContent).toContain('MERGE ≠ DEPLOY PROD');
            expect(agentsContent).toContain('SMG Change Control Protocol');

            const procContent = fs.readFileSync(procPath, 'utf-8');
            expect(procContent).toContain('MERGE ≠ DEPLOY PROD');
            expect(procContent).toContain('Authorization Record');
        });
    });
});
