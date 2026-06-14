import React, { useEffect, useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import { navigateToShipment } from '../lib/navigationHelper';
import { useAuth } from '../context/AuthContext';
import type { Activity } from '../lib/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:           '#F7F6F0',
  card:         '#FFFFFF',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  accent:       '#C10F1D',
  border:       '#E2E0DA',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(isoStr: string): string {
  const diff  = Date.now() - new Date(isoStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1)  return 'Just now';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default function ActivityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const handleActivityPress = async (item: Activity) => {
    if (!item.shipment_id) return;

    const shipmentId = item.shipment_id;
    const unreadForShipment = activities.some(a => a.shipment_id === shipmentId && !a.is_read);
    if (unreadForShipment) {
      setActivities(prev => prev.map(a => (
        a.shipment_id === shipmentId ? { ...a, is_read: true } : a
      )));
      const { error } = await supabase
        .from('activity')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('shipment_id', shipmentId)
        .eq('is_read', false);
      if (error) console.warn('[activity] mark shipment read failed:', error.message);
    }

    await navigateToShipment(shipmentId, navigation);
  };

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (!user) return;
    const loadActivity = async () => {
      const { data, error } = await supabase
        .from('activity')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) Alert.alert('Error', error.message);
      if (data) setActivities(data as Activity[]);
      setLoading(false);
    };

    loadActivity();
  }, [user]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Activity</Text>
      </View>

      {/* ── Activity list ─────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={DS.accent} />
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No activity yet</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {activities.map((item, idx) => {
            const isAlert = item.type === 'alert' || item.type === 'warning';
            return (
              <React.Fragment key={item.id}>
                {idx > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={[styles.item, isAlert && styles.itemAlert]}
                  activeOpacity={0.7}
                  onPress={() => handleActivityPress(item)}
                >
                  <Text style={[styles.itemMessage, isAlert && styles.itemMessageAlert]}>
                    {item.message}
                  </Text>
                  <Text style={[styles.itemTime, isAlert && styles.itemTimeAlert]}>
                    {timeAgo(item.created_at)}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: DS.bg },
  scroll:  { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#A0A0A0',
  },

  // ── Header ────────────────────────────────────────────────────────────────────
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 20,
    paddingBottom:     16,
  },
  backBtn: {
    marginRight:     2,
    padding:         8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   22,
    color:      DS.textPrimary,
  },

  // ── Activity items ────────────────────────────────────────────────────────────
  item: {
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  itemAlert: {
    backgroundColor: '#FDE8E8',
  },
  itemMessage: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  itemMessageAlert: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color:      '#9B1C1C',
  },
  itemTime: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      DS.textSecondary,
    marginTop:  3,
  },
  itemTimeAlert: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color:      DS.accent,
  },
  divider: {
    height:          1,
    backgroundColor: DS.border,
  },
});
