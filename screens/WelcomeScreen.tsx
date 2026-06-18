import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path, G } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as AppleAuthentication from 'expo-apple-authentication';
import { RootStackParamList } from '../App';
import { signInWithGoogle } from '../lib/googleAuth';
import { signInWithApple } from '../lib/appleAuth';
import { bootstrapProfile } from '../lib/bootstrapProfile';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:            '#F5F9F6',
  card:          '#FFFFFF',
  border:        '#E2E0DA',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  accent:        '#CD643D',
} as const;

// ─── Apple logo SVG ───────────────────────────────────────────────────────────
const AppleIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24">
    <Path
      d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      fill="#000"
    />
  </Svg>
);

// ─── Google G SVG (multicolour) ───────────────────────────────────────────────
const GoogleIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24">
    <G>
      <Path
        d="M21.35 11.1H12v2.85h5.35c-.48 2.3-2.5 3.95-5.35 3.95-3.31 0-6-2.69-6-6s2.69-6 6-6c1.54 0 2.94.57 4.01 1.5l2.12-2.12A9.94 9.94 0 0012 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10 0-.67-.07-1.32-.2-1.95l-.45.05z"
        fill="#4285F4"
      />
      <Path
        d="M3.15 7.35l2.45 1.8A5.99 5.99 0 0112 6c1.54 0 2.94.57 4.01 1.5l2.12-2.12A9.94 9.94 0 0012 2a9.97 9.97 0 00-8.85 5.35z"
        fill="#EA4335"
      />
      <Path
        d="M12 22c2.43 0 4.67-.8 6.41-2.15l-2.96-2.43A6.01 6.01 0 0112 18c-2.84 0-5.25-1.9-6.1-4.5l-2.43 1.87A9.97 9.97 0 0012 22z"
        fill="#34A853"
      />
      <Path
        d="M21.8 10.05l-9.8.05v2.85h5.35a5.7 5.7 0 01-2.44 3.57l2.96 2.43C20.16 17.3 21.8 14.9 21.8 12c0-.67-.07-1.32-.2-1.95h.2z"
        fill="#FBBC05"
      />
    </G>
  </Svg>
);

// ─── Google metadata helpers ──────────────────────────────────────────────────
// Google may supply given_name/family_name directly, or only a combined
// full_name / name string.  We split on whitespace as a last resort.
function extractGivenName(meta: Record<string, unknown>): string | null {
  if (typeof meta.given_name === 'string' && meta.given_name.trim()) {
    return meta.given_name.trim();
  }
  const full = (typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '').trim();
  if (!full) return null;
  return full.split(/\s+/)[0] || null;
}

function extractFamilyName(meta: Record<string, unknown>): string | null {
  if (typeof meta.family_name === 'string' && meta.family_name.trim()) {
    return meta.family_name.trim();
  }
  const full = (typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '').trim();
  if (!full) return null;
  const parts = full.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function WelcomeScreen({ navigation }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading,  setAppleLoading]  = useState(false);

  const handleAppleSignIn = async () => {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      Alert.alert(
        'Apple Sign-In unavailable',
        'Apple Sign-In is not available on this device or build.',
      );
      return;
    }

    setAppleLoading(true);
    const { data, error, firstName, lastName } = await signInWithApple();
    setAppleLoading(false);

    if (error) {
      Alert.alert('Sign in failed', error.message);
      return;
    }

    if (data?.session) {
      // Bootstrap ensures a profile row exists with the best available names.
      // Apple only returns fullName on first authorization — subsequent sign-ins
      // will have firstName/lastName as null, which bootstrapProfile handles safely.
      await bootstrapProfile(data.session.user.id, { firstName, lastName });
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { data, error } = await signInWithGoogle();
    setGoogleLoading(false);

    if (error) {
      Alert.alert('Sign in failed', error.message);
      return;
    }

    if (data?.session) {
      // Extract name from Supabase user metadata populated by Google's OAuth response.
      const meta = data.session.user.user_metadata ?? {};
      const firstName = extractGivenName(meta);
      const lastName  = extractFamilyName(meta);
      console.log('[PROFILE_BOOTSTRAP_DEBUG] Google metadata names:', { firstName, lastName });
      await bootstrapProfile(data.session.user.id, { firstName, lastName });
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  };

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Circuit logo — top left */}
      <Image
        source={require('../assets/images/circuit-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Middle section — fills flex space, headline sits at bottom */}
      <View style={styles.middle}>
        <Text style={styles.heading}>{'Move goods.\nStay in control.'}</Text>
        <Text style={styles.subheading}>
          Manage international shipments with full visibility.
        </Text>
      </View>

      {/* Bottom actions */}
      <View style={styles.bottom}>

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PhoneEmail')}
        >
          <Text style={styles.primaryButtonText}>Continue with email</Text>
        </TouchableOpacity>

        {/* Divider row */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialRow}>
          {/* Apple */}
          <TouchableOpacity
            style={styles.socialButton}
            activeOpacity={0.8}
            onPress={handleAppleSignIn}
            disabled={appleLoading}
          >
            {appleLoading ? (
              <ActivityIndicator size="small" color={DS.textPrimary} />
            ) : (
              <>
                <AppleIcon />
                <Text style={styles.socialButtonText}>Apple</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity
            style={styles.socialButton}
            activeOpacity={0.8}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={DS.textPrimary} />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.socialButtonText}>Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          {'By continuing you agree to our '}
          <Text style={styles.termsLink} onPress={() => navigation.navigate('TermsOfService')}>
            Terms of Service
          </Text>
          {' and '}
          <Text style={styles.termsLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
            Privacy Policy
          </Text>
        </Text>

      </View>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex:              1,
    backgroundColor:   DS.bg,
    paddingHorizontal: 20,
  },

  // Logo
  logo: {
    width:     140,
    height:    40,
    marginTop: 8,
  },

  // Middle section
  middle: {
    flex:           1,
    justifyContent: 'flex-end',
    paddingBottom:  40,
  },
  heading: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     28,
    lineHeight:   28 * 1.2,
    color:        DS.textPrimary,
    marginBottom: 8,
  },
  subheading: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    lineHeight: 20,
  },

  // Bottom block
  bottom: {},

  // Primary button
  primaryButton: {
    backgroundColor: '#1A1712',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginBottom:    16,
  },
  primaryButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      '#FFFFFF',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  14,
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: DS.border,
  },
  dividerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   10,
    color:      DS.textMuted,
  },

  // Social buttons
  socialRow: {
    flexDirection: 'row',
    gap:           8,
  },
  socialButton: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    12,
    paddingVertical: 12,
  },
  socialButtonText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.textPrimary,
  },

  // Terms
  terms: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     10,
    color:        DS.textMuted,
    textAlign:    'center',
    marginTop:    20,
    marginBottom: 4,
  },
  termsLink: {
    color: DS.accent,
  },
});
