// ─────────────────────────────────────────────────────────────────────────────
// TEMP: App Review bypass — REMOVE THIS ENTIRE FUNCTION AFTER APP STORE APPROVAL
//
// This Edge Function exists solely to let Apple App Reviewers log in without
// access to the review@circuit40s.com inbox.  It is not a general auth bypass:
// it only generates a session for one exact email+code pair.
//
// After approval: delete this file and remove the client-side check in
// screens/VerificationScreen.tsx (look for TEMP_APP_REVIEW_EMAIL).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

// ── Review credentials — change both before deploying, remove after approval ──
const REVIEW_EMAIL = 'review@circuit40s.com';
const REVIEW_CODE  = '424242';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let email: string | undefined;
  let code:  string | undefined;

  try {
    const body = await req.json();
    email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : undefined;
    code  = typeof body.code  === 'string' ? body.code.trim()               : undefined;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  // ── Strict credential check — not a universal bypass ─────────────────────
  if (email !== REVIEW_EMAIL || code !== REVIEW_CODE) {
    // Return the same 401 for both wrong email and wrong code to avoid
    // leaking whether the email alone is valid.
    return json({ error: 'Invalid credentials' }, 401);
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[app-review-login] Missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return json({ error: 'Server configuration error' }, 500);
  }

  // Service-role client — service key never leaves this function
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // Generate a single-use magic link token for the review account.
    // The token_hash is returned to the client, which exchanges it for a real
    // Supabase session via verifyOtp({ token_hash, type: 'magiclink' }).
    // This produces a genuine auth session so RLS policies work normally.
    const { data, error } = await admin.auth.admin.generateLink({
      type:  'magiclink',
      email: REVIEW_EMAIL,
    });

    if (error) {
      console.error('[app-review-login] generateLink error:', error.message);
      return json({ error: 'Could not generate review session' }, 500);
    }

    const token_hash = data?.properties?.hashed_token;
    if (!token_hash) {
      console.error('[app-review-login] No hashed_token in generateLink response');
      return json({ error: 'Could not generate review session' }, 500);
    }

    return json({ token_hash });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[app-review-login] Unexpected error:', message);
    return json({ error: 'Internal server error' }, 500);
  }
});
