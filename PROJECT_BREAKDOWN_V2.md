# Project Breakdown V2
_Generated 2026-04-05_

---

## 1. app.json (full file)

```json
{
  "expo": {
    "name": "circuit41",
    "slug": "circuit41",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.anonymous.circuit41"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-font",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.668086573862-gaj0jemha74ah3mdmpphfvaasb7bp"
        }
      ]
    ]
  }
}
```

**Notes:**
- No `infoPlist.CFBundleURLTypes` — the plugin injects the URL scheme automatically during prebuild.
- `@react-native-google-signin/google-signin` is configured with `iosUrlScheme` as an array-style plugin entry.

---

## 2. .env (variable names only)

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
```

**Notes:**
- All four variables are required at build time.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` format: `<id>.apps.googleusercontent.com`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is the OAuth 2.0 Web Client ID from Google Cloud Console.

---

## 3. lib/supabase.ts

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
```

---

## 4. lib/googleAuth.ts

```ts
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
};

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();

    if (userInfo.data?.idToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
      });

      if (error) throw error;
      return { data, error: null };
    } else {
      throw new Error('No ID token returned from Google');
    }
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { data: null, error: null }; // user cancelled, not an error
    }
    return { data: null, error };
  }
};

export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.log('Google sign out error:', error);
  }
};
```

**Notes:**
- `configureGoogleSignIn()` is called once in `App.tsx` via `useEffect` on mount.
- `SIGN_IN_CANCELLED` returns `{ data: null, error: null }` — caller must check `data` before proceeding, not just `error`.
- `signOutFromGoogle()` is called before `supabase.auth.signOut()` in `ProfileScreen`.

---

## 5. context/AuthContext.tsx

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user:    User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user:    null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

**Notes:**
- `loading: true` until the initial `getSession()` resolves — `App.tsx` shows `<LoadingScreen />` during this time.
- `onAuthStateChange` handles magic link returns and Google Sign-In token exchange automatically — no extra wiring needed after `signInWithIdToken`.

---

## 6. VerificationScreen.tsx — handleVerify function

```ts
const handleVerify = async () => {
  const code = digits.join('');
  if (code.length !== OTP_LENGTH) return;

  setVerifying(true);
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      ...(isPhone
        ? { phone: contact, type: 'sms' as const }
        : { email: contact, type: 'email' as const }
      ),
      token: code,
    });

    if (error) {
      Alert.alert('Error', error.message);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      setFocusedIndex(0);
      return;
    }

    if (!data.session) {
      Alert.alert('Error', 'Verification failed. Please try again.');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.session.user.id)
      .maybeSingle();

    if (profile) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      navigation.navigate('ProfileSetup');
    }
  } catch (err: any) {
    Alert.alert('Error', err.message || 'Something went wrong');
  } finally {
    setVerifying(false);
  }
};
```

**Notes:**
- `isPhone` is derived at component level: `const isPhone = contact.startsWith('+')`.
- New/existing user detection is a profile table check (`maybeSingle()`), not a timestamp heuristic.

---

## 7. WelcomeScreen.tsx — handleGoogleSignIn function

```ts
const handleGoogleSignIn = async () => {
  setGoogleLoading(true);
  const { data, error } = await signInWithGoogle();
  setGoogleLoading(false);

  if (error) {
    Alert.alert('Sign in failed', error.message);
    return;
  }

  if (data?.session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.session.user.id)
      .maybeSingle();

    if (profile) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } else {
      navigation.navigate('ProfileSetup');
    }
  }
};
```

**Notes:**
- `error` being null does not mean sign-in succeeded — user cancellation also returns `{ data: null, error: null }`. The `if (data?.session)` guard handles this correctly.
- Apple Sign-In button shows `Alert.alert('Coming Soon', ...)` for now.

---

## 8. ios/circuit41/Info.plist — CFBundleURLTypes section

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.anonymous.circuit41</string>
    </array>
  </dict>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.668086573862-gaj0jemha74ah3mdmpphfvaasb7bp</string>
    </array>
  </dict>
</array>
```

**Notes:**
- First entry (`com.anonymous.circuit41`) is the app's own deep-link scheme, injected by Expo automatically.
- Second entry is the Google reversed client ID, injected by the `@react-native-google-signin/google-signin` plugin via `iosUrlScheme` in `app.json`.
- This file is auto-generated — do not edit manually. Changes belong in `app.json` followed by `npx expo prebuild --platform ios`.
