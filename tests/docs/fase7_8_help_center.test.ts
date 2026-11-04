import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Fase 7.8 — Help Center Completeness & Operational Support Audit', () => {
    const rootDir = process.cwd();
    const helpDir = path.join(rootDir, 'docs', 'help');
    const readmePath = path.join(helpDir, 'README.md');
    const artigosPath = path.join(helpDir, 'ARTIGOS_SOLUCAO_PROBLEMAS.md');
    const hardwarePath = path.join(helpDir, 'GUIA_CONTINGENCIA_HARDWARE.md');
    const suportePath = path.join(helpDir, 'SISTEMA_DE_SUPORTE_E_TICKETS.md');

    describe('Pilar 1: Integridade Estrutural dos Arquivos do Help Center', () => {
        it('DOC-HELP-001: todos os 4 documentos do Help Center devem existir', () => {
            expect(fs.existsSync(readmePath), 'README.md deve existir').toBe(true);
            expect(fs.existsSync(artigosPath), 'ARTIGOS_SOLUCAO_PROBLEMAS.md deve existir').toBe(true);
            expect(fs.existsSync(hardwarePath), 'GUIA_CONTINGENCIA_HARDWARE.md deve existir').toBe(true);
            expect(fs.existsSync(suportePath), 'SISTEMA_DE_SUPORTE_E_TICKETS.md deve existir').toBe(true);
        });

        it('DOC-HELP-002: deve respeitar a Brand Architecture oficial nos cabeçalhos', () => {
            const readme = fs.readFileSync(readmePath, 'utf-8');
            const suporte = fs.readFileSync(suportePath, 'utf-8');

            expect(readme).toContain('SMG Barber');
            expect(readme).toContain('SMG Intelligence');
            expect(readme).toContain('The Barbershop Intelligence');
            expect(suporte).toContain('SMG Intelligence');
            expect(suporte).toContain('SMG Barber');
        });
    });

    describe('Pilar 2: Hub Central do Help Center (README.md)', () => {
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');

        it('DOC-HUB-001: deve definir o manifesto de autoatendimento e o SLA de resolução', () => {
            expect(readmeContent).toContain('Autonomia Imediata');
            expect(readmeContent).toContain('SLA < 24h');
            expect(readmeContent).toContain('Padrão Canônico de Troubleshooting');
        });

        it('DOC-HUB-002: deve cobrir e mapear as 8 categorias operacionais da base de conhecimento', () => {
            expect(readmeContent).toContain('Agenda & Horários');
            expect(readmeContent).toContain('Atendimento & Comandas');
            expect(readmeContent).toContain('Pagamentos & Checkout');
            expect(readmeContent).toContain('Caixa & Fechamento');
            expect(readmeContent).toContain('Club dos Chefes');
            expect(readmeContent).toContain('Clientes & WhatsApp');
            expect(readmeContent).toContain('Hardware & Conexão');
            expect(readmeContent).toContain('Acessos & Permissões');
        });

        it('DOC-HUB-003: deve apresentar matriz de busca rápida por sintoma e árvore de decisão', () => {
            expect(readmeContent).toContain('Matriz de Busca Rápida por Sintoma Operacional');
            expect(readmeContent).toContain('Árvore de Decisão para Autoatendimento');
            expect(readmeContent).toContain('A maquininha imprimiu o comprovante, mas o sistema deu erro ao finalizar');
            expect(readmeContent).toContain('Comanda bloqueada como "Em atendimento"');
        });
    });

    describe('Pilar 3: Artigos de Solução de Problemas (Troubleshooting)', () => {
        const artigosContent = fs.readFileSync(artigosPath, 'utf-8');

        it('DOC-ART-001: deve adotar o formato canônico Sintoma -> Causa -> Resolução -> Prevenção', () => {
            expect(artigosContent).toContain('Sintoma:');
            expect(artigosContent).toContain('Causa Provável:');
            expect(artigosContent).toContain('Resolução Imediata (Passo a Passo):');
            expect(artigosContent).toContain('Como Prevenir:');
        });

        it('DOC-ART-002: deve cobrir os cenários críticos de contingência de caixa e maquininhas', () => {
            expect(artigosContent).toContain('NUNCA passe o cartão do cliente novamente na maquininha');
            expect(artigosContent).toContain('Observações / NSU');
            expect(artigosContent).toContain('Comanda Fechada com Meio de Pagamento Incorreto');
            expect(artigosContent).toContain('Divergência de Valores na Conferência Cega de Caixa');
            expect(artigosContent).toContain('Sangria ou Suprimento Esquecido');
        });

        it('DOC-ART-003: deve cobrir incidentes de Club dos Chefes, Clientes duplicados e Permissões', () => {
            expect(artigosContent).toContain('Crédito do Club dos Chefes Não Disponível no Checkout');
            expect(artigosContent).toContain('Clientes Duplicados com Histórico Dividido');
            expect(artigosContent).toContain('Barbeiro Sem Acesso à sua Própria Agenda ou Comissões');
            expect(artigosContent).toContain('Perfil de Novo Colaborador Travado em "Pendente"');
        });
    });

    describe('Pilar 4: Guia de Contingência de Hardware & Redes', () => {
        const hardwareContent = fs.readFileSync(hardwarePath, 'utf-8');

        it('DOC-HDW-001: deve detalhar o Plano A (Hotspot 4G/5G) e o Plano B (Contingência Analógica)', () => {
            expect(hardwareContent).toContain('Plano A: Hotspot 4G/5G de Alta Velocidade');
            expect(hardwareContent).toContain('Plano B: Contingência Analógica Extrema');
            expect(hardwareContent).toContain('Bloco de Comandas de Emergência');
            expect(hardwareContent).toContain('Lançamento Retroativo');
        });

        it('DOC-HDW-002: deve cobrir impressoras térmicas (80mm e 58mm), teste feed e maquininhas', () => {
            expect(hardwareContent).toContain('80mm (padrão de balcão)');
            expect(hardwareContent).toContain('58mm (mini-impressoras portáteis)');
            expect(hardwareContent).toContain('Self-Test / Feed Test');
            expect(hardwareContent).toContain('net stop spooler && net start spooler');
            expect(hardwareContent).toContain('Maquininhas de Cartão (POS e SmartPOS)');
        });

        it('DOC-HDW-003: deve listar requisitos mínimos de infraestrutura recomendados', () => {
            expect(hardwareContent).toContain('Requisitos Mínimos de Infraestrutura Recomendados');
            expect(hardwareContent).toContain('Banda larga fixa (Fibra Ótica)');
            expect(hardwareContent).toContain('Nobreak');
        });
    });

    describe('Pilar 5: Sistema de Suporte, SLA & Abertura de Chamados', () => {
        const suporteContent = fs.readFileSync(suportePath, 'utf-8');

        it('DOC-SUP-001: deve estruturar os 3 níveis de suporte N1, N2 e N3', () => {
            expect(suporteContent).toContain('NÍVEL 1: Autoatendimento & Base de Conhecimento');
            expect(suporteContent).toContain('NÍVEL 2: Gestor Local / Dono da Barbearia');
            expect(suporteContent).toContain('NÍVEL 3: Engenharia SMG Intelligence');
        });

        it('DOC-SUP-002: deve formalizar matriz de severidade P1 a P4 e meta de SLA < 24h com CSAT > 90%', () => {
            expect(suporteContent).toContain('P1 — Crítico');
            expect(suporteContent).toContain('P2 — Alto');
            expect(suporteContent).toContain('P3 — Normal');
            expect(suporteContent).toContain('P4 — Melhoria');
            expect(suporteContent).toContain('Taxa de Resolução em Menos de 24h');
            expect(suporteContent).toContain('Índice de Satisfação do Atendimento (CSAT)');
            expect(suporteContent).toContain('90%');
        });

        it('DOC-SUP-003: deve fornecer o modelo estruturado oficial de ticket e canais de contato', () => {
            expect(suporteContent).toContain('Modelo Oficial de Ticket / Chamado de Suporte');
            expect(suporteContent).toContain('[CHAMADO DE SUPORTE SMG BARBER]');
            expect(suporteContent).toContain('Passos para Reproduzir o Erro');
            expect(suporteContent).toContain('Contingência Adotada');
            expect(suporteContent).toContain('suporte@soumanager.com');
        });
    });
});
