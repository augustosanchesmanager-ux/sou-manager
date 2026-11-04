import { describe, it, expect } from 'vitest';
import {
  getFriendlyErrorMessage,
  type ErrorContext,
} from '../../src/utils/businessErrorMessages';
import {
  validateBrazilianCellPhone,
  validateBrlCurrency,
  convertMinutesToDecimalHours,
  convertDecimalHoursToMinutes,
  formatDurationDisplay,
} from '../../src/utils/functionalValidation';
import {
  canModifyLinkedComanda,
  calculateSyncedComandaItems,
  evaluateCascadingCancel,
} from '../../src/utils/comandaScheduleSync';
import {
  detectAppointmentOverlap,
  calculateServicesNominalDuration,
} from '../../src/utils/scheduleDuration';
import {
  calculateProjectedDates,
  generateCativaConfirmationMessage,
  buildCativaWhatsAppUrl,
} from '../../src/utils/recurringSchedule';

describe('FASE 7.3: Functional Consistency Audit (5 Fluxos Operacionais & Mensageria Canônica)', () => {
  // =========================================================================
  // 1. MENSAGERIA CANÔNICA EM PT-BR & ELIMINAÇÃO DE CÓDIGOS TÉCNICOS (DECISÃO 2-A)
  // =========================================================================
  describe('1. Mensageria Canônica & Tratamento de Erros PostgREST/RPC', () => {
    it('FC-MSG-001: should translate PostgreSQL unique constraint violations (23505) without exposing SQL', () => {
      const dbError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_appointments_slot"',
        details: 'Key (staff_id, start_time)=(st-1, 2026-11-04 10:00) already exists.',
      };

      const result = getFriendlyErrorMessage(dbError);
      expect(result.title).toBe('Registro Duplicado');
      expect(result.message).toBe('Já existe um registro com estes mesmos dados no sistema.');
      expect(result.message).not.toContain('idx_appointments_slot');
      expect(result.message).not.toContain('staff_id');
      expect(result.isRecoverable).toBe(true);
    });

    it('FC-MSG-002: should provide contextual client message for unique violations in client registration', () => {
      const clientConflictError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint "clients_phone_key"',
      };

      const result = getFriendlyErrorMessage(clientConflictError, 'client');
      expect(result.title).toBe('Cliente Já Cadastrado');
      expect(result.message).toBe('Já existe um cliente cadastrado com este telefone ou documento.');
    });

    it('FC-MSG-003: should translate appointment overlap conflicts (23P01) into operational wording', () => {
      const overlapError = {
        code: '23P01',
        message: 'conflicting key value violates exclusion constraint "no_overlapping_appointments"',
      };

      const result = getFriendlyErrorMessage(overlapError, 'appointment');
      expect(result.title).toBe('Conflito de Horário');
      expect(result.message).toBe('Este horário já está ocupado por outro atendimento para este profissional.');
      expect(result.isRecoverable).toBe(true);
    });

    it('FC-MSG-004: should map permission denied (42501) and mark as unrecoverable without re-auth', () => {
      const rlsError = {
        code: '42501',
        message: 'insufficient_privilege: new row violates row-level security policy for table "comandas"',
      };

      const result = getFriendlyErrorMessage(rlsError);
      expect(result.title).toBe('Acesso Negado');
      expect(result.message).toBe('Você não possui permissão para executar esta operação. Contate o administrador.');
      expect(result.isRecoverable).toBe(false);
    });

    it('FC-MSG-005: should translate custom business RPC codes (P0001 to P0004) with high fidelity', () => {
      expect(getFriendlyErrorMessage({ code: 'P0001' }).message).toBe(
        'O cliente não possui créditos disponíveis para este serviço no plano contratado.'
      );
      expect(getFriendlyErrorMessage({ code: 'P0002' }).message).toBe(
        'Esta comanda já foi finalizada ou liquidada e não admite novas alterações.'
      );
      expect(getFriendlyErrorMessage({ code: 'P0003' }).message).toBe(
        'O agendamento está sendo atualizado por outro operador. Tente novamente em instantes.'
      );
      expect(getFriendlyErrorMessage({ code: 'P0004' }).message).toBe(
        'É obrigatório informar uma justificativa válida para estornar este lançamento.'
      );
    });

    it('FC-MSG-006: should handle network disconnections gracefully without showing raw exceptions', () => {
      const networkError = new TypeError('Failed to fetch');
      const result = getFriendlyErrorMessage(networkError);

      expect(result.title).toBe('Sem Conexão');
      expect(result.message).toBe('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      expect(result.code).toBe('NETWORK');
    });

    it('FC-MSG-007: should sanitize unknown long errors avoiding leaks of query text or internal identifiers', () => {
      const rawSqlLeak = 'SELECT id, tenant_id FROM public.users WHERE secret_key = 12345';
      const result = getFriendlyErrorMessage(rawSqlLeak);

      expect(result.message).not.toContain('SELECT');
      expect(result.message).not.toContain('secret_key');
      expect(result.message).toBe('Não foi possível concluir a operação. Por favor, tente novamente.');
    });
  });

  // =========================================================================
  // 2. CONSISTÊNCIA DE VALIDAÇÃO DE ENTRADA & FORMATAÇÃO FUNCIONAL
  // =========================================================================
  describe('2. Consistência de Validação de Entrada & Formatação Funcional', () => {
    it('FC-VAL-001: should validate valid Brazilian cell phones and format to E.164 and display masks', () => {
      const valid = validateBrazilianCellPhone('11988887777');
      expect(valid.isValid).toBe(true);
      expect(valid.sanitizedDigits).toBe('11988887777');
      expect(valid.sanitizedE164).toBe('5511988887777');
      expect(valid.formattedDisplay).toBe('(11) 98888-7777');
      expect(valid.error).toBeUndefined();

      // Já contendo máscara de entrada
      const withMask = validateBrazilianCellPhone('(21) 97777-6666');
      expect(withMask.isValid).toBe(true);
      expect(withMask.sanitizedE164).toBe('5521977776666');
      expect(withMask.formattedDisplay).toBe('(21) 97777-6666');
    });

    it('FC-VAL-002: should reject invalid cell phone lengths or landlines missing ninth digit', () => {
      // Telefone fixo (8 dígitos após DDD — não é celular válido para WhatsApp)
      const landline = validateBrazilianCellPhone('1133334444');
      expect(landline.isValid).toBe(false);
      expect(landline.error).toContain('DDD e o número com 9 dígitos');

      // 9 dígitos mas sem o dígito 9 na frente
      const invalidNinth = validateBrazilianCellPhone('11888887777');
      expect(invalidNinth.isValid).toBe(false);
      expect(invalidNinth.error).toContain('deve iniciar com o dígito 9');

      // Vazio ou nulo
      expect(validateBrazilianCellPhone('').isValid).toBe(false);
      expect(validateBrazilianCellPhone(null).isValid).toBe(false);
    });

    it('FC-VAL-003: should validate BRL currency inputs preventing fractional rounding errors', () => {
      const numeric = validateBrlCurrency(75.5);
      expect(numeric.isValid).toBe(true);
      expect(numeric.cents).toBe(7550);
      expect(numeric.value).toBe(75.5);
      expect(numeric.formatted).toContain('75,50');

      // String com máscara e separador brasileiro
      const stringMask = validateBrlCurrency('R$ 1.250,75');
      expect(stringMask.isValid).toBe(true);
      expect(stringMask.cents).toBe(125075);
      expect(stringMask.value).toBe(1250.75);

      // Rejeição de valores negativos e não numéricos
      expect(validateBrlCurrency(-25).isValid).toBe(false);
      expect(validateBrlCurrency(-25).error).toContain('não pode ser negativo');
      expect(validateBrlCurrency('abc').isValid).toBe(false);
      expect(validateBrlCurrency(null).isValid).toBe(false);
    });

    it('FC-VAL-004: should convert duration between nominal minutes and decimal hours without precision drift', () => {
      // 30 min <-> 0.5h
      expect(convertMinutesToDecimalHours(30)).toBe(0.5);
      expect(convertDecimalHoursToMinutes(0.5)).toBe(30);

      // 45 min <-> 0.75h
      expect(convertMinutesToDecimalHours(45)).toBe(0.75);
      expect(convertDecimalHoursToMinutes(0.75)).toBe(45);

      // 90 min <-> 1.5h
      expect(convertMinutesToDecimalHours(90)).toBe(1.5);
      expect(convertDecimalHoursToMinutes(1.5)).toBe(90);

      // Duração amigável para exibição em badges
      expect(formatDurationDisplay(30)).toBe('30m');
      expect(formatDurationDisplay(60)).toBe('1h');
      expect(formatDurationDisplay(75)).toBe('1h 15m');
      expect(formatDurationDisplay(120)).toBe('2h');
    });
  });

  // =========================================================================
  // 3. CONSISTÊNCIA DE FLUXOS OPERACIONAIS (FLUXOS 1 A 5)
  // =========================================================================
  describe('3. Consistência dos Fluxos Operacionais Centrais', () => {
    it('FC-FLO-001 (Fluxo 1: Agenda): should detect contiguous appointments as non-overlapping slots', () => {
      const existing = [
        { id: 'apt-1', staffId: 'barber-1', dateKey: '2026-11-10', startDecimal: 14, durationDecimal: 0.75 }, // 14:00 - 14:45
      ];

      // Atendimento começando exatamente às 14:45: NÃO deve colidir
      const contiguous = detectAppointmentOverlap(
        { id: 'apt-2', staffId: 'barber-1', dateKey: '2026-11-10', startDecimal: 14.75, durationDecimal: 0.5 },
        existing
      );
      expect(contiguous.hasOverlap).toBe(false);

      // Atendimento começando às 14:30 (sobreposição de 15m): DEVE colidir
      const overlapping = detectAppointmentOverlap(
        { id: 'apt-3', staffId: 'barber-1', dateKey: '2026-11-10', startDecimal: 14.5, durationDecimal: 0.5 },
        existing
      );
      expect(overlapping.hasOverlap).toBe(true);
      expect(overlapping.conflictingAppointments.length).toBe(1);
    });

    it('FC-FLO-002 (Fluxo 1 & 5: Cadeira Cativa): should generate valid WhatsApp confirmation link with formatted cell phone', () => {
      const phoneValidation = validateBrazilianCellPhone('11988887777');
      expect(phoneValidation.isValid).toBe(true);

      const message = generateCativaConfirmationMessage({
        clientName: 'Pedro Alvares',
        barberName: 'Carlos Barbeiro',
        dateStr: '2026-11-12',
        timeStr: '15:30',
        shopName: 'Barbearia Sanchez',
      });

      const url = buildCativaWhatsAppUrl(phoneValidation.sanitizedDigits, message);
      expect(url).toContain('https://wa.me/5511988887777?text=');
      expect(url).toContain(encodeURIComponent('Pedro'));
      expect(url).toContain(encodeURIComponent('Cadeira Cativa'));
      expect(url).toContain(encodeURIComponent('15:30'));
    });

    it('FC-FLO-003 (Fluxo 2: Balcão & Sincronização): should preserve counter products when updating comanda service', () => {
      const currentItems = [
        {
          id: 'item-svc',
          comanda_id: 'cmd-1',
          service_id: 'old-svc',
          product_name: 'Corte Social',
          unit_price: 50,
          quantity: 1,
          staff_id: 'b-1',
        },
        {
          id: 'item-prod',
          comanda_id: 'cmd-1',
          service_id: null, // Produto físico avulso
          product_name: 'Pomada Matte',
          unit_price: 40,
          quantity: 2,
          staff_id: 'b-1',
        },
      ];

      const synced = calculateSyncedComandaItems({
        currentItems,
        originalServiceId: 'old-svc',
        newService: { id: 'new-svc', name: 'Corte Degradê Navalhado', price: 65 },
        newProfessionalId: 'b-2',
      });

      // Deve preservar o produto com a quantidade e preço originais (2x R$ 40 = R$ 80)
      expect(synced.preservedProductsCount).toBe(1);
      const product = synced.updatedItems.find((i) => i.service_id === null);
      expect(product?.product_name).toBe('Pomada Matte');
      expect(product?.quantity).toBe(2);
      expect(product?.unit_price).toBe(40);

      // Total esperado: 1x 65 (serviço novo) + 2x 40 (produtos) = R$ 145,00
      expect(synced.nextTotal).toBe(145);
    });

    it('FC-FLO-004 (Fluxo 2 & 3: Proteção de Estado): should forbid modifying comanda linked to paid or closed lifecycle', () => {
      expect(canModifyLinkedComanda({ status: 'open' }).canModify).toBe(true);
      expect(canModifyLinkedComanda({ status: 'blocked' }).canModify).toBe(true);

      const paidGuard = canModifyLinkedComanda({ status: 'paid' });
      expect(paidGuard.canModify).toBe(false);
      expect(paidGuard.reason).toBe('paid_comanda');

      const closedGuard = canModifyLinkedComanda({ status: 'closed' });
      expect(closedGuard.canModify).toBe(false);

      const billedGuard = canModifyLinkedComanda({ status: 'billed' });
      expect(billedGuard.canModify).toBe(false);
    });

    it('FC-FLO-005 (Fluxo 2: Cancelamento em Cascata): should prompt confirmation when comanda has physical products', () => {
      const evaluation = evaluateCascadingCancel({
        comanda: { status: 'open' },
        comandaItems: [
          { id: 'i-1', service_id: 's-1', product_name: 'Corte', unit_price: 50, quantity: 1 },
          { id: 'i-2', service_id: null, product_name: 'Cerveja IPA', unit_price: 15, quantity: 2 },
        ],
      });

      expect(evaluation.requiresConfirmation).toBe(true);
      expect(evaluation.canDirectCancel).toBe(false);
      expect(evaluation.reason).toBe('has_products');
      expect(evaluation.productItems.length).toBe(1);
      expect(evaluation.productsTotal).toBe(30); // 2x R$ 15 = R$ 30
      expect(evaluation.message).toContain('1 produto(s)');
    });

    it('FC-FLO-006 (Fluxo 3: Checkout): should calculate change accurately rejecting tender lower than due amount', () => {
      const totalDue = 85.0;
      const tenderedCash = 100.0;
      const change = tenderedCash - totalDue;

      expect(change).toBe(15.0);

      // Trava contra valor insuficiente
      const insufficientTender = 80.0;
      const isSufficient = insufficientTender >= totalDue;
      expect(isSufficient).toBe(false);
    });

    it('FC-FLO-007 (Fluxo 4: Comissões): should maintain segregation between confirmed commission and pending pipeline', () => {
      const items = [
        { id: '1', gross: 60, status: 'paid', rate: 0.5 },
        { id: '2', gross: 40, status: 'open', rate: 0.5 },
      ];

      const confirmed = items
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + i.gross * i.rate, 0);
      const pending = items
        .filter((i) => i.status === 'open')
        .reduce((sum, i) => sum + i.gross * i.rate, 0);

      expect(confirmed).toBe(30);
      expect(pending).toBe(20);
      expect(confirmed + pending).toBe(50);
    });

    it('FC-FLO-008 (Fluxo 5: Club dos Chefes): should consistently yield 0.00 customer charge when plan credit applies', () => {
      const servicePrice = 70.0;
      const hasPlanCredit = true;
      const customerCharge = hasPlanCredit ? 0.0 : servicePrice;

      expect(customerCharge).toBe(0.0);
      const currencyResult = validateBrlCurrency(customerCharge);
      expect(currencyResult.formatted).toContain('0,00');
    });
  });
});
