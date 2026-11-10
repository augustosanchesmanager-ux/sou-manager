import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Flag operacional: false = função temporariamente desativada (responde 503).
// Para reativar, mudar para true e re-deployar.
const FUNCTION_ENABLED = false;

interface AuthContext {
    userId: string;
    tenantId: string;
    role: string;
    appSlug: string;
}

async function getAuthContext(supabase: ReturnType<typeof createClient>, req: Request): Promise<AuthContext> {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
        throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
        throw new Error('Invalid authentication');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

    if (!profile) {
        throw new Error('Profile not found');
    }

    return {
        userId: user.id,
        tenantId: profile.tenant_id,
        role: profile.role,
        appSlug: 'barber',
    };
}

function requireRole(ctx: AuthContext, allowedRoles: string[]) {
    if (!allowedRoles.includes(ctx.role)) {
        throw new Error(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (!FUNCTION_ENABLED) {
        return new Response(
            JSON.stringify({
                error: 'Service Unavailable',
                message: 'A função import-export está temporariamente desativada.',
            }),
            {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }

    const url = new URL(req.url);
    const path = url.pathname.replace('/import-export', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    let authCtx: AuthContext;
    try {
        authCtx = await getAuthContext(supabase, req);
    } catch (err) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        if (path.match(/^\/templates(\/.*)?$/) && req.method === 'GET') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const entity = url.searchParams.get('entity');
            const appSlug = url.searchParams.get('app_slug');

            let query = supabase
                .from('control.import_export_templates')
                .select('*')
                .eq('is_active', true)
                .or(`tenant_id.eq.${authCtx.tenantId},tenant_id.is.null`);

            if (entity) {
                query = query.eq('entity', entity);
            }
            if (appSlug) {
                query = query.eq('app_slug', appSlug);
            }

            const { data, error } = await query;
            if (error) throw error;

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/templates$/) && req.method === 'POST') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const body = await req.json();

            const isGlobal = body.tenant_id === null;
            if (isGlobal && authCtx.role !== 'superadmin') {
                throw new Error('Only superadmin can create global templates');
            }

            const { data, error } = await supabase
                .from('control.import_export_templates')
                .insert(body)
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify(data), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/templates\/[^/]+$/) && req.method === 'PUT') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const templateId = path.split('/')[2];
            const body = await req.json();

            const { data: existing } = await supabase
                .from('control.import_export_templates')
                .select('tenant_id')
                .eq('id', templateId)
                .single();

            if (!existing) {
                throw new Error('Template not found');
            }

            if (existing.tenant_id !== null && existing.tenant_id !== authCtx.tenantId) {
                throw new Error('Access denied');
            }

            if (existing.tenant_id === null && authCtx.role !== 'superadmin') {
                throw new Error('Access denied');
            }

            const { data, error } = await supabase
                .from('control.import_export_templates')
                .update(body)
                .eq('id', templateId)
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/templates\/[^/]+$/) && req.method === 'DELETE') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const templateId = path.split('/')[2];

            const { data: existing } = await supabase
                .from('control.import_export_templates')
                .select('tenant_id')
                .eq('id', templateId)
                .single();

            if (!existing) {
                throw new Error('Template not found');
            }

            if (existing.tenant_id !== null && existing.tenant_id !== authCtx.tenantId) {
                throw new Error('Access denied');
            }

            if (existing.tenant_id === null && authCtx.role !== 'superadmin') {
                throw new Error('Access denied');
            }

            const { error } = await supabase
                .from('control.import_export_templates')
                .update({ is_active: false })
                .eq('id', templateId);

            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/[^/]+\/template$/) && req.method === 'GET') {
            requireRole(authCtx, ['superadmin', 'manager', 'staff', 'barber', 'receptionist']);
            const entity = path.split('/')[1];
            const format = url.searchParams.get('format') || 'csv';

            const { data: template } = await supabase
                .from('control.import_export_templates')
                .select('*')
                .eq('entity', entity)
                .eq('is_default', true)
                .eq('is_active', true)
                .or(`tenant_id.eq.${authCtx.tenantId},tenant_id.is.null`)
                .order('tenant_id', { ascending: false })
                .limit(1)
                .single();

            if (!template) {
                return new Response(JSON.stringify(null), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const columnHeaders = [
                ...template.required_columns,
                ...template.optional_columns,
            ];

            const csvContent = columnHeaders.join(',');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

            return new Response(blob, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${entity}_template_${format}.csv"`,
                },
            });
        }

        if (path.match(/^\/[^/]+\/validate$/) && req.method === 'POST') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const entity = path.split('/')[1];
            const body = await req.json();
            const { jobId, rows, templateId } = body;

            let validationRules: Record<string, unknown> = {};
            if (templateId) {
                const { data: template } = await supabase
                    .from('control.import_export_templates')
                    .select('validation_rules')
                    .eq('id', templateId)
                    .single();
                if (template?.validation_rules) {
                    validationRules = template.validation_rules;
                }
            }

            let validCount = 0;
            let invalidCount = 0;
            const errorsSummary: Record<string, string[]> = {};

            const processedRows = rows.map((row: Record<string, unknown>, idx: number) => {
                const rowErrors: { field: string; message: string }[] = [];

                for (const [field, rule] of Object.entries(validationRules)) {
                    const value = row[field];
                    const ruleObj = rule as { type?: string; min?: number; max?: number; required?: boolean };

                    if (ruleObj.required && (value === undefined || value === null || value === '')) {
                        rowErrors.push({ field, message: `Campo obrigatório: ${field}` });
                    }
                    if (value !== undefined && value !== null && value !== '') {
                        if (ruleObj.type === 'number' && typeof value === 'string') {
                            const num = parseFloat(value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
                            if (isNaN(num) || (ruleObj.min !== undefined && num < ruleObj.min)) {
                                rowErrors.push({ field, message: `Valor inválido para ${field}` });
                            }
                        }
                    }
                }

                if (rowErrors.length > 0) {
                    invalidCount++;
                    for (const err of rowErrors) {
                        if (!errorsSummary[err.field]) errorsSummary[err.field] = [];
                        errorsSummary[err.field].push(`Linha ${idx + 1}: ${err.message}`);
                    }
                } else {
                    validCount++;
                }

                return {
                    row_number: idx + 1,
                    job_id: jobId,
                    status: rowErrors.length > 0 ? 'invalid' : 'valid',
                    original_data: row,
                    normalized_data: row,
                    errors: rowErrors,
                    warnings: [],
                };
            });

            if (jobId) {
                await supabase
                    .from('control.import_job_rows')
                    .upsert(processedRows);

                await supabase
                    .from('control.import_jobs')
                    .update({
                        status: 'validated',
                        valid_rows: validCount,
                        invalid_rows: invalidCount,
                        error_summary: errorsSummary,
                    })
                    .eq('id', jobId);
            }

            return new Response(JSON.stringify({
                valid: validCount,
                invalid: invalidCount,
                errors: errorsSummary,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/[^/]+\/commit$/) && req.method === 'POST') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const entity = path.split('/')[1];
            const body = await req.json();
            const { jobId, createStockMovements = false, importOnlyValid = true } = body;

            const { data: job } = await supabase
                .from('control.import_jobs')
                .select('*')
                .eq('id', jobId)
                .eq('tenant_id', authCtx.tenantId)
                .single();

            if (!job) {
                throw new Error('Job not found');
            }

            await supabase
                .from('control.import_jobs')
                .update({ status: 'committing' })
                .eq('id', jobId);

            const { data: rows } = await supabase
                .from('control.import_job_rows')
                .select('*')
                .eq('job_id', jobId)
                .eq('status', importOnlyValid ? 'valid' : undefined)
                .in('status', importOnlyValid ? ['valid'] : ['valid', 'invalid']);

            let createdCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            let failedCount = 0;

            const tableMap: Record<string, string> = {
                products: 'products',
                services: 'services',
                clients: 'clients',
            };

            const tableName = tableMap[entity];
            if (!tableName) {
                throw new Error(`Unknown entity: ${entity}`);
            }

            const configMap: Record<string, { duplicateCheckFields: string[] }> = {
                products: { duplicateCheckFields: ['code', 'barcode'] },
                services: { duplicateCheckFields: ['code', 'name'] },
                clients: { duplicateCheckFields: ['phone', 'email'] },
            };
            const config = configMap[entity] ?? { duplicateCheckFields: [] };

            for (const row of rows ?? []) {
                try {
                    if (!row.normalized_data) {
                        failedCount++;
                        continue;
                    }

                    const normalized = row.normalized_data as Record<string, unknown>;
                    delete normalized['id'];

                    const duplicateCheckFields = config.duplicateCheckFields ?? [];
                    let existing: { id: string } | null = null;

                    if (duplicateCheckFields.length > 0) {
                        const conditions = duplicateCheckFields
                            .map(field => {
                                const val = normalized[field];
                                if (val === undefined || val === null || val === '') return null;
                                return { field, value: val };
                            })
                            .filter(c => c !== null) as { field: string; value: unknown }[];

                        if (conditions.length > 0) {
                            let dupQuery = supabase.from(tableName).select('id').eq('tenant_id', authCtx.tenantId);
                            for (const cond of conditions) {
                                dupQuery = dupQuery.eq(cond.field, cond.value);
                            }
                            const { data: dupResult } = await dupQuery.limit(1);
                            existing = dupResult && dupResult.length > 0 ? dupResult[0] : null;
                        }
                    }

                    if (existing) {
                        const { error: updateError } = await supabase
                            .from(tableName)
                            .update({ ...normalized })
                            .eq('id', existing.id);

                        if (updateError) {
                            failedCount++;
                        } else {
                            updatedCount++;
                        }
                    } else {
                        const { error: insertError } = await supabase
                            .from(tableName)
                            .insert({ ...normalized, tenant_id: authCtx.tenantId });

                        if (insertError) {
                            failedCount++;
                        } else {
                            createdCount++;
                        }
                    }

                    await supabase
                        .from('control.import_job_rows')
                        .update({
                            status: 'skipped',
                            action_taken: existing ? 'update' : 'create',
                            processed_at: new Date().toISOString(),
                        })
                        .eq('id', row.id);

                } catch (err) {
                    failedCount++;
                    await supabase
                        .from('control.import_job_rows')
                        .update({
                            status: 'invalid',
                            action_taken: 'error',
                            processed_at: new Date().toISOString(),
                        })
                        .eq('id', row.id);
                }
            }

            const finalStatus = failedCount > 0 && createdCount + updatedCount > 0
                ? 'partial_completed'
                : failedCount === 0 && createdCount + updatedCount > 0
                    ? 'completed'
                    : 'failed';

            await supabase
                .from('control.import_jobs')
                .update({
                    status: finalStatus,
                    completed_at: new Date().toISOString(),
                    created_count: createdCount,
                    updated_count: updatedCount,
                    skipped_count: skippedCount,
                    failed_count: failedCount,
                })
                .eq('id', jobId);

            await supabase
                .from('control.import_audit_logs')
                .insert({
                    job_id: jobId,
                    tenant_id: authCtx.tenantId,
                    app_slug: authCtx.appSlug,
                    entity,
                    action: 'job_completed',
                    actor_id: authCtx.userId,
                    details: { createdCount, updatedCount, skippedCount, failedCount, finalStatus },
                });

            return new Response(JSON.stringify({
                success: finalStatus === 'completed' || finalStatus === 'partial_completed',
                createdCount,
                updatedCount,
                skippedCount,
                failedCount,
                status: finalStatus,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/jobs$/) && req.method === 'GET') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const entity = url.searchParams.get('entity');
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '20');
            const offset = (page - 1) * limit;

            let query = supabase
                .from('control.import_jobs')
                .select('*', { count: 'exact' })
                .eq('tenant_id', authCtx.tenantId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (entity) {
                query = query.eq('entity', entity);
            }

            const { data, error, count } = await query;
            if (error) throw error;

            return new Response(JSON.stringify({ jobs: data, total: count }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/jobs$/) && req.method === 'POST') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const body = await req.json();

            const { data, error } = await supabase
                .from('control.import_jobs')
                .insert({
                    tenant_id: authCtx.tenantId,
                    app_slug: body.app_slug || authCtx.appSlug,
                    entity: body.entity,
                    template_id: body.templateId || null,
                    direction: body.direction || 'import',
                    format: body.format,
                    status: 'pending',
                    file_name: body.fileName,
                    file_size: body.fileSize,
                    total_rows: body.totalRows,
                    created_by: authCtx.userId,
                })
                .select()
                .single();

            if (error) throw error;

            await supabase
                .from('control.import_audit_logs')
                .insert({
                    job_id: data.id,
                    tenant_id: authCtx.tenantId,
                    app_slug: authCtx.appSlug,
                    entity: body.entity,
                    action: 'job_started',
                    actor_id: authCtx.userId,
                    details: { fileName: body.fileName, totalRows: body.totalRows },
                });

            return new Response(JSON.stringify(data), {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/jobs\/[^/]+$/) && req.method === 'GET') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const jobId = path.split('/')[2];

            const { data: job } = await supabase
                .from('control.import_jobs')
                .select('*')
                .eq('id', jobId)
                .eq('tenant_id', authCtx.tenantId)
                .single();

            if (!job) {
                throw new Error('Job not found');
            }

            const { data: rows } = await supabase
                .from('control.import_job_rows')
                .select('*')
                .eq('job_id', jobId)
                .order('row_number', { ascending: true });

            return new Response(JSON.stringify({ ...job, rows }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/jobs\/[^/]+\/cancel$/) && req.method === 'POST') {
            requireRole(authCtx, ['superadmin', 'manager']);
            const jobId = path.split('/')[2];

            const { data: job } = await supabase
                .from('control.import_jobs')
                .select('id, status')
                .eq('id', jobId)
                .eq('tenant_id', authCtx.tenantId)
                .single();

            if (!job) {
                throw new Error('Job not found');
            }

            if (!['pending', 'validating', 'validated'].includes(job.status)) {
                throw new Error('Job cannot be cancelled in current status');
            }

            const { error } = await supabase
                .from('control.import_jobs')
                .update({ status: 'cancelled', completed_at: new Date().toISOString() })
                .eq('id', jobId);

            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (path.match(/^\/[^/]+\/export$/) && req.method === 'GET') {
            requireRole(authCtx, ['superadmin', 'manager', 'staff', 'barber', 'receptionist']);
            const entity = path.split('/')[1];
            const format = url.searchParams.get('format') || 'csv';
            const search = url.searchParams.get('search') || '';
            const status = url.searchParams.get('status') || '';

            const tableMap: Record<string, string> = {
                products: 'products',
                services: 'services',
                clients: 'clients',
            };

            const tableName = tableMap[entity];
            if (!tableName) {
                throw new Error(`Unknown entity: ${entity}`);
            }

            let query = supabase
                .from(tableName)
                .select('*')
                .eq('tenant_id', authCtx.tenantId);

            if (search) {
                query = query.ilike('name', `%${search}%`);
            }

            if (entity === 'products' && status) {
                query = query.eq('active', status === 'active');
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                return new Response(JSON.stringify({ downloadUrl: null }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const headers = Object.keys(data[0]);
            const csvContent = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(h => {
                        const val = row[h];
                        if (val === null || val === undefined) return '';
                        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                            return `"${val.replace(/"/g, '""')}"`;
                        }
                        return String(val);
                    }).join(',')
                ),
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

            return new Response(blob, {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${entity}_export_${Date.now()}.csv"`,
                },
            });
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Error in import-export function:', err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});