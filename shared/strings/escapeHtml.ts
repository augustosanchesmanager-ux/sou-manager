/**
 * [SMG][SHARED][UTIL] escapeHtml
 *
 * Escapa caracteres HTML sensíveis para prevenir XSS ao interpolar
 * valores controlados pelo usuário em strings HTML (document.write,
 * innerHTML, templates de impressão).
 *
 * F5.1/F5.2 — Auditoria de Segurança (2026-09-14)
 * Vetores: handlePrint em Comandas.tsx e CashClosingPage.tsx
 */

/**
 * Escapa uma string para uso seguro em contexto HTML (texto/atributo).
 * escapeHtml(`<script>alert(1)</script>`) → `&lt;script&gt;alert(1)&lt;/script&gt;`
 * escapeHtml("João & Maria") → "João &amp; Maria"
 * escapeHtml("") → ""
 * escapeHtml(null) → ""
 */
export const escapeHtml = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');