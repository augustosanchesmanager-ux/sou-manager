/**
 * functionalValidation.ts
 * Utilitário puro de validação e formatação funcional para o SMG Barber (Fase 7.3).
 * Garante consistência de entrada e apresentação de telefones, moedas, durações e datas.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  sanitizedDigits: string;
  sanitizedE164: string;
  formattedDisplay: string;
  error?: string;
}

export interface CurrencyValidationResult {
  isValid: boolean;
  cents: number;
  value: number;
  formatted: string;
  error?: string;
}

/**
 * 1. Valida e sanitiza número de telefone celular brasileiro (DDD + 9 dígitos).
 * Aceita entradas com ou sem máscara, adicionando DDI 55 para comunicação WhatsApp.
 */
export function validateBrazilianCellPhone(rawPhone: unknown): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      isValid: false,
      sanitizedDigits: '',
      sanitizedE164: '',
      formattedDisplay: '',
      error: 'Telefone celular não informado.',
    };
  }

  const digits = rawPhone.replace(/\D/g, '');

  // Celular brasileiro com DDD precisa ter exatamente 11 dígitos (ou 13 se já veio com DDI 55)
  let localDigits = digits;
  if (digits.length === 13 && digits.startsWith('55')) {
    localDigits = digits.slice(2);
  }

  if (localDigits.length !== 11) {
    return {
      isValid: false,
      sanitizedDigits: localDigits,
      sanitizedE164: '',
      formattedDisplay: rawPhone.trim(),
      error: 'Telefone celular inválido. Informe o DDD e o número com 9 dígitos (ex: 11 99999-8888).',
    };
  }

  // Validação do nono dígito (celular BR sempre inicia com 9 após DDD)
  const ddd = localDigits.slice(0, 2);
  const ninthDigit = localDigits.charAt(2);
  if (ninthDigit !== '9') {
    return {
      isValid: false,
      sanitizedDigits: localDigits,
      sanitizedE164: '',
      formattedDisplay: rawPhone.trim(),
      error: 'Número de celular brasileiro deve iniciar com o dígito 9 após o DDD.',
    };
  }

  const firstPart = localDigits.slice(2, 7);
  const secondPart = localDigits.slice(7);
  const formattedDisplay = `(${ddd}) ${firstPart}-${secondPart}`;
  const sanitizedE164 = `55${localDigits}`;

  return {
    isValid: true,
    sanitizedDigits: localDigits,
    sanitizedE164,
    formattedDisplay,
  };
}

/**
 * 2. Valida valor monetário BRL garantindo integridade de centavos sem dízimas.
 */
export function validateBrlCurrency(rawValue: unknown): CurrencyValidationResult {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return {
      isValid: false,
      cents: 0,
      value: 0,
      formatted: 'R$ 0,00',
      error: 'Valor monetário é obrigatório.',
    };
  }

  let numValue = 0;
  if (typeof rawValue === 'number') {
    numValue = rawValue;
  } else if (typeof rawValue === 'string') {
    // Trata formato BRL '1.250,50' ou numérico '1250.50'
    const cleaned = rawValue.replace(/[R$\s]/g, '').trim();
    if (cleaned.includes(',')) {
      numValue = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    } else {
      numValue = parseFloat(cleaned);
    }
  }

  if (!Number.isFinite(numValue) || Number.isNaN(numValue)) {
    return {
      isValid: false,
      cents: 0,
      value: 0,
      formatted: 'R$ 0,00',
      error: 'Valor monetário numérico inválido.',
    };
  }

  if (numValue < 0) {
    return {
      isValid: false,
      cents: 0,
      value: numValue,
      formatted: 'R$ 0,00',
      error: 'O valor monetário não pode ser negativo.',
    };
  }

  const cents = Math.round(numValue * 100);
  const safeValue = cents / 100;
  const formatted = safeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return {
    isValid: true,
    cents,
    value: safeValue,
    formatted,
  };
}

/**
 * 3. Conversão de minutos inteiros nominais para decimal de hora (usado pela grade da agenda).
 * Ex: 30 min -> 0.5; 45 min -> 0.75; 60 min -> 1.0.
 */
export function convertMinutesToDecimalHours(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * 4. Conversão de horas decimais para minutos nominais.
 * Ex: 0.5h -> 30 min; 0.75h -> 45 min; 1.5h -> 90 min.
 */
export function convertDecimalHoursToMinutes(decimalHours: number): number {
  if (!Number.isFinite(decimalHours) || decimalHours <= 0) return 0;
  return Math.round(decimalHours * 60);
}

/**
 * 5. Formatação amigável de duração em minutos (ex: '30m', '1h', '1h 15m').
 */
export function formatDurationDisplay(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}
