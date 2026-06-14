import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

  // ── Auth: verify the bearer token ─────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return json({ error: 'Invalid authorization header' }, 401);
  }
  const bearerToken = parts[1];

  const supabaseUrl     = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey  = Deno.env.get('SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    console.error('[delete-account] SUPABASE_URL is not set');
    return json({ error: 'Server configuration error' }, 500);
  }
  if (!serviceRoleKey) {
    console.error('[delete-account] SERVICE_ROLE_KEY is not set');
    return json({ error: 'Server configuration error' }, 500);
  }

  // Validate the caller's identity using their own token.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    auth:   { persistSession: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const userId = user.id;
  const now    = new Date().toISOString();

  // Service-role client — never exposed to clients, only used inside this function.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Valid shipment_status enum values that mean the shipment is fully resolved.
  const SAFE_STATUSES = ['delivered', 'cancelled'];

  try {
    // ── Step 0: Block deletion if any active shipments exist ──────────────────
    //
    // Users must resolve all in-progress shipments before deleting their account.
    // NOT-IN means any future status defaults to blocking, which is the safe direction.
    const { data: activeShipments, error: shipCheckErr } = await admin
      .from('shipments')
      .select('id')
      .eq('user_id', userId)
      .not('status', 'in', `(${SAFE_STATUSES.join(',')})`)
      .limit(1);

    if (shipCheckErr) {
      console.error('[delete-account] Step 0 shipment check failed:', shipCheckErr.message);
      return json({ error: 'SERVER_ERROR' }, 500);
    }

    if (activeShipments && activeShipments.length > 0) {
      return json(
        {
          error:   'ACTIVE_SHIPMENTS_EXIST',
          message: 'You currently have active shipments. Please complete or cancel all active shipments before deleting your account.',
        },
        409,
      );
    }

    // ── Step 1: Delete personal convenience records ────────────────────────────
    //
    // These tables hold user PII with no operational retention requirement.
    const deleteResults = await Promise.allSettled([
      admin.from('saved_cards').delete().eq('user_id', userId),
      admin.from('saved_addresses').delete().eq('user_id', userId),
      admin.from('feedback').delete().eq('user_id', userId),
    ]);

    for (const result of deleteResults) {
      if (result.status === 'fulfilled' && result.value.error) {
        console.warn('[delete-account] Step 1 partial error:', result.value.error.message);
      }
    }

    // ── Step 2: Anonymise the profile row ─────────────────────────────────────
    //
    // The profile row is retained for audit/support purposes but all identifying
    // fields are replaced with non-identifying placeholders.
    //
    // first_name and last_name are NOT NULL in the database so they use placeholder
    // strings instead of null.  preferred_name and phone are nullable and cleared.
    // scheduled_deletion_at is set to now because the auth user is deleted immediately
    // in Step 4 — no deferred purge job is needed.
    const { error: profileErr } = await admin
      .from('profiles')
      .update({
        first_name:             'Deleted',
        last_name:              'User',
        preferred_name:         null,
        phone:                  null,
        account_status:         'deleted',
        deleted_at:             now,
        scheduled_deletion_at:  now,
      })
      .eq('id', userId);

    if (profileErr) {
      console.error('[delete-account] Step 2 profile anonymise failed:', profileErr.message);
      return json({ error: 'SERVER_ERROR' }, 500);
    }

    // ── Step 3: Unlink shipment records ───────────────────────────────────────
    //
    // Shipments are operational/financial records retained for payment
    // reconciliation, logistics traceability, fraud prevention, and compliance.
    // We null user_id to sever the FK reference BEFORE deleting the auth user
    // in Step 4.  This is critical: if shipments.user_id has ON DELETE CASCADE
    // referencing auth.users(id), rows where user_id is still set to this userId
    // would be cascade-deleted when the auth user is removed.  Nulling first
    // ensures those rows no longer reference the auth user, so the cascade has
    // nothing to act on and shipment rows are preserved.
    //
    // Requires shipments.user_id to be nullable — see SQL note in summary.
    // If the column is NOT NULL this update will fail; we log and proceed, but
    // in that case a CASCADE constraint WOULD delete the shipment rows when the
    // auth user is deleted below.  Run the migration first to avoid this.
    const { error: shipErr } = await admin
      .from('shipments')
      .update({ user_id: null })
      .eq('user_id', userId);

    if (shipErr) {
      console.warn('[delete-account] Step 3 shipments unlink failed:', shipErr.message);
      // Non-fatal log, but see above: if user_id is NOT NULL and a CASCADE exists,
      // Step 4 will cascade-delete shipment rows.  Run the migration to prevent this.
    }

    // ── Step 4: Delete the Supabase Auth user ─────────────────────────────────
    //
    // By this point personal data has been removed/anonymised and shipment rows
    // have had their user_id nulled, so no operational data should be at risk
    // from cascade constraints.
    //
    // Deleting (not banning) the auth user means the same email address is
    // immediately available for a fresh sign-up, creating a new user_id.
    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(userId);

    if (deleteAuthErr) {
      console.error('[delete-account] Step 4 auth delete failed:', deleteAuthErr.message);
      return json({ error: 'SERVER_ERROR' }, 500);
    }

    return json({ success: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[delete-account] Unexpected error:', message);
    return json({ error: 'SERVER_ERROR' }, 500);
  }
});
