import { describe, it, expect } from 'vitest';
import { parseCsvText, normalizePhone, normalizeDate, normalizeEmail, normalizeText } from './csv';
import { buildImportPreview, phoneDuplicateKey } from './pipeline';
import { clientImportDefinition, toPersistableRow } from './definitions';
import type { ImportLimits } from './types';

// ─── Helpers ────────────────────────────────────────────────────
const LIMITS: ImportLimits = {
  maxRows: 5000,
  maxFileBytes: 5 * 1024 * 1024,
  maxColumns: 20,
};

const parse = (text: string) => parseCsvText(text, LIMITS);

const HEADER = 'nome,telefone,email,aniversario';
const csv = (rows: string[], header = HEADER) => [header, ...rows].join('\n');

// ─── Parser + Normalização (csv.ts) ─────────────────────────────
describe('P2.1 — Import Engine', () => {
  describe('csv.ts — Parser', () => {
    it('parseia header e linhas com BOM removido', () => {
      const result = parse('\uFEFF' + csv(['João,11988887777,joao@mail.com,15/03/1990']));
      expect(result.errors).toEqual([]);
      expect(result.csv?.headers).toEqual(['nome', 'telefone', 'email', 'aniversario']);
      expect(result.csv?.rows).toHaveLength(1);
      expect(result.csv?.rows[0].nome).toBe('João');
    });

    it('arquivo vazio → erro estrutural sem csv', () => {
      const result = parse('');
      expect(result.csv).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('linhas de dados acima de maxRows → erro estrutural', () => {
      const many = Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => `Cliente ${i},119${i}`);
      const result = parse(csv(many, 'nome,telefone'));
      expect(result.errors.some((e) => e.includes('linhas'))).toBe(true);
    });

    it('ainda retorna csv quando só há excesso de linhas (decide no pipeline)', () => {
      const many = Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => `Cliente ${i},119${i}`);
      const result = parse(csv(many, 'nome,telefone'));
      expect(result.csv).not.toBeNull();
    });

    it('arquivo acima de maxFileBytes → erro estrutural', () => {
      const text = csv(['Cliente com nome longo o suficiente,11988887777']);
      const bloated = text.padEnd(LIMITS.maxFileBytes + 1, 'x');
      const result = parse(bloated);
      expect(result.errors.some((e) => e.includes('MB'))).toBe(true);
    });
  });

  describe('csv.ts — Normalização', () => {
    it('normalizePhone → apenas dígitos', () => {
      expect(normalizePhone('(11) 98888-7777')).toBe('11988887777');
      expect(normalizePhone('+55 11 98888-7777')).toBe('5511988887777');
      expect(normalizePhone('')).toBe('');
    });

    it('normalizeEmail → trim + lowercase', () => {
      expect(normalizeEmail('  João@Mail.COM ')).toBe('joão@mail.com');
    });

    it('normalizeText → trim + colapsa espaços', () => {
      expect(normalizeText('  João   da  Silva  ')).toBe('João da Silva');
    });

    it('normalizeDate pt-BR → ISO', () => {
      expect(normalizeDate('15/03/1990')).toBe('1990-03-15');
      expect(normalizeDate('3/2/2026')).toBe('2026-02-03');
      expect(normalizeDate('2026-03-15')).toBe('2026-03-15');
      expect(normalizeDate('31/02/2026')).toBe('');
      expect(normalizeDate('not-a-date')).toBe('');
      expect(normalizeDate('')).toBe('');
    });
  });

  // ─── Pipeline (pipeline.ts) ───────────────────────────────────
  describe('pipeline.ts — buildImportPreview', () => {
    it('arquivo válido → todas as linhas em validRows', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv([
          'João,11988887777,joao@mail.com,15/03/1990',
          'Maria,11977776666,maria@mail.com,20/07/1985',
        ]),
        fileBytes: 200,
      });
      expect(preview.fileErrors).toEqual([]);
      expect(preview.totalRows).toBe(2);
      expect(preview.validRows).toHaveLength(2);
      expect(preview.invalidRows).toHaveLength(0);
      expect(preview.duplicateRows).toHaveLength(0);
      expect(preview.validRows[0].values.birthday).toBe('1990-03-15');
    });

    it('coluna obrigatória ausente no header → erro estrutural e preview vazio', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(['João,11988887777,joao@mail.com'], 'telefone,email,aniversario'),
        fileBytes: 100,
      });
      expect(preview.fileErrors.some((e) => e.includes('Nome'))).toBe(true);
      expect(preview.totalRows).toBe(0);
      expect(preview.rows).toHaveLength(0);
    });

    it('excesso de linhas → erro estrutural bloqueia (rows vazio)', () => {
      const many = Array.from({ length: clientImportDefinition.limits.maxRows + 1 }, (_, i) => `Cliente ${i},119${i}`);
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(many, 'nome,telefone'),
        fileBytes: 100000,
      });
      expect(preview.fileErrors.length).toBeGreaterThan(0);
      expect(preview.rows).toHaveLength(0);
    });

    it('linha sem valor em coluna obrigatória → invalid com motivo', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv([' ,11988887777,joao@mail.com,15/03/1990']),
        fileBytes: 100,
      });
      expect(preview.invalidRows).toHaveLength(1);
      expect(preview.invalidRows[0].errors.join(' ')).toContain('Nome é obrigatório');
    });

    it('email e telefone inválidos → invalid com motivos', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(['João,123,email-errado,15/03/1990']),
        fileBytes: 100,
      });
      expect(preview.invalidRows).toHaveLength(1);
      const errors = preview.invalidRows[0].errors.join(' | ');
      expect(errors).toContain('Telefone');
      expect(errors).toContain('Email');
    });

    it('data inválida → invalid', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(['João,11988887777,joao@mail.com,31/02/2026']),
        fileBytes: 100,
      });
      expect(preview.invalidRows).toHaveLength(1);
      expect(preview.invalidRows[0].errors.join(' ')).toContain('Aniversário');
    });

    it('telefone já existente no banco → duplicate sinalizada (nunca bloqueia)', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(['João,11988887777,joao@mail.com,15/03/1990']),
        fileBytes: 100,
        existingKeys: new Set([phoneDuplicateKey('(11) 98888-7777')]),
      });
      expect(preview.validRows).toHaveLength(0);
      expect(preview.duplicateRows).toHaveLength(1);
      expect(preview.duplicateRows[0].duplicateOf).toContain('telefone');
    });

    it('telefone repetido no mesmo arquivo → segunda ocorrência duplicate', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv([
          'João,11988887777,joao@mail.com,15/03/1990',
          'Outro João,11988887777,outro@mail.com,01/01/2000',
        ]),
        fileBytes: 200,
      });
      expect(preview.validRows).toHaveLength(1);
      expect(preview.duplicateRows).toHaveLength(1);
      expect(preview.duplicateRows[0].rowNumber).toBe(2);
      expect(preview.duplicateRows[0].duplicateOf).toContain('linha 1');
    });

    it('linha inválida tem precedência sobre duplicate', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(['João,11988887777,email-errado,15/03/1990']),
        fileBytes: 100,
        existingKeys: new Set(['11988887777']),
      });
      expect(preview.invalidRows).toHaveLength(1);
      expect(preview.duplicateRows).toHaveLength(0);
      expect(preview.invalidRows[0].errors.join(' ')).toContain('Email');
    });

    it('coluna desconhecida → warning, linha segue válida', () => {
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(['João,11988887777,joao@mail.com,15/03/1990'], 'nome,telefone,email,aniversario,observacoes'),
        fileBytes: 200,
      });
      expect(preview.warnings.some((w) => w.includes('observacoes'))).toBe(true);
      expect(preview.validRows).toHaveLength(1);
    });

    it('excesso de colunas → erro estrutural', () => {
      const manyCols = Array.from({ length: clientImportDefinition.limits.maxColumns + 1 }, (_, i) => `col${i}`).join(',');
      const preview = buildImportPreview({
        definition: clientImportDefinition,
        csvText: csv(['João,11988887777,joao@mail.com,15/03/1990'], manyCols),
        fileBytes: 200,
      });
      expect(preview.fileErrors.some((e) => e.includes('colunas'))).toBe(true);
      expect(preview.rows).toHaveLength(0);
    });
  });

  // ─── Definição clientes_v1 (definitions.ts) ───────────────────
  describe('definitions.ts — clientes_v1', () => {
    it('contrato do template', () => {
      expect(clientImportDefinition.entity).toBe('client');
      expect(clientImportDefinition.version).toBe('v1');
      expect(clientImportDefinition.persistence.rpc).toBe('import_clients_batch');
      expect(clientImportDefinition.audit).toBe(true);
      expect(clientImportDefinition.duplicateStrategy.key).toBe('telefone');
      expect(clientImportDefinition.columns.map((c) => c.key)).toEqual(['name', 'phone', 'email', 'birthday']);
      expect(clientImportDefinition.limits.maxRows).toBe(5000);
    });

    it('toPersistableRow mapeia valores normalizados', () => {
      const row = toPersistableRow({
        rowNumber: 3,
        status: 'valid',
        values: { name: 'João', phone: '11988887777', email: 'joao@mail.com', birthday: '1990-03-15' },
        errors: [],
      });
      expect(row).toEqual({
        rowNumber: 3,
        name: 'João',
        phone: '11988887777',
        email: 'joao@mail.com',
        birthday: '1990-03-15',
      });
    });

    it('duplicateStrategy.normalize retorna null sem telefone', () => {
      const key = clientImportDefinition.duplicateStrategy.normalize({
        rowNumber: 1,
        values: { name: 'João', phone: '', email: '', birthday: '' },
      });
      expect(key).toBeNull();
    });

    it('duplicateStrategy.normalize ignora formatação do telefone', () => {
      const key = clientImportDefinition.duplicateStrategy.normalize({
        rowNumber: 1,
        values: { name: 'João', phone: '(11) 98888-7777', email: '', birthday: '' },
      });
      expect(key).toBe('11988887777');
    });
  });
});