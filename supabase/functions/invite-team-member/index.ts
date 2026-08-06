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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.slice('Bearer '.length).trim();
        const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !caller) {
            return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Validar chamador (owner/manager/admin do tenant) via RPC com o JWT do
        // chamador no header Authorization, para que toda a logica de negocio
        // (D2 role, D3 limite, dedupe) rode no banco com auth.uid() correto.
        const callerClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: `Bearer ${token}` } },
            }
        );

        const { email, role, tenant_id, redirect_url } = await req.json();
        if (!email || !role || !tenant_id) {
            return new Response(JSON.stringify({ error: 'Missing required fields: email, role, tenant_id' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: invite, error: inviteError } = await callerClient.rpc('invite_team_member', {
            p_tenant_id: tenant_id,
            p_email: email,
            p_role: role,
        }).single();

        if (inviteError) {
            console.error('invite_team_member rpc error:', JSON.stringify(inviteError, null, 2));
            return new Response(JSON.stringify({
                error: inviteError.message || 'Falha ao criar convite',
                code: inviteError.code || null,
                details: inviteError.details || null,
                hint: inviteError.hint || null,
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // D4: envio do email pelo canal SMTP da Supabase Auth.
        // redirect_to deve estar na lista de "Redirect URLs" do projeto (aceite da 6.0.3).
        // O token do convite (team_invitations) e anexado a URL para que o link do email
        // desembarque em /#/accept-invite/<token> (o token nao e exposto por outra via).
        const appUrl = (redirect_url as string | undefined)?.trim() || Deno.env.get('APP_URL') || '';
        let emailError = null;
        if (appUrl) {
            const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(String(email), {
                redirectTo: `${appUrl.replace(/\/+$/, '')}/#/accept-invite/${invite.token}`,
                data: { invite_role: invite.role },
            });
            emailError = error;
            if (emailError) {
                console.error('inviteUserByEmail error:', JSON.stringify(emailError, null, 2));
            }
        } else {
            emailError = { message: 'APP_URL not configured — invite link must be shared manually' };
        }

        return new Response(JSON.stringify({
            invite: {
                id: invite.id,
                email: invite.email,
                role: invite.role,
                status: invite.status,
                expires_at: invite.expires_at,
            },
            email: emailError ? { error: emailError.message } : { sent: true },
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('Unexpected error:', JSON.stringify(err, null, 2));
        return new Response(JSON.stringify({
            error: err.message || 'Internal server error',
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
