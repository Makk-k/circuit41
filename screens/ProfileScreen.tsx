import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { TabScreenProps } from '../App';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { signOutFromGoogle } from '../lib/googleAuth';
import AddressBottomSheet from '../components/AddressBottomSheet';
import ProfileEditBottomSheet from '../components/ProfileEditBottomSheet';

type Props = TabScreenProps<'Profile'>;

type ProfileData = {
  first_name:      string | null;
  last_name:       string | null;
  preferred_name:  string | null;
  phone:           string | null;
  account_status?: string | null;
};

const DS = {
  bg:           '#F7F6F0',
  card:         '#FFFFFF',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  accent:       '#C10F1D',
  border:       '#E2E0DA',
  cardBorder:   '#D4D2CC',
} as const;

export default function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [profileData,        setProfileData]        = useState<ProfileData | null>(null);
  const [showAddressSheet,   setShowAddressSheet]   = useState(false);
  const [showEditSheet,      setShowEditSheet]      = useState(false);
  const [savedAddresses,     setSavedAddresses]     = useState<any[]>([]);
  const [cardCount,          setCardCount]          = useState(0);
  const [showDeleteModal,    setShowDeleteModal]    = useState(false);
  const [deleteConfirmText,  setDeleteConfirmText]  = useState('');
  const [deleting,           setDeleting]           = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('first_name, last_name, preferred_name, phone, account_status')
      .eq('id', user.id)
      .single()
      .then(async ({ data }) => {
        if (!data) return;
        // Belt-and-suspenders: AuthContext handles this on startup, but catches
        // the edge case where an account is deleted on another device mid-session.
        if ((data as any).account_status === 'deleted') {
          await signOutFromGoogle();
          await signOut();
          return;
        }
        setProfileData(data as ProfileData);
      });
  }, [user]);

  // Addresses: fetch once on mount.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => {
        if (data) setSavedAddresses(data);
      });
  }, [user]);

  // Card count: refresh on every focus.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      supabase
        .from('saved_cards')
        .select('id')
        .eq('user_id', user.id)
        .then(({ data: cards }) => {
          setCardCount(cards?.length || 0);
        });
    }, [user]),
  );

  if (!fontsLoaded) return null;

  const displayName = profileData
    ? (profileData.preferred_name || profileData.first_name || '') +
      (profileData.last_name ? ' ' + profileData.last_name : '')
    : '';

  const initials = profileData
    ? ((profileData.first_name?.[0] ?? '') + (profileData.last_name?.[0] ?? '')).toUpperCase()
    : '';

  const handleSignOut = async () => {
    await signOutFromGoogle();
    await signOut();
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account and remove your access to Circuit41. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setShowDeleteModal(true);
          },
        },
      ],
    );
  };

  const handleDeleteConfirmed = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Incorrect', 'Please type DELETE exactly to confirm.');
      return;
    }
    if (!user) return;

    setDeleting(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (sessionError || !accessToken) {
        Alert.alert('Could not delete account', 'Session expired. Please sign in again.');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey:         SUPABASE_ANON_KEY,
          Authorization:  `Bearer ${accessToken}`,
        },
      });

      let result: { success?: boolean; error?: string; message?: string } = {};
      try {
        result = await response.json();
      } catch {
        // non-JSON response — treat as generic failure
      }

      if (!response.ok || !result.success) {
        if (result.error === 'ACTIVE_SHIPMENTS_EXIST') {
          Alert.alert(
            'Account deletion unavailable',
            'You currently have active shipments. Please complete or cancel all active shipments before deleting your account.',
          );
        } else {
          Alert.alert(
            'Could not delete account',
            'Something went wrong. Please try again or contact support.',
          );
        }
        return;
      }

      // Account deleted server-side — clear local session and return to Welcome
      setShowDeleteModal(false);
      await signOutFromGoogle();
      await signOut();
      navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });

    } catch {
      Alert.alert('Could not delete account', 'Something went wrong. Please try again or contact support.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.root}>

      {/* ── Avatar + name ────────────────────────────────────────────────── */}
      <View style={[styles.avatarSection, { paddingTop: insets.top + 32 }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{displayName}</Text>
      </View>

      {/* ── Scrollable cards ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Personal Information */}
        <TouchableOpacity
          style={styles.sectionLabelRow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setShowEditSheet(true)}
        >
          <Text style={styles.sectionLabel}>Personal Information</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#A0A0A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#A0A0A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>First Name</Text>
            <Text style={profileData?.first_name ? styles.rowValue : [styles.rowValue, styles.rowValueMuted]}>
              {profileData?.first_name ?? 'Not set'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Last Name</Text>
            <Text style={profileData?.last_name ? styles.rowValue : [styles.rowValue, styles.rowValueMuted]}>
              {profileData?.last_name ?? 'Not set'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <View style={styles.rowRight}>
              {user?.email ? (
                <>
                  <Text style={styles.rowValue}>{user.email}</Text>
                  <View style={styles.badgeVerified}>
                    <Text style={styles.badgeVerifiedText}>Verified</Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.rowValue, styles.rowValueMuted]}>Not set</Text>
              )}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={profileData?.phone ? styles.rowValue : [styles.rowValue, styles.rowValueMuted]}>
              {profileData?.phone || 'Not set'}
            </Text>
          </View>
        </View>

        {/* Saved Addresses */}
        <TouchableOpacity
          style={styles.sectionLabelRow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setShowAddressSheet(true)}
        >
          <Text style={styles.sectionLabel}>Saved Addresses</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#A0A0A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#A0A0A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.card}>
          {savedAddresses.length === 0 ? (
            <View style={styles.row}>
              <Text style={[styles.rowValue, { color: '#A0A0A0', fontSize: 13 }]}>No saved addresses yet</Text>
            </View>
          ) : (
            savedAddresses.map((addr, idx) => (
              <React.Fragment key={addr.id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.rowValue}>{addr.label || 'Address'}</Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: DS.textSecondary, marginTop: 2 }}>
                      {addr.address_line}
                    </Text>
                  </View>
                  {addr.is_default && (
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultPillText}>Default</Text>
                    </View>
                  )}
                </View>
              </React.Fragment>
            ))
          )}
        </View>

        {/* Payment Methods */}
        <TouchableOpacity
          style={styles.sectionLabelRow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.navigate('SavedCards')}
        >
          <Text style={styles.sectionLabel}>Payment Methods</Text>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#A0A0A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#A0A0A0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={[styles.rowValue, { fontSize: 13, color: DS.textSecondary }]}>
              {cardCount > 0
                ? cardCount + ' card' + (cardCount > 1 ? 's' : '') + ' saved'
                : 'No cards saved'}
            </Text>
          </View>
        </View>

        {/* Sign out + Help */}
        <View style={[styles.card, { marginTop: 24 }]}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => navigation.navigate('Feedback')}>
            <Text style={styles.rowLabel}>Help improve the app</Text>
            <Ionicons name="chevron-forward" size={16} color={DS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Delete account — visually separated, low prominence */}
        <View style={[styles.card, styles.deleteCard]}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            <Text style={styles.deleteText}>Delete account</Text>
          </TouchableOpacity>
        </View>

        {/* Legal links */}
        <View style={styles.legalRow}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('TermsOfService')}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </TouchableOpacity>
          <View style={styles.legalDot} />
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('PrivacyPolicy')}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Edit profile sheet ───────────────────────────────────────────── */}
      <ProfileEditBottomSheet
        visible={showEditSheet}
        onClose={() => setShowEditSheet(false)}
        userId={user?.id ?? ''}
        initialFirstName={profileData?.first_name ?? ''}
        initialLastName={profileData?.last_name ?? ''}
        initialPhone={profileData?.phone ?? ''}
        onSaved={(updated) => {
          setProfileData(prev => prev
            ? { ...prev, first_name: updated.first_name, last_name: updated.last_name, phone: updated.phone }
            : prev,
          );
        }}
      />

      {/* ── Delete account confirmation modal ───────────────────────────── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!deleting) setShowDeleteModal(false); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm deletion</Text>
            <Text style={styles.modalBody}>
              Type <Text style={styles.modalCode}>DELETE</Text> below to permanently delete your account.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="DELETE"
              placeholderTextColor="#C0BDBB"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                activeOpacity={0.7}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  deleteConfirmText !== 'DELETE' && styles.modalConfirmDisabled,
                ]}
                activeOpacity={0.8}
                onPress={handleDeleteConfirmed}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
              >
                {deleting
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.modalConfirmText}>Delete account</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Saved addresses sheet ────────────────────────────────────────── */}
      <AddressBottomSheet
        visible={showAddressSheet}
        onClose={() => setShowAddressSheet(false)}
        savedAddresses={savedAddresses}
        onConfirm={() => setShowAddressSheet(false)}
        userId={user?.id}
        onAddressesChanged={setSavedAddresses}
        onSaveNewAddress={async (address: string) => {
          if (!user) return;
          const label = savedAddresses.length === 0 ? 'Home' : 'Address';
          const { data } = await supabase
            .from('saved_addresses')
            .insert({
              user_id:      user.id,
              label,
              address_line: address,
              is_default:   savedAddresses.length === 0,
            })
            .select()
            .single();
          if (data) setSavedAddresses(prev => [...prev, data]);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.bg, flexDirection: 'column' },

  // Avatar
  avatarSection: {
    alignItems:        'center',
    paddingBottom:     24,
    paddingHorizontal: 20,
  },
  avatarCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: '#ECEAE4',
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarInitials: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   22,
    color:      DS.textSecondary,
  },
  userName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   18,
    color:      DS.textPrimary,
    marginTop:  12,
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 20 }, // paddingBottom set dynamically (80 + insets.bottom + 16)

  // Section label
  sectionLabelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      20,
    marginBottom:   8,
  },
  sectionLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      11,
    color:         DS.textSecondary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },

  // Card
  card: {
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    16,
    overflow:        'hidden',
  },

  // Row inside card
  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  rowLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   14,
    color:      DS.textSecondary,
  },
  rowValue: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  rowValueMuted: {
    color: DS.textSecondary,
  },

  // Divider
  divider: {
    height:           1,
    backgroundColor:  DS.border,
    marginHorizontal: 16,
  },

  // Badges
  badgeVerified: {
    backgroundColor:   '#DCFCE7',
    borderRadius:      20,
    paddingVertical:   2,
    paddingHorizontal: 8,
  },
  badgeVerifiedText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   11,
    color:      '#15803D',
  },
  // Default address pill
  defaultPill: {
    backgroundColor:   '#F0EEE8',
    borderRadius:      10,
    paddingVertical:   3,
    paddingHorizontal: 8,
  },
  defaultPillText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   10,
    color:      '#6B6B6B',
  },

  // Sign out
  signOutText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   14,
    color:      DS.accent,
  },

  // Delete account card — separated with extra top margin and muted border
  deleteCard: {
    marginTop:   12,
    marginBottom: 8,
    borderColor: '#EAD8D8',
  },
  deleteText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   14,
    color:      DS.accent,
    opacity:    0.75,
  },

  // Legal links
  legalRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            8,
    marginTop:      16,
    marginBottom:   8,
  },
  legalLink: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      '#A0A0A0',
  },
  legalDot: {
    width:           3,
    height:          3,
    borderRadius:    1.5,
    backgroundColor: '#C0BDBB',
  },

  // Delete confirmation modal
  modalOverlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: DS.card,
    borderRadius:    20,
    padding:         24,
    width:           '100%',
  },
  modalTitle: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     17,
    color:        DS.textPrimary,
    marginBottom: 10,
  },
  modalBody: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     14,
    color:        DS.textSecondary,
    lineHeight:   20,
    marginBottom: 16,
  },
  modalCode: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color:      DS.textPrimary,
  },
  modalInput: {
    backgroundColor:   DS.bg,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      10,
    paddingVertical:   12,
    paddingHorizontal: 14,
    fontFamily:        'PlusJakartaSans_500Medium',
    fontSize:          15,
    color:             DS.textPrimary,
    marginBottom:      20,
    letterSpacing:     1.5,
  },
  modalButtons: {
    flexDirection: 'row',
    gap:           10,
  },
  modalCancel: {
    flex:            1,
    backgroundColor: '#F0EEE8',
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
  },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   14,
    color:      DS.textSecondary,
  },
  modalConfirm: {
    flex:            1,
    backgroundColor: DS.accent,
    borderRadius:    12,
    paddingVertical: 13,
    alignItems:      'center',
  },
  modalConfirmDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
});
