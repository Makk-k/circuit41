import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
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

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return json({ error: 'Invalid authorization header' }, 401);
  }

  const bearerToken = parts[1];
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl) return json({ error: 'Server configuration error' }, 500);

  // User-scoped client for reading profile
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  // Service-role client for writing stripe_customer_id back to profiles
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseServiceKey) {
    console.error('[setup-payment-method] SUPABASE_SERVICE_ROLE_KEY not set');
    return json({ error: 'Server configuration error' }, 500);
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: { paymentMethodId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { paymentMethodId } = body;
  if (!paymentMethodId || typeof paymentMethodId !== 'string') {
    return json({ error: 'Missing required field: paymentMethodId' }, 400);
  }

  // ── Stripe setup ──────────────────────────────────────────────────────────────
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    console.error('[setup-payment-method] STRIPE_SECRET_KEY not set');
    return json({ error: 'Payment service is not configured' }, 500);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  // ── Get or create Stripe Customer ─────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email, first_name, last_name')
    .eq('id', user.id)
    .single();

  let stripeCustomerId: string;

  if (profile?.stripe_customer_id) {
    stripeCustomerId = profile.stripe_customer_id;
  } else {
    const displayName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(' ') || undefined;

    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: displayName,
      metadata: { supabaseUserId: user.id },
    });
    stripeCustomerId = customer.id;

    // Persist the new customer ID
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', user.id);

    if (updateError) {
      console.error('[setup-payment-method] failed to store stripe_customer_id:', updateError.message);
      // Non-fatal: return customer id anyway — card still usable this session
    }
  }

  // ── Attach PaymentMethod to Customer ─────────────────────────────────────────
  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // PM already attached to this customer is fine
    if (!message.includes('already been attached')) {
      console.error('[setup-payment-method] attach failed:', message);
      return json({ error: message }, 500);
    }
  }

  return json({ stripeCustomerId });
});
