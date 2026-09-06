/**
 * [SMG][MODULE][IMPORT-ENGINE] types
 *
 * Contrato central do Import Engine (P2_DESIGN_GATE.md §10.1).
 *
 * RESPONSABILIDADE: Tipos puros do pipeline de importação —
 *   ImportDefinition (contrato por entidade), ImportColumn (coluna do template),
 *   NormalizedRow / PreviewRow / ImportPreview (resultado do pipeline).
 *
 * NÃO FAZ:
 *   - Não lê arquivos (ver csv.ts)
 *   - Não acessa Supabase/banco (persistência via PersistenceStrategy/RPC)
 *   - Não conhece React
 *
 * GARANTIAS:
 *   - Zero dependência de infraestrutura — 100% testável em isolamento
 *   - Pipeline obrigatório: Parser → Normalização → Validação estrutural →
 *     Validação de domínio → Duplicidade → PREVIEW → CONFIRMA → Persistência
 */

export type ColumnType = 'string' | 'phone' | 'email' | 'date' | 'number';

export interface ImportColumn {
  /** Chave canônica da coluna (ex.: 'name'). */
  key: string;
  /** Label exibido na UI/preview (ex.: 'Nome'). */
  label: string;
  /** Obrigatoriedade estrutural da coluna no template. */
  required: boolean;
  /** Tipo de domínio — define parser e validação padrão. */
  type: ColumnType;
  /** Nomes de coluna tolerados no CSV (case-insensitive, sem acento, trim). */
  aliases: string[];
  /** Normalização do valor bruto → valor canônico (ex.: data pt-BR → ISO). */
  parse?: (raw: string) => string;
  /** Validações de domínio: retornam motivo de erro ou null se válido. */
  validators?: Array<(value: string) => string | null>;
}

/** Estratégia de duplicidade por entidade — decisão de negócio (gate §11 #4). */
export interface DuplicateStrategy {
  /** Chave de identidade usada pelo detector (ex.: 'telefone'). */
  key: string;
  /**
   * Normaliza uma linha para a chave de duplicidade (ex.: telefone só dígitos).
   * Retorna null quando a linha não tem como ser avaliada (ex.: sem telefone).
   */
  normalize: (row: NormalizedRow) => string | null;
}

/** Contrato de persistência segura — RPC transacional + idempotência (P0.4). */
export interface PersistenceStrategy {
  /** Nome do RPC no banco (ex.: 'import_clients_batch'). */
  rpc: string;
}

export interface ImportLimits {
  /** Linhas máximas por arquivo (decisão P2.1 — recomendação: 5.000). */
  maxRows: number;
  /** Bytes máximos por arquivo (recomendação: 5 MB). */
  maxFileBytes: number;
  /** Colunas máximas toleradas (anti arquivo malformado/malicioso). */
  maxColumns: number;
}

export interface ImportDefinition {
  /** Entidade importável (ex.: 'client'). */
  entity: string;
  /** Versão do template — imutável (clientes_v1 → v2 nunca muta v1). */
  version: string;
  /** Colunas do template. */
  columns: ImportColumn[];
  /** Detector de duplicidade por entidade (nunca vira UNIQUE — princípio 9). */
  duplicateStrategy: DuplicateStrategy;
  /** Persistência via RPC transacional (nunca INSERT direto — regra central). */
  persistence: PersistenceStrategy;
  /** Limites de arquivo/linhas/colunas. */
  limits: ImportLimits;
  /** Auditoria obrigatória (import_jobs/import_rows). Sempre true. */
  audit: boolean;
}

export interface NormalizedRow {
  /** Número da linha no arquivo (1 = primeira linha de dados, após header). */
  rowNumber: number;
  /** Chave canônica → valor normalizado. */
  values: Record<string, string>;
}

export type PreviewRowStatus = 'valid' | 'duplicate' | 'invalid';

export interface PreviewRow {
  rowNumber: number;
  status: PreviewRowStatus;
  values: Record<string, string>;
  /** Motivos de erro de validação (não vazio apenas em 'invalid'). */
  errors: string[];
  /** Descrição de duplicidade quando 'duplicate' (ex.: telefone já cadastrado). */
  duplicateOf?: string;
}

export interface ImportPreview {
  definition: ImportDefinition;
  fileName: string;
  fileBytes: number;
  totalRows: number;
  rows: PreviewRow[];
  /** Linhas válidas (importáveis). */
  validRows: PreviewRow[];
  /** Linhas duplicadas candidatas (sinalizadas, NUNCA bloqueadas — princípio 9). */
  duplicateRows: PreviewRow[];
  /** Linhas inválidas (excluídas, com motivos). */
  invalidRows: PreviewRow[];
  /** Erros estruturais de arquivo (tamanho, linhas, colunas obrigatórias ausentes). */
  fileErrors: string[];
  /** Avisos (ex.: colunas desconhecidas ignoradas). */
  warnings: string[];
}

export interface BuildImportPreviewInput {
  definition: ImportDefinition;
  /** Conteúdo do CSV (texto puro — encoding já decodificado pelo caller). */
  csvText: string;
  /** Tamanho real do arquivo em bytes (para limite maxFileBytes). */
  fileBytes: number;
  /** Nome do arquivo, para exibição no preview. Default: 'arquivo.csv'. */
  fileName?: string;
  /** Chaves de duplicidade já existentes no banco (ex.: telefones do tenant). */
  existingKeys?: Set<string>;
}