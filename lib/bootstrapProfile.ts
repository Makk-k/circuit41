import { supabase } from './supabase';

// Names written by the delete-account function or used as initial fallbacks.
// Profiles whose names match these are considered "not yet real" and can be
// overwritten if the provider supplies better values.
const PLACEHOLDER_FIRSTS = new Set(['User', 'Deleted', '']);
const PLACEHOLDER_LASTS  = new Set(['User', 'Deleted', '']);

type NameHints = {
  firstName?: string | null;
  lastName?:  string | null;
};

/**
 * Ensures a profiles row exists for userId and populates names from provider hints.
 *
 * Rules:
 *  - No row:           insert with hints (or safe fallbacks "User" / "").
 *  - Row with real names:  leave untouched.
 *  - Row with placeholder names:  overwrite with hints if available.
 */
export async function bootstrapProfile(userId: string, hints: NameHints = {}): Promise<void> {
  const firstName = hints.firstName?.trim() || null;
  const lastName  = hints.lastName?.trim()  || null;

  console.log('[PROFILE_BOOTSTRAP_DEBUG] Starting for', userId, { firstName, lastName });

  const { data: existing, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', userId)
    .maybeSingle();

  if (fetchErr) {
    // Non-fatal — the user lands in the app and can fill their name in ProfileScreen.
    console.error('[PROFILE_BOOTSTRAP_DEBUG] Fetch failed:', fetchErr.message);
    return;
  }

  if (!existing) {
    // No profile yet — create one.
    const { error: insertErr } = await supabase.from('profiles').insert({
      id:         userId,
      first_name: firstName || 'User',
      last_name:  lastName  || '',
      updated_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error('[PROFILE_BOOTSTRAP_DEBUG] Insert failed:', insertErr.message);
    } else {
      console.log('[PROFILE_BOOTSTRAP_DEBUG] Profile created:', { firstName, lastName });
    }
    return;
  }

  // Profile exists — only update if current names are placeholders AND we have
  // better values from the provider.
  const currentFirst = existing.first_name ?? '';
  const currentLast  = existing.last_name  ?? '';

  const updateFirst = PLACEHOLDER_FIRSTS.has(currentFirst) && !!firstName;
  const updateLast  = PLACEHOLDER_LASTS.has(currentLast)   && !!lastName;

  if (!updateFirst && !updateLast) {
    console.log('[PROFILE_BOOTSTRAP_DEBUG] Profile has real names — skipping update');
    return;
  }

  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (updateFirst) patch.first_name = firstName!;
  if (updateLast)  patch.last_name  = lastName!;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);

  if (updateErr) {
    console.error('[PROFILE_BOOTSTRAP_DEBUG] Update failed:', updateErr.message);
  } else {
    console.log('[PROFILE_BOOTSTRAP_DEBUG] Placeholder names updated:', patch);
  }
}
