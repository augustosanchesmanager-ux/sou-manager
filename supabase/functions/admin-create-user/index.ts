import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getDefaultCommissionRateForRole = (role: string) => {
    return String(role || '').trim().toLowerCase() === 'barber' ? 50 : 0;
};

const STAFF_ROLE_MAP: Record<string, string> = {
    'manager': 'Manager',
    'gerente': 'Manager',
    'owner': 'Manager',
    'admin': 'Manager',
    'barber': 'Barber',
    'barbeiro': 'Barber',
    'receptionist': 'Receptionist',
    'recepcionista': 'Receptionist',
};

const normalizeStaffRole = (role: string): string => {
    const trimmed = String(role || '').trim();
    if (['Manager', 'Barber', 'Receptionist'].includes(trimmed)) return trimmed;
    return STAFF_ROLE_MAP[trimmed.toLowerCase()] || 'Barber';
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
            callerRole === 'admin';

        if (!isSuperAdmin && !isManagerLike) {
            return new Response(JSON.stringify({ error: 'Forbidden: insufficient privileges' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { email, password, name, role, tenant_id } = await req.json();
        const normalizedRequestedRole = normalizeStaffRole(role);
        const normalizedRequestedRoleLower = normalizedRequestedRole.toLowerCase();
        if (!isSuperAdmin && (normalizedRequestedRoleLower === 'super admin' || normalizedRequestedRoleLower === 'superadmin')) {
            return new Response(JSON.stringify({ error: 'Forbidden: only super admin can assign super admin role' }), {
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

        // If user already exists, find them instead of failing
        if (createError && (createError.message.includes('already registered') || createError.status === 422)) {
            console.log('User already exists, fetching existing ID...');
            const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (listError) {
                return new Response(JSON.stringify({ error: `User exists but failed to fetch ID: ${listError.message}` }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const existingUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (existingUser) {
                newUser = { user: existingUser };
                createError = null; // Mark as "not an error" now that we found the user
                console.log('Found existing user ID:', existingUser.id);
            }
        }

        if (createError) {
            console.error('Create user error:', JSON.stringify(createError, null, 2));
            return new Response(JSON.stringify({
                error: createError.message || 'Erro ao criar usuário',
                code: createError.code || null,
                details: createError.details || null,
                hint: createError.hint || null,
                status: createError.status || null,
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('Auth user created:', newUser.user?.id);
        const defaultCommissionRate = getDefaultCommissionRateForRole(normalizedRequestedRole);

        // 2. Insert or Update staff record
        const staffPayload = {
            id: newUser.user!.id,
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
            // Don't fail — the auth user was created. Return a warning with full context.
            return new Response(JSON.stringify({
                user: newUser.user,
                warning: `User created but staff record failed: ${staffError.message}`,
                staff_error: {
                    message: staffError.message || null,
                    code: staffError.code || null,
                    details: staffError.details || null,
                    hint: staffError.hint || null,
                },
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ user: newUser.user }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('Unexpected error:', JSON.stringify(err, null, 2));
        return new Response(JSON.stringify({
            error: err.message || 'Internal server error',
            code: err.code || null,
            details: err.details || null,
            hint: err.hint || null,
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
