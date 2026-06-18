import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { gradients as G } from '../lib/theme';
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
  bg:           '#F5F9F6',
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
  const [profileName,    setProfileName]    = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Greeting name comes from the app profile (profiles.first_name), NOT the
  // Gmail/Apple auth display name. Fetched once the user is known.
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('preferred_name, first_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfileName((data.preferred_name || data.first_name) ?? null);
      });
  }, [user?.id]);

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

  // ── Layer gesture: the Dashboard is the centre layer. A downward pull reveals
  //    Activity; an upward pull reveals Shipments. If the pull doesn't cross the
  //    threshold it springs back (an "alive" bounce). Built-in PanResponder +
  //    Animated only — no gesture-handler/reanimated, no navigation rebuild.
  //    NOTE: declared before any early return so hook order stays stable.
  const pan = useRef(new Animated.Value(0)).current;
  const navigatingRef = useRef(false);
  const gestureStart  = useRef(0);

  // Deliberate "pull and hold" gating so casual swipes / normal scrolls never switch pages:
  //   • must drag a long distance,
  //   • must NOT be a quick flick (low release velocity),
  //   • must hold the drag briefly.
  const DIST_THRESHOLD = 160;  // px the finger must travel
  const VEL_MAX        = 0.6;  // reject fast flicks (px/ms at release)
  const MIN_DURATION   = 200;  // ms the gesture must last

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture for a clearly vertical, non-trivial drag — small
      // moves and normal scrolling fall through untouched.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 24 && Math.abs(g.dy) > Math.abs(g.dx) * 2,
      onPanResponderGrant: () => {
        gestureStart.current = Date.now();
      },
      onPanResponderMove: (_, g) => {
        // resistive follow — eases as you pull further (elastic feel)
        const d = g.dy;
        pan.setValue(Math.sign(d) * Math.min(Math.abs(d) * 0.45, 150));
      },
      onPanResponderRelease: (_, g) => {
        const duration   = Date.now() - gestureStart.current;
        const farEnough  = Math.abs(g.dy) > DIST_THRESHOLD;
        const deliberate = Math.abs(g.vy) < VEL_MAX;     // not a quick flick
        const held       = duration > MIN_DURATION;
        const intentional = farEnough && deliberate && held;

        if (!navigatingRef.current && intentional && g.dy > 0) {
          navigatingRef.current = true;
          navigation.navigate('Activity');
        } else if (!navigatingRef.current && intentional && g.dy < 0) {
          navigatingRef.current = true;
          navigation.navigate('Shipments' as never);
        }
        Animated.spring(pan, { toValue: 0, useNativeDriver: true, friction: 6, tension: 70 })
          .start(() => { navigatingRef.current = false; });
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: 0, useNativeDriver: true, friction: 6, tension: 70 }).start();
      },
    }),
  ).current;

  if (!fontsLoaded) return null;

  const primary   = shipments[0] ?? null;
  const secondary = shipments[1] ?? null;
  const hasShipments = shipments.length > 0;
  const recentActivities = activities.filter(isRecentActivity);
  const hasUnreadActivity = activities.some(item => !item.is_read);

  // Greeting (avatar + time-of-day + first name) per the design reference.
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  // Prefer the saved app profile first name; fall back to auth metadata name;
  // finally a generic greeting. Never derive the name from the email address.
  const meta: any = (user as any)?.user_metadata ?? {};
  const metaName =
    meta.first_name || (meta.full_name ? String(meta.full_name).split(' ')[0] : '');
  const firstName = profileName || metaName || 'there';
  const initial = String(firstName).charAt(0).toUpperCase() || 'C';

  const handleShipmentPress = async (shipment: Shipment) => {
    await navigateToShipment(shipment.id, navigation, 'home');
  };

  return (
    // Outer container stays put — the FAB lives here so it never moves with the
    // gesture surface or any scroll.
    <View style={{ flex: 1, backgroundColor: DS.bg }}>

    {/* Whole-page gesture surface: pull down → Activity, up → Shipments (springs back otherwise). */}
    <Animated.View
      style={{ flex: 1, backgroundColor: DS.bg, transform: [{ translateY: pan }] }}
      {...panResponder.panHandlers}
    >

      {/* ── FIXED TOP SECTION — never scrolls ───────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>

        {/* 1. GREETING ROW — avatar + good afternoon + first name */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile' as never)}
            accessibilityLabel="Open profile"
          >
            <Text style={styles.avatarText} allowFontScaling={false}>{initial}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} allowFontScaling={false}>{greet}</Text>
            <Text style={styles.nameText} allowFontScaling={false} numberOfLines={1}>{firstName}</Text>
          </View>
        </View>

        {initialLoading ? (
          <>
            <SkeletonCard height={120} />
            <SkeletonCard height={80} />
          </>
        ) : hasShipments ? (
          <>
            {/* 2. PRIMARY SHIPMENT — dark gradient hero */}
            {primary && (() => {
              const si = getStatusInfo(primary.status);
              const order = ['in_progress', 'received', 'origin_port', 'in_transit', 'destination_port', 'out_for_delivery', 'delivered'];
              const idx = order.indexOf(primary.status);
              const frac = idx <= 0 ? 0.12 : idx / (order.length - 1);
              const filled = Math.max(1, Math.min(4, Math.round(frac * 4)));
              const eta = (primary as any).estimated_delivery
                ? `Arriving ${new Date((primary as any).estimated_delivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : si.stage;
              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleShipmentPress(primary)}
                  style={styles.heroWrap}
                >
                  <LinearGradient
                    colors={G.heroDark}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                  >
                    <View style={styles.heroGlow} pointerEvents="none" />
                    <View style={styles.heroTopRow}>
                      <Text style={styles.heroLabel} allowFontScaling={false}>ACTIVE SHIPMENT</Text>
                      <View style={[styles.heroPill, { backgroundColor: si.bg }]}>
                        <Text style={[styles.heroPillText, { color: si.text }]} allowFontScaling={false} maxFontSizeMultiplier={1.2}>
                          {si.label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.heroRoute} allowFontScaling={false}>
                      {primary.origin_country} → {primary.destination_country}
                    </Text>
                    <Text style={styles.heroStage} allowFontScaling={false}>{eta}</Text>

                    {/* 4-segment progress bar */}
                    <View style={styles.heroProgress}>
                      {[0, 1, 2, 3].map(i => (
                        <View key={i} style={[styles.heroSeg, i < filled ? styles.heroSegFilled : styles.heroSegEmpty]} />
                      ))}
                    </View>

                    <Text style={styles.heroMeta} allowFontScaling={false}>
                      {[primary.slot_name, primary.slot_tag].filter(Boolean).join(' · ') || `Shipment ${shipmentRef(primary.id)}`}
                    </Text>
                  </LinearGradient>
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
          /* ── EMPTY STATE — friendly welcome + how-it-works ─────────────── */
          <View style={styles.emptyCard}>
            <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
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
            <Text style={styles.emptyTitle} allowFontScaling={false}>Welcome to Circuit 41</Text>
            <Text style={styles.emptySubtitle} allowFontScaling={false}>
              Ship your goods from overseas to your door. Here's how it works:
            </Text>

            <View style={styles.stepsWrap}>
              {[
                'Start a shipment',
                'Add parcel & tracking details',
                'Send your goods to the warehouse',
                'Track every update inside Circuit 41',
              ].map((label, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText} allowFontScaling={false}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText} allowFontScaling={false}>{label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.emptyButton}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ShippingRoute')}
            >
              <Text style={styles.emptyButtonText} allowFontScaling={false}>Start your first shipment</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* ── RECENT ACTIVITY — floats clear of the bottom nav ─────────────── */}
      <View style={[styles.activityCard, { flex: 1, marginHorizontal: 20, marginTop: 16, marginBottom: 96 + insets.bottom }]}>
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
            <Text style={styles.activityEmptyText} allowFontScaling={false}>No activity recorded yet</Text>
          </View>
        )}
      </View>

    </Animated.View>

      {/* ── FLOATING "+" — true FAB: fixed to the screen, never moves with the
          gesture surface or scroll. ─────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 92 + insets.bottom }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ShippingRoute')}
        accessibilityLabel="Start a new shipment"
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    marginBottom:   20,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2C2820',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#E0875F',
  },
  greeting: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   14,
    color:      DS.textSecondary,
  },
  nameText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   26,
    color:      DS.textPrimary,
    letterSpacing: -0.4,
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

  // ── Shared card base (borderless, soft elevation) ────────────────────────────
  card: {
    backgroundColor: DS.card,
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
  stepsWrap: {
    alignSelf:  'stretch',
    marginTop:  18,
    gap:        12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  stepNum: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: 'rgba(205,100,61,0.10)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepNumText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   12,
    color:      DS.accent,
  },
  stepText: {
    flex:       1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  emptyButton: {
    backgroundColor: '#1A1712',
    borderRadius:    12,
    paddingVertical: 12,
    width:           '100%',
    alignItems:      'center',
    marginTop:       22,
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
  // ── Dark gradient hero ───────────────────────────────────────────────────────
  heroWrap: {
    marginTop: 16,
    borderRadius: 26,
    shadowColor: '#140F08', shadowOpacity: 0.30, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 8,
  },
  hero: {
    borderRadius: 26,
    padding: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -50, right: -40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(205,100,61,0.20)',
  },
  heroTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  heroLabel: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, letterSpacing: 1.4,
    color: '#A39C8F',
  },
  heroPill: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11 },
  heroPillText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11 },
  heroRoute: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, color: '#F3EFE7', marginTop: 18,
  },
  heroStage: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 27, color: '#FFFFFF', marginTop: 6, letterSpacing: -0.6,
  },
  heroProgress: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  heroSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
  },
  heroSegFilled: { backgroundColor: '#CD643D' },
  heroSegEmpty:  { backgroundColor: '#423D35' },
  heroMeta: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12.5, color: '#938C7F', marginTop: 14,
  },

  // ── Floating "+" FAB ─────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 22,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1A1712',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#140F08', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10,
    zIndex: 100,
  },
});
