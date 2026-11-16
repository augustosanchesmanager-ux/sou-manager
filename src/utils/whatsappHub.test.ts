import { describe, expect, it } from 'vitest';
import {
  buildAppointmentWhatsAppTemplates,
  buildPostSaleThankYouMessage,
  buildPublicBookingUrl,
  cleanPhoneNumber,
  generateWhatsAppLink,
  getFirstName,
  isValidWhatsAppPhone,
} from './whatsappHub';

describe('whatsappHub utilities', () => {
  it('should_sanitize_brazilian_phone_numbers_when_formatting_for_whatsapp', () => {
    expect(cleanPhoneNumber('(11) 99999-8888')).toBe('5511999998888');
    expect(cleanPhoneNumber('+55 11 99999-8888')).toBe('5511999998888');
    expect(cleanPhoneNumber('1133334444')).toBe('551133334444');
    expect(cleanPhoneNumber('')).toBe('');
    expect(cleanPhoneNumber(null)).toBe('');
    expect(cleanPhoneNumber('12345')).toBe('');

    expect(isValidWhatsAppPhone('(11) 99999-8888')).toBe(true);
    expect(isValidWhatsAppPhone(undefined)).toBe(false);
    expect(isValidWhatsAppPhone('000')).toBe(false);
  });

  it('should_generate_encoded_whatsapp_link_only_when_phone_is_valid', () => {
    const link = generateWhatsAppLink('(11) 98765-4321', 'Fala *João*, tudo certo?');
    expect(link).toBe(
      `https://wa.me/5511987654321?text=${encodeURIComponent('Fala *João*, tudo certo?')}`,
    );

    expect(generateWhatsAppLink(null, 'Olá')).toBeNull();
    expect(generateWhatsAppLink('123', 'Olá')).toBeNull();
  });

  it('should_extract_first_name_and_build_public_booking_url', () => {
    expect(getFirstName('Carlos Eduardo Silva')).toBe('Carlos');
    expect(getFirstName('   ')).toBe('Cliente');

    const url = buildPublicBookingUrl('sanchez barber');
    expect(url).toContain('/#/agendar/sanchez%20barber');
  });

  it('should_build_all_four_fixed_appointment_templates_with_dynamic_data', () => {
    const templates = buildAppointmentWhatsAppTemplates({
      clientName: 'Rafael Mendes',
      serviceName: 'Corte + Barba',
      timeLabel: '14:30',
      bookingUrl: 'https://barber.soumanager.com/#/agendar/sanchezbarber',
    });

    expect(templates).toHaveLength(4);
    expect(templates.map((item) => item.id)).toEqual([
      'confirm',
      'delay',
      'tolerance',
      'reschedule',
    ]);

    expect(templates[0].label).toBe('Confirmar Horário');
    expect(templates[0].message).toBe(
      'Fala *Rafael*, tudo certo? Passando pra confirmar seu horário de *Corte + Barba* hoje às *14:30*.',
    );

    expect(templates[1].label).toBe('Notificar Atraso');
    expect(templates[1].message).toBe(
      'Fala *Rafael*, notamos um pequeno atraso. Ainda consegue chegar para o seu horário das *14:30*?',
    );

    expect(templates[2].label).toBe('Pedir Tolerância');
    expect(templates[2].message).toBe(
      'Fala *Rafael*, seu barbeiro está finalizando um atendimento e pedimos uns minutinhos de tolerância, mas já estamos te esperando!',
    );

    expect(templates[3].label).toBe('Remarcar (Falta)');
    expect(templates[3].message).toBe(
      'Fala *Rafael*, como não conseguimos te atender hoje, vamos remarcar para não deixar o cabelo perder o corte? Só escolher um horário aqui: *https://barber.soumanager.com/#/agendar/sanchezbarber*',
    );
  });

  it('should_include_google_review_block_when_google_review_url_is_configured', () => {
    const message = buildPostSaleThankYouMessage({
      clientName: 'Lucas Andrade',
      barbershopName: 'Sanchez Barber',
      bookingUrl: 'https://barber.soumanager.com/#/agendar/sanchezbarber',
      googleReviewUrl: 'https://g.page/r/sanchez/review',
    });

    expect(message).toBe(
      'Fala *Lucas*, valeu por colar na *Sanchez Barber* hoje! ✂️\n\n' +
        'Se curtiu o atendimento, dá uma força avaliando a gente no Google, é rapidinho: *https://g.page/r/sanchez/review*\n\n' +
        'E para agendar seus próximos cortes ou deixar alguma sugestão para nossa equipe, é só acessar nosso link: *https://barber.soumanager.com/#/agendar/sanchezbarber*',
    );
  });

  it('should_omit_google_review_block_gracefully_when_google_review_url_is_empty', () => {
    const message = buildPostSaleThankYouMessage({
      clientName: 'Lucas Andrade',
      barbershopName: 'Sanchez Barber',
      bookingUrl: 'https://barber.soumanager.com/#/agendar/sanchezbarber',
      googleReviewUrl: '   ',
    });

    expect(message).not.toContain('Google');
    expect(message).not.toContain('\n\n\n');
    expect(message).toBe(
      'Fala *Lucas*, valeu por colar na *Sanchez Barber* hoje! ✂️\n\n' +
        'Para agendar seus próximos cortes ou deixar alguma sugestão para nossa equipe, é só acessar nosso link: *https://barber.soumanager.com/#/agendar/sanchezbarber*',
    );
  });
});
