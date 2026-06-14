import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

type AppleSignInResult = {
  data:      Awaited<ReturnType<typeof supabase.auth.signInWithIdToken>>['data'] | null;
  error:     Error | null;
  firstName: string | null;
  lastName:  string | null;
  // email is included for completeness; @privaterelay.appleid.com is a valid
  // Apple-managed relay address when the user chose "Hide My Email" — treat it
  // as a normal identity, never attempt to link it to a real email automatically.
  email:     string | null;
};

/**
 * Signs in with Apple using the native iOS authentication sheet.
 *
 * Caller is responsible for checking availability with
 * AppleAuthentication.isAvailableAsync() before calling this function.
 *
 * Nonce flow:
 *   1. Generate a random raw nonce
 *   2. SHA-256 hash it — Apple receives only the hash
 *   3. Pass the raw nonce to Supabase; Supabase hashes it internally to verify
 *
 * Name availability:
 *   Apple returns credential.fullName only on the FIRST authorization for a given
 *   app/account pair. Subsequent sign-ins return null for fullName. Always treat
 *   missing names gracefully.
 */
export const signInWithApple = async (): Promise<AppleSignInResult> => {
  const empty: AppleSignInResult = { data: null, error: null, firstName: null, lastName: null, email: null };

  try {
    // Step 1: Generate raw nonce
    const rawNonce =
      Math.random().toString(36).substring(2, 18) +
      Math.random().toString(36).substring(2, 18);

    // Step 2: Hash it for Apple
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    // Step 3: Launch native Apple Sign-In sheet with hashed nonce
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    // Extract name fields before they are lost — only present on first auth.
    const firstName = credential.fullName?.givenName  ?? null;
    const lastName  = credential.fullName?.familyName ?? null;
    const email     = credential.email                ?? null;

    console.log('[PROFILE_BOOTSTRAP_DEBUG] Apple credential names:', { firstName, lastName, email });

    const { identityToken } = credential;
    if (!identityToken) {
      throw new Error('No identity token returned from Apple Sign-In');
    }

    // Step 4: Sign in to Supabase with the raw nonce and Apple identity token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token:    identityToken,
      nonce:    rawNonce,
    });

    if (error) throw error;
    return { data, error: null, firstName, lastName, email };

  } catch (error: any) {
    // User cancelled the native Apple sheet — fail quietly
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return empty;
    }
    console.error('[APPLE_SIGN_IN_DEBUG]', error);
    return { ...empty, error: error as Error };
  }
};
