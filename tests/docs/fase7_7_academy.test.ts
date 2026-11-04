import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Fase 7.7 — SMG Academy Completeness & Certification Audit', () => {
    const rootDir = process.cwd();
    const academyDir = path.join(rootDir, 'docs', 'academy');
    const readmePath = path.join(academyDir, 'README.md');
    const recepcaoPath = path.join(academyDir, 'TRILHA_RECEPCAO_E_CAIXA.md');
    const barbeiroPath = path.join(academyDir, 'TRILHA_BARBEIRO_BANCADA.md');
    const gestaoPath = path.join(academyDir, 'TRILHA_GESTAO_E_DONO.md');
    const certificacaoPath = path.join(academyDir, 'SISTEMA_DE_CERTIFICACAO.md');

    describe('Pilar 1: Integridade Estrutural dos Arquivos da SMG Academy', () => {
        it('DOC-ACAD-001: todos os 5 documentos da SMG Academy devem existir', () => {
            expect(fs.existsSync(readmePath), 'README.md deve existir').toBe(true);
            expect(fs.existsSync(recepcaoPath), 'TRILHA_RECEPCAO_E_CAIXA.md deve existir').toBe(true);
            expect(fs.existsSync(barbeiroPath), 'TRILHA_BARBEIRO_BANCADA.md deve existir').toBe(true);
            expect(fs.existsSync(gestaoPath), 'TRILHA_GESTAO_E_DONO.md deve existir').toBe(true);
            expect(fs.existsSync(certificacaoPath), 'SISTEMA_DE_CERTIFICACAO.md deve existir').toBe(true);
        });

        it('DOC-ACAD-002: deve respeitar a Brand Architecture oficial nos cabeçalhos', () => {
            const readme = fs.readFileSync(readmePath, 'utf-8');
            const certificacao = fs.readFileSync(certificacaoPath, 'utf-8');

            expect(readme).toContain('SMG Barber');
            expect(readme).toContain('SMG Intelligence');
            expect(readme).toContain('The Barbershop Intelligence');
            expect(certificacao).toContain('SMG Intelligence');
            expect(certificacao).toContain('SMG Barber');
        });
    });

    describe('Pilar 2: Hub Central e Manifesto Pedagógico (README.md)', () => {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');

        it('DOC-HUB-001: deve definir a metodologia em 3 etapas de aprendizado', () => {
            expect(readmeContent).toContain('Aprenda o Método');
            expect(readmeContent).toContain('Pratique sem Risco');
            expect(readmeContent).toContain('Conquiste a Certificação Oficial');
        });

        it('DOC-HUB-002: deve referenciar o catálogo das 3 trilhas por role e o sistema de certificação', () => {
            expect(readmeContent).toContain('TRILHA_RECEPCAO_E_CAIXA.md');
            expect(readmeContent).toContain('TRILHA_BARBEIRO_BANCADA.md');
            expect(readmeContent).toContain('TRILHA_GESTAO_E_DONO.md');
            expect(readmeContent).toContain('SISTEMA_DE_CERTIFICACAO.md');
        });
    });

    describe('Pilar 3: Trilha de Recepção & Caixa Ágil', () => {
        const recepcaoContent = fs.readFileSync(recepcaoPath, 'utf-8');

        it('DOC-REC-001: deve cobrir atalhos rápidos, cockpit, cadeira cativa e conferência cega', () => {
            expect(recepcaoContent).toContain('Tecla `N`');
            expect(recepcaoContent).toContain('Cadeira Cativa Semanal');
            expect(recepcaoContent).toContain('Fechamento de Caixa Cego');
            expect(recepcaoContent).toContain('Sangria e Suprimento');
            expect(recepcaoContent).toContain('Club dos Chefes');
        });

        it('DOC-REC-002: deve conter exercícios práticos simulados para o balcão', () => {
            expect(recepcaoContent).toContain('Exercício 1');
            expect(recepcaoContent).toContain('Exercício 2');
            expect(recepcaoContent).toContain('Exercício 3');
            expect(recepcaoContent).toContain('Exercício 4');
            expect(recepcaoContent).toContain('Exercício 5');
        });
    });

    describe('Pilar 4: Trilha de Barbeiro Digital & Bancada Lucrativa', () => {
        const barbeiroContent = fs.readFileSync(barbeiroPath, 'utf-8');

        it('DOC-BAR-001: deve cobrir modo mobile, venda de bancada e transparência de comissão', () => {
            expect(barbeiroContent).toContain('Modo Barbeiro Mobile');
            expect(barbeiroContent).toContain('Iniciar Atendimento');
            expect(barbeiroContent).toContain('Meu Extrato');
            expect(barbeiroContent).toContain('comissão líquida');
            expect(barbeiroContent).toContain('ADR-001');
        });

        it('DOC-BAR-002: deve conter exercícios práticos para a rotina de cadeira', () => {
            expect(barbeiroContent).toContain('Exercício 1');
            expect(barbeiroContent).toContain('Exercício 2');
            expect(barbeiroContent).toContain('Exercício 3');
            expect(barbeiroContent).toContain('Exercício 4');
        });
    });

    describe('Pilar 5: Trilha de Gestão Executiva & Dono da Barbearia', () => {
        const gestaoContent = fs.readFileSync(gestaoPath, 'utf-8');

        it('DOC-GES-001: deve cobrir os 6 KPIs vitais, combate ao churn via WhatsApp e Club dos Chefes', () => {
            expect(gestaoContent).toContain('Os 6 Indicadores-Chave Diários');
            expect(gestaoContent).toContain('Combate ao Churn via WhatsApp');
            expect(gestaoContent).toContain('Club dos Chefes');
            expect(gestaoContent).toContain('ADR-001');
            expect(gestaoContent).toContain('Diferença de Caixa');
        });

        it('DOC-GES-002: deve conter exercícios executivos para o proprietário', () => {
            expect(gestaoContent).toContain('Exercício 1');
            expect(gestaoContent).toContain('Exercício 2');
            expect(gestaoContent).toContain('Exercício 3');
            expect(gestaoContent).toContain('Exercício 4');
        });
    });

    describe('Pilar 6: Sistema de Certificação e Avaliação', () => {
        const certificacaoContent = fs.readFileSync(certificacaoPath, 'utf-8');

        it('DOC-CRT-001: deve estipular nota de corte mínima de 80%', () => {
            expect(certificacaoContent).toContain('80% de aproveitamento');
            expect(certificacaoContent).toContain('12 meses');
        });

        it('DOC-CRT-002: deve conter gabarito comentado para todas as 3 trilhas', () => {
            expect(certificacaoContent).toContain('Trilha 1 — Especialista em Recepção & Caixa Ágil');
            expect(certificacaoContent).toContain('Trilha 2 — Barbeiro Digital & Bancada Lucrativa');
            expect(certificacaoContent).toContain('Trilha 3 — Gestão Executiva & Dono da Barbearia');
        });

        it('DOC-CRT-003: deve fornecer o template oficial de certificado e selo de excelência', () => {
            expect(certificacaoContent).toContain('SMG INTELLIGENCE');
            expect(certificacaoContent).toContain('CERTIFICADO DE EXCELÊNCIA OPERACIONAL');
            expect(certificacaoContent).toContain('SMG-ACAD-');
            expect(certificacaoContent).toContain('UNIDADE CERTIFICADA SMG BARBER');
        });
    });
});
