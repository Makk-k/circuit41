import React, { useCallback, useContext, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFocusEffect } from '@react-navigation/native';
import { ActionBadgeContext, TabScreenProps } from '../App';
import ActionBottomSheet, { ActionType } from '../components/ActionBottomSheet';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { shadow as SH } from '../lib/theme';
import type { Action } from '../lib/database.types';

type Props = TabScreenProps<'Actions'>;

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:           '#F5F9F6',
  card:         '#FFFFFF',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  accent:       '#CD643D',
  border:       '#E8E6DF',
} as const;

type DueStyle = 'urgent' | 'upcoming' | 'neutral';

// Due badge colours by style
const DUE_COLORS: Record<DueStyle, { bg: string; text: string }> = {
  urgent:   { bg: '#FEE2E2', text: '#991B1B' },
  upcoming: { bg: '#FEF3C7', text: '#B45309' },
  neutral:  { bg: '#F0EEE8', text: '#6B6B6B' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDueStyle(dueDate: string | null): DueStyle {
  if (!dueDate) return 'neutral';
  const diffDays = (new Date(dueDate).getTime() - Date.now()) / 86_400_000;
  if (diffDays <= 0) return 'urgent';
  if (diffDays <= 3) return 'upcoming';
  return 'neutral';
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'Pending';
  const diffDays = Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (diffDays <= 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return `Due ${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function getActionBtnLabel(actionType: string): string {
  switch (actionType) {
    case 'address':  return 'Add Address';
    case 'confirm':  return 'Confirm';
    case 'document': return 'Upload';
    default:         return 'Respond';
  }
}

function shipmentRef(id: string): string {
  return '#' + id.substring(0, 8).toUpperCase();
}

// ─── Local type for bottom sheet state ───────────────────────────────────────
type SheetAction = {
  id:         string;
  title:      string;
  description: string;
  actionType: ActionType;
  context:    string;
  shipmentId: string;
};

export default function ActionsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refreshActionBadge, setHasIncompleteActions } = useContext(ActionBadgeContext);

  const [actions,        setActions]        = useState<Action[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const [sheetVisible,   setSheetVisible]   = useState(false);
  const [selectedAction, setSelectedAction] = useState<SheetAction | null>(null);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const fetchActions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('actions')
        .select('*, shipments(id, origin_country, destination_country, status)')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) { Alert.alert('Error', error.message); return; }
      const filteredActions = (data || []).filter(
        (action: any) => action.shipments?.status !== 'in_progress',
      );
      setActions(filteredActions as Action[]);
      setHasIncompleteActions(filteredActions.length > 0);
    } finally {
      setInitialLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchRef.current > 30_000) {
        lastFetchRef.current = now;
        fetchActions();
      }
    }, [user?.id]),
  );

  const handleActionComplete = async (actionId: string) => {
    try {
      const { error } = await supabase
        .from('actions')
        .update({ status: 'submitted' })
        .eq('id', actionId);
      if (error) { Alert.alert('Error', error.message); return; }
      const nextActions = actions.filter(a => a.id !== actionId);
      setActions(nextActions);
      setHasIncompleteActions(nextActions.length > 0);
      refreshActionBadge();
    } catch {
      Alert.alert('Error', 'Failed to submit action');
    }
  };

  const openSheet = (action: Action) => {
    const shipmentData = (action as any).shipments;
    const ref = shipmentData?.id ?? action.shipment_id;
    const context = shipmentData
      ? `Shipment ${shipmentRef(ref)} · ${shipmentData.origin_country} → ${shipmentData.destination_country}`
      : `Shipment ${shipmentRef(ref)}`;

    setSelectedAction({
      id:          action.id,
      title:       action.title,
      description: action.description ?? '',
      actionType:  (action.action_type as ActionType) ?? 'default',
      context,
      shipmentId:  action.shipment_id,
    });
    setSheetVisible(true);
  };

  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Actions</Text>
        <Text style={styles.subtitle}>Things that need your attention</Text>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {initialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={DS.accent} />
        </View>
      ) : actions.length > 0 ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {actions.map(action => {
            const dueStyle = getDueStyle(action.due_date);
            const due      = DUE_COLORS[dueStyle];
            const btnLabel = getActionBtnLabel(action.action_type);

            return (
              <TouchableOpacity
                key={action.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => openSheet(action)}
              >
                {/* Status chip — clear pending state */}
                <View style={styles.statusChip}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusChipText}>Pending</Text>
                </View>

                {/* Top row: primary title + due badge */}
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle}>{action.title}</Text>
                  <View style={[styles.dueBadge, { backgroundColor: due.bg }]}>
                    <Text style={[styles.dueBadgeText, { color: due.text }]}>
                      {formatDueDate(action.due_date)}
                    </Text>
                  </View>
                </View>

                {/* Supporting context */}
                {(() => {
                  const shipmentData = (action as any).shipments;
                  const r = shipmentData?.id ?? action.shipment_id;
                  const ctx = shipmentData
                    ? `Shipment ${shipmentRef(r)} · ${shipmentData.origin_country} → ${shipmentData.destination_country}`
                    : `Shipment ${shipmentRef(r)}`;
                  return <Text style={styles.cardContext}>{ctx}</Text>;
                })()}

                {/* Bottom row: action button right-aligned */}
                <View style={styles.cardBottomRow}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    activeOpacity={0.85}
                    onPress={() => openSheet(action)}
                  >
                    <Text style={styles.actionBtnText}>{btnLabel}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        // Empty state — shown when there are no pending actions
        <View style={styles.emptyState}>
          <View style={styles.emptyCircle}>
            <Ionicons name="checkmark" size={28} color="#15803D" />
          </View>
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySubtitle}>No actions needed right now</Text>
        </View>
      )}

      {/* ── Action bottom sheet ──────────────────────────────────────────── */}
      {selectedAction && (
        <ActionBottomSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onSubmit={() => handleActionComplete(selectedAction.id)}
          actionTitle={selectedAction.title}
          actionDescription={selectedAction.description}
          actionType={selectedAction.actionType}
          shipmentContext={selectedAction.context}
          actionId={selectedAction.id}
          shipmentId={selectedAction.shipmentId}
        />
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.bg, flexDirection: 'column' },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom:     16,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   22,
    color:      DS.textPrimary,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    marginTop:  4,
  },

  // Loading / empty
  centered: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 96 },

  // Action card — borderless, soft elevation
  card: {
    backgroundColor:   DS.card,
    borderRadius:      18,
    padding:           16,
    paddingHorizontal: 18,
    marginBottom:      12,
    marginHorizontal:  20,
    ...SH.card,
  },
  statusChip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    alignSelf:         'flex-start',
    backgroundColor:   'rgba(205,100,61,0.10)',
    borderRadius:      999,
    paddingVertical:   3,
    paddingHorizontal: 9,
    marginBottom:      10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.accent },
  statusChipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   10,
    letterSpacing: 0.3,
    color:      '#9A3B1C',
  },
  cardTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            8,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   15,
    color:      DS.textPrimary,
    flex:       1,
  },
  dueBadge: {
    borderRadius:      10,
    paddingVertical:   3,
    paddingHorizontal: 8,
  },
  dueBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   10,
  },
  cardContext: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
    marginTop:  4,
  },
  cardBottomRow: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    marginTop:      12,
  },
  actionBtn: {
    backgroundColor:   '#1A1712',
    borderRadius:      12,
    paddingVertical:   9,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   12,
    color:      '#FFFFFF',
  },

  // Empty state
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: '#DCFCE7',
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   16,
    color:      DS.textPrimary,
    marginTop:  16,
  },
  emptySubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    marginTop:  6,
  },

});
