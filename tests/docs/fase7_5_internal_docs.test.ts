import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Fase 7.5 — Internal Documentation Sanity & Completeness Audit', () => {
    const rootDir = process.cwd();
    const docsDir = path.join(rootDir, 'docs');
    const arqPath = path.join(docsDir, 'ARQUITETURA.md');
    const devPath = path.join(docsDir, 'DESENVOLVIMENTO.md');
    const procPath = path.join(docsDir, 'PROCESSOS_ENGENHARIA.md');

    describe('Pilar 1: Integridade Estrutural e Existência dos Arquivos Canônicos', () => {
        it('DOC-INT-001: deve conter todos os documentos fundamentais da arquitetura interna', () => {
            expect(fs.existsSync(arqPath), 'ARQUITETURA.md deve existir').toBe(true);
            expect(fs.existsSync(devPath), 'DESENVOLVIMENTO.md deve existir').toBe(true);
            expect(fs.existsSync(procPath), 'PROCESSOS_ENGENHARIA.md deve existir').toBe(true);
            expect(fs.existsSync(path.join(docsDir, 'TAXONOMY.md')), 'TAXONOMY.md deve existir').toBe(true);
            expect(fs.existsSync(path.join(docsDir, 'BRAND_ARCHITECTURE.md')), 'BRAND_ARCHITECTURE.md deve existir').toBe(true);
        });

        it('DOC-INT-002: deve documentar a arquitetura de marca híbrida endossada em BRAND_ARCHITECTURE.md', () => {
            const brandContent = fs.readFileSync(path.join(docsDir, 'BRAND_ARCHITECTURE.md'), 'utf-8');
            expect(brandContent).toContain('SMG Intelligence');
            expect(brandContent).toContain('The Barbershop Intelligence');
            expect(brandContent).toContain('SMG Auto');
            expect(brandContent).toContain('Automotive Business Intelligence');
            expect(brandContent).toContain('Pitch de Transição');
            expect(brandContent).toContain('85% do SMG Core');
        });
    });

    describe('Pilar 2: Conteúdo Técnico de docs/ARQUITETURA.md', () => {
        const arqContent = fs.readFileSync(arqPath, 'utf-8');

        it('DOC-ARQ-001: deve documentar a stack tecnológica moderna completa', () => {
            expect(arqContent).toContain('React');
            expect(arqContent).toContain('19');
            expect(arqContent).toContain('Vite');
            expect(arqContent).toContain('6');
            expect(arqContent).toContain('Tailwind CSS');
            expect(arqContent).toContain('v4');
            expect(arqContent).toContain('HashRouter');
            expect(arqContent).toContain('Supabase');
            expect(arqContent).toContain('Google Gemini');
        });

        it('DOC-ARQ-002: deve documentar o isolamento multi-tenant via RLS e helpers de segurança', () => {
            expect(arqContent).toContain('Row Level Security');
            expect(arqContent).toContain('tenant_id');
            expect(arqContent).toContain('current_tenant_id_from_auth_uid()');
            expect(arqContent).toContain('current_is_super_admin_from_auth_uid()');
        });

        it('DOC-ARQ-003: deve documentar a arquitetura orientada a eventos e worker outbox D8', () => {
            expect(arqContent).toContain('Padrão Outbox');
            expect(arqContent).toContain('event_store');
            expect(arqContent).toContain('outbox_items');
            expect(arqContent).toContain('worker-dispatcher');
            expect(arqContent).toContain('worker_dispatcher');
            expect(arqContent).toContain('processed_operations');
        });

        it('DOC-ARQ-004: deve documentar a separação canônica financeira (ADR-001)', () => {
            expect(arqContent).toContain('ADR-001');
            expect(arqContent).toContain('domain/commission/');
            expect(arqContent).toContain('application/cashClosing/');
        });

        it('DOC-ARQ-005: deve documentar a topologia do alias @/ e árvore de diretórios', () => {
            expect(arqContent).toContain('aponta para a RAIZ do repositório');
            expect(arqContent).toContain('components/');
            expect(arqContent).toContain('src/');
        });
    });

    describe('Pilar 3: Guia de Onboarding e Desenvolvimento em docs/DESENVOLVIMENTO.md', () => {
        const devContent = fs.readFileSync(devPath, 'utf-8');

        it('DOC-DEV-001: deve configurar o dev server na porta 3000 com host 0.0.0.0', () => {
            expect(devContent).toContain('npm run dev');
            expect(devContent).toContain('3000');
            expect(devContent).toContain('0.0.0.0');
            expect(devContent).toContain('http://localhost:3000');
        });

        it('DOC-DEV-002: deve documentar o Local Demo Mode e credenciais padrão para depuração', () => {
            expect(devContent).toContain('Local Demo Mode');
            expect(devContent).toContain('teste@soumanager.local');
            expect(devContent).toContain('12345678');
            expect(devContent).toContain('soumanager.local.demo');
        });

        it('DOC-DEV-003: deve detalhar todos os comandos de verificação e gates de engenharia', () => {
            expect(devContent).toContain('npm run typecheck');
            expect(devContent).toContain('npm run test');
            expect(devContent).toContain('npm run architecture:ci');
            expect(devContent).toContain('npm run smg:verify');
            expect(devContent).toContain('npm run build');
            expect(devContent).toContain('git diff --check');
        });

        it('DOC-DEV-004: não deve conter comandos ou portas obsoletas', () => {
            expect(devContent).not.toContain('5173');
            expect(devContent).not.toContain('cd SOU-MANA-GER');
        });

        it('DOC-DEV-005: deve conter as convenções de testes e regras do Tailwind v4', () => {
            expect(devContent).toContain('Padrão AAA');
            expect(devContent).toContain('Purple Ban');
            expect(devContent).toContain('Blue Ban');
            expect(devContent).toContain('Contraste de CTA');
        });
    });

    describe('Pilar 4: Processos de Engenharia e Governança em docs/PROCESSOS_ENGENHARIA.md', () => {
        const procContent = fs.readFileSync(procPath, 'utf-8');

        it('DOC-PRC-001: deve documentar a máquina de estados do SMG Change Control Protocol', () => {
            expect(procContent).toContain('INTAKE');
            expect(procContent).toContain('AUDIT');
            expect(procContent).toContain('CLASSIFY');
            expect(procContent).toContain('STOP/GATE');
            expect(procContent).toContain('COMMIT AUTHORIZATION');
            expect(procContent).toContain('MERGE AUTHORIZATION');
            expect(procContent).toContain('DEPLOY AUTHORIZATION');
        });

        it('DOC-PRC-002: deve registrar o invariante MERGE ≠ DEPLOY PROD (ADR-026)', () => {
            expect(procContent).toContain('MERGE ≠ DEPLOY PROD');
            expect(procContent).toContain('ADR-026');
            expect(procContent).toContain('deploy-production.yml');
        });

        it('DOC-PRC-003: deve definir a estrutura obrigatória do Authorization Record', () => {
            expect(procContent).toContain('authorization_record:');
            expect(procContent).toContain('authorized_by: "Augusto (PO)"');
            expect(procContent).toContain('merge_approved:');
            expect(procContent).toContain('deploy_approved:');
        });

        it('DOC-PRC-004: deve documentar os gates bloqueadores vs advisory do CI', () => {
            expect(procContent).toContain('typecheck');
            expect(procContent).toContain('architecture:ci');
            expect(procContent).toContain('Advisory');
            expect(procContent).toContain('continue-on-error');
        });

        it('DOC-PRC-005: deve conter a matriz RACI de responsabilidades entre PO e Engenharia', () => {
            expect(procContent).toContain('Antigravity / Engenharia');
            expect(procContent).toContain('Augusto (PO)');
            expect(procContent).toContain('Autorização de Merge na branch');
        });
    });
});
