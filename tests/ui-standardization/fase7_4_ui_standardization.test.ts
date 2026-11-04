import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Fase 7.4 — UI Standardization & Design System Audit', () => {
    const rootDir = process.cwd();
    const indexCssPath = path.join(rootDir, 'index.css');
    const designDocPath = path.join(rootDir, 'docs', 'design', 'DESIGN_SYSTEM_SMG_BARBER.md');
    const uiDir = path.join(rootDir, 'components', 'ui');

    describe('Pilar 1: Integridade dos Design Tokens no Tailwind v4 (index.css)', () => {
        const cssContent = fs.readFileSync(indexCssPath, 'utf-8');

        it('UI-TOK-001: deve definir a paleta primária de prestígio sem variantes não mapeadas', () => {
            expect(cssContent).toContain('--color-primary: #D99A2B;');
            expect(cssContent).toContain('--color-primary-dark: #A96F14;');
            expect(cssContent).toContain('--color-primary-light: #F3D9A4;');
            expect(cssContent).toContain('--color-gold: #D99A2B;');
            expect(cssContent).not.toContain('primary-gold:');
        });

        it('UI-TOK-002: deve definir as superfícies fundamentais Dark-First e Light Cream', () => {
            expect(cssContent).toContain('--color-night: #0B0B0C;');
            expect(cssContent).toContain('--color-smg-ink: #14110B;');
            expect(cssContent).toContain('--color-surface-dark: #171310;');
            expect(cssContent).toContain('--color-card-dark: #1A1610;');
            expect(cssContent).toContain('--color-border-dark: #2D2618;');
            expect(cssContent).toContain('--color-cream: #FAF6EE;');
        });

        it('UI-TOK-003: deve definir os 6 chips de identidade dos barbeiros na Paleta Atelier', () => {
            expect(cssContent).toContain('--color-barber-1: #C98A1F;');
            expect(cssContent).toContain('--color-barber-2: #10B981;');
            expect(cssContent).toContain('--color-barber-3: #F59E0B;');
            expect(cssContent).toContain('--color-barber-4: #EF4444;');
            expect(cssContent).toContain('--color-barber-5: #F97316;');
            expect(cssContent).toContain('--color-barber-6: #14B8A6;');
        });

        it('UI-TOK-004: deve definir os tokens semânticos completos da Agenda (sched-*) com variantes fortes', () => {
            const schedTokens = [
                'scheduled',
                'pending',
                'confirmed',
                'in-progress',
                'completed',
                'cancelled',
                'no-show',
            ];

            for (const status of schedTokens) {
                expect(cssContent).toContain(`--color-sched-${status}:`);
                expect(cssContent).toContain(`--color-sched-${status}-strong:`);
            }
        });

        it('UI-TOK-005: deve conter a camada de flip do Dark Mode (:root.dark)', () => {
            expect(cssContent).toContain(':root.dark');
            expect(cssContent).toContain('--color-cream: #14110B;');
            expect(cssContent).toContain('--color-card: #1A1610;');
        });
    });

    describe('Pilar 2: Padronização e Acessibilidade do Componente Button', () => {
        const buttonPath = path.join(uiDir, 'Button.tsx');
        const buttonContent = fs.readFileSync(buttonPath, 'utf-8');

        it('UI-BTN-001: deve aplicar estritamente text-night com gradiente primário (WCAG AA 8.9:1)', () => {
            expect(buttonContent).toContain('bg-gradient-to-r from-primary to-primary-dark text-night');
            expect(buttonContent).not.toMatch(/primary:.*text-white/);
        });

        it('UI-BTN-002: deve fornecer anel de foco acessível com primary e offset', () => {
            expect(buttonContent).toContain('focus-visible:ring-primary/40');
            expect(buttonContent).toContain('focus-visible:ring-2');
        });

        it('UI-BTN-003: deve suportar a variante outline com borda e texto primary', () => {
            expect(buttonContent).toContain("outline: 'border border-primary text-primary");
        });

        it('UI-BTN-004: deve adaptar a cor do spinner de loading para garantir contraste no botão dourado', () => {
            expect(buttonContent).toContain("variant === 'primary' ? 'border-night/30 border-t-night'");
        });
    });

    describe('Pilar 3: Padronização e Acessibilidade do Componente Modal', () => {
        const modalPath = path.join(uiDir, 'Modal.tsx');
        const modalContent = fs.readFileSync(modalPath, 'utf-8');

        it('UI-MOD-001: deve incluir atributos semânticos ARIA para leitores de tela', () => {
            expect(modalContent).toContain('role="dialog"');
            expect(modalContent).toContain('aria-modal="true"');
            expect(modalContent).toContain('aria-labelledby="modal-title"');
            expect(modalContent).toContain('id="modal-title"');
            expect(modalContent).toContain('aria-label="Fechar modal"');
        });

        it('UI-MOD-002: deve utilizar backdrop blur e superfícies dark-first homologadas', () => {
            expect(modalContent).toContain('backdrop-blur-sm');
            expect(modalContent).toContain('dark:bg-card-dark');
            expect(modalContent).toContain('dark:border-border-dark');
        });
    });

    describe('Pilar 4: Componente Universal StatusBadge', () => {
        const badgePath = path.join(uiDir, 'StatusBadge.tsx');
        const badgeContent = fs.readFileSync(badgePath, 'utf-8');

        it('UI-BDG-001: deve exportar o componente StatusBadge e mapear todos os status da agenda', () => {
            expect(badgeContent).toContain('export const StatusBadge');
            expect(badgeContent).toContain('scheduled:');
            expect(badgeContent).toContain('pending:');
            expect(badgeContent).toContain('confirmed:');
            expect(badgeContent).toContain('in_progress:');
            expect(badgeContent).toContain('completed:');
            expect(badgeContent).toContain('cancelled:');
            expect(badgeContent).toContain('no_show:');
        });

        it('UI-BDG-002: deve mapear os status de comandas, pagamentos e clube', () => {
            expect(badgeContent).toContain('open:');
            expect(badgeContent).toContain('blocked:');
            expect(badgeContent).toContain('paid:');
            expect(badgeContent).toContain('active:');
            expect(badgeContent).toContain('paused:');
        });

        it('UI-BDG-003: deve fornecer fallback resiliente para status desconhecidos', () => {
            expect(badgeContent).toContain('fallbackConfig');
            expect(badgeContent).toContain('Desconhecido');
            expect(badgeContent).toContain('bg-slate-100 text-slate-700');
        });
    });

    describe('Pilar 5: Varredura Estática de Banimentos (Purple Ban & Blue Ban)', () => {
        it('UI-BAN-001: diretório components/ui não deve conter nenhuma classe roxa, lilás ou índigo', () => {
            const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

            for (const file of files) {
                const content = fs.readFileSync(path.join(uiDir, file), 'utf-8');
                expect(content).not.toMatch(/\b(text|bg|border)-(purple|violet|indigo)-\d+/);
            }
        });

        it('UI-BAN-002: diretório components/ui não deve conter classes inexistentes como primary-gold', () => {
            const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

            for (const file of files) {
                const content = fs.readFileSync(path.join(uiDir, file), 'utf-8');
                expect(content).not.toContain('primary-gold');
            }
        });

        it('UI-BAN-003: documentação formal do Design System deve existir e cobrir os 5 pilares', () => {
            expect(fs.existsSync(designDocPath)).toBe(true);
            const doc = fs.readFileSync(designDocPath, 'utf-8');
            expect(doc).toContain('Atelier Tech Sofisticado');
            expect(doc).toContain('PURPLE BAN');
            expect(doc).toContain('REGRA DE CONTRASTE DE CTA');
            expect(doc).toContain('Tokens de Design (Tailwind v4 — CSS-First)');
        });
    });
});
