import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
// F2.1: hierarquia de papéis (fonte canônica testada em tests/security/f2_1_role_hierarchy.test.ts)
import { canAssignStaffRole } from '../_shared/staff-role-hierarchy.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getDefaultCommissionRateForRole = (role: string) => {
    return String(role || '').trim().toLowerCase() === 'barber' ? 50 : 0;
};

// Contrato R6 (2026-08-06): staff.role = owner | manager | barber | receptionist | admin
// Mapeamento aceita termos PT/EN e valores legados PascalCase (normalizados para lowercase).
const STAFF_ROLE_MAP: Record<string, string> = {
    'manager': 'manager',
    'gerente': 'manager',
    'gerente operacional': 'manager',
    'owner': 'manager',
    'admin': 'admin',
    'adminmanager': 'admin',
    'admin_manager': 'admin',
    'gerente administrativo': 'admin',
    'barber': 'barber',
    'barbeiro': 'barber',
    'receptionist': 'receptionist',
    'recepcionista': 'receptionist',
};

const normalizeStaffRole = (role: string): string => {
    const trimmed = String(role || '').trim();
    const lower = trimmed.toLowerCase();
    // Valores legados PascalCase sao normalizados para o contrato R6
    if (lower === 'manager') return 'manager';
    if (lower === 'adminmanager' || lower === 'admin_manager') return 'admin';
    if (lower === 'barber') return 'barber';
    if (lower === 'receptionist') return 'receptionist';
    if (['owner', 'manager', 'admin', 'barber', 'receptionist'].includes(lower)) return lower;
    return STAFF_ROLE_MAP[lower] || 'barber';
};

const jsonResponse = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

/** F06: resposta uniforme — nunca confirma se o e-mail existe. */
const GENERIC_USER_CREATE_CONFLICT =
    'Não foi possível criar o usuário. Se o e-mail já pertence a uma conta, use o fluxo de convite ou recuperação de senha.';

