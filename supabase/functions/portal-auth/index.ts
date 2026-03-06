import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Replace with a secure secret for JWT signing in production
const JWT_SECRET = Deno.env.get('SUPABASE_ANON_KEY') || 'local-dev-secret-key-that-is-at-least-32-bytes-long';
const keyBuf = new TextEncoder().encode(JWT_SECRET.padEnd(32, '0').substring(0, 32));
const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign", "verify"]
);

interface RequestPayload {
    action: 'request_otp' | 'verify_otp';
    phone?: string;
    tenantId?: string;
    code?: string;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { action, phone, tenantId, code } = await req.json() as RequestPayload;

        if (!action || !phone || !tenantId) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Clean phone number (digits only)
        const cleanPhone = phone.replace(/\D/g, '');

        if (action === 'request_otp') {
            // 1. Check if the portal is enabled for this tenant
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

            // 2. Check for recent OTP requests to prevent spam (Rate Limiting)
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
                // Too many requests in the last minute
                const latestRequest = recentRequests[0];
                if (latestRequest.attempts >= 3) {
                    return new Response(JSON.stringify({ error: 'Too many attempts. Please wait a moment before requesting a new code.' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 429,
                    });
                }

                // Increment attempt but still generate (optional strategy, here we just block spamming requests)
                // A better strategy is blocking the generation entirely for 1 min.
                return new Response(JSON.stringify({ error: 'Please wait 60 seconds before requesting a new code.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 429,
                });
            }

            // 3. Find or Create Client inside this tenant
            let { data: client } = await supabase
                .from('clients')
                .select('id, name')
                .eq('tenant_id', tenantId)
                .eq('phone', cleanPhone)
                .single();

            if (!client) {
                // Return a specific response indicating client not found so frontend can ask for name
                return new Response(JSON.stringify({ error: 'Client not registered', code: 'CLIENT_NOT_FOUND', cleanPhone }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                });
            }

            // 4. Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(`[MOCK WHATSAPP] Sending OTP ${otp} to ${cleanPhone} for tenant ${tenantId}`);

            // Hash OTP before storing
            const salt = await bcrypt.genSalt(8);
            const code_hash = await bcrypt.hash(otp, salt);

            // Store request, expires in 5 minutes
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

            // 1. Get the latest pending OTP request
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

            // 2. Check expiration
            if (new Date(otpRequest.expires_at) < new Date()) {
                await supabase.from('otp_requests').update({ status: 'expired' }).eq('id', otpRequest.id);
                return new Response(JSON.stringify({ error: 'OTP code has expired.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }

            // 3. Verify hash
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

            // 4. Mark as verified
            await supabase.from('otp_requests').update({ status: 'verified' }).eq('id', otpRequest.id);

            // 5. Get client info
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

            // 6. Generate JWT Session Token
            // We use Deno jwt library
            const payload = {
                iss: "sou-manager-portal",
                sub: client.id,
                tenant_id: tenantId,
                role: 'portal_client',
                exp: getNumericDate(30 * 24 * 60 * 60), // 30 days
            };

            const jwt = await create({ alg: "HS512", typ: "JWT" }, payload, cryptoKey);

            // Hash the JWT just to store securely in our DB (optional but good practice)
            const tokenSalt = await bcrypt.genSalt(6);
            const token_hash = await bcrypt.hash(jwt, tokenSalt);

            // 7. Store in portal_sessions
            await supabase.from('portal_sessions').insert({
                tenant_id: tenantId,
                client_id: client.id,
                token_hash: token_hash,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
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
