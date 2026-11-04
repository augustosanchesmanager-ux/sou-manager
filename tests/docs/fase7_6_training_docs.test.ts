import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Fase 7.6 — Training & Operational Documentation Completeness Audit', () => {
    const rootDir = process.cwd();
    const trainingDir = path.join(rootDir, 'docs', 'training');
    const readmePath = path.join(trainingDir, 'README.md');
    const manualPath = path.join(trainingDir, 'MANUAL_DO_USUARIO_SMG_BARBER.md');
    const rolePath = path.join(trainingDir, 'TUTORIAIS_POR_ROLE.md');
    const quickstartPath = path.join(trainingDir, 'GUIA_INICIO_RAPIDO.md');
    const faqPath = path.join(trainingDir, 'FAQ_OPERACIONAL.md');

    describe('Pilar 1: Integridade Estrutural dos Arquivos de Treinamento', () => {
        it('DOC-TRN-001: todos os 5 documentos da central de treinamento devem existir', () => {
            expect(fs.existsSync(readmePath), 'README.md deve existir').toBe(true);
            expect(fs.existsSync(manualPath), 'MANUAL_DO_USUARIO_SMG_BARBER.md deve existir').toBe(true);
            expect(fs.existsSync(rolePath), 'TUTORIAIS_POR_ROLE.md deve existir').toBe(true);
            expect(fs.existsSync(quickstartPath), 'GUIA_INICIO_RAPIDO.md deve existir').toBe(true);
            expect(fs.existsSync(faqPath), 'FAQ_OPERACIONAL.md deve existir').toBe(true);
        });

        it('DOC-TRN-002: deve respeitar a Brand Architecture oficial nos cabeçalhos', () => {
            const readme = fs.readFileSync(readmePath, 'utf-8');
            const manual = fs.readFileSync(manualPath, 'utf-8');

            expect(readme).toContain('SMG Barber');
            expect(readme).toContain('SMG Intelligence');
            expect(manual).toContain('SMG Barber');
            expect(manual).toContain('The Barbershop Intelligence');
        });
    });

    describe('Pilar 2: Hub Central e Sanidade de Links (README.md)', () => {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');

        it('DOC-HUB-001: não deve conter links quebrados legados (404)', () => {
            expect(readmeContent).not.toContain('../barber/');
            expect(readmeContent).not.toContain('../receptionist/');
            expect(readmeContent).not.toContain('../faq/');
        });

        it('DOC-HUB-002: deve referenciar todos os novos guias operacionais canônicos', () => {
            expect(readmeContent).toContain('MANUAL_DO_USUARIO_SMG_BARBER.md');
            expect(readmeContent).toContain('TUTORIAIS_POR_ROLE.md');
            expect(readmeContent).toContain('GUIA_INICIO_RAPIDO.md');
            expect(readmeContent).toContain('FAQ_OPERACIONAL.md');
        });
    });

    describe('Pilar 3: Manual Completo do Usuário (MANUAL_DO_USUARIO_SMG_BARBER.md)', () => {
        const manualContent = fs.readFileSync(manualPath, 'utf-8');

        it('DOC-MAN-001: deve cobrir os 8 módulos operacionais centrais do sistema', () => {
            expect(manualContent).toContain('Módulo 1: Cockpit & Home Operacional do Dia');
            expect(manualContent).toContain('Módulo 2: Agenda de Atendimentos & Cadeira Cativa');
            expect(manualContent).toContain('Módulo 3: Comandas & Balcão PDV');
            expect(manualContent).toContain('Módulo 4: Checkout Expresso & Formas de Pagamento');
            expect(manualContent).toContain('Módulo 5: Fechamento de Caixa & Extrato de Comissão');
            expect(manualContent).toContain('Módulo 6: Clientes, CRM 360° & WhatsApp');
            expect(manualContent).toContain('Módulo 7: Club dos Chefes (Assinaturas e Créditos)');
            expect(manualContent).toContain('Módulo 8: Configurações, Equipe & Serviços');
        });

        it('DOC-MAN-002: deve detalhar regras de conferência física e separação financeira (ADR-001)', () => {
            expect(manualContent).toContain('ADR-001');
            expect(manualContent).toContain('Conferência Física');
            expect(manualContent).toContain('sobras ou faltas');
            expect(manualContent).toContain('taxa da maquininha');
        });
    });

    describe('Pilar 4: Trilhas de Capacitação por Papel (TUTORIAIS_POR_ROLE.md)', () => {
        const roleContent = fs.readFileSync(rolePath, 'utf-8');

        it('DOC-ROL-001: deve conter trilhas específicas para Recepção, Barbeiro e Dono/Gerente', () => {
            expect(roleContent).toContain('Trilha da Recepção & Operador de Caixa');
            expect(roleContent).toContain('Trilha do Barbeiro & Profissional da Bancada');
            expect(roleContent).toContain('Trilha do Dono & Gerente Geral');
        });

        it('DOC-ROL-002: deve orientar o barbeiro sobre comissões teóricas e painel individual', () => {
            expect(roleContent).toContain('Meu Extrato');
            expect(roleContent).toContain('comissão líquida');
            expect(roleContent).toContain('Iniciar Atendimento');
        });
    });

    describe('Pilar 5: Guia Rápido e FAQ Operacional', () => {
        const quickstartContent = fs.readFileSync(quickstartPath, 'utf-8');
        const faqContent = fs.readFileSync(faqPath, 'utf-8');

        it('DOC-QUI-001: deve fornecer checklist de implantação em 15 minutos', () => {
            expect(quickstartContent).toContain('15 minutos');
            expect(quickstartContent).toContain('Passo 1');
            expect(quickstartContent).toContain('Passo 2');
            expect(quickstartContent).toContain('Passo 3');
            expect(quickstartContent).toContain('Passo 4');
        });

        it('DOC-FAQ-001: deve documentar atalhos de teclado e protocolo de contingência offline', () => {
            expect(faqContent).toContain('Atalhos de Teclado Operacionais');
            expect(faqContent).toContain('`N`');
            expect(faqContent).toContain('`Escape`');
            expect(faqContent).toContain('modo offline');
        });

        it('DOC-FAQ-002: deve orientar sobre casos extremos e bloqueio de comanda', () => {
            expect(faqContent).toContain('Comanda com status Bloqueada');
            expect(faqContent).toContain('Desbloquear Comanda');
            expect(faqContent).toContain('Club dos Chefes');
        });
    });
});
