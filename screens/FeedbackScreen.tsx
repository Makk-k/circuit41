import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

const CATEGORIES = [
  'Bug',
  'Suggestion',
  'Payment issue',
  'Shipment issue',
  'Account issue',
  'Other',
];

const DS = {
  bg:            '#F7F6F0',
  card:          '#FFFFFF',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  accent:        '#C10F1D',
  border:        '#E2E0DA',
} as const;

export default function FeedbackScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [category,     setCategory]     = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [message,      setMessage]      = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Required', 'Please select a category.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Required', 'Please enter a message.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({ user_id: user.id, category, message: message.trim() });

      if (error) {
        Alert.alert('Could not send feedback', error.message || 'Something went wrong.');
        return;
      }

      Alert.alert('Feedback sent', 'Thanks — we appreciate your help.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Could not send feedback', err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header sits above KeyboardAvoidingView so it never shifts */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={DS.textPrimary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* keyboardDismissMode lets user dismiss by dragging the scroll view */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Pressable backdrop dismisses keyboard when tapping non-interactive areas */}
          <Pressable onPress={Keyboard.dismiss}>

            <Text style={styles.title}>Help improve the app</Text>
            <Text style={styles.subtitle}>Tell us what we can improve.</Text>

            {/* ── Category dropdown ──────────────────────────────────── */}
            <Text style={styles.sectionLabel}>CATEGORY</Text>

            <TouchableOpacity
              style={[styles.dropdown, dropdownOpen && styles.dropdownOpen]}
              activeOpacity={0.8}
              onPress={() => {
                Keyboard.dismiss();
                setDropdownOpen(prev => !prev);
              }}
            >
              <Text style={category ? styles.dropdownValue : styles.dropdownPlaceholder}>
                {category ?? 'Select category'}
              </Text>
              <Ionicons
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={DS.textSecondary}
              />
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={styles.dropdownList}>
                {CATEGORIES.map((cat, idx) => (
                  <React.Fragment key={cat}>
                    {idx > 0 && <View style={styles.dropdownDivider} />}
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        setCategory(cat);
                        setDropdownOpen(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        category === cat && styles.dropdownItemActive,
                      ]}>
                        {cat}
                      </Text>
                      {category === cat && (
                        <Ionicons name="checkmark" size={16} color={DS.accent} />
                      )}
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* ── Message ────────────────────────────────────────────── */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>MESSAGE</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Describe the issue or suggestion..."
              placeholderTextColor={DS.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoCorrect={false}
              autoCapitalize="sentences"
              onFocus={() => setDropdownOpen(false)}
            />

            {/* ── Submit ─────────────────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.submitBtnText}>Send feedback</Text>
              }
            </TouchableOpacity>

          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DS.bg },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   12,
  },
  backButton: {
    width:           36,
    height:          36,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom:     48,
  },

  title: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     22,
    color:        DS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     14,
    color:        DS.textSecondary,
    marginBottom: 24,
  },

  sectionLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         DS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom:  8,
  },

  // Dropdown trigger row
  dropdown: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      14,
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  dropdownOpen: {
    borderColor:              DS.accent,
    borderBottomLeftRadius:   0,
    borderBottomRightRadius:  0,
  },
  dropdownPlaceholder: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   14,
    color:      DS.textMuted,
  },
  dropdownValue: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   14,
    color:      DS.textPrimary,
  },

  // Options list — renders inline below the trigger
  dropdownList: {
    backgroundColor:        DS.card,
    borderWidth:            1,
    borderTopWidth:         0,
    borderColor:            DS.accent,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius:14,
    overflow:               'hidden',
    marginBottom:           4,
  },
  dropdownItem: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   13,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  dropdownItemActive: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color:      DS.accent,
  },
  dropdownDivider: {
    height:           1,
    backgroundColor:  DS.border,
    marginHorizontal: 16,
  },

  messageInput: {
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      14,
    padding:           16,
    fontSize:          14,
    fontFamily:        'PlusJakartaSans_400Regular',
    color:             DS.textPrimary,
    minHeight:         120,
    textAlignVertical: 'top',
  },

  submitBtn: {
    backgroundColor: DS.accent,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       24,
  },
  submitBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
});
