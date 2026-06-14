import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path, Rect } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailWaiting'>;

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

// ─── Envelope SVG icon ────────────────────────────────────────────────────────
const EnvelopeIcon: React.FC = () => (
  <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="4" width="20" height="16" rx="2" stroke={DS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M2 7l10 7 10-7" stroke={DS.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Back chevron ─────────────────────────────────────────────────────────────
const BackChevron: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={DS.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function EmailWaitingScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [resending,  setResending]  = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      setResendSent(true);
      setTimeout(() => setResendSent(false), 2000);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backBtn}
        activeOpacity={0.7}
        onPress={() => navigation.goBack()}
      >
        <BackChevron />
      </TouchableOpacity>

      {/* Content — centered */}
      <View style={styles.content}>
        <EnvelopeIcon />

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a sign-in link to:</Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.instruction}>Tap the link in the email to continue.</Text>
        <Text style={styles.spamNote}>Make sure to check your spam folder</Text>

        {/* Resend button */}
        <TouchableOpacity
          style={styles.resendBtn}
          activeOpacity={0.8}
          onPress={handleResend}
          disabled={resending}
        >
          <Text style={styles.resendText}>
            {resendSent ? 'Email sent!' : 'Resend email'}
          </Text>
        </TouchableOpacity>

        {/* Use a different email */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.differentEmail}>Use a different email</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: DS.bg,
    paddingHorizontal: 20,
  },

  backBtn: {
    padding:         8,
    marginTop:       8,
    alignSelf:       'flex-start',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
  },

  content: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingBottom:  40,
  },

  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   22,
    color:      DS.textPrimary,
    textAlign:  'center',
    marginTop:  24,
  },

  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    textAlign:  'center',
    marginTop:  8,
  },

  email: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      DS.textPrimary,
    textAlign:  'center',
    marginTop:  4,
  },

  instruction: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    textAlign:  'center',
    marginTop:  16,
    maxWidth:   260,
  },

  spamNote: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      DS.textMuted,
    textAlign:  'center',
    marginTop:  8,
  },

  resendBtn: {
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      12,
    paddingVertical:   13,
    alignItems:        'center',
    alignSelf:         'stretch',
    marginTop:         32,
  },

  resendText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   13,
    color:      DS.textPrimary,
  },

  differentEmail: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      DS.accent,
    textAlign:  'center',
    marginTop:  16,
  },
});
