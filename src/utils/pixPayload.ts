/**
 * [SMG][FINANCE][PIX] pixPayload
 *
 * RESPONSABILIDADE: Geração de payload PIX EMVCo padrão BR Code (Banco Central do Brasil)
 * para exibição em QR Code dinâmico e código "Copia e Cola".
 *
 * GARANTIAS:
 *   - Função pura, determinística, sem efeitos colaterais
 *   - Cálculo CRC16-CCITT (polinômio 0x1021, init 0xFFFF)
 *   - Sanitização de caracteres acentuados para compatibilidade estrita com bancos
 */

function formatField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function normalizeText(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .slice(0, maxLength);
}

export function calculatePixCrc16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface GeneratePixPayloadOptions {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amount: number;
  txId?: string;
  description?: string;
}

export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity = 'SAO PAULO',
  amount,
  txId = '***',
  description,
}: GeneratePixPayloadOptions): string {
  const cleanKey = pixKey.trim();
  const cleanName = normalizeText(merchantName || 'SMG BARBER', 25) || 'BARBEARIA';
  const cleanCity = normalizeText(merchantCity || 'BRASIL', 15) || 'BRASILIA';
  const cleanTxId = (txId || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const formattedAmount = amount > 0 ? amount.toFixed(2) : '0.00';

  // 26: Merchant Account Information
  const gui = formatField('00', 'br.gov.bcb.pix');
  const keyField = formatField('01', cleanKey);
  const descField = description ? formatField('02', normalizeText(description, 40)) : '';
  const merchantAccountInfo = formatField('26', `${gui}${keyField}${descField}`);

  // 62: Additional Data Field Template (TxID)
  const txIdField = formatField('05', cleanTxId);
  const additionalData = formatField('62', txIdField);

  const rawPayload = [
    formatField('00', '01'), // Payload Format Indicator
    merchantAccountInfo,
    formatField('52', '0000'), // Merchant Category Code
    formatField('53', '986'), // Currency: BRL
    formatField('54', formattedAmount), // Amount
    formatField('58', 'BR'), // Country Code
    formatField('59', cleanName), // Merchant Name
    formatField('60', cleanCity), // Merchant City
    additionalData,
    '6304', // CRC16 placeholder
  ].join('');

  const checksum = calculatePixCrc16(rawPayload);
  return `${rawPayload}${checksum}`;
}
