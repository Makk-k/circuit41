import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TabScreenProps } from '../App';
import { supabase } from '../lib/supabase';
import { navigateToShipment } from '../lib/navigationHelper';
import { useAuth } from '../context/AuthContext';
import { shadow as SH } from '../lib/theme';
import type { Shipment } from '../lib/database.types';

type Props = TabScreenProps<'Shipments'>;
type Tab = 'Active' | 'Completed';

// ─── Design tokens (shared with DashboardScreen) ──────────────────────────────
const DS = {
  bg:           '#F5F9F6',
  card:         '#FFFFFF',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  accent:       '#CD643D',
  border:       '#E8E6DF',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shipmentRef(id: string): string {
  return '#' + id.substring(0, 8).toUpperCase();
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getStatusInfo(status: string): {
  label: string; bg: string; text: string; border: string; phase: string
} {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  switch (status) {
    case 'in_progress':      return { label: 'In Progress',      bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', phase: 'In Progress' };
    case 'received':         return { label: 'Received',         bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', phase: 'Received' };
    case 'origin_port':      return { label: 'Origin Port',      bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', phase: 'Origin Port' };
    case 'in_transit':       return { label: 'In Transit',       bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', phase: 'In Transit' };
    case 'destination_port': return { label: 'Destination Port', bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6', phase: 'Destination Port' };
    case 'out_for_delivery': return { label: 'Out for Delivery', bg: '#FED7AA', text: '#9A3412', border: '#F97316', phase: 'Out for Delivery' };
    case 'delivered':        return { label: 'Delivered',        bg: '#DCFCE7', text: '#15803D', border: '#22C55E', phase: 'Delivered' };
    case 'cancelled':        return { label: 'Cancelled',        bg: '#F0EEE8', text: '#6B6B6B', border: '#D4D2CC', phase: 'Cancelled' };
    default:                 return { label, bg: '#F0EEE8', text: '#6B6B6B', border: '#D4D2CC', phase: label };
  }
}

// ─── Extended type for in-progress (includes parcel count) ───────────────────
type ShipmentWithParcels = Shipment & { parcels?: { id: string }[] };

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ShipmentsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Active');

  const [activeShipments,     setActiveShipments]     = useState<Shipment[]>([]);
  const [inProgressShipments, setInProgressShipments] = useState<ShipmentWithParcels[]>([]);
  const [completedShipments,  setCompletedShipments]  = useState<Shipment[]>([]);
  const [initialLoading,      setInitialLoading]      = useState(true);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const fetchShipments = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [activeRes, inProgressRes, completedRes] = await Promise.all([
        supabase
          .from('shipments')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_visible', true)
          .is('archived_at', null)
          .in('status', ['received', 'origin_port', 'in_transit', 'destination_port', 'out_for_delivery'])
          .order('updated_at', { ascending: false }),
        supabase
          .from('shipments')
          .select('*, parcels(id)')
          .eq('user_id', user.id)
          .eq('is_visible', true)
          .is('archived_at', null)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false }),
        // Completed / history: delivered shipments PLUS any archived shipment (archived
        // shipments move out of the active list into history, but stay viewable).
        supabase
          .from('shipments')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_visible', true)
          .or('status.eq.delivered,archived_at.not.is.null')
          .order('updated_at', { ascending: false }),
      ]);

      if (activeRes.error)     Alert.alert('Error', activeRes.error.message);
      if (inProgressRes.error) Alert.alert('Error', inProgressRes.error.message);
      if (completedRes.error)  Alert.alert('Error', completedRes.error.message);

      if (activeRes.data)     setActiveShipments(activeRes.data as Shipment[]);
      if (inProgressRes.data) setInProgressShipments(inProgressRes.data as ShipmentWithParcels[]);
      if (completedRes.data)  setCompletedShipments(completedRes.data as Shipment[]);
    } finally {
      setInitialLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchShipments();
    }, [fetchShipments]),
  );

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>

      {/* ── HEADER — title + add new shipment ───────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title} allowFontScaling={false}>Shipments</Text>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ShippingRoute')}
          accessibilityLabel="Start a new shipment"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ── SEGMENTED CONTROL (Active / Completed) ──────────────────────────── */}
      <View style={styles.segmentWrap}>
        <View style={styles.segmentTrack}>
          {(['Active', 'Completed'] as const).map(tab => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.segment, isActive && styles.segmentActive]}
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[styles.segmentText, { color: isActive ? '#FFFFFF' : DS.textSecondary }]}
                  allowFontScaling={false}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── CARD LIST (scrollable) ───────────────────────────────────────────── */}
      {initialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={DS.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: 80 + insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'Active' ? (
            <>
              {/* In Progress section */}
              {inProgressShipments.length > 0 && (
                <>
                  <Text style={styles.inProgressLabel} allowFontScaling={false}>IN PROGRESS</Text>
                  {inProgressShipments.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.cardInProgress}
                      activeOpacity={0.85}
                      onPress={() => navigateToShipment(s.id, navigation, 'shipments')}
                    >
                      <View style={styles.row}>
                        <Text style={styles.shipmentId} allowFontScaling={false}>
                          Shipment {shipmentRef(s.id)}
                        </Text>
                        <View style={styles.inProgressBadge}>
                          <Text
                            style={styles.inProgressBadgeText}
                            allowFontScaling={false}
                            maxFontSizeMultiplier={1.2}
                          >
                            In Progress
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.inProgressBatch} allowFontScaling={false}>
                        {s.slot_name ?? '—'}{s.slot_rate != null ? ` · £${s.slot_rate}/kg` : ''}
                      </Text>
                      <Text style={styles.inProgressSummary} allowFontScaling={false}>
                        {s.parcels != null ? `${s.parcels.length} item${s.parcels.length !== 1 ? 's' : ''} added` : 'No items yet'} · awaiting payment
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Active shipments */}
              {activeShipments.length === 0 && inProgressShipments.length === 0 ? (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText} allowFontScaling={false}>No active shipments</Text>
                </View>
              ) : (
                activeShipments.map(s => {
                  const si = getStatusInfo(s.status);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.card}
                      activeOpacity={0.85}
                      onPress={() => navigateToShipment(s.id, navigation, 'shipments')}
                    >
                      <View style={styles.row}>
                        <Text style={styles.shipmentId} allowFontScaling={false}>
                          Shipment {shipmentRef(s.id)}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: si.bg }]}>
                          <Text
                            style={[styles.badgeText, { color: si.text }]}
                            allowFontScaling={false}
                            maxFontSizeMultiplier={1.2}
                          >
                            {si.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.route} allowFontScaling={false}>
                        {s.origin_country} → {s.destination_country}
                      </Text>
                      <Text style={styles.phase} allowFontScaling={false}>{si.phase}</Text>
                      <Text style={styles.eta} allowFontScaling={false}>
                        {(s as any).estimated_delivery
                          ? `Est. delivery ${formatDate((s as any).estimated_delivery)}`
                          : `Updated ${formatDate(s.updated_at)}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : (
            // Completed tab
            completedShipments.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText} allowFontScaling={false}>No completed shipments</Text>
              </View>
            ) : (
              completedShipments.map(s => {
                const isArchived  = !!(s as any).archived_at;
                const isDelivered = s.status === 'delivered';
                const label = isDelivered && isArchived
                  ? 'Delivered · Archived'
                  : isDelivered ? 'Delivered' : 'Archived';
                const sub = isDelivered
                  ? `Delivered on ${formatDate((s as any).delivered_at ?? s.updated_at)}`
                  : `Archived on ${formatDate((s as any).archived_at ?? s.updated_at)}`;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.cardCompleted}
                    activeOpacity={0.85}
                    onPress={() => navigateToShipment(s.id, navigation, 'shipments')}
                  >
                    <View style={styles.row}>
                      <Text style={styles.shipmentId} allowFontScaling={false}>
                        Shipment {shipmentRef(s.id)}
                      </Text>
                      {isArchived && (
                        <View style={styles.archivedBadge}>
                          <Text style={styles.archivedBadgeText} allowFontScaling={false} maxFontSizeMultiplier={1.2}>Archived</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.route} allowFontScaling={false}>
                      {s.origin_country} → {s.destination_country}
                    </Text>
                    <Text style={styles.deliveredLabel} allowFontScaling={false}>{label}</Text>
                    <Text style={styles.deliveredDate} allowFontScaling={false}>{sub}</Text>
                  </TouchableOpacity>
                );
              })
            )
          )}
        </ScrollView>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: DS.bg,
    flexDirection:   'column',
  },

  // ── Header — title + add button ───────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     4,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   27,
    color:      DS.textPrimary,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: '#1A1712',
    alignItems: 'center', justifyContent: 'center',
    ...SH.card,
  },

  // ── Segmented control (Active / Completed) ─────────────────────────────────────
  segmentWrap: {
    paddingHorizontal: 20,
    marginTop:         18,
  },
  segmentTrack: {
    flexDirection:   'row',
    backgroundColor: '#E9E5DC',
    borderRadius:    12,
    padding:         4,
    alignSelf:       'flex-start',
  },
  segment: {
    paddingVertical:   8,
    paddingHorizontal: 20,
    borderRadius:      9,
  },
  segmentActive: {
    backgroundColor: '#1A1712',
  },
  segmentText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   13.5,
  },

  // ── Loading / empty ──────────────────────────────────────────────────────────
  centered: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptySection: {
    paddingVertical:   32,
    alignItems:        'center',
    paddingHorizontal: 20,
  },
  emptySectionText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#A0A0A0',
  },

  // ── Card list ────────────────────────────────────────────────────────────────
  list: {
    flex: 1,
  },
  listContent: {
    // paddingBottom is set dynamically in the component (80 + insets.bottom + 16)
  },

  // ── In Progress section ───────────────────────────────────────────────────────
  inProgressLabel: {
    fontFamily:        'PlusJakartaSans_600SemiBold',
    fontSize:          10,
    color:             '#A0A0A0',
    letterSpacing:     1.2,
    textTransform:     'uppercase',
    marginHorizontal:  20,
    marginTop:         16,
    marginBottom:      8,
  },
  cardInProgress: {
    backgroundColor:   '#FFFFFF',
    borderRadius:      18,
    marginHorizontal:  20,
    paddingVertical:   16,
    paddingHorizontal: 18,
    marginBottom:      10,
    ...SH.card,
  },
  inProgressBadge: {
    backgroundColor:   '#FEF3C7',
    borderRadius:      20,
    paddingVertical:   3,
    paddingHorizontal: 10,
  },
  inProgressBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   10,
    color:      '#B45309',
  },
  inProgressBatch: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      '#6B6B6B',
    marginTop:  4,
  },
  inProgressSummary: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      '#A0A0A0',
    marginTop:  2,
  },

  // ── Active shipment card ─────────────────────────────────────────────────────
  card: {
    backgroundColor:  DS.card,
    borderRadius:     18,
    marginHorizontal: 20,
    marginTop:        12,
    paddingVertical:  16,
    paddingHorizontal: 18,
    ...SH.card,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  shipmentId: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  badge: {
    borderRadius:      20,
    paddingVertical:   3,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   11,
  },
  route: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
    marginTop:  2,
  },
  phase: {
    fontFamily:   'PlusJakartaSans_500Medium',
    fontSize:     13,
    color:        DS.textSecondary,
    marginTop:    6,
    marginBottom: 2,
  },
  eta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },

  // ── Completed shipment card ──────────────────────────────────────────────────
  cardCompleted: {
    backgroundColor:   DS.card,
    borderRadius:      18,
    marginHorizontal:  20,
    marginTop:         12,
    paddingVertical:   16,
    paddingHorizontal: 18,
    ...SH.card,
  },
  archivedBadge: {
    backgroundColor:   'rgba(205,100,61,0.12)',
    borderWidth:       0.75,
    borderColor:       'rgba(205,100,61,0.32)',
    borderRadius:      20,
    paddingVertical:   3,
    paddingHorizontal: 10,
  },
  archivedBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   10,
    color:      '#9A3B1C',
  },
  deliveredLabel: {
    fontFamily:  'PlusJakartaSans_600SemiBold',
    fontSize:    14,
    color:       DS.textSecondary,
    marginTop:   8,
    marginBottom: 4,
  },
  deliveredDate: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },

});
