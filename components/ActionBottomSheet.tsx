import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { pickImageFromLibrary } from '../lib/imagePicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export type ActionType = 'address' | 'confirm' | 'document' | 'default';

type Props = {
  visible:           boolean;
  onClose:           () => void;
  onSubmit?:         () => void;
  actionTitle:       string;
  actionDescription: string;
  actionType:        ActionType;
  shipmentContext?:  string;
  actionId?:         string;
  shipmentId?:       string;
};

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:           '#F7F6F0',
  card:         '#FFFFFF',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  accent:       '#C10F1D',
  border:       '#E2E0DA',
} as const;

// ─── Animation constants ──────────────────────────────────────────────────────
const SLIDE_CLOSED   = 700;
const SHEET_MAX_HEIGHT = Dimensions.get('window').height * 0.92;

export default function ActionBottomSheet({
  visible,
  onClose,
  onSubmit,
  actionTitle,
  actionDescription,
  actionType,
  shipmentContext,
  actionId,
  shipmentId: shipmentIdProp,
}: Props) {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [submittedValue, setSubmittedValue] = useState('');
  const [confirmed,      setConfirmed]      = useState(false);
  const [docUploaded,    setDocUploaded]    = useState(false);
  const [docFileName,    setDocFileName]    = useState('');
  const [uploading,      setUploading]      = useState(false);

  // ─── Animation state ────────────────────────────────────────────────────────
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

  const sanitizeFileName = (name: string): string =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').toLowerCase();

  const uploadDocFile = async (uri: string, mimeType: string, fileName: string) => {
    if (!user || !shipmentIdProp) return;
    setUploading(true);
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File not found at: ' + uri);

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) throw new Error('Could not read file');

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const safeFileName = sanitizeFileName(fileName);
      const filePath = user.id + '/' + shipmentIdProp + '/' + Date.now() + '_' + safeFileName;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, bytes, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;
      await supabase.from('documents').insert({
        shipment_id: shipmentIdProp,
        user_id:     user.id,
        name:        safeFileName,
        file_path:   filePath,
        file_type:   mimeType,
        uploaded_by: 'user',
      });
      setDocUploaded(true);
      setDocFileName(safeFileName);
      setSubmittedValue(safeFileName);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const handleDocUpload = () => {
    Alert.alert('Upload Document', 'Choose what to upload', [
      {
        text: 'Photo / Image',
        onPress: async () => {
          const image = await pickImageFromLibrary();
          if (image) {
            await uploadDocFile(image.uri, image.mimeType, image.fileName);
          }
        },
      },
      {
        text: 'PDF / Document',
        onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({
              type: ['application/pdf', '*/*'],
              copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              const asset = result.assets[0];
              await uploadDocFile(
                asset.uri,
                asset.mimeType || 'application/octet-stream',
                asset.name || 'document-' + Date.now(),
              );
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (actionType === 'document' && !docUploaded) {
      Alert.alert('Required', 'Please upload a document before submitting');
      return;
    }
    try {
      if (actionId) {
        const value = actionType === 'confirm' ? (confirmed ? 'yes' : 'no') : submittedValue;
        await supabase
          .from('actions')
          .update({ status: 'submitted', submitted_value: value })
          .eq('id', actionId);
      }
      if (actionType === 'address' && submittedValue && shipmentIdProp) {
        await supabase
          .from('shipments')
          .update({ delivery_address: submittedValue })
          .eq('id', shipmentIdProp);
      }
      onSubmit?.();
      dismiss();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  // ─── Dynamic input area — switches based on actionType prop ───────────────
  const renderInput = () => {
    switch (actionType) {
      case 'address':
        return (
          <TextInput
            style={styles.textInput}
            placeholder="Enter delivery address"
            placeholderTextColor="#A0A0A0"
            multiline
            textAlignVertical="top"
            value={submittedValue}
            onChangeText={setSubmittedValue}
          />
        );

      case 'confirm':
        return (
          <View>
            <Text style={styles.confirmDesc}>
              Please review your shipment details and confirm everything is correct.
            </Text>
            <TouchableOpacity
              style={styles.confirmToggleRow}
              activeOpacity={0.8}
              onPress={() => setConfirmed(prev => !prev)}
            >
              <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                {confirmed && <Text style={styles.checkboxTick}>✓</Text>}
              </View>
              <Text style={styles.confirmToggleLabel}>I confirm the details are correct</Text>
            </TouchableOpacity>
          </View>
        );

      case 'document':
        return docUploaded ? (
          <View style={styles.uploadSuccessRow}>
            <Text style={styles.uploadSuccessText}>{docFileName}</Text>
            <TouchableOpacity onPress={() => { setDocUploaded(false); setDocFileName(''); }}>
              <Text style={styles.uploadRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleDocUpload}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator size="small" color="#1A1A1A" />
              : <Text style={styles.uploadBtnText}>Upload Document</Text>
            }
          </TouchableOpacity>
        );

      default:
        return (
          <TextInput
            style={styles.textInput}
            placeholder="Enter details"
            placeholderTextColor="#A0A0A0"
            value={submittedValue}
            onChangeText={setSubmittedValue}
          />
        );
    }
  };

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
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 12,
                paddingHorizontal: 20,
                paddingBottom: insets.bottom + 24,
                maxHeight: SHEET_MAX_HEIGHT,
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
                    <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#C10F1D' }}>Done</Text>
                  </TouchableOpacity>
                )}

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  contentContainerStyle={{ paddingBottom: keyboardHeight }}
                >
                  {/* Top row: title + X close button */}
                  <View style={styles.topRow}>
                    <Text style={styles.title}>{actionTitle}</Text>
                    <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={dismiss}>
                      <Text style={styles.closeBtnText}>×</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Explanation text */}
                  <Text style={styles.description}>{actionDescription}</Text>

                  {/* Dynamic input area */}
                  {renderInput()}

                  {/* Shipment context block */}
                  <View style={styles.contextDivider} />
                  <Text style={styles.contextLine}>
                    {shipmentContext ?? 'Shipment context unavailable'}
                  </Text>
                  {shipmentIdProp && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={{ marginTop: 6 }}
                      onPress={() => {
                        dismiss();
                        navigation.navigate('ShipmentDetail', { shipmentId: shipmentIdProp });
                      }}
                    >
                      <Text style={styles.viewShipmentLink}>View Shipment →</Text>
                    </TouchableOpacity>
                  )}

                  {/* Primary action button */}
                  <TouchableOpacity
                    style={styles.submitBtn}
                    activeOpacity={0.85}
                    onPress={handleSubmit}
                  >
                    <Text style={styles.submitBtnText}>Submit</Text>
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

  // Top row
  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  title: {
    fontFamily:  'PlusJakartaSans_700Bold',
    fontSize:    18,
    color:       DS.textPrimary,
    flex:        1,
    marginRight: 12,
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

  // Explanation
  description: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     13,
    color:        DS.textSecondary,
    marginTop:    8,
    marginBottom: 20,
  },

  // Address / default text input
  textInput: {
    backgroundColor: DS.bg,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    12,
    padding:         14,
    fontFamily:      'PlusJakartaSans_400Regular',
    fontSize:        14,
    color:           DS.textPrimary,
    minHeight:       80,
  },

  // Confirm action type
  confirmDesc: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     13,
    color:        DS.textSecondary,
    lineHeight:   20,
    marginBottom: 16,
  },
  confirmToggleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  checkbox: {
    width:          22,
    height:         22,
    borderRadius:   4,
    borderWidth:    1.5,
    borderColor:    DS.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: DS.accent,
    borderColor:     DS.accent,
  },
  checkboxTick: {
    color:    '#FFFFFF',
    fontSize: 13,
  },
  confirmToggleLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      DS.textPrimary,
    flex:       1,
  },

  // Document upload button
  uploadBtn: {
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    10,
    paddingVertical: 14,
    alignItems:      'center',
  },
  uploadBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  uploadSuccessRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth:    1,
    borderColor:    '#86EFAC',
    borderRadius:   10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  uploadSuccessText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      '#15803D',
    flex:       1,
    marginRight: 8,
  },
  uploadRemove: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },

  // Shipment context
  contextDivider: {
    height:          1,
    backgroundColor: DS.border,
    marginTop:       20,
    marginBottom:    14,
  },
  contextLine: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  viewShipmentLink: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   13,
    color:      DS.accent,
  },

  // Primary submit button
  submitBtn: {
    backgroundColor: DS.accent,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       20,
  },
  submitBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
});
