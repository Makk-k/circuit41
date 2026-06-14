import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { supabase } from '../lib/supabase';

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

const SLIDE_CLOSED    = 700;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  visible:          boolean;
  onClose:          () => void;
  onSaved:          (updated: { first_name: string; last_name: string; phone: string | null }) => void;
  userId:           string;
  initialFirstName: string;
  initialLastName:  string;
  initialPhone:     string;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProfileEditBottomSheet({
  visible,
  onClose,
  onSaved,
  userId,
  initialFirstName,
  initialLastName,
  initialPhone,
}: Props) {
  const insets = useSafeAreaInsets();

  const [firstName,      setFirstName]      = useState(initialFirstName);
  const [lastName,       setLastName]       = useState(initialLastName);
  const [phone,          setPhone]          = useState(initialPhone);
  const [saving,         setSaving]         = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ─── Animation state ──────────────────────────────────────────────────────
  const slideAnim       = useRef(new Animated.Value(SLIDE_CLOSED)).current;
  const backdropAnim    = useRef(new Animated.Value(0)).current;
  const [localVisible,  setLocalVisible]  = useState(false);
  const localVisibleRef = useRef(false);
  const hasOpenedRef    = useRef(false);
  const onCloseRef      = useRef(onClose);
  onCloseRef.current = onClose;

  const openSheet = useCallback(() => {
    setLocalVisible(true);
    localVisibleRef.current = true;
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim,    { toValue: 0, speed: 20, bounciness: 0, useNativeDriver: true }),
    ]).start();
  }, [backdropAnim, slideAnim]);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim,    { toValue: SLIDE_CLOSED, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setLocalVisible(false);
      localVisibleRef.current = false;
      onCloseRef.current();
    });
  }, [backdropAnim, slideAnim]);

  // Sync fields each time the sheet opens, then animate it in.
  useEffect(() => {
    if (visible) {
      setFirstName(initialFirstName);
      setLastName(initialLastName);
      setPhone(initialPhone);
      hasOpenedRef.current = true;
      openSheet();
    } else if (hasOpenedRef.current && localVisibleRef.current) {
      dismiss();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const handleSave = async () => {
    const trimFirst = firstName.trim();
    const trimLast  = lastName.trim();
    if (!trimFirst) {
      Alert.alert('Required', 'First name cannot be empty.');
      return;
    }
    if (!trimLast) {
      Alert.alert('Required', 'Last name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: trimFirst,
          last_name:  trimLast,
          phone:      phone.trim() || null,
        })
        .eq('id', userId);
      if (error) throw error;
      onSaved({ first_name: trimFirst, last_name: trimLast, phone: phone.trim() || null });
      dismiss();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <Modal visible={localVisible} animationType="none" transparent onRequestClose={dismiss}>
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={dismiss}>
          <Animated.View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdropAnim }]}
          />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, transform: [{ translateY: slideAnim }] }}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={{
              backgroundColor:      DS.card,
              borderTopLeftRadius:  20,
              borderTopRightRadius: 20,
              paddingTop:           12,
              paddingHorizontal:    20,
              paddingBottom:        insets.bottom + 24,
              maxHeight:            SHEET_MAX_HEIGHT,
            }}>
              {/* Handle bar */}
              <View style={{ width: 36, height: 4, backgroundColor: '#E2E0DA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

              {/* Header */}
              <View style={styles.headerRow}>
                <Text style={styles.title}>Edit Profile</Text>
                <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={dismiss}>
                  <Text style={styles.closeBtnText}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                contentContainerStyle={{ paddingBottom: keyboardHeight }}
              >
                {/* First Name */}
                <Text style={styles.fieldLabel}>FIRST NAME</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={DS.textMuted}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                {/* Last Name */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>LAST NAME</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={DS.textMuted}
                  autoCapitalize="words"
                  returnKeyType="next"
                />

                {/* Phone */}
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>PHONE (OPTIONAL)</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+44 7700 000000"
                  placeholderTextColor={DS.textMuted}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  returnKeyType="done"
                />

                {/* Save */}
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  activeOpacity={0.85}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Text style={styles.saveBtnText}>Save changes</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   20,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   18,
    color:      DS.textPrimary,
  },
  closeBtn: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: '#F0EEE8',
    alignItems:      'center',
    justifyContent:  'center',
  },
  closeBtnText: {
    fontSize:   16,
    color:      DS.textSecondary,
    lineHeight: 20,
  },
  fieldLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         DS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  8,
  },
  input: {
    backgroundColor:   DS.bg,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      10,
    padding:           13,
    paddingHorizontal: 14,
    fontFamily:        'PlusJakartaSans_400Regular',
    fontSize:          14,
    color:             DS.textPrimary,
  },
  saveBtn: {
    backgroundColor: DS.accent,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       24,
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
});
