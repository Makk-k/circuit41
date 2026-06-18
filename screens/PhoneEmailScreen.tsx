// NOTE: Phone authentication is intentionally disabled for MVP.
// This screen now handles email-only OTP sign-in.
// Phone input, country picker, and SMS flow have been removed from the UI.
// Backend phone auth infrastructure (Supabase) remains untouched.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneEmail'>;

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

// ─── Icons ────────────────────────────────────────────────────────────────────
const BackChevron: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PhoneEmailScreen({ navigation }: Props) {
  const [email,   setEmail]   = useState('');
  const [sending, setSending] = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleSend = async () => {
    if (sending) return;
    setSending(true);

    try {
      const trimmed = email.trim();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: undefined,
        },
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      navigation.navigate('Verification', { contact: trimmed });
    } finally {
      setSending(false);
    }
  };

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

          {/* Back — chevron only */}
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <BackChevron />
          </TouchableOpacity>

          {/* Heading */}
          <Text style={styles.title}>Continue with email</Text>
          <Text style={styles.subtitle}>We'll send a one-time code to confirm</Text>

          {/* Email input */}
          <TextInput
            style={styles.emailInput}
            placeholder="Email address"
            placeholderTextColor={DS.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            returnKeyType="done"
          />

          {/* Send code */}
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Send code</Text>
            )}
          </TouchableOpacity>

          {/* Helper */}
          <Text style={styles.helper}>A 6-digit code will be sent to verify</Text>

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

  // Back — icon only
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
    marginBottom: 20,
  },

  // Email input
  emailInput: {
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      10,
    padding:           13,
    paddingHorizontal: 14,
    fontSize:          14,
    fontFamily:        'PlusJakartaSans_400Regular',
    color:             DS.textPrimary,
    marginBottom:      16,
  },

  // Primary button
  primaryButton: {
    backgroundColor: '#1A1712',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
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
