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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Auth: validate bearer token inside the function ──────────────────────────
  // "Verify JWT" is disabled for this function in the Supabase dashboard so the
  // platform gate does not attempt HS256 verification on an ES256 token.
  // We validate the token ourselves via supabase.auth.getUser(), which calls
  // Supabase Auth directly and handles the algorithm correctly.

  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return json({ error: 'Missing authorization header' }, 401);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return json({ error: 'Invalid authorization header' }, 401);
  }

  const bearerToken = parts[1];

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey =
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl) {
    console.error('[create-payment-intent] SUPABASE_URL env var is not set');
    return json({ error: 'Server configuration error' }, 500);
  }

  // Create a per-request Supabase client authenticated as the calling user.
  // getUser() validates the token against Supabase Auth and returns the user
  // if the token is valid, regardless of the JWT signing algorithm.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: {
    amount?: unknown;
    currency?: unknown;
    shipmentId?: unknown;
    paymentMethod?: unknown;
    stripeCustomerId?: unknown;
    savedPaymentMethodId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { amount, currency, shipmentId, paymentMethod, stripeCustomerId, savedPaymentMethodId } = body;

  // ── Validate inputs ───────────────────────────────────────────────────────────
  if (shipmentId === undefined || shipmentId === null || shipmentId === '') {
    return json({ error: 'Missing required field: shipmentId' }, 400);
  }

  if (currency === undefined || currency === null || typeof currency !== 'string' || currency.trim() === '') {
    return json({ error: 'Missing required field: currency' }, 400);
  }

  if (amount === undefined || amount === null) {
    return json({ error: 'Missing required field: amount' }, 400);
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount)) {
    return json({ error: `amount is not a valid number: ${amount}` }, 400);
  }

  if (numericAmount <= 0) {
    return json({ error: `amount must be greater than 0, received: ${numericAmount}` }, 400);
  }

  // ── Stripe setup ──────────────────────────────────────────────────────────────
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    console.error('[create-payment-intent] STRIPE_SECRET_KEY env var is not set');
    return json({ error: 'Payment service is not configured' }, 500);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  // ── Convert GBP pounds → pence (Stripe smallest unit) ────────────────────────
  // total_cost is stored as a decimal pound value (e.g. 10.50 = £10.50)
  // Stripe requires the amount in the smallest currency unit (10.50 GBP = 1050 pence)
  const amountInSmallestUnit = Math.round(numericAmount * 100);

  console.log(
    `[create-payment-intent] Creating intent: user=${user.id} shipmentId=${shipmentId} amount=${numericAmount} ${currency.toUpperCase()} → ${amountInSmallestUnit} pence`,
  );

  try {
    // ── Saved-card path ───────────────────────────────────────────────────────
    // When the client provides a saved Stripe Customer + PaymentMethod, create
    // the intent pre-attached to that customer so the client only needs to
    // confirm (with 3DS support) rather than re-enter card details.
    const usingSavedCard =
      typeof stripeCustomerId === 'string' && stripeCustomerId.length > 0 &&
      typeof savedPaymentMethodId === 'string' && savedPaymentMethodId.length > 0;

    if (usingSavedCard) {
      console.log(
        `[create-payment-intent] Saved-card path — customer=${stripeCustomerId} pm=${savedPaymentMethodId}`,
      );

      // Confirm server-side so the frontend never needs to supply card details again.
      // If 3DS / additional authentication is required, Stripe sets status to
      // 'requires_action' and the frontend calls handleNextAction(clientSecret).
      // If payment succeeds immediately, status is 'succeeded' and the frontend
      // skips the Stripe step entirely.
      const paymentIntent = await stripe.paymentIntents.create({
        amount:               amountInSmallestUnit,
        currency:             currency.toLowerCase(),
        customer:             stripeCustomerId as string,
        payment_method:       savedPaymentMethodId as string,
        payment_method_types: ['card'],
        confirm:              true,
        return_url:           'circuit41://stripe-redirect',
        metadata:             { shipmentId: String(shipmentId), userId: user.id },
      });

      console.log(
        `[create-payment-intent] Saved-card intent confirmed: id=${paymentIntent.id} status=${paymentIntent.status}`,
      );

      return json({
        clientSecret:       paymentIntent.client_secret,
        paymentIntentStatus: paymentIntent.status,
      });
    }

    // ── Standard path (new card entry / Apple Pay / Google Pay) ──────────────
    // For card-only flow, restrict payment methods server-side so PaymentSheet
    // cannot surface wallets, BNPL, or any other method.
    // For Apple Pay / Google Pay, the client uses confirmPlatformPayPayment()
    // which does not need payment_method_types restricted on the intent.
    const isCardOnly = paymentMethod === 'card';

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   amountInSmallestUnit,
      currency: currency.toLowerCase(),
      metadata: { shipmentId: String(shipmentId), userId: user.id },
      ...(isCardOnly
        ? { payment_method_types: ['card'] }
        : { automatic_payment_methods: { enabled: true } }),
    });

    console.log(`[create-payment-intent] Intent created: ${paymentIntent.id}`);

    return json({ clientSecret: paymentIntent.client_secret });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-payment-intent] Stripe error:', message);
    return json({ error: message }, 500);
  }
});
