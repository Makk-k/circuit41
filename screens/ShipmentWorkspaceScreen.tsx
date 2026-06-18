import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  Modal,
  BackHandler,
  LayoutAnimation,
  Alert,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path, Rect, Polyline, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import AddItemBottomSheet, { NewItem } from '../components/AddItemBottomSheet';
import StaticTabBar from '../components/StaticTabBar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { shadow as SH } from '../lib/theme';
import type { Parcel } from '../lib/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShipmentWorkspace'>;

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shipmentRef(id: string): string {
  return '#' + id.substring(0, 8).toUpperCase();
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function generateRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'REF-';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ─── Clipboard icon SVG ───────────────────────────────────────────────────────
const ClipboardIcon: React.FC = () => (
  <Svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <Path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" />
    <Rect x="8" y="2" width="8" height="4" rx="1" stroke="#1A1A1A" strokeWidth="1.8" />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ShipmentWorkspaceScreen({ navigation, route }: Props) {
  const { slot, origin, destination, shipmentId: paramShipmentId, source: entrySource = 'creation' } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [parcels,          setParcels]          = useState<Parcel[]>([]);
  const [shipmentId,       setShipmentId]        = useState<string | null>(paramShipmentId ?? null);
  const [createdAt,        setCreatedAt]         = useState<string | null>(null);
  const [slotRate,         setSlotRate]          = useState<number | null>(slot?.general_rate ?? null);
  const [routeOrigin,      setRouteOrigin]       = useState<string | null>(origin ?? null);
  const [routeDestination, setRouteDestination]  = useState<string | null>(destination ?? null);
  const [warehouseAddress, setWarehouseAddress]  = useState<string>(
    slot?.warehouse_address ?? 'Fetching address…',
  );
  const [creating,         setCreating]          = useState(false);

  const [sheetVisible,    setSheetVisible]   = useState(false);
  const [copyLabel,       setCopyLabel]      = useState('Copy address');
  const [selectedParcel,  setSelectedParcel] = useState<Parcel | null>(null);

  const activeParcels = parcels.filter(p => p.status !== 'cancelled');
  const hasActiveItems = activeParcels.length > 0;

  const handleBack = useCallback(() => {
    const goToSource = () => {
      if (entrySource === 'shipments') {
        navigation.navigate('MainTabs', { screen: 'Shipments' });
      } else {
        navigation.navigate('MainTabs', { screen: 'Home' });
      }
    };
    if (hasActiveItems) {
      // At least one active parcel — never go back to slot/route selection
      goToSource();
    } else if (entrySource === 'creation') {
      // Still in creation flow with no active parcels — allow backward navigation
      navigation.goBack();
    } else {
      // Re-opened from Home or Shipments tab, no active parcels — return to source
      goToSource();
    }
  }, [navigation, hasActiveItems, entrySource]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => sub.remove();
    }, [handleBack]),
  );

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // ── On mount: create new shipment OR load existing ────────────────────────
  useEffect(() => {
    if (paramShipmentId) {
      loadExistingShipment(paramShipmentId);
    } else if (slot && origin && destination && user) {
      createNewShipment();
    }
  }, []);

  const createNewShipment = async () => {
    if (!user || !slot) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('shipments')
        .insert({
          user_id:             user.id,
          status:              'in_progress',
          slot_name:           slot.name,
          slot_tag:            slot.tag,
          slot_rate:           slot.general_rate,
          shipping_rate_id:    slot.id,
          rate_currency:       slot.currency ?? 'USD',
          origin_country:      origin,
          destination_country: destination,
          warehouse_address:   slot.warehouse_address || null,
        })
        .select()
        .single();

      if (error) { Alert.alert('Error', error.message); return; }
      if (data) {
        setShipmentId(data.id);
        setCreatedAt(data.created_at);
        setRouteOrigin(data.origin_country ?? origin ?? null);
        setRouteDestination(data.destination_country ?? destination ?? null);
      }
    } finally {
      setCreating(false);
    }
  };

  const loadExistingShipment = async (id: string) => {
    try {
      const { data: shipment, error } = await supabase
        .from('shipments')
        .select('*, parcels(*)')
        .eq('id', id)
        .single();

      if (error) { Alert.alert('Error', error.message); return; }
      if (shipment) {
        setCreatedAt(shipment.created_at);
        setSlotRate(shipment.slot_rate ?? null);
        setRouteOrigin(shipment.origin_country ?? null);
        setRouteDestination(shipment.destination_country ?? null);
        setParcels((shipment.parcels ?? []) as Parcel[]);
        setWarehouseAddress(shipment.warehouse_address || 'Address not available');
      }
    } catch {
      Alert.alert('Error', 'Failed to load shipment');
    }
  };

  const fetchParcels = useCallback(async () => {
    if (!shipmentId) return;
    const { data, error } = await supabase
      .from('parcels')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: true });
    if (error) { Alert.alert('Error', error.message); return; }
    if (data) setParcels(data as Parcel[]);
  }, [shipmentId]);

  useFocusEffect(
    useCallback(() => {
      if (shipmentId) fetchParcels();
    }, [shipmentId, fetchParcels]),
  );

  const handleCancelShipment = async () => {
    if (parcels.some(p => p.status === 'arrived')) {
      Alert.alert(
        'Shipment already in handling',
        'This shipment has parcels that have already arrived. Please contact support if you need to cancel or return it.',
      );
      return;
    }
    try {
      if (shipmentId) {
        await supabase
          .from('shipments')
          .update({ is_visible: false })
          .eq('id', shipmentId);
      }
      navigation.navigate('MainTabs');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleCancelParcel = (parcelId: string) => {
    Alert.alert(
      'Cancel Parcel',
      'Are you sure you want to cancel this parcel?',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Parcel',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('parcels')
              .update({ status: 'cancelled' })
              .eq('id', parcelId);
            if (error) { Alert.alert('Error', error.message); return; }
            setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: 'cancelled' } : p));
          },
        },
      ],
    );
  };

  if (!fontsLoaded) return null;

  // ── Copy address ──────────────────────────────────────────────────────────
  const handleCopyAddress = async () => {
    await Clipboard.setStringAsync(warehouseAddress);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy address'), 1500);
  };

  // ── Add parcel — save to DB ───────────────────────────────────────────────
  const handleAddItem = async (newItem: NewItem) => {
    if (!shipmentId || !user) {
      Alert.alert('Not ready', 'Shipment is still being created, please try again.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('parcels')
        .insert({
          shipment_id:    shipmentId,
          user_id:        user.id,
          item_names:     newItem.itemNames,
          tracking_id:    newItem.trackingId || null,
          reference_id:   newItem.trackingId ? null : generateRef(),
          declared_value: newItem.declaredValue ? parseFloat(newItem.declaredValue) : null,
          category:       newItem.category,
          sensitive_types: newItem.sensitiveTypes,
          has_receipt:    newItem.hasReceipt,
          receipt_path:   newItem.receiptPath || null,
          status:         'in_transit',
        })
        .select()
        .single();

      if (error) { Alert.alert('Error', error.message); return; }
      if (data) {
        setParcels(prev => [...prev, data as Parcel]);
        fetchParcels();
      }
    } catch {
      Alert.alert('Error', 'Failed to add parcel');
    }
  };

  const displayRef  = shipmentId ? shipmentRef(shipmentId) : '#…';
  const startedDate = createdAt ? formatDate(createdAt) : '—';
  const rateDisplay = slotRate != null ? `£${slotRate}/kg` : '—';
  const routeDisplay = [routeOrigin, routeDestination].filter(Boolean).join(' → ');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {hasActiveItems ? (
          /* Shipment with parcels — original back control (unchanged behaviour) */
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        ) : (
          /* Empty newly-created shipment — clear "‹ Shipments" fallback so the
             user is never trapped. Always routes to the Shipments tab. */
          <TouchableOpacity
            onPress={() => navigation.navigate('MainTabs', { screen: 'Shipments' })}
            activeOpacity={0.7}
            style={styles.backToShipments}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.backToShipmentsText}>Shipments</Text>
          </TouchableOpacity>
        )}

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Shipment {displayRef}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>In progress</Text>
          </View>
          {shipmentId && (
            <TouchableOpacity
              style={styles.helpBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => navigation.navigate('ShipmentSupport', { shipmentId })}
            >
              <Ionicons name="help-circle-outline" size={26} color="#CD643D" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerSub}>
          {creating ? 'Creating shipment…' : `Started ${startedDate} · ${rateDisplay} slot`}
        </Text>
        {routeDisplay ? (
          <Text style={styles.headerRoute}>{routeDisplay}</Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 150 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── BLOCK 1: Drop-off Address ───────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>DROP-OFF ADDRESS</Text>

        <View style={styles.warehouseCard}>
          <Text style={styles.warehouseText}>{warehouseAddress}</Text>
          <Text style={styles.warehouseNote}>Send your items to this address</Text>
          <TouchableOpacity style={styles.copyButton} activeOpacity={0.7} onPress={handleCopyAddress}>
            <ClipboardIcon />
            <Text style={styles.copyButtonText}>{copyLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* ── BLOCK 2: Parcels ────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
          PARCELS ({activeParcels.length})
        </Text>

        {creating && (
          <ActivityIndicator color={DS.accent} style={{ marginBottom: 12 }} />
        )}

        {/* Total weight summary */}
        {activeParcels.length > 0 && (() => {
          const totalWeight = activeParcels.reduce((sum, p) => {
            const w = parseFloat(String(p.weight ?? ''));
            return sum + (isNaN(w) ? 0 : w);
          }, 0);
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
              <Text style={{ fontSize: 12, color: '#6B6B6B' }}>
                Total weight: {totalWeight > 0 ? totalWeight + ' kg' : 'Pending weighing'}
              </Text>
              <TouchableOpacity onPress={() => Alert.alert(
                'Total Weight',
                'This shows the combined weight of all arrived parcels as measured at our warehouse. Final shipping cost is calculated based on this weight.',
              )}>
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Circle cx="12" cy="12" r="10" stroke="#A0A0A0" strokeWidth="2" fill="none" />
                  <Path d="M12 16v-4M12 8h.01" stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          );
        })()}

        {activeParcels.map(item => (
          <View key={item.id}>
            <ParcelCard item={item} onShowQR={setSelectedParcel} onCancelParcel={handleCancelParcel} />
          </View>
        ))}

        {/* Add parcel dashed button */}
        <TouchableOpacity
          style={styles.addItemButton}
          activeOpacity={0.7}
          onPress={() => setSheetVisible(true)}
        >
          <Text style={styles.addItemText}>+ Add parcel</Text>
        </TouchableOpacity>

        {/* ── READY TO SHIP ─────────────────────────────────────────── */}
        <View style={styles.readySection}>
          <TouchableOpacity
            style={[styles.readyButton, !hasActiveItems && styles.readyButtonDisabled]}
            activeOpacity={hasActiveItems ? 0.85 : 1}
            disabled={!hasActiveItems}
            onPress={() => {
              if (!shipmentId) { Alert.alert('Not ready', 'Shipment is still being created.'); return; }
              const hasUnArrived = activeParcels.some(p => p.status !== 'arrived');
              if (hasUnArrived) {
                Alert.alert(
                  'Parcels still in transit',
                  'All parcels must be marked as arrived before you can proceed to checkout.',
                );
                return;
              }
              navigation.navigate('ShipmentCheckout', { shipmentId });
            }}
          >
            <Text style={[styles.readyButtonText, !hasActiveItems && styles.readyButtonTextDisabled]}>Ready to ship →</Text>
          </TouchableOpacity>
          <Text style={styles.readyNote}>
            All items arrived? Proceed to delivery and payment
          </Text>
        </View>

      </ScrollView>

      {/* ── CANCEL SHIPMENT — sits just above the bottom nav, only when no active parcels ── */}
      {!hasActiveItems && (
        <TouchableOpacity
          style={[styles.cancelShipmentBtn, { bottom: 96 + insets.bottom }]}
          activeOpacity={0.7}
          onPress={handleCancelShipment}
        >
          <Text style={styles.cancelShipmentText}>Cancel shipment</Text>
        </TouchableOpacity>
      )}

      {/* ── BOTTOM NAVIGATION — keep the user oriented; never trapped here ── */}
      <StaticTabBar navigation={navigation} activeKey="Shipments" />

      {/* ── Add Item Bottom Sheet ────────────────────────────────────── */}
      <AddItemBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onAdd={handleAddItem}
      />

      {/* ── Parcel QR Modal ──────────────────────────────────────────── */}
      <ParcelQRModal
        parcel={selectedParcel}
        onClose={() => setSelectedParcel(null)}
      />
    </SafeAreaView>
  );
}

// ─── Parcel QR Modal ──────────────────────────────────────────────────────────
type QRModalProps = {
  parcel:  Parcel | null;
  onClose: () => void;
};

const ParcelQRModal: React.FC<QRModalProps> = ({ parcel, onClose }) => {
  const [copyLabel, setCopyLabel] = useState('Copy reference');

  const displayRef = parcel ? (parcel.tracking_id ?? parcel.reference_id ?? '') : '';
  const displayName = parcel ? (parcel.item_names.join(', ') || 'Parcel') : '';

  const handleCopy = async () => {
    if (!parcel) return;
    await Clipboard.setStringAsync(displayRef);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy reference'), 1500);
  };

  return (
    <Modal visible={parcel !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={qrStyles.overlay}>
        <View style={qrStyles.sheet}>
          <View style={qrStyles.handle} />
          <TouchableOpacity style={qrStyles.closeBtn} activeOpacity={0.7} onPress={onClose}>
            <Svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={qrStyles.parcelName}>{displayName}</Text>
          <Text style={qrStyles.parcelRef}>{displayRef}</Text>
          <View style={qrStyles.qrWrap}>
            {parcel && displayRef ? (
              <QRCode value={displayRef} size={180} color="#1A1A1A" backgroundColor="white" />
            ) : null}
          </View>
          <Text style={qrStyles.refCode}>{displayRef}</Text>
          <TouchableOpacity style={qrStyles.copyBtn} activeOpacity={0.7} onPress={handleCopy}>
            <Text style={qrStyles.copyBtnText}>{copyLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const qrStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingHorizontal: 20, paddingBottom: 48, alignItems: 'center', position: 'relative',
  },
  handle:    { width: 36, height: 4, backgroundColor: '#E2E0DA', borderRadius: 2, marginBottom: 16 },
  closeBtn:  {
    position: 'absolute', top: 16, right: 20, width: 28, height: 28,
    borderRadius: 14, backgroundColor: '#F0EEE8', alignItems: 'center', justifyContent: 'center',
  },
  parcelName: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: '#1A1A1A', textAlign: 'center', marginBottom: 4,
  },
  parcelRef: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#6B6B6B', textAlign: 'center', marginBottom: 24,
  },
  qrWrap:    { alignItems: 'center', justifyContent: 'center', marginBottom: 0 },
  refCode:   {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#1A1A1A', letterSpacing: 2,
    textAlign: 'center', marginTop: 16,
  },
  copyBtn:   {
    width: '100%', borderWidth: 1, borderColor: '#E2E0DA', borderRadius: 10, paddingVertical: 13,
    alignItems: 'center', marginTop: 12,
  },
  copyBtnText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#1A1A1A' },
});

