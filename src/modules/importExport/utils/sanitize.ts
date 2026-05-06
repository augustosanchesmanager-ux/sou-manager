export function sanitizeExcelInjection(value: string): string {
  if (typeof value !== 'string') return value;

  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  const trimmed = value.trim();

  for (const prefix of dangerousPrefixes) {
    if (trimmed.startsWith(prefix)) {
      return `'${trimmed}`;
    }
  }

  return trimmed;
}

export function sanitizeObject(
  obj: Record<string, unknown>,
  fields: string[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj };

  for (const key of fields) {
    if (typeof result[key] === 'string') {
      result[key] = sanitizeExcelInjection(result[key] as string);
    }
  }

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string' && !fields.includes(key)) {
      result[key] = sanitizeExcelInjection(value);
    }
  }

  return result;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_\-\.\s]/g, '').trim();
}

export function sanitizeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return sanitizeExcelInjection(str);
}

export function trimAndNormalize(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}