import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import ExcelJS from 'npm:exceljs@4.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export interface ExcelColumnSpec {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'currency' | 'date';
}

export interface ExcelExportRequest {
  tenantId?: string;
  reportType?: 'sales' | 'clients' | 'cashflow' | 'commissions' | 'schedule' | 'custom';
  title?: string;
  subtitle?: string;
  sheetName?: string;
  fileName?: string;
  columns?: ExcelColumnSpec[];
  rows?: Array<Record<string, string | number | boolean | null | undefined>>;
  summaryRows?: Array<{ label: string; value: string | number; type?: 'currency' | 'number' | 'string' }>;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  };
}

function sanitizeFileName(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned.endsWith('.xlsx') ? cleaned : `${cleaned || 'relatorio_smg'}.xlsx`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing Supabase environment configuration.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Missing Authorization header.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 1. Validate caller identity and tenant via user JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Unauthorized user session.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('id, tenant_id, role, status')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileErr || !profile || !profile.tenant_id) {
    return new Response(
      JSON.stringify({ ok: false, error: 'User profile or tenant not found.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const isSuperAdmin = profile.role === 'super_admin' || profile.role === 'superadmin';

  // 1.1 Deny exports for profiles that are pending approval or suspended
  const profileStatus = String(profile.status ?? '').toLowerCase();
  if (!isSuperAdmin && profileStatus !== 'active') {
    return new Response(
      JSON.stringify({ ok: false, error: 'User profile is not active. Export denied.' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let body: ExcelExportRequest;
  try {
    body = (await req.json()) as ExcelExportRequest;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON request body.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Strict multi-tenant isolation: always enforce caller's tenant_id unless super_admin
  const effectiveTenantId = isSuperAdmin && body.tenantId ? body.tenantId : String(profile.tenant_id);

  // Resolve tenant name for header branding
  const { data: tenantRow } = await adminClient
    .from('tenants')
    .select('name')
    .eq('id', effectiveTenantId)
    .maybeSingle();
  const tenantName = tenantRow?.name || 'SMG Barber';

  let columns: ExcelColumnSpec[] = body.columns ?? [];
  let rows: Array<Record<string, string | number | boolean | null | undefined>> = body.rows ?? [];
  let reportTitle = body.title || 'Relatório Gerencial — SMG Barber';

  // 2. Server-side DB query fallback when rows are not provided by the client
  if (rows.length === 0 && body.reportType === 'clients') {
    reportTitle = body.title || 'Base de Clientes (CRM)';
    columns = [
      { key: 'name', header: 'Cliente', width: 32, type: 'string' },
      { key: 'phone', header: 'Telefone', width: 20, type: 'string' },
      { key: 'email', header: 'E-mail', width: 28, type: 'string' },
      { key: 'lifetime_value', header: 'LTV Acumulado (R$)', width: 20, type: 'currency' },
      { key: 'vip', header: 'Classificação', width: 16, type: 'string' },
      { key: 'last_visit', header: 'Última Visita', width: 18, type: 'string' },
    ];
    const { data: clientData } = await adminClient
      .from('clients')
      .select('name, phone, email, lifetime_value, last_visit')
      .eq('tenant_id', effectiveTenantId)
      .order('name', { ascending: true })
      .limit(10000);

    rows = (clientData ?? []).map((c) => {
      const ltv = Number(c.lifetime_value) || 0;
      return {
        name: c.name ?? 'Sem nome',
        phone: c.phone ?? '—',
        email: c.email ?? '—',
        lifetime_value: ltv,
        vip: ltv > 1000 ? 'VIP' : 'Standard',
        last_visit: c.last_visit ? String(c.last_visit).slice(0, 10) : '—',
      };
    });
  } else if (rows.length === 0 && body.reportType === 'cashflow') {
    reportTitle = body.title || 'Relatório de Fluxo de Caixa';
    columns = [
      { key: 'date', header: 'Data', width: 16, type: 'string' },
      { key: 'description', header: 'Descrição', width: 36, type: 'string' },
      { key: 'category', header: 'Categoria', width: 22, type: 'string' },
      { key: 'type', header: 'Tipo', width: 14, type: 'string' },
      { key: 'payment_method', header: 'Forma de Pagamento', width: 20, type: 'string' },
      { key: 'amount', header: 'Valor (R$)', width: 18, type: 'currency' },
      { key: 'status', header: 'Status', width: 14, type: 'string' },
    ];
    let txQuery = adminClient
      .from('transactions')
      .select('date, description, category, type, payment_method, amount, status')
      .eq('tenant_id', effectiveTenantId)
      .order('date', { ascending: false })
      .limit(10000);

    if (body.filters?.dateFrom) txQuery = txQuery.gte('date', body.filters.dateFrom);
    if (body.filters?.dateTo) txQuery = txQuery.lte('date', body.filters.dateTo);

    const { data: txData } = await txQuery;
    rows = (txData ?? []).map((t) => ({
      date: t.date ?? '—',
      description: t.description ?? '—',
      category: t.category ?? 'Geral',
      type: t.type === 'income' ? 'Entrada' : 'Saída',
      payment_method: t.payment_method ?? '—',
      amount: Number(t.amount) || 0,
      status: t.status ?? 'paid',
    }));
  }

  if (columns.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: 'No columns specified for Excel export.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 3. Build workbook via ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SMG Barber Platform';
  workbook.created = new Date();

  const sheetTitle = (body.sheetName || 'Relatorio').slice(0, 31);
  const sheet = workbook.addWorksheet(sheetTitle, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const totalCols = Math.max(columns.length, 1);

  // Row 1: Brand Title Banner
  sheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${tenantName.toUpperCase()} — ${reportTitle.toUpperCase()}`;
  titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFD99A2B' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF191611' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 28;

  // Row 2: Subtitle & Export Metadata
  sheet.mergeCells(2, 1, 2, totalCols);
  const nowBr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const subCell = sheet.getCell(2, 1);
  subCell.value = body.subtitle
    ? `${body.subtitle}  |  Gerado em: ${nowBr} (America/Sao_Paulo)  |  Registros: ${rows.length}`
    : `Gerado em: ${nowBr} (America/Sao_Paulo)  |  Total de registros: ${rows.length}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF57534E' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFAF6EE' },
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 20;

  // Row 3: Table Headers
  const headerRow = sheet.getRow(3);
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF29241D' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.type === 'currency' || col.type === 'number' ? 'right' : 'left',
    };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFD99A2B' } },
    };
  });
  headerRow.height = 24;

  // Data Rows (starting at row 4)
  rows.forEach((item, rIdx) => {
    const excelRow = sheet.getRow(4 + rIdx);
    const isEven = rIdx % 2 === 1;

    columns.forEach((col, cIdx) => {
      const cell = excelRow.getCell(cIdx + 1);
      const rawVal = item[col.key];

      if (col.type === 'currency' || col.type === 'number') {
        const numVal = typeof rawVal === 'number' ? rawVal : Number(String(rawVal ?? '0').replace(',', '.')) || 0;
        cell.value = numVal;
        cell.numFmt = col.type === 'currency' ? '"R$ "#,##0.00;("R$ "#,##0.00);"R$ "0.00' : '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.value = rawVal === null || rawVal === undefined ? '—' : String(rawVal);
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF191611' } };
      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F2EB' },
        };
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE8DFC9' } },
      };
    });
    excelRow.height = 19;
  });

  // Optional Summary Rows at the bottom
  if (Array.isArray(body.summaryRows) && body.summaryRows.length > 0) {
    const startSummaryRow = 4 + rows.length + 1;
    body.summaryRows.forEach((sRow, sIdx) => {
      const rowObj = sheet.getRow(startSummaryRow + sIdx);
      const labelCell = rowObj.getCell(1);
      labelCell.value = sRow.label;
      labelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF191611' } };

      const valCell = rowObj.getCell(2);
      if (sRow.type === 'currency' || typeof sRow.value === 'number') {
        valCell.value = Number(sRow.value) || 0;
        if (sRow.type === 'currency') {
          valCell.numFmt = '"R$ "#,##0.00;("R$ "#,##0.00);"R$ "0.00';
        }
      } else {
        valCell.value = String(sRow.value);
      }
      valCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF191611' } };
      rowObj.height = 21;
    });
  }

  // Configure column widths
  columns.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    column.width = col.width || Math.max(col.header.length + 6, 16);
  });

  // Enable AutoFilter on header row
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + Math.max(rows.length, 1), column: totalCols },
  };

  // 4. Write workbook buffer and upload to Supabase Storage ('exports' bucket)
  const buffer = await workbook.xlsx.writeBuffer();
  const uint8 = new Uint8Array(buffer as ArrayBuffer);

  const finalFileName = sanitizeFileName(
    body.fileName || `relatorio_${body.reportType || 'smg'}_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  const storagePath = `${effectiveTenantId}/${Date.now()}_${finalFileName}`;

  const { error: uploadErr } = await adminClient.storage
    .from('exports')
    .upload(storagePath, uint8, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });

  if (uploadErr) {
    return new Response(
      JSON.stringify({ ok: false, error: `Failed to upload Excel to Storage: ${uploadErr.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 5. Generate Presigned URL valid for 1 hour (3600s)
  const { data: signedData, error: signedErr } = await adminClient.storage
    .from('exports')
    .createSignedUrl(storagePath, 3600, {
      download: finalFileName,
    });

  if (signedErr || !signedData?.signedUrl) {
    return new Response(
      JSON.stringify({ ok: false, error: `Failed to generate Presigned URL: ${signedErr?.message ?? 'unknown'}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      signedUrl: signedData.signedUrl,
      fileName: finalFileName,
      storagePath,
      rowCount: rows.length,
      expiresInSeconds: 3600,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
