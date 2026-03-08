import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verify the caller's JWT
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        );
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser(token);
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
        const normalizedRequestedRole = String(role || 'Barber').trim();
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
            console.error('Create user error:', createError);
            return new Response(JSON.stringify({ error: createError.message }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('Auth user created:', newUser.user?.id);

        // 2. Insert or Update staff record
        const { error: staffError } = await supabaseAdmin.from('staff').upsert({
            id: newUser.user!.id,
            name,
            email,
            role: normalizedRequestedRole || 'Barber',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
            status: 'active',
            commission_rate: 40,
            tenant_id: resolvedTenantId,
        });

        if (staffError) {
            console.error('Staff insert error:', staffError);
            // Don't fail — the auth user was created. Return a warning.
            return new Response(JSON.stringify({
                user: newUser.user,
                warning: `User created but staff record failed: ${staffError.message}`
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
        console.error('Unexpected error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
