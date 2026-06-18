import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// NOTE: these are EXPO_PUBLIC_* vars — inlined at BUILD time. On EAS they must be
// configured as EAS environment variables (scope: production); the local `.env`
// is gitignored and is NOT uploaded to EAS. If they are missing, the build ships
// without keys.
export const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Boot safety: createClient() THROWS synchronously on an empty url/key
// ("supabaseUrl is required."). Because this module is imported at app boot, that
// throw crashes the app before the first screen renders. If a build is missing its
// env vars we log loudly and fall back to harmless placeholders so the app can still
// boot (to an unauthenticated state) instead of closing instantly.
export const SUPABASE_ENV_MISSING = !SUPABASE_URL || !SUPABASE_ANON_KEY;
if (SUPABASE_ENV_MISSING) {
  console.error(
    '[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'This build was created without the required EAS production environment variables. ' +
      'Supabase calls will fail until the app is rebuilt with the env vars set.',
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'https://missing-env.invalid',
  SUPABASE_ANON_KEY || 'missing-env',
  {
    auth: {
      storage:            AsyncStorage,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,
    },
  },
);
