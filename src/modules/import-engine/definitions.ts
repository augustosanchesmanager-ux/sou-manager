/**
 * [SMG][MODULE][IMPORT-ENGINE] definitions
 *
 * Definições de importação por entidade — P2.1: clientes (clientes_v1).
 * Cada versão de template é IMUTÁVEL: correções geram nova versão (v2),
 * nunca mutação da v1 (compatibilidade de jobs antigos em import_jobs).
 */

import { normalizeDate, normalizeEmail, normalizePhone, normalizeText } from './csv';
import type { ImportDefinition, PreviewRow } from './types';
import type { ClientImportRow } from '../../../domain/client/types';

/**
 * Template clientes_v1 (P2.1 — decisão #4: duplicidade por entidade,
 * chave = telefone; decisão #3: parcial por padrão).
 *
 * Colunas:
 *  - name (obrigatória, string)
 *  - phone (opcional, phone) — chave de duplicidade
 *  - email (opcional, email)
 *  - birthday (opcional, date pt-BR dd/mm/aaaa)
 */
export const clientImportDefinition: ImportDefinition = {
  entity: 'client',
  version: 'v1',
  columns: [
    {
      key: 'name',
      label: 'Nome',
      required: true,
      type: 'string',
      aliases: ['nome', 'name', 'cliente', 'client', 'nome completo', 'nome_completo', 'nome do cliente'],
      parse: normalizeText,
      validators: [
        (value) => (value.length < 2 ? 'Nome muito curto' : null),
      ],
    },
    {
      key: 'phone',
      label: 'Telefone',
      required: false,
      type: 'phone',
      aliases: ['telefone', 'phone', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'ddd'],
      parse: normalizePhone,
    },
    {
      key: 'email',
      label: 'Email',
      required: false,
      type: 'email',
      aliases: ['email', 'e-mail', 'mail', 'correo', 'email address'],
      parse: normalizeEmail,
    },
    {
      key: 'birthday',
      label: 'Aniversário',
      required: false,
      type: 'date',
      aliases: ['aniversário', 'aniversario', 'aniversario (data)', 'nascimento', 'data de nascimento', 'data_nascimento', 'birthday', 'dob'],
      parse: normalizeDate,
    },
  ],
  duplicateStrategy: {
    key: 'telefone',
    normalize: (row) => (row.values.phone ? normalizePhone(row.values.phone) : null),
  },
  persistence: {
    rpc: 'import_clients_batch',
  },
  limits: {
    maxRows: 5000,
    maxFileBytes: 5 * 1024 * 1024,
    maxColumns: 20,
  },
  audit: true,
};

/** Converte PreviewRow válida → linha persistível (shape do RPC). */
export function toPersistableRow(row: PreviewRow): ClientImportRow {
  return {
    rowNumber: row.rowNumber,
    name: row.values.name ?? '',
    phone: row.values.phone ?? '',
    email: row.values.email ?? '',
    birthday: row.values.birthday ?? '',
  };
}