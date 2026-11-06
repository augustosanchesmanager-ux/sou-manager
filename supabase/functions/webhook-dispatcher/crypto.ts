/**
 * Camada de Criptografia e Assinatura de Webhooks para SMG Platform
 * Utiliza Web Crypto API nativa (HMAC-SHA256) compatível com Deno e Node.js >= 18.
 */

/**
 * Converte um ArrayBuffer em string hexadecimal lowercase
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Comparação de strings resistente a timing attack
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Calcula a assinatura HMAC-SHA256 de um payload com segredo fornecido
 */
export async function computeHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return bufferToHex(signatureBuffer);
}

/**
 * Gera o cabeçalho canônico de assinatura de webhook:
 * X-SMG-Signature: t={timestamp},v1={digestHex}
 * 
 * O digest é calculado sobre a string concatenada: `${timestamp}.${payload}`
 */
export async function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): Promise<{ signatureHeader: string; timestamp: number; digestHex: string }> {
  if (!secret || secret.trim() === '') {
    throw new Error('Secret de webhook não pode ser vazio para gerar assinatura');
  }

  const signedContent = `${timestamp}.${payload}`;
  const digestHex = await computeHmacSha256(signedContent, secret);
  const signatureHeader = `t=${timestamp},v1=${digestHex}`;

  return {
    signatureHeader,
    timestamp,
    digestHex,
  };
}

/**
 * Valida o cabeçalho X-SMG-Signature contra um payload e segredo,
 * verificando o timestamp contra tolerância a replay attacks (default 300s).
 */
export async function verifyWebhookSignature(
  payload: string,
  secret: string,
  signatureHeader: string | null | undefined,
  toleranceSeconds: number = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<{ valid: boolean; reason?: string }> {
  if (!signatureHeader || signatureHeader.trim() === '') {
    return { valid: false, reason: 'Header de assinatura ausente ou vazio' };
  }

  if (!secret || secret.trim() === '') {
    return { valid: false, reason: 'Secret de webhook inválido' };
  }

  // Parse t={timestamp},v1={hash}
  const parts = signatureHeader.split(',').map((p) => p.trim());
  let timestampStr: string | null = null;
  let digestHex: string | null = null;

  for (const part of parts) {
    if (part.startsWith('t=')) {
      timestampStr = part.substring(2);
    } else if (part.startsWith('v1=')) {
      digestHex = part.substring(3);
    }
  }

  if (!timestampStr || !digestHex) {
    return { valid: false, reason: 'Formato inválido do header de assinatura (esperado t=...,v1=...)' };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Timestamp de assinatura inválido' };
  }

  // Verificação contra replay attack
  const age = Math.abs(nowSeconds - timestamp);
  if (toleranceSeconds > 0 && age > toleranceSeconds) {
    return { valid: false, reason: `Assinatura expirada (idade: ${age}s > tolerância: ${toleranceSeconds}s)` };
  }

  // Calcular digest esperado e comparar em tempo constante
  const signedContent = `${timestamp}.${payload}`;
  const expectedDigest = await computeHmacSha256(signedContent, secret);

  const matches = constantTimeCompare(digestHex.toLowerCase(), expectedDigest.toLowerCase());
  if (!matches) {
    return { valid: false, reason: 'Digest criptográfico HMAC incompatível' };
  }

  return { valid: true };
}