const isAlreadyRegisteredError = (error: {
    message?: string;
    status?: number;
    code?: string;
} | null): boolean => {
    if (!error) return false;
    const message = String(error.message || '').toLowerCase();
    return (
        error.status === 422 ||
        error.code === 'email_exists' ||
        message.includes('already registered') ||
        message.includes('already been registered')
    );
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Use the service role key to have admin privileges
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Verify the caller is authenticated
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verify the caller's JWT using GoTrue (compatible with asymmetric signing keys like ES256)
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { auth: { persistSession: false } }
        );
        const token = authHeader.slice('Bearer '.length).trim();
        
        let callerUser = null;
        let authError = null;
        
        // Try getUser first (works with most JWT formats)
        try {
            const result = await supabaseClient.auth.getUser(token);
            callerUser = result.data?.user;
            authError = result.error;
        } catch (e) {
            // If getUser fails, try session verification
            try {
                const sessionResult = await supabaseClient.auth.getSession();
                if (sessionResult.data?.session?.access_token === token) {
                    callerUser = sessionResult.data.session.user;
                    authError = null;
                }
            } catch {
                authError = e;
            }
        }
        
        if (authError || !callerUser) {
            console.error('Caller auth error:', authError);
            return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('tenant_id, role')
            .eq('id', callerUser.id)
            .maybeSingle();

        const { data: callerStaff } = await supabaseAdmin
            .from('staff')
            .select('tenant_id, role')
            .eq('id', callerUser.id)
            .maybeSingle();

        const callerRole = String(callerProfile?.role || callerStaff?.role || '').toLowerCase().trim();
        const callerTenantId = callerProfile?.tenant_id || callerStaff?.tenant_id || null;
        const isSuperAdmin = callerRole === 'super admin' || callerRole === 'superadmin';
        const isManagerLike =
            callerRole === 'manager' ||
            callerRole === 'gerente' ||
            callerRole === 'owner' ||
            callerRole === 'admin' ||
            callerRole === 'adminmanager' ||
            callerRole === 'gerente administrativo';

        if (!isSuperAdmin && !isManagerLike) {
            return new Response(JSON.stringify({ error: 'Forbidden: insufficient privileges' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { email, password, name, role, tenant_id } = await req.json();
        const normalizedRequestedRole = normalizeStaffRole(role);
        // F2.1: hierarquia rígida — somente superadmin atribui admin; manager cria barber/receptionist.
        if (!canAssignStaffRole(callerRole, normalizedRequestedRole)) {
            return new Response(JSON.stringify({ error: 'Forbidden: role hierarchy violation' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const resolvedTenantId = isSuperAdmin ? (tenant_id || callerTenantId) : callerTenantId;
        if (!resolvedTenantId) {
            return new Response(JSON.stringify({ error: 'Missing tenant context for user creation' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('Creating user:', { email, name, role: normalizedRequestedRole, tenant_id: resolvedTenantId });

        if (!email || !password || !name) {
            return new Response(JSON.stringify({ error: 'Missing required fields: email, password, name' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (password.length < 6) {
            return new Response(JSON.stringify({ error: 'Password should be at least 6 characters' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 1. Create auth user via admin API
        let newUser;
        let createError;

        const { data: createdUser, error: err } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, role: normalizedRequestedRole, tenant_id: resolvedTenantId }
        });

        newUser = createdUser;
        createError = err;

        // F06: NUNCA adotar um usuário existente pelo e-mail. O lookup global
        // permitia que um gestor do tenant A fizesse upsert do staff de um
        // usuário do tenant B (service_role ignora RLS). Resposta uniforme para
        // não confirmar a existência da conta.
        if (isAlreadyRegisteredError(createError)) {
            console.warn('User creation rejected: e-mail already registered (generic 409).');
            return jsonResponse({ error: GENERIC_USER_CREATE_CONFLICT }, 409);
        }

        if (createError) {
            console.error('Create user error:', JSON.stringify(createError, null, 2));
            return jsonResponse({ error: 'Não foi possível criar o usuário.' }, 400);
        }

        console.log('Auth user created:', newUser.user?.id);
        const defaultCommissionRate = getDefaultCommissionRateForRole(normalizedRequestedRole);
        const staffId = newUser.user!.id;

        // F06 (defesa em profundidade): o upsert é por id e roda com service_role.
        // Se já existir staff desse id em outro tenant, aborta antes de mover o
        // registro. Um id recém-criado não deveria ter staff; isto cobre reexecução
        // ou inconsistência prévia.
        const { data: existingStaff, error: existingStaffError } = await supabaseAdmin
            .from('staff')
            .select('id, tenant_id')
            .eq('id', staffId)
            .maybeSingle();

        if (existingStaffError) {
            console.error('Staff lookup error:', JSON.stringify(existingStaffError, null, 2));
            return jsonResponse({ error: 'Não foi possível concluir o cadastro.' }, 500);
        }

        if (existingStaff && existingStaff.tenant_id !== resolvedTenantId) {
            console.warn('Cross-tenant staff upsert blocked for staff id:', staffId);
            return jsonResponse({ error: 'Não foi possível concluir o cadastro.' }, 409);
        }

        // 2. Insert or Update staff record
        const staffPayload = {
            id: staffId,
            name,
            email,
            role: normalizedRequestedRole,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
            status: 'active',
            commission_rate: defaultCommissionRate,
            tenant_id: resolvedTenantId,
        };
        console.log('Staff upsert payload:', JSON.stringify({ ...staffPayload, avatar: '(omitted)' }));

        const { error: staffError } = await supabaseAdmin.from('staff').upsert(staffPayload);

        if (staffError) {
            console.error('Staff insert error:', JSON.stringify(staffError, null, 2));
            // Não devolve SQL/detalhes internos. O usuário auth já foi criado;
            // o chamador recebe apenas o id para suporte/retry.
            return jsonResponse({
                user: { id: staffId },
                warning: 'User created but staff record failed.',
            }, 200);
        }

        return jsonResponse({ user: newUser.user }, 200);

    } catch (err: any) {
        console.error('Unexpected error:', JSON.stringify(err, null, 2));
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
});
