import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Verification'>;

// ─────────────────────────────────────────────────────────────────────────────
// TEMP: App Review bypass — REMOVE AFTER APP STORE APPROVAL
// These constants gate a special login path for Apple App Reviewers.
// Also delete supabase/functions/app-review-login/index.ts when removing this.
// ─────────────────────────────────────────────────────────────────────────────
const TEMP_APP_REVIEW_EMAIL = 'review@circuit40s.com';
const TEMP_APP_REVIEW_CODE  = '424242';

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:            '#F7F6F0',
  card:          '#FFFFFF',
  border:        '#E2E0DA',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  accent:        '#C10F1D',
} as const;

const OTP_LENGTH   = 6;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BOX_WIDTH    = (SCREEN_WIDTH - 40 - 50) / OTP_LENGTH;

// ─── Back chevron ─────────────────────────────────────────────────────────────
const BackChevron: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function VerificationScreen({ navigation, route }: Props) {
  const { contact } = route.params;

  const [digits,       setDigits]       = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [resendLabel,  setResendLabel]  = useState('Resend code');
  const [verifying,    setVerifying]    = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleDigitChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length !== OTP_LENGTH) return;

    // ── TEMP: App Review bypass — REMOVE AFTER APP STORE APPROVAL ─────────────
    // Only activates for the exact review email + code. All other combinations
    // fall through to the normal email OTP flow below, unchanged.
    if (contact.toLowerCase() === TEMP_APP_REVIEW_EMAIL && code === TEMP_APP_REVIEW_CODE) {
      setVerifying(true);
      try {
        // Call the Edge Function server-side to get a single-use token_hash.
        // The service role key never leaves the Edge Function.
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/app-review-login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey:          SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ email: contact.toLowerCase(), code }),
          },
        );

        const result = await response.json();

        if (!response.ok || !result.token_hash) {
          Alert.alert('Review login failed', result.error || 'Could not start review session.');
          return;
        }

        // Exchange the server-generated token_hash for a real Supabase session.
        // verifyOtp with token_hash produces a genuine auth session so that
        // all RLS policies work exactly as they do for normal users.
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: result.token_hash,
          type:       'magiclink',
        });

        if (error || !data.session) {
          Alert.alert('Review login failed', error?.message || 'Session exchange failed.');
          return;
        }

        // Same profile-check → navigation as the normal verified flow.
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
        Alert.alert('Review login failed', err.message || 'Something went wrong');
      } finally {
        setVerifying(false);
      }
      return; // Do not fall through to normal OTP verification.
    }
    // ── End App Review bypass ──────────────────────────────────────────────────

    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: contact,
        type:  'email' as const,
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

  const handleResend = async () => {
    setResendLabel('Sending…');
    try {
      await supabase.auth.signInWithOtp({ email: contact });
      setResendLabel('Code resent');
    } catch {
      setResendLabel('Resend code');
    } finally {
      setTimeout(() => setResendLabel('Resend code'), 2000);
    }
  };

  const filledCount = digits.filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <BackChevron />
          </TouchableOpacity>

          {/* Heading */}
          <Text style={styles.title}>Enter the code</Text>
          <Text style={styles.subtitle}>
            {'Sent to '}
            <Text style={styles.contactHighlight}>{contact}</Text>
            {'. Check your inbox.'}
          </Text>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {digits.map((digit, i) => {
              const isActive = focusedIndex === i;
              const hasValue = digit.length > 0;
              return (
                <TextInput
                  key={i}
                  ref={ref => { inputRefs.current[i] = ref; }}
                  style={[
                    styles.otpBox,
                    (isActive || hasValue) && styles.otpBoxActive,
                    isActive && styles.otpBoxFocused,
                  ]}
                  value={digit}
                  onChangeText={text => handleDigitChange(text, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  onFocus={() => setFocusedIndex(i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  caretHidden
                  selectTextOnFocus
                />
              );
            })}
          </View>

          {/* Resend row */}
          <Text style={styles.resendRow}>
            <Text style={styles.resendPrefix}>{"Didn't receive it?  "}</Text>
            <Text style={styles.resendLink} onPress={handleResend}>
              {resendLabel}
            </Text>
          </Text>

          {/* Verify button */}
          <TouchableOpacity
            style={[styles.primaryButton, (filledCount < OTP_LENGTH || verifying) && styles.primaryButtonDim]}
            activeOpacity={0.85}
            onPress={handleVerify}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          {/* Helper */}
          <Text style={styles.helper}>Code expires in 10 minutes</Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: DS.bg,
  },
  kav: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     40,
  },

  // Back
  backBtn: {
    padding:         8,
    marginBottom:    16,
    alignSelf:       'flex-start',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
  },

  // Heading
  title: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     20,
    color:        DS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     12,
    color:        DS.textSecondary,
    marginBottom: 28,
  },
  contactHighlight: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color:      DS.textPrimary,
  },

  // OTP row
  otpRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   24,
  },
  otpBox: {
    width:           BOX_WIDTH,
    height:          52,
    backgroundColor: DS.card,
    borderWidth:     1.5,
    borderColor:     DS.border,
    borderRadius:    10,
    fontSize:        22,
    fontFamily:      'PlusJakartaSans_700Bold',
    color:           DS.textPrimary,
  },
  otpBoxActive: {
    borderColor: DS.accent,
  },
  otpBoxFocused: {
    backgroundColor: '#FEF9F9',
    borderColor:     DS.accent,
  },

  // Resend
  resendRow: {
    textAlign:    'center',
    marginBottom: 24,
    fontSize:     11,
  },
  resendPrefix: {
    fontFamily: 'PlusJakartaSans_400Regular',
    color:      DS.textSecondary,
  },
  resendLink: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color:      DS.accent,
  },

  // Primary button
  primaryButton: {
    backgroundColor: DS.accent,
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
  },
  primaryButtonDim: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      '#FFFFFF',
  },

  // Helper
  helper: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   10,
    color:      DS.textMuted,
    textAlign:  'center',
    marginTop:  10,
  },
});
