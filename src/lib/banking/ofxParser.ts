export interface ParsedTransaction {
  fitid: string;
  posted_at: string; // YYYY-MM-DD
  amount: number;
  memo: string;
  type: 'credit' | 'debit';
}

export interface ParsedStatement {
  bankId?: string;
  accountId?: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  transactions: ParsedTransaction[];
}

const parseOfxDate = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) {
    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6);
    const day = digits.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return new Date().toISOString().split('T')[0];
};

const extractTagValue = (xmlOrSgml: string, tag: string): string => {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const match = xmlOrSgml.match(regex);
  return match ? match[1].trim() : '';
};

export const parseOfxContent = (content: string): ParsedStatement => {
  const cleanContent = content.replace(/\r\n/g, '\n');

  const bankId = extractTagValue(cleanContent, 'BANKID') || extractTagValue(cleanContent, 'ORG');
  const accountId = extractTagValue(cleanContent, 'ACCTID');
  const dtStartRaw = extractTagValue(cleanContent, 'DTSTART');
  const dtEndRaw = extractTagValue(cleanContent, 'DTEND');

  const transactions: ParsedTransaction[] = [];
  const stmtTrnBlocks = cleanContent.split(/<STMTTRN>/i).slice(1);

  let earliestDate = dtStartRaw ? parseOfxDate(dtStartRaw) : '';
  let latestDate = dtEndRaw ? parseOfxDate(dtEndRaw) : '';

  for (const block of stmtTrnBlocks) {
    const endBlockIndex = block.search(/<\/STMTTRN>/i);
    const trnData = endBlockIndex !== -1 ? block.slice(0, endBlockIndex) : block;

    const fitid = extractTagValue(trnData, 'FITID');
    const dtPostedRaw = extractTagValue(trnData, 'DTPOSTED');
    const trnAmtRaw = extractTagValue(trnData, 'TRNAMT').replace(',', '.');
    const memo = extractTagValue(trnData, 'MEMO') || extractTagValue(trnData, 'NAME') || 'Transação Bancária';
    const trnType = extractTagValue(trnData, 'TRNTYPE').toUpperCase();

    if (fitid && trnAmtRaw) {
      const amount = parseFloat(trnAmtRaw);
      const postedDate = parseOfxDate(dtPostedRaw);

      if (!earliestDate || postedDate < earliestDate) earliestDate = postedDate;
      if (!latestDate || postedDate > latestDate) latestDate = postedDate;

      transactions.push({
        fitid,
        posted_at: postedDate,
        amount,
        memo,
        type: amount >= 0 || trnType === 'CREDIT' ? 'credit' : 'debit',
      });
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return {
    bankId,
    accountId,
    periodStart: earliestDate || today,
    periodEnd: latestDate || today,
    transactions,
  };
};

export const parseCsvContent = (content: string): ParsedStatement => {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('Arquivo CSV vazio');
  }

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].toLowerCase().split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));

  const dateIdx = header.findIndex((h) => h.includes('data') || h.includes('date'));
  const memoIdx = header.findIndex((h) => h.includes('historico') || h.includes('descri') || h.includes('memo'));
  const amountIdx = header.findIndex((h) => h.includes('valor') || h.includes('amount') || h.includes('saldo'));

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error('Não foi possível identificar colunas de Data e Valor no arquivo CSV.');
  }

  const transactions: ParsedTransaction[] = [];
  let earliestDate = '';
  let latestDate = '';

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length <= Math.max(dateIdx, amountIdx)) continue;

    const rawDate = cols[dateIdx];
    const rawMemo = memoIdx !== -1 ? cols[memoIdx] : 'Lançamento CSV';
    let rawAmount = cols[amountIdx].replace(/\./g, '').replace(',', '.');

    const dateParts = rawDate.split(/[-/]/);
    let postedDate = '';
    if (dateParts.length === 3) {
      if (dateParts[0].length === 4) {
        postedDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
      } else {
        postedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
      }
    }

    const amount = parseFloat(rawAmount);
    if (!isNaN(amount) && postedDate) {
      if (!earliestDate || postedDate < earliestDate) earliestDate = postedDate;
      if (!latestDate || postedDate > latestDate) latestDate = postedDate;

      // Gera um hash simples representativo como fitid para CSV
      const fitid = `csv-${postedDate}-${Math.abs(amount).toFixed(2)}-${rawMemo.slice(0, 15).replace(/\s+/g, '')}`;

      transactions.push({
        fitid,
        posted_at: postedDate,
        amount,
        memo: rawMemo,
        type: amount >= 0 ? 'credit' : 'debit',
      });
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return {
    periodStart: earliestDate || today,
    periodEnd: latestDate || today,
    transactions,
  };
};

export const parseBankStatementFile = async (file: File): Promise<ParsedStatement> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const text = await file.text();

  if (extension === 'ofx' || text.includes('<OFX>')) {
    return parseOfxContent(text);
  }

  if (extension === 'csv') {
    return parseCsvContent(text);
  }

  // Fallback: tenta OFX, depois CSV
  try {
    return parseOfxContent(text);
  } catch {
    return parseCsvContent(text);
  }
};
