import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, getNumericDate, verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jwtSecret = Deno.env.get('PORTAL_JWT_SECRET');
if (!jwtSecret) {
    throw new Error('Missing PORTAL_JWT_SECRET for portal-auth function.');
}

const keyBuf = new TextEncoder().encode(jwtSecret.padEnd(32, '0').substring(0, 32));
const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign", "verify"]
);

interface RequestPayload {
    action: 'request_otp' | 'verify_otp' | 'validate_session';
    phone?: string;
    tenantId?: string;
    code?: string;
    token?: string;
    clientId?: string;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        const supabase = createClient(supabaseUrl, supabaseKey);

        const payload = await req.json() as RequestPayload;
        const { action, phone, tenantId, code, token, clientId } = payload;

        if (!action || !tenantId) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        if (action === 'validate_session') {
            if (!token || !clientId) {
                return new Response(JSON.stringify({ error: 'Missing token or clientId' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            try {
                const verifiedPayload = await verify(token, cryptoKey) as Record<string, unknown>;
                const payloadTenantId = String(verifiedPayload.tenant_id || '');
                const payloadClientId = String(verifiedPayload.sub || '');
                const payloadRole = String(verifiedPayload.role || '');
                const payloadExp = Number(verifiedPayload.exp || 0);

                if (
                    payloadTenantId !== tenantId ||
                    payloadClientId !== clientId ||
                    payloadRole !== 'portal_client' ||
                    payloadExp * 1000 < Date.now()
                ) {
                    return new Response(JSON.stringify({ valid: false, error: 'Invalid token claims' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 401,
                    });
                }

                const { data: sessions, error: sessionsError } = await supabase
                    .from('portal_sessions')
                    .select('id, token_hash, expires_at')
                    .eq('tenant_id', tenantId)
                    .eq('client_id', clientId)
                    .gte('expires_at', new Date().toISOString())
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (sessionsError || !sessions || sessions.length === 0) {
                    return new Response(JSON.stringify({ valid: false, error: 'Session not found' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 401,
                    });
                }

                let matchedSessionId: string | null = null;
                for (const session of sessions) {
                    const matches = await bcrypt.compare(token, session.token_hash);
                    if (matches) {
                        matchedSessionId = session.id;
                        break;
                    }
                }

                if (!matchedSessionId) {
                    return new Response(JSON.stringify({ valid: false, error: 'Session token mismatch' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 401,
                    });
                }

                await supabase
                    .from('portal_sessions')
                    .update({ last_seen_at: new Date().toISOString() })
                    .eq('id', matchedSessionId);

                return new Response(JSON.stringify({ valid: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            } catch (jwtError) {
                console.error('Portal token validation error:', jwtError);
                return new Response(JSON.stringify({ valid: false, error: 'Invalid session token' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401,
                });
            }
        }

        if (!phone) {
            return new Response(JSON.stringify({ error: 'Missing required phone field' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        const cleanPhone = phone.replace(/\D/g, '');

        if (action === 'request_otp') {
            const { data: addon, error: addonError } = await supabase
                .from('tenant_addons')
                .select('status')
                .eq('tenant_id', tenantId)
                .eq('addon_key', 'CLIENT_PORTAL')
                .single();

            if (addonError || addon?.status !== 'enabled') {
                return new Response(JSON.stringify({ error: 'Portal is not enabled for this tenant.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403,
                });
            }

            const waitTimeMinutes = 1;
            const { data: recentRequests } = await supabase
                .from('otp_requests')
                .select('id, created_at, attempts')
                .eq('tenant_id', tenantId)
                .eq('phone', cleanPhone)
                .eq('status', 'pending')
                .gte('created_at', new Date(Date.now() - waitTimeMinutes * 60000).toISOString())
                .order('created_at', { ascending: false });

            if (recentRequests && recentRequests.length > 0) {
                const latestRequest = recentRequests[0];
                if (latestRequest.attempts >= 3) {
                    return new Response(JSON.stringify({ error: 'Too many attempts. Please wait a moment before requesting a new code.' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 429,
                    });
                }

                return new Response(JSON.stringify({ error: 'Please wait 60 seconds before requesting a new code.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 429,
                });
            }

            const { data: client } = await supabase
                .from('clients')
                .select('id, name')
                .eq('tenant_id', tenantId)
                .eq('phone', cleanPhone)
                .single();

            if (!client) {
                return new Response(JSON.stringify({ error: 'Client not registered', code: 'CLIENT_NOT_FOUND', cleanPhone }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                });
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(`[MOCK WHATSAPP] Sending OTP ${otp} to ${cleanPhone} for tenant ${tenantId}`);

            const salt = await bcrypt.genSalt(8);
            const code_hash = await bcrypt.hash(otp, salt);

            const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
            const { error: insertError } = await supabase.from('otp_requests').insert({
                tenant_id: tenantId,
                phone: cleanPhone,
                code_hash,
                expires_at: expiresAt,
                status: 'pending'
            });

            if (insertError) {
                return new Response(JSON.stringify({ error: 'Failed to create OTP request' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500,
                });
            }

            return new Response(JSON.stringify({ message: 'OTP sent successfully' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        if (action === 'verify_otp') {
            if (!code) {
                return new Response(JSON.stringify({ error: 'Code is required' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            const { data: requests, error: reqError } = await supabase
                .from('otp_requests')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('phone', cleanPhone)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);

            if (reqError || !requests || requests.length === 0) {
                return new Response(JSON.stringify({ error: 'No pending OTP request found or it has expired.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            const otpRequest = requests[0];
            if (new Date(otpRequest.expires_at) < new Date()) {
                await supabase.from('otp_requests').update({ status: 'expired' }).eq('id', otpRequest.id);
                return new Response(JSON.stringify({ error: 'OTP code has expired.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            const isMatch = await bcrypt.compare(code, otpRequest.code_hash);
            if (!isMatch) {
                const newAttempts = (otpRequest.attempts || 0) + 1;
                await supabase.from('otp_requests').update({ attempts: newAttempts }).eq('id', otpRequest.id);

                if (newAttempts >= 3) {
                    await supabase.from('otp_requests').update({ status: 'expired' }).eq('id', otpRequest.id);
                    return new Response(JSON.stringify({ error: 'Too many invalid attempts. Code expired.' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 400,
                    });
                }

                return new Response(JSON.stringify({ error: 'Invalid code.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            await supabase.from('otp_requests').update({ status: 'verified' }).eq('id', otpRequest.id);

            const { data: client } = await supabase
                .from('clients')
                .select('id, name')
                .eq('tenant_id', tenantId)
                .eq('phone', cleanPhone)
                .single();

            if (!client) {
                return new Response(JSON.stringify({ error: 'Client not found.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                });
            }

            const jwtPayload = {
                iss: "sou-manager-portal",
                sub: client.id,
                tenant_id: tenantId,
                role: 'portal_client',
                exp: getNumericDate(30 * 24 * 60 * 60),
            };
            const jwt = await create({ alg: "HS512", typ: "JWT" }, jwtPayload, cryptoKey);

            const tokenSalt = await bcrypt.genSalt(6);
            const token_hash = await bcrypt.hash(jwt, tokenSalt);

            await supabase.from('portal_sessions').insert({
                tenant_id: tenantId,
                client_id: client.id,
                token_hash,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                last_seen_at: new Date().toISOString()
            });

            return new Response(JSON.stringify({
                message: 'Successfully verified',
                token: jwt,
                client: {
                    id: client.id,
                    name: client.name,
                    phone: cleanPhone
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
