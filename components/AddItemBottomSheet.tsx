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
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { pickImageFromLibrary } from '../lib/imagePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
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
  bg:            '#F5F9F6',
  card:          '#FFFFFF',
  border:        '#E2E0DA',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  accent:        '#CD643D',
} as const;

// ─── Animation constants ──────────────────────────────────────────────────────
const SLIDE_CLOSED    = 700;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

// ─── Sensitive goods chip options ─────────────────────────────────────────────
const SENSITIVE_OPTIONS = ['F-Brand', 'Magnetic', 'Battery', 'Cell Phone', 'Perfume'];

// ─── Updated parcel type ──────────────────────────────────────────────────────
export type NewItem = {
  itemNames:      string[];
  trackingId:     string;
  declaredValue:  string;
  category:       'general' | 'sensitive';
  sensitiveTypes: string[];
  hasReceipt:     boolean;
  receiptPath?:   string;
};

type Props = {
  visible:  boolean;
  onClose:  () => void;
  onAdd:    (item: NewItem) => void;
};

// ─── Paperclip icon SVG ───────────────────────────────────────────────────────
const PaperclipIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Path
      d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
      stroke={DS.textMuted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function AddItemBottomSheet({ visible, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();

  const [itemNames,        setItemNames]        = useState<string[]>(['']);
  const [trackingId,       setTrackingId]       = useState('');
  const [declaredValue,    setDeclaredValue]    = useState('');
  const [category,         setCategory]         = useState<'general' | 'sensitive'>('general');
  const [sensitiveTypes,   setSensitiveTypes]   = useState<string[]>([]);
  const [receiptUploaded,  setReceiptUploaded]  = useState(false);
  const [receiptPath,      setReceiptPath]      = useState('');

  // ─── Animation state ──────────────────────────────────────────────────────
  const slideAnim      = useRef(new Animated.Value(SLIDE_CLOSED)).current;
  const backdropAnim   = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localVisible, setLocalVisible] = useState(false);
  const localVisibleRef = useRef(false);
  const hasOpenedRef    = useRef(false);
  const onCloseRef      = useRef(onClose);
  onCloseRef.current = onClose;

  const openSheet = useCallback(() => {
    setLocalVisible(true);
    localVisibleRef.current = true;
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 0, useNativeDriver: true }),
    ]).start();
  }, [backdropAnim, slideAnim]);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SLIDE_CLOSED, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setLocalVisible(false);
      localVisibleRef.current = false;
      onCloseRef.current();
    });
  }, [backdropAnim, slideAnim]);

  useEffect(() => {
    if (visible) {
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

  const updateItemName = (text: string, index: number) => {
    const next = [...itemNames];
    next[index] = text;
    setItemNames(next);
  };

  const addItemNameRow = () => setItemNames(prev => [...prev, '']);

  const removeItemNameRow = (index: number) => {
    setItemNames(prev => prev.filter((_, i) => i !== index));
  };

  const selectGeneral = () => {
    setCategory('general');
    setSensitiveTypes([]);
  };

  const toggleSensitiveChip = (chip: string) => {
    setSensitiveTypes(prev => {
      const next = prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip];
      if (next.length > 0) setCategory('sensitive');
      return next;
    });
  };

  const generateRef = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'REF-';
    for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  const uploadReceipt = async (uri: string, mimeType: string, fileName: string) => {
    try {
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
      const filePath = 'receipts/' + Date.now() + '_' + safeFileName;

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File not found');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) throw new Error('Could not read file');

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, bytes, { contentType: mimeType, upsert: true });
      if (error) throw error;

      setReceiptUploaded(true);
      setReceiptPath(filePath);
      Alert.alert('Success', 'Receipt uploaded');
    } catch (err: any) {
      Alert.alert('Upload failed', err.message);
    }
  };

  const handleUploadReceipt = () => {
    Alert.alert('Upload Receipt', 'Choose receipt type', [
      {
        text: 'Photo',
        onPress: async () => {
          const image = await pickImageFromLibrary();
          if (image) {
            await uploadReceipt(image.uri, image.mimeType, image.fileName);
          }
        },
      },
      {
        text: 'PDF',
        onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf'],
            copyToCacheDirectory: true,
          });
          if (!result.canceled && result.assets?.[0]) {
            await uploadReceipt(result.assets[0].uri, 'application/pdf', result.assets[0].name);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAdd = () => {
    const filledNames = itemNames.filter(n => n.trim().length > 0);
    if (filledNames.length === 0) return;
    const finalTrackingId = trackingId.trim() || generateRef();

    onAdd({
      itemNames:      filledNames,
      trackingId:     finalTrackingId,
      declaredValue:  declaredValue.trim(),
      category,
      sensitiveTypes,
      hasReceipt:     receiptUploaded,
      receiptPath:    receiptPath || undefined,
    });

    setItemNames(['']);
    setTrackingId('');
    setDeclaredValue('');
    setCategory('general');
    setSensitiveTypes([]);
    setReceiptUploaded(false);
    setReceiptPath('');
    dismiss();
  };

  if (!fontsLoaded) return null;

  return (
    <Modal
      visible={localVisible}
      animationType="none"
      transparent
      onRequestClose={dismiss}
    >
      <View style={{ flex: 1 }}>
        {/* Backdrop: fades independently */}
        <TouchableWithoutFeedback onPress={dismiss}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdropAnim },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sheet: anchored to bottom, slides on open/close */}
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
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: keyboardHeight }}
                >

                  {/* Handle bar */}
                  <View style={styles.handleBar} />

                  {/* Title */}
                  <Text style={styles.title}>Add parcel</Text>

                  {/* ── WHAT'S INSIDE ──────────────────────────────────────────── */}
                  <Text style={styles.sectionLabel}>WHAT'S INSIDE?</Text>

                  {itemNames.map((name, i) => (
                    <View key={i} style={[styles.nameRow, i > 0 && { marginTop: 8 }]}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Item name e.g. Nike Air Max"
                        placeholderTextColor={DS.textMuted}
                        value={name}
                        onChangeText={text => updateItemName(text, i)}
                        returnKeyType="next"
                      />
                      {itemNames.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeButton}
                          activeOpacity={0.7}
                          onPress={() => removeItemNameRow(i)}
                        >
                          <Text style={styles.removeButtonText}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.addAnotherLink}
                    activeOpacity={0.7}
                    onPress={addItemNameRow}
                  >
                    <Text style={styles.addAnotherText}>+ Add another item</Text>
                  </TouchableOpacity>

                  {/* ── TRACKING ID ─────────────────────────────────────────────── */}
                  <Text style={[styles.sectionLabel, { marginTop: 14 }]}>TRACKING ID (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Leave blank to auto-generate a reference"
                    placeholderTextColor={DS.textMuted}
                    value={trackingId}
                    onChangeText={setTrackingId}
                    returnKeyType="next"
                    autoCapitalize="characters"
                  />

                  {/* ── SPECIAL REQUIREMENTS ─────────────────────────────────────── */}
                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>SPECIAL REQUIREMENTS</Text>

                  <TouchableOpacity
                    style={[styles.categoryRow, category === 'general' && styles.categoryRowSelected]}
                    activeOpacity={0.8}
                    onPress={selectGeneral}
                  >
                    <Text style={styles.categoryRowLabel}>General Goods</Text>
                    <View style={[styles.radio, category === 'general' && styles.radioSelected]} />
                  </TouchableOpacity>

                  <Text style={styles.sensitiveSectionLabel}>Sensitive Goods</Text>
                  <View style={styles.chipsRow}>
                    {SENSITIVE_OPTIONS.map(chip => {
                      const active = sensitiveTypes.includes(chip);
                      return (
                        <TouchableOpacity
                          key={chip}
                          style={[styles.chip, active && styles.chipActive]}
                          activeOpacity={0.7}
                          onPress={() => toggleSensitiveChip(chip)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* ── DECLARED VALUE ────────────────────────────────────────────── */}
                  <TextInput
                    style={[styles.input, { marginTop: 16 }]}
                    placeholder="£ Value (optional)"
                    placeholderTextColor={DS.textMuted}
                    value={declaredValue}
                    onChangeText={setDeclaredValue}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />

                  {/* ── UPLOAD RECEIPT ─────────────────────────────────────────────── */}
                  <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
                    SHOPPING RECEIPT (OPTIONAL)
                  </Text>

                  {receiptUploaded ? (
                    <View style={styles.uploadButtonSuccess}>
                      <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                      <Text style={styles.uploadTextSuccess}>Receipt uploaded</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => { setReceiptUploaded(false); setReceiptPath(''); }}
                      >
                        <Text style={styles.uploadRemove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      activeOpacity={0.7}
                      onPress={handleUploadReceipt}
                    >
                      <PaperclipIcon />
                      <Text style={styles.uploadText}>Upload receipt (optional)</Text>
                    </TouchableOpacity>
                  )}

                  {/* ── SUBMIT ──────────────────────────────────────────────────────── */}
                  <TouchableOpacity
                    style={styles.addButton}
                    activeOpacity={0.85}
                    onPress={handleAdd}
                  >
                    <Text style={styles.addButtonText}>Add parcel</Text>
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
  handleBar: {
    width:           36,
    height:          4,
    backgroundColor: '#E2E0DA',
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    16,
  },
  title: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     17,
    color:        DS.textPrimary,
    marginBottom: 16,
  },

  sectionLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         DS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  8,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  removeButton: {
    width:          28,
    height:         28,
    alignItems:     'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   20,
    color:      DS.textMuted,
    lineHeight: 24,
  },
  addAnotherLink: {
    marginTop:    6,
    marginBottom: 2,
    alignSelf:    'flex-start',
  },
  addAnotherText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.accent,
  },

  input: {
    backgroundColor:   DS.bg,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      10,
    padding:           11,
    paddingHorizontal: 12,
    fontSize:          13,
    fontFamily:        'PlusJakartaSans_400Regular',
    color:             DS.textPrimary,
  },

  categoryRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      10,
    padding:           12,
    paddingHorizontal: 14,
  },
  categoryRowSelected: {
    borderColor:     DS.accent,
    backgroundColor: 'rgba(205,100,61,0.10)',
  },
  categoryRowLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  radio: {
    width:        14,
    height:       14,
    borderRadius: 7,
    borderWidth:  1.5,
    borderColor:  '#D4D2CC',
  },
  radioSelected: {
    borderColor:     DS.accent,
    backgroundColor: DS.accent,
  },

  sensitiveSectionLabel: {
    fontFamily:   'PlusJakartaSans_500Medium',
    fontSize:     13,
    color:        DS.textPrimary,
    marginTop:    12,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  chip: {
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      20,
    paddingVertical:   5,
    paddingHorizontal: 12,
    backgroundColor:   DS.card,
  },
  chipActive: {
    backgroundColor: 'rgba(205,100,61,0.10)',
    borderColor:     DS.accent,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  chipTextActive: {
    color: DS.accent,
  },

  uploadButton: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: DS.bg,
    borderWidth:     1,
    borderColor:     '#D4D2CC',
    borderStyle:     'dashed',
    borderRadius:    10,
    padding:         13,
  },
  uploadText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
  },
  uploadButtonSuccess: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: '#F0FDF4',
    borderWidth:     1,
    borderColor:     '#86EFAC',
    borderRadius:    10,
    padding:         13,
  },
  uploadTextSuccess: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      '#15803D',
    flex:       1,
  },
  uploadRemove: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },

  addButton: {
    backgroundColor: '#1A1712',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       20,
    marginBottom:    8,
  },
  addButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      '#FFFFFF',
  },
});
