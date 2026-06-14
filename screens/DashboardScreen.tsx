import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
import { useFocusEffect } from '@react-navigation/native';
import { TabScreenProps } from '../App';
import { supabase } from '../lib/supabase';
import { navigateToShipment } from '../lib/navigationHelper';
import { useAuth } from '../context/AuthContext';
import { shadow as SH } from '../lib/theme';
import type { Shipment, Activity } from '../lib/database.types';

type Props = TabScreenProps<'Home'>;

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:           '#F7F6F0',
  card:         '#FFFFFF',
  activityCard: '#F0EEE8',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  accent:       '#CD643D',
  border:       '#E8E6DF',
  cardBorder:   '#D9D7D0',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getStatusInfo(status: string): {
  label: string; bg: string; text: string; border: string; stage: string
} {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  switch (status) {
    case 'in_progress':      return { label: 'In Progress',      bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', stage: 'In Progress' };
    case 'received':         return { label: 'Received',         bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', stage: 'Received' };
    case 'origin_port':      return { label: 'Origin Port',      bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', stage: 'Origin Port' };
    case 'in_transit':       return { label: 'In Transit',       bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', stage: 'In Transit' };
    case 'destination_port': return { label: 'Destination Port', bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6', stage: 'Destination Port' };
    case 'out_for_delivery': return { label: 'Out for Delivery', bg: '#FED7AA', text: '#9A3412', border: '#F97316', stage: 'Out for Delivery' };
    case 'delivered':        return { label: 'Delivered',        bg: '#DCFCE7', text: '#15803D', border: '#22C55E', stage: 'Delivered' };
    case 'cancelled':        return { label: 'Cancelled',        bg: '#F0EEE8', text: '#6B6B6B', border: '#D4D2CC', stage: 'Cancelled' };
    default:                 return { label, bg: '#F0EEE8', text: '#6B6B6B', border: '#D4D2CC', stage: label };
  }
}

function shipmentRef(id: string): string {
  return '#' + id.substring(0, 8).toUpperCase();
}

function isRecentActivity(item: Activity): boolean {
  return Date.now() - new Date(item.created_at).getTime() <= 5 * 24 * 60 * 60 * 1000;
}

function timeAgo(isoStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (seconds < 60)    return 'Just now';
  if (seconds < 3600)  return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

// ─── Animated sweeping divider ────────────────────────────────────────────────
const AnimatedDivider: React.FC = () => {
  const translateX = useRef(new Animated.Value(-80)).current;
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (containerWidth === 0) return;
    translateX.setValue(-80);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: containerWidth + 80, duration: 2800, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -80, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [containerWidth, translateX]);

  return (
    <View style={styles.dividerWrap} onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
      <View style={styles.dividerBaseline} />
      <Animated.View style={[styles.dividerGlow, { transform: [{ translateX }] }]} />
    </View>
  );
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────
const SkeletonCard: React.FC<{ height?: number }> = ({ height = 100 }) => (
  <View style={[styles.skeletonCard, { height }]} />
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [shipments,      setShipments]      = useState<Shipment[]>([]);
  const [activities,     setActivities]     = useState<Activity[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const fetchShipments = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_visible', true)
      .is('archived_at', null)
      .not('status', 'eq', 'delivered')
      .not('status', 'eq', 'cancelled')
      .order('updated_at', { ascending: false })
      .limit(2);
    if (error) Alert.alert('Error', error.message);
    if (data) setShipments(data as Shipment[]);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchShipments();
    }, [fetchShipments]),
  );

  const fetchActivities = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('activity')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) Alert.alert('Error', error.message);
      if (data) setActivities(data as Activity[]);
    } finally {
      setInitialLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchActivities();
    }, [fetchActivities]),
  );

  useEffect(() => {
    if (!user?.id) {
      setInitialLoading(false);
      return;
    }

    const refreshInitialData = async () => {
      try {
        await Promise.all([fetchShipments(), fetchActivities()]);
      } finally {
        setInitialLoading(false);
      }
    };

    refreshInitialData();
  }, [user?.id, fetchShipments, fetchActivities]);

  if (!fontsLoaded) return null;

  const primary   = shipments[0] ?? null;
  const secondary = shipments[1] ?? null;
  const hasShipments = shipments.length > 0;
  const recentActivities = activities.filter(isRecentActivity);
  const hasUnreadActivity = activities.some(item => !item.is_read);

  const handleShipmentPress = async (shipment: Shipment) => {
    await navigateToShipment(shipment.id, navigation, 'home');
  };

  return (
    <View style={{ flex: 1, backgroundColor: DS.bg }}>

      {/* ── FIXED TOP SECTION — never scrolls ───────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>

        {/* 1. GREETING ROW */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting} allowFontScaling={false}>Welcome back 👋</Text>
            <Text style={styles.subGreeting} allowFontScaling={false}>
              {initialLoading
                ? 'Loading...'
                : hasShipments
                  ? `${shipments.length} active shipment${shipments.length > 1 ? 's' : ''}`
                  : 'No active shipments'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Activity')}
          >
            <Ionicons name="notifications-outline" size={24} color={DS.textPrimary} />
            {hasUnreadActivity && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>

        {initialLoading ? (
          <>
            <SkeletonCard height={120} />
            <SkeletonCard height={80} />
          </>
        ) : hasShipments ? (
          <>
            {/* 2. PRIMARY SHIPMENT CARD */}
            {primary && (() => {
              const si = getStatusInfo(primary.status);
              return (
                <TouchableOpacity
                  style={[styles.card, { borderColor: si.border }]}
                  activeOpacity={0.85}
                  onPress={() => handleShipmentPress(primary)}
                >
                  <View style={styles.row}>
                    <Text style={styles.shipmentId} allowFontScaling={false}>
                      Shipment {shipmentRef(primary.id)}
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
                    {primary.origin_country} → {primary.destination_country}
                  </Text>
                  <AnimatedDivider />
                  <Text style={styles.stageBold} allowFontScaling={false}>{si.stage}</Text>
                  <Text style={[styles.detail, { marginTop: 4 }]} allowFontScaling={false}>
                    {[primary.slot_name, primary.slot_tag].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </TouchableOpacity>
              );
            })()}

            {/* 3. SECONDARY SHIPMENT CARD */}
            {secondary && (() => {
              const si = getStatusInfo(secondary.status);
              return (
                <TouchableOpacity
                  style={[styles.card, styles.cardSecondary, { borderColor: si.border }]}
                  activeOpacity={0.85}
                  onPress={() => handleShipmentPress(secondary)}
                >
                  <View style={styles.row}>
                    <Text style={styles.shipmentId} allowFontScaling={false}>
                      Shipment {shipmentRef(secondary.id)}
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
                    {secondary.origin_country} → {secondary.destination_country}
                  </Text>
                  <Text style={[styles.stageSemiBold, { marginTop: 8, marginBottom: 4 }]} allowFontScaling={false}>
                    {si.stage}
                  </Text>
                  <Text style={styles.detail} allowFontScaling={false}>
                    {[secondary.slot_name, secondary.slot_tag].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </>
        ) : (
          /* ── EMPTY STATE ─────────────────────────────────────────────── */
          <View style={styles.emptyCard}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20.91 8.84L12 4 3.09 8.84M12 4v16M20.91 8.84L12 20M3.09 8.84L12 20"
                stroke="#D4D2CC"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M3.09 8.84l9 5.28 8.82-5.28"
                stroke="#D4D2CC"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.emptyTitle} allowFontScaling={false}>Start your first shipment</Text>
            <Text style={styles.emptySubtitle} allowFontScaling={false}>Create your first shipment to get started</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ShippingRoute')}
            >
              <Text style={styles.emptyButtonText} allowFontScaling={false}>Start Shipment</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* ── RECENT ACTIVITY — fills all remaining vertical space ─────────── */}
      <View style={[styles.activityCard, { flex: 1, marginHorizontal: 20, marginTop: 12, marginBottom: 80 }]}>
        <Text style={styles.activityLabel} allowFontScaling={false}>RECENT ACTIVITY</Text>
        {initialLoading ? (
          <View style={styles.activityEmptyRow}>
            <ActivityIndicator color={DS.accent} size="small" />
          </View>
        ) : recentActivities.length > 0 ? (
          <ScrollView
            style={styles.activityScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
          >
            {recentActivities.map((item, idx) => {
              const isAlert = item.type === 'alert' || item.type === 'warning';
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <View style={styles.thinDivider} />}
                  <TouchableOpacity
                    style={[styles.activityItem, isAlert && styles.activityItemAlert]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (item.shipment_id) {
                        navigateToShipment(item.shipment_id, navigation, 'home');
                      }
                    }}
                  >
                    <Text
                      style={[styles.activityMsg, isAlert && styles.activityMsgAlert]}
                      allowFontScaling={false}
                    >
                      {item.message}
                    </Text>
                    <Text
                      style={[styles.activityTime, isAlert && styles.activityTimeAlert]}
                      allowFontScaling={false}
                      maxFontSizeMultiplier={1.2}
                    >
                      {timeAgo(item.created_at)}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.activityEmptyRow}>
            <Text style={styles.activityEmptyText} allowFontScaling={false}>No activity yet</Text>
          </View>
        )}
      </View>

      {/* ── PINNED START NEW SHIPMENT BUTTON — always visible above nav bar ─── */}
      <View style={[styles.ctaWrap, { bottom: 90 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ShippingRoute')}
        >
          <Text style={styles.ctaText} allowFontScaling={false}>Start New Shipment</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   20,
  },
  greeting: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   22,
    color:      DS.textPrimary,
  },
  subGreeting: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    marginTop:  2,
  },
  notificationButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DS.accent,
    borderWidth: 1,
    borderColor: DS.bg,
  },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: '#E8E6E0',
    borderRadius:    16,
    marginBottom:    12,
  },

  // ── Shared card base ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    18,
    padding:         18,
    ...SH.card,
  },
  cardSecondary: {
    paddingVertical:   14,
    paddingHorizontal: 18,
    marginTop:         12,
  },

  // ── Card internals ───────────────────────────────────────────────────────────
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
    borderRadius:     20,
    paddingVertical:  3,
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
  stageBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   18,
    color:      DS.textPrimary,
  },
  stageSemiBold: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  detail: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  etaValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      DS.textPrimary,
  },

  // ── Animated divider ─────────────────────────────────────────────────────────
  dividerWrap: {
    height:        1,
    marginVertical: 12,
    overflow:      'hidden',
  },
  dividerBaseline: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: DS.border,
  },
  dividerGlow: {
    position:        'absolute',
    top:             0,
    left:            0,
    width:           80,
    height:          1,
    backgroundColor: DS.accent,
    opacity:         0.75,
  },

  // ── Empty state card ─────────────────────────────────────────────────────────
  emptyCard: {
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      16,
    paddingVertical:   24,
    paddingHorizontal: 20,
    marginTop:         8,
    alignItems:        'center',
  },
  emptyTitle: {
    fontFamily:  'PlusJakartaSans_700Bold',
    fontSize:    15,
    color:       '#1A1A1A',
    textAlign:   'center',
    marginTop:   12,
  },
  emptySubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#6B6B6B',
    textAlign:  'center',
    marginTop:  6,
  },
  emptyButton: {
    backgroundColor: '#C10F1D',
    borderRadius:    12,
    paddingVertical: 12,
    width:           '100%',
    alignItems:      'center',
    marginTop:       20,
  },
  emptyButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      '#FFFFFF',
  },

  // ── Activity card ────────────────────────────────────────────────────────────
  activityCard: {
    backgroundColor: DS.activityCard,
    borderWidth:     0.75,
    borderColor:     DS.cardBorder,
    borderRadius:    16,
    overflow:        'hidden',
  },
  activityEmptyRow: {
    padding:        20,
    alignItems:     'center',
  },
  activityEmptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#A0A0A0',
  },
  activityLabel: {
    fontFamily:     'PlusJakartaSans_600SemiBold',
    fontSize:       11,
    color:          DS.textSecondary,
    letterSpacing:  1.2,
    textTransform:  'uppercase',
    paddingTop:     14,
    paddingHorizontal: 16,
    paddingBottom:  10,
  },
  activityScroll: {
    flex: 1,
  },
  activityItem: {
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  activityItemAlert: {
    backgroundColor: '#FDE8E8',
  },
  activityMsg: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  activityMsgAlert: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color:      '#9B1C1C',
  },
  activityTime: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      DS.textSecondary,
    marginTop:  2,
  },
  activityTimeAlert: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color:      DS.accent,
  },
  thinDivider: {
    height:           1,
    backgroundColor:  DS.border,
    marginHorizontal: 16,
  },

  // ── Pinned CTA button — absolute above tab bar ────────────────────────────────
  ctaWrap: {
    position: 'absolute',
    left:     20,
    right:    20,
    zIndex:   100,
  },
  ctaButton: {
    backgroundColor: '#9B1C1C',
    borderRadius:    14,
    paddingVertical: 15,
    alignItems:      'center',
  },
  ctaText: {
    fontFamily:    'PlusJakartaSans_700Bold',
    fontSize:      14,
    color:         '#FFFFFF',
    letterSpacing: 0.5,
  },
});
