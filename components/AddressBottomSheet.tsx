import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Switch,
  ScrollView,
  Keyboard,
  Animated,
  Dimensions,
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
import type { SavedAddress } from '../lib/database.types';

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

const SLIDE_CLOSED    = 700;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  visible:              boolean;
  onClose:              () => void;
  onConfirm:            (address: string) => void;
  onSaveNewAddress?:    (address: string) => void;
  savedAddresses:       SavedAddress[];
  userId?:              string;
  onAddressesChanged?:  (addresses: SavedAddress[]) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatAddress(addr: SavedAddress): string {
  const parts = [addr.address_line, addr.city, addr.postcode, addr.country].filter(Boolean);
  return parts.join(', ');
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AddressBottomSheet({
  visible,
  onClose,
  onConfirm,
  onSaveNewAddress,
  savedAddresses,
  userId,
  onAddressesChanged,
}: Props) {
  const insets    = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [localAddresses, setLocalAddresses] = useState<SavedAddress[]>(savedAddresses);
  const [selectedId,     setSelectedId]     = useState<string | null>(
    (savedAddresses.find(a => a.is_default) ?? savedAddresses[0])?.id ?? null,
  );
  const [showNewInput,   setShowNewInput]   = useState(false);
  const [newAddress,     setNewAddress]     = useState('');
  const [saveForFuture,  setSaveForFuture]  = useState(true);
  const [mutatingId,     setMutatingId]     = useState<string | null>(null);

  // ── Animation state ─────────────────────────────────────────────────────────
  const slideAnim    = useRef(new Animated.Value(SLIDE_CLOSED)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  // Plain state — only used to pad ScrollView content, no animation needed.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localVisible,    setLocalVisible]    = useState(false);
  const localVisibleRef = useRef(false);
  const hasOpenedRef    = useRef(false);
  // Ref ensures dismiss always calls the latest onClose even across renders
  const onCloseRef = useRef(onClose);
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

  // Trigger animations when the visible prop changes
  useEffect(() => {
    if (visible) {
      hasOpenedRef.current = true;
      openSheet();
    } else if (hasOpenedRef.current && localVisibleRef.current) {
      dismiss();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Sync local state when the sheet opens or saved addresses prop changes
  useEffect(() => {
    if (visible) {
      setLocalAddresses(savedAddresses);
      const def = savedAddresses.find(a => a.is_default) ?? savedAddresses[0];
      setSelectedId(def?.id ?? null);
      setShowNewInput(false);
      setNewAddress('');
    }
  }, [visible, savedAddresses]);

  if (!fontsLoaded) return null;

  const handleSetDefault = async (addr: SavedAddress) => {
    if (!userId || mutatingId) return;
    setMutatingId(addr.id);
    try {
      await supabase.from('saved_addresses').update({ is_default: false }).eq('user_id', userId);
      await supabase.from('saved_addresses').update({ is_default: true }).eq('id', addr.id);
      const updated = localAddresses.map(a => ({ ...a, is_default: a.id === addr.id }));
      setLocalAddresses(updated);
      onAddressesChanged?.(updated);
    } finally {
      setMutatingId(null);
    }
  };

  const handleRemove = async (addr: SavedAddress) => {
    if (!userId || mutatingId) return;
    setMutatingId(addr.id);
    try {
      await supabase.from('saved_addresses').delete().eq('id', addr.id);
      const updated = localAddresses.filter(a => a.id !== addr.id);
      setLocalAddresses(updated);
      onAddressesChanged?.(updated);
      if (selectedId === addr.id) {
        const next = updated.find(a => a.is_default) ?? updated[0];
        setSelectedId(next?.id ?? null);
      }
    } finally {
      setMutatingId(null);
    }
  };

  const handleConfirm = () => {
    let finalAddress: string;
    if (showNewInput && newAddress.trim()) {
      finalAddress = newAddress.trim();
      if (saveForFuture) onSaveNewAddress?.(finalAddress);
    } else {
      const saved = localAddresses.find(a => a.id === selectedId);
      finalAddress = saved ? formatAddress(saved) : '';
    }
    onConfirm(finalAddress);
    dismiss();
  };

  return (
    <Modal
      visible={localVisible}
      animationType="none"
      transparent
      onRequestClose={dismiss}
    >
      <View style={{ flex: 1 }}>
        {/* ── Backdrop: fades in independently, tap to dismiss ── */}
        <TouchableWithoutFeedback onPress={dismiss}>
          <Animated.View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdropAnim }]}
          />
        </TouchableWithoutFeedback>

        {/* ── Sheet: anchored to bottom, slides on open/close ── */}
        <Animated.View
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, transform: [{ translateY: slideAnim }] }}
        >
            {/* Prevent touches inside the sheet from reaching the backdrop */}
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{
                backgroundColor:      '#FFFFFF',
                borderTopLeftRadius:  20,
                borderTopRightRadius: 20,
                paddingTop:           12,
                paddingHorizontal:    20,
                paddingBottom:        insets.bottom + 24,
                maxHeight:            SHEET_MAX_HEIGHT,
              }}>
                {/* Handle bar */}
                <View style={{
                  width: 36, height: 4,
                  backgroundColor: '#E2E0DA',
                  borderRadius: 2,
                  alignSelf: 'center',
                  marginBottom: 16,
                }} />

                {/* Done button — shown when keyboard is visible */}
                {keyboardVisible && (
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 16, right: 20 }}
                    activeOpacity={0.7}
                    onPress={Keyboard.dismiss}
                  >
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#CD643D' }}>Done</Text>
                  </TouchableOpacity>
                )}

                {/* Title */}
                <Text style={styles.title}>Delivery address</Text>

                <ScrollView
                  ref={scrollRef}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  contentContainerStyle={{ paddingBottom: keyboardHeight }}
                >
                  {/* Saved addresses label */}
                  {localAddresses.length > 0 && (
                    <Text style={styles.sectionLabel}>SAVED ADDRESSES</Text>
                  )}

                  {localAddresses.map((addr, idx) => (
                    <React.Fragment key={addr.id}>
                      <TouchableOpacity
                        style={styles.addressRow}
                        activeOpacity={0.8}
                        onPress={() => { setSelectedId(addr.id); setShowNewInput(false); }}
                      >
                        <View style={styles.addressTextWrap}>
                          <Text style={styles.addressLine1}>{addr.label || 'Address'}</Text>
                          <Text style={styles.addressLine2} numberOfLines={2}>
                            {formatAddress(addr)}
                          </Text>

                          {/* Management actions — only when userId is provided */}
                          {userId && (
                            <View style={styles.addressActions}>
                              {!addr.is_default && (
                                <TouchableOpacity
                                  onPress={() => handleSetDefault(addr)}
                                  disabled={mutatingId === addr.id}
                                >
                                  <Text style={[
                                    styles.actionDefault,
                                    mutatingId === addr.id && styles.actionDisabled,
                                  ]}>
                                    Set as default
                                  </Text>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity
                                onPress={() => handleRemove(addr)}
                                disabled={mutatingId === addr.id}
                              >
                                <Text style={[
                                  styles.actionRemove,
                                  mutatingId === addr.id && styles.actionDisabled,
                                ]}>
                                  Remove
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Radio */}
                        <View style={[styles.radio, selectedId === addr.id && styles.radioSelected]}>
                          {selectedId === addr.id && <View style={styles.radioInner} />}
                        </View>
                      </TouchableOpacity>
                      {idx < localAddresses.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                  ))}

                  <View style={styles.divider} />

                  {/* + Add new address */}
                  <TouchableOpacity
                    style={styles.addNewRow}
                    activeOpacity={0.7}
                    onPress={() => setShowNewInput(prev => !prev)}
                  >
                    <Text style={styles.addNewText}>+ Add new address</Text>
                  </TouchableOpacity>

                  {showNewInput && (
                    <TextInput
                      style={styles.newAddressInput}
                      placeholder="Enter full address"
                      placeholderTextColor={DS.textMuted}
                      value={newAddress}
                      onChangeText={setNewAddress}
                      textContentType="fullStreetAddress"
                      autoComplete="street-address"
                      autoCorrect={false}
                      autoCapitalize="words"
                      returnKeyType="done"
                      multiline
                      numberOfLines={3}
                      onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                    />
                  )}

                  {/* Save for future use toggle */}
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Save for future use</Text>
                    <Switch
                      value={saveForFuture}
                      onValueChange={setSaveForFuture}
                      trackColor={{ false: '#D4D2CC', true: '#F7CBCD' }}
                      thumbColor={saveForFuture ? DS.accent : '#FFFFFF'}
                    />
                  </View>

                  {/* Confirm button */}
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    activeOpacity={0.85}
                    onPress={handleConfirm}
                  >
                    <Text style={styles.confirmBtnText}>Confirm address</Text>
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
  title: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     17,
    color:        DS.textPrimary,
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         DS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  8,
  },

  // Saved address row
  addressRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    justifyContent:  'space-between',
    paddingVertical: 14,
  },
  addressTextWrap: {
    flex:        1,
    marginRight: 12,
  },
  addressLine1: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  addressLine2: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
    marginTop:  2,
  },

  // Management action links
  addressActions: {
    flexDirection: 'row',
    gap:           12,
    marginTop:     6,
  },
  actionDefault: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  actionRemove: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.accent,
  },
  actionDisabled: {
    opacity: 0.4,
  },

  radio: {
    width:          18,
    height:         18,
    borderRadius:   9,
    borderWidth:    1.5,
    borderColor:    '#D4D2CC',
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      1,
  },
  radioSelected: {
    borderColor: DS.accent,
  },
  radioInner: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: DS.accent,
  },

  divider: {
    height:          1,
    backgroundColor: DS.border,
  },

  // Add new address
  addNewRow: {
    paddingVertical: 14,
  },
  addNewText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      DS.accent,
  },
  newAddressInput: {
    backgroundColor:   DS.bg,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      10,
    padding:           13,
    paddingHorizontal: 14,
    fontSize:          13,
    fontFamily:        'PlusJakartaSans_400Regular',
    color:             DS.textPrimary,
    marginBottom:      8,
    minHeight:         80,
    textAlignVertical: 'top',
  },

  // Save toggle
  toggleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 16,
  },
  toggleLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textPrimary,
  },

  // Confirm button
  confirmBtn: {
    backgroundColor: '#1A1712',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       20,
  },
  confirmBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      '#FFFFFF',
  },
});