// ─── ParcelCard ───────────────────────────────────────────────────────────────

type ParcelCardProps = { item: Parcel; onShowQR: (item: Parcel) => void; onCancelParcel: (id: string) => void };

const ParcelCard: React.FC<ParcelCardProps> = ({ item, onShowQR, onCancelParcel }) => {
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const displayName   = item.item_names.join(', ') || 'New parcel';
  const displayRef    = item.tracking_id ?? item.reference_id ?? '';
  const statusLabel: Record<string, string> = {
    in_transit:   'In Transit',
    arrived:      'Arrived',
    held:         'Held',
    returned:     'Returned',
    cancelled:    'Cancelled',
  };
  const statusColors: Record<string, { bg: string; text: string }> = {
    in_transit:  { bg: '#DBEAFE', text: '#1E40AF' },
    arrived:     { bg: '#DCFCE7', text: '#15803D' },
    held:        { bg: '#FEF3C7', text: '#92400E' },
    returned:    { bg: '#FEE2E2', text: '#991B1B' },
    cancelled:   { bg: '#F0EEE8', text: '#6B6B6B' },
  };
  const displayStatus = statusLabel[item.status] ?? item.status;
  const tags          = item.category === 'general' ? ['General Goods'] : item.sensitive_types;
  const statusStyle   = statusColors[item.status] ?? { bg: '#F0EEE8', text: '#6B6B6B' };

  const togglePhotos = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhotosExpanded(prev => !prev);
  };

  return (
    <View style={itemStyles.card}>
      {/* Top row: name + status badge */}
      <View style={itemStyles.row}>
        <Text style={itemStyles.itemName} numberOfLines={1}>{displayName}</Text>
        <View style={[itemStyles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[itemStyles.statusText, { color: statusStyle.text }]}>{displayStatus}</Text>
        </View>
      </View>

      {/* Tracking / reference ID */}
      <TouchableOpacity onPress={() => onShowQR(item)}>
        <Text style={{ fontSize: 12, color: '#CD643D', fontWeight: '500', textDecorationLine: 'underline', marginTop: 4 }}>
          {displayRef}
        </Text>
      </TouchableOpacity>
      {item.weight != null && (
        <Text style={{ fontSize: 11, color: '#6B6B6B', marginTop: 2 }}>
          {item.weight} kg
        </Text>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <View style={itemStyles.tagsRow}>
          {tags.map(tag => (
            <View key={tag} style={itemStyles.tag}>
              <Text style={itemStyles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Divider above photo toggle */}
      <View style={itemStyles.photoDivider} />

      {/* Photo collapse toggle row */}
      <TouchableOpacity style={itemStyles.photoToggleRow} activeOpacity={0.7} onPress={togglePhotos}>
        <Text style={itemStyles.photoToggleLabel}>Photos</Text>
        <Svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <Polyline
            points={photosExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}
            stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>

      {/* Expanded photo section */}
      {photosExpanded && (
        <View style={itemStyles.photoSection}>
          {item.photos && item.photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={itemStyles.photoScrollContent}>
              {item.photos.map((url, i) => (
                <Pressable key={i} onPress={() => setViewerUrl(url)}>
                  <Image
                    source={{ uri: url }}
                    style={itemStyles.photoThumb}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={itemStyles.noPhotosText}>No photos yet</Text>
          )}
        </View>
      )}

      {/* Full-screen photo viewer */}
      <Modal
        visible={viewerUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}
      >
        <View style={itemStyles.viewerOverlay}>
          <TouchableOpacity
            style={itemStyles.viewerClose}
            activeOpacity={0.7}
            onPress={() => setViewerUrl(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={itemStyles.viewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewerUrl && (
            <Image
              source={{ uri: viewerUrl }}
              style={itemStyles.viewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Cancel parcel — only before arrival */}
      {item.status !== 'arrived' && item.status !== 'cancelled' && (
        <TouchableOpacity
          style={itemStyles.cancelParcelBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => onCancelParcel(item.id)}
        >
          <Text style={itemStyles.cancelParcelText}>Cancel parcel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const itemStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E0DA',
    borderRadius: 14, padding: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#1A1A1A', flex: 1, marginRight: 8,
  },
  statusBadge: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 },
  statusText:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10 },
  trackingId:  { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#A0A0A0', marginTop: 4 },
  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag:         { backgroundColor: '#F0EEE8', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
  tagText:     { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: '#6B6B6B' },
  photoDivider:     { height: 1, backgroundColor: '#F0EEE8', marginTop: 10 },
  photoToggleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  photoToggleLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#A0A0A0' },
  photoSection:     { marginTop: 10 },
  photoScrollContent: { paddingRight: 4 },
  photoThumb: {
    width: 56, height: 56, borderRadius: 10, backgroundColor: '#ECEAE4',
    marginRight: 8, overflow: 'hidden',
  },
  noPhotosText:    { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#A0A0A0', fontStyle: 'italic' },
  cancelParcelBtn:  { marginTop: 10, alignSelf: 'flex-start' },
  cancelParcelText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#DC2626' },
  // Full-screen photo viewer modal
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  viewerCloseText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  viewerImage: { width: '92%', height: '72%', borderRadius: 8 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DS.bg },

  // Header
  header:         { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  backButton:     {
    marginBottom:    12,
    alignSelf:       'flex-start',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
    padding:         8,
  },
  backLabelMuted: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: DS.textSecondary },
  backToShipments: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
    alignSelf:     'flex-start',
    marginBottom:  12,
    marginLeft:    -4,
    paddingVertical: 2,
    paddingRight:  8,
  },
  backToShipmentsText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   15,
    color:      DS.textPrimary,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  helpBtn:        { marginLeft: 'auto', padding: 2 },
  headerTitle:    { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 20, color: DS.textPrimary },
  statusPill: {
    backgroundColor: '#FEF3C7', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10,
  },
  statusPillText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#B45309' },
  headerSub:      { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: DS.textSecondary, marginTop: 4 },
  headerRoute:    { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: DS.textPrimary, marginTop: 8 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },

  // Section label
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: DS.textMuted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },

  // Warehouse card — solid dark premium card (important, copyable, not loud). No border, no blue.
  warehouseCard: {
    backgroundColor: '#1A1712', borderRadius: 18, padding: 18, ...SH.dark,
  },
  warehouseText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#FFFFFF', lineHeight: 22,
  },
  warehouseNote: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11.5, color: 'rgba(255,255,255,0.62)', marginTop: 6,
  },
  copyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start', marginTop: 14,
  },
  copyButtonText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: '#1A1712' },

  // Add item dashed button
  addItemButton: {
    borderWidth: 1.5, borderColor: '#D4D2CC', borderStyle: 'dashed',
    borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 24,
  },
  addItemText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: DS.accent },

  // Ready to ship
  readySection:    { alignItems: 'center' },
  readyButton:     {
    backgroundColor: '#1A1712', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center',
  },
  readyButtonText:         { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#FFFFFF' },
  readyButtonDisabled:     { backgroundColor: '#E2E0DA' },
  readyButtonTextDisabled: { color: '#A0A0A0' },
  readyNote:       {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: DS.textMuted, textAlign: 'center', marginTop: 8,
  },

  // Cancel shipment
  cancelShipmentBtn: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelShipmentText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#DC2626', textAlign: 'center' },

  backWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backLabelAccent: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: DS.accent },
});
