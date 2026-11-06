import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('FASE 8.11: SaaS Certification (Certificação Master dos 7 Pilares de Escalabilidade)', () => {
  const rootDir = process.cwd();

  // =========================================================================
  // PILAR 1: ARQUITETURA ENTERPRISE & MULTI-TENANT CONSOLIDADA
  // =========================================================================
  describe('1. Pilar de Arquitetura Enterprise & Multi-Tenant', () => {
    it('CERT-SAAS-P1-001: deve possuir a diretriz normativa de multi-tenant estrito e HashRouter em AGENTS.md', () => {
      const agentsMdPath = path.join(rootDir, 'AGENTS.md');
      expect(fs.existsSync(agentsMdPath), 'AGENTS.md deve existir na raiz').toBe(true);

      const content = fs.readFileSync(agentsMdPath, 'utf-8');
      expect(content).toContain('HashRouter');
      expect(content).toContain('tenant_id');
      expect(content).toContain('current_tenant_id_from_auth_uid');
      expect(content).toContain('MERGE ≠ DEPLOY PROD');
    });

    it('CERT-SAAS-P1-002: deve possuir o dossiê formal de Certificação SaaS em docs/certification/', () => {
      const certDocPath = path.join(rootDir, 'docs', 'certification', 'SAAS_CERTIFICATION.md');
      expect(fs.existsSync(certDocPath), 'SAAS_CERTIFICATION.md deve existir').toBe(true);

      const content = fs.readFileSync(certDocPath, 'utf-8');
      expect(content).toContain('7 Pilares de Certificação SaaS');
      expect(content).toContain('ADR-032');
      expect(content).toContain('ADR-041');
      expect(content).toContain('ADR-043');
    });
  });

  // =========================================================================
  // PILAR 2: UX & VALOR PERCEBIDO (DEMONSTRAÇÃO GUIADA)
  // =========================================================================
  describe('2. Pilar de UX & Conversão Orientada a Valor Percebido', () => {
    it('CERT-SAAS-P2-001: deve possuir o modal de agendamento de demonstração guiada para percepção de valor', () => {
      const demoModalPath = path.join(rootDir, 'components', 'DemoBookingModal.tsx');
      expect(fs.existsSync(demoModalPath), 'DemoBookingModal.tsx deve existir').toBe(true);

      const content = fs.readFileSync(demoModalPath, 'utf-8');
      expect(content).toContain('AGENDAR DEMONSTRAÇÃO GUIADA');
      expect(content).toContain('validateBrazilianCellPhone');
      expect(content).toContain('cadeiras');
      expect(content).toContain('setSubmitted');
    });

    it('CERT-SAAS-P2-002: deve integrar canais de agendamento de demonstração guiada na Landing Page', () => {
      const landingPath = path.join(rootDir, 'pages', 'Landing.tsx');
      expect(fs.existsSync(landingPath), 'Landing.tsx deve existir').toBe(true);

      const content = fs.readFileSync(landingPath, 'utf-8');
      expect(content).toContain('AGENDAR DEMONSTRAÇÃO GUIADA');
      expect(content).toContain('wa.me');
      expect(content).toContain('contato@soumanager.com');
    });
  });

  // =========================================================================
  // PILAR 3: SEGURANÇA, RLS & TRILHO FORENSE CORPORATIVO
  // =========================================================================
  describe('3. Pilar de Segurança, RLS & Trilho Forense Corporativo', () => {
    it('CERT-SAAS-P3-001: deve possuir a migração SQL do trilho forense com append-only absoluto (sem UPDATE/DELETE)', () => {
      const migrationPath = path.join(
        rootDir,
        'supabase',
        'migrations',
        '20261106040000_phase_8_enterprise_features_and_audit_logs.sql'
      );
      expect(fs.existsSync(migrationPath), 'Migration de enterprise audit deve existir').toBe(true);

      const content = fs.readFileSync(migrationPath, 'utf-8');
      expect(content).toContain('CREATE TABLE IF NOT EXISTS public.enterprise_audit_logs');
      expect(content).toContain('enterprise_audit_logs_select_policy');
      expect(content).toContain('enterprise_audit_logs_insert_policy');
      expect(content).not.toContain('CREATE POLICY enterprise_audit_logs_update_policy');
      expect(content).not.toContain('CREATE POLICY enterprise_audit_logs_delete_policy');
    });

    it('CERT-SAAS-P3-002: deve possuir proteção criptográfica contra replay attacks e HMAC em webhooks', () => {
      const cryptoPath = path.join(
        rootDir,
        'supabase',
        'functions',
        'webhook-dispatcher',
        'crypto.ts'
      );
      const dispatcherPath = path.join(
        rootDir,
        'supabase',
        'functions',
        'webhook-dispatcher',
        'dispatcher.ts'
      );
      expect(fs.existsSync(cryptoPath), 'crypto.ts deve existir').toBe(true);
      expect(fs.existsSync(dispatcherPath), 'dispatcher.ts deve existir').toBe(true);

      const cryptoContent = fs.readFileSync(cryptoPath, 'utf-8');
      const dispatcherContent = fs.readFileSync(dispatcherPath, 'utf-8');

      expect(cryptoContent).toContain('generateWebhookSignature');
      expect(cryptoContent).toContain('verifyWebhookSignature');
      expect(cryptoContent).toContain('constantTimeCompare');
      expect(dispatcherContent).toContain('X-SMG-Signature');
      expect(dispatcherContent).toContain('RETRY_DELAYS_SECONDS');
    });
  });

  // =========================================================================
  // PILAR 4: PERFORMANCE & BASELINE ARQUITETURAL
  // =========================================================================
  describe('4. Pilar de Performance & Baseline Arquitetural', () => {
    it('CERT-SAAS-P4-001: deve preservar o arquivo de baseline arquitetural com métricas controladas', () => {
      const baselinePath = path.join(rootDir, 'architecture-baseline.json');
      expect(fs.existsSync(baselinePath), 'architecture-baseline.json deve existir').toBe(true);

      const content = fs.readFileSync(baselinePath, 'utf-8');
      const baseline = JSON.parse(content);
      expect(baseline).toHaveProperty('repositoryViolations');
      expect(typeof baseline.repositoryViolations).toBe('number');
      expect(baseline.repositoryViolations).toBe(222);
    });

    it('CERT-SAAS-P4-002: deve conter a suite de verificação master npm run smg:verify documentada', () => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      expect(fs.existsSync(packageJsonPath), 'package.json deve existir').toBe(true);

      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      expect(pkg.scripts).toHaveProperty('smg:verify');
    });
  });

  // =========================================================================
  // PILAR 5: TREINAMENTO & CAPACITAÇÃO (SMG ACADEMY)
  // =========================================================================
  describe('5. Pilar de Treinamento & Capacitação (SMG Academy)', () => {
    it('CERT-SAAS-P5-001: deve possuir o Hub Central da SMG Academy com as 3 trilhas estruturadas', () => {
      const academyHub = path.join(rootDir, 'docs', 'academy', 'README.md');
      const trilhaRecepcao = path.join(rootDir, 'docs', 'academy', 'TRILHA_RECEPCAO_E_CAIXA.md');
      const trilhaBarbeiro = path.join(rootDir, 'docs', 'academy', 'TRILHA_BARBEIRO_BANCADA.md');
      const trilhaGestao = path.join(rootDir, 'docs', 'academy', 'TRILHA_GESTAO_E_DONO.md');

      expect(fs.existsSync(academyHub), 'Hub da Academy deve existir').toBe(true);
      expect(fs.existsSync(trilhaRecepcao), 'Trilha Recepção deve existir').toBe(true);
      expect(fs.existsSync(trilhaBarbeiro), 'Trilha Barbeiro deve existir').toBe(true);
      expect(fs.existsSync(trilhaGestao), 'Trilha Gestão deve existir').toBe(true);
    });

    it('CERT-SAAS-P5-002: deve estabelecer o sistema de certificação e corte mínimo de 80%', () => {
      const certSystemPath = path.join(rootDir, 'docs', 'academy', 'SISTEMA_DE_CERTIFICACAO.md');
      expect(fs.existsSync(certSystemPath), 'SISTEMA_DE_CERTIFICACAO.md deve existir').toBe(true);

      const content = fs.readFileSync(certSystemPath, 'utf-8');
      expect(content).toContain('80%');
      expect(content.toUpperCase()).toContain('CERTIFICADO DE EXCELÊNCIA OPERACIONAL');
    });
  });

  // =========================================================================
  // PILAR 6: ONBOARDING ÁGIL & AUTOATENDIMENTO
  // =========================================================================
  describe('6. Pilar de Onboarding Ágil & Autoatendimento', () => {
    it('CERT-SAAS-P6-001: deve possuir o Guia de Início Rápido em 15 minutos para novos estabelecimentos', () => {
      const quickstartPath = path.join(rootDir, 'docs', 'training', 'GUIA_INICIO_RAPIDO.md');
      expect(fs.existsSync(quickstartPath), 'GUIA_INICIO_RAPIDO.md deve existir').toBe(true);

      const content = fs.readFileSync(quickstartPath, 'utf-8');
      expect(content).toContain('15 minutos');
      expect(content).toContain('Passo 1');
      expect(content).toContain('Passo 4');
    });

    it('CERT-SAAS-P6-002: deve possuir a Central de Ajuda com troubleshooting canônico dos 8 módulos reais', () => {
      const helpHub = path.join(rootDir, 'docs', 'help', 'README.md');
      const troubleshooting = path.join(rootDir, 'docs', 'help', 'ARTIGOS_SOLUCAO_PROBLEMAS.md');

      expect(fs.existsSync(helpHub), 'Help Center README deve existir').toBe(true);
      expect(fs.existsSync(troubleshooting), 'ARTIGOS_SOLUCAO_PROBLEMAS.md deve existir').toBe(true);

      const content = fs.readFileSync(troubleshooting, 'utf-8');
      expect(content).toContain('Sintoma');
      expect(content).toContain('Causa Provável');
      expect(content).toContain('Resolução Imediata');
    });
  });

  // =========================================================================
  // PILAR 7: BILLING DA PLATAFORMA SAAS & MÉTRICAS EXECUTIVAS
  // =========================================================================
  describe('7. Pilar de Billing da Plataforma SaaS & Métricas Executivas', () => {
    it('CERT-SAAS-P7-001: deve possuir a migração SQL com tabelas de planos, assinaturas e faturas SaaS', () => {
      const billingMigrationPath = path.join(
        rootDir,
        'supabase',
        'migrations',
        '20261106030000_phase_8_platform_billing_and_subscriptions.sql'
      );
      expect(fs.existsSync(billingMigrationPath), 'Migration de billing deve existir').toBe(true);

      const content = fs.readFileSync(billingMigrationPath, 'utf-8');
      expect(content).toContain('public.platform_plans');
      expect(content).toContain('public.platform_subscriptions');
      expect(content).toContain('public.platform_invoices');
      expect(content).toContain('public.get_saas_executive_metrics');
      expect(content).toContain('public.settle_platform_invoice');
    });

    it('CERT-SAAS-P7-002: deve possuir o serviço platformBillingService com métodos de gestão e métricas de SaaS', () => {
      const servicePath = path.join(rootDir, 'services', 'platformBillingService.ts');
      expect(fs.existsSync(servicePath), 'platformBillingService.ts deve existir').toBe(true);

      const content = fs.readFileSync(servicePath, 'utf-8');
      expect(content).toContain('listPlans');
      expect(content).toContain('getTenantSubscription');
      expect(content).toContain('createOrUpdateSubscription');
      expect(content).toContain('settleInvoice');
      expect(content).toContain('getSaaSExecutiveMetrics');
    });
  });
});
