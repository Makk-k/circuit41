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

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

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

// ─── Person outline icon ──────────────────────────────────────────────────────
const PersonIcon: React.FC = () => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
      stroke={DS.textMuted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 11a4 4 0 100-8 4 4 0 000 8z"
      stroke={DS.textMuted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileSetupScreen({ navigation }: Props) {
  const [firstName,     setFirstName]     = useState('');
  const [lastName,      setLastName]      = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [saving,        setSaving]        = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleGetStarted = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id:             user.id,
          first_name:     firstName.trim(),
          last_name:      lastName.trim(),
          preferred_name: preferredName.trim() || null,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;

      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

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

          {/* Back button */}
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>

          {/* Avatar placeholder */}
          <View style={styles.avatarCircle}>
            <PersonIcon />
          </View>

          {/* Heading */}
          <Text style={styles.title}>What should we call you?</Text>
          <Text style={styles.subtitle}>Just a few details to get started</Text>

          {/* First name */}
          <Text style={styles.fieldLabel}>FIRST NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Your first name"
            placeholderTextColor={DS.textMuted}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Last name */}
          <Text style={styles.fieldLabel}>LAST NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Your last name"
            placeholderTextColor={DS.textMuted}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Preferred name */}
          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>PREFERRED NAME</Text>
            <Text style={styles.labelOptional}> (optional)</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="What should we call you?"
            placeholderTextColor={DS.textMuted}
            value={preferredName}
            onChangeText={setPreferredName}
            autoCapitalize="words"
            returnKeyType="done"
          />

          {/* Continue — disabled until first name and last name both have content */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!canSubmit || saving) && styles.primaryButtonDisabled,
            ]}
            activeOpacity={canSubmit && !saving ? 0.85 : 1}
            onPress={handleGetStarted}
            disabled={!canSubmit || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  !canSubmit && styles.primaryButtonTextDisabled,
                ]}
              >
                Get started →
              </Text>
            )}
          </TouchableOpacity>

          {/* Helper */}
          <Text style={styles.helper}>You can update this anytime in your profile</Text>

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
    alignItems:        'center',
  },
  backBtn: {
    padding:         8,
    alignSelf:       'flex-start',
    marginBottom:    16,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
  },

  // Avatar
  avatarCircle: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: '#ECEAE4',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    16,
  },

  // Heading
  title: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     18,
    color:        DS.textPrimary,
    textAlign:    'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     12,
    color:        DS.textSecondary,
    textAlign:    'center',
    marginBottom: 24,
  },

  // Fields
  fieldLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         DS.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  5,
    alignSelf:     'flex-start',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    alignSelf:     'flex-start',
    marginBottom:  5,
  },
  labelOptional: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   10,
    color:      DS.textMuted,
  },
  input: {
    width:             '100%',
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      10,
    padding:           12,
    paddingHorizontal: 14,
    fontSize:          13,
    fontFamily:        'PlusJakartaSans_400Regular',
    color:             DS.textPrimary,
    marginBottom:      12,
  },

  // Primary button
  primaryButton: {
    width:           '100%',
    backgroundColor: DS.accent,
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       20,
  },
  primaryButtonDisabled: {
    backgroundColor: '#E2E0DA',
  },
  primaryButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      '#FFFFFF',
  },
  primaryButtonTextDisabled: {
    color: '#A0A0A0',
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
