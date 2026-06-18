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
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import type { ShippingRate, Slot } from '../lib/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'SlotSelection'>;

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

// ─── Tag styling ──────────────────────────────────────────────────────────────
type TagStyle = { bg: string; color: string };

function getTagStyle(tag: string | null): TagStyle {
  if (!tag) return { bg: '#F5F9F6', color: '#6B6B6B' };
  const t = tag.toLowerCase();
  if (t.includes('standard') || t.includes('recommend')) return { bg: '#F0FDF4', color: '#16A34A' };
  if (t.includes('express') || t.includes('fast')) return { bg: 'rgba(205,100,61,0.10)', color: '#9A3B1C' };
  if (t.includes('economy') || t.includes('afford')) return { bg: '#F5F9F6', color: '#6B6B6B' };
  return { bg: '#F5F9F6', color: '#6B6B6B' };
}

function currencySymbol(currency?: string | null): string {
  switch ((currency ?? 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'NGN': return '₦';
    case 'GBP': return '£';
    default: return '$';
  }
}

function labelForServiceType(serviceType?: string | null): string | null {
  if (!serviceType) return null;
  if (serviceType === 'economy') return 'Most affordable';
  if (serviceType === 'standard') return 'Recommended';
  if (serviceType === 'express') return 'Fast';
  return serviceType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function shippingRateToSlot(rate: ShippingRate): Slot {
  return {
    id: rate.id,
    name: labelForServiceType(rate.service_type) || rate.service_name || `${rate.origin_country} to ${rate.destination_country}`,
    tag: labelForServiceType(rate.service_type),
    origin_country: rate.origin_country,
    destination_country: rate.destination_country,
    currency: rate.currency,
    general_rate: rate.general_goods_rate == null ? null : Number(rate.general_goods_rate),
    battery_rate: rate.battery_items_rate == null ? null : Number(rate.battery_items_rate),
    branded_rate: rate.branded_goods_rate == null ? null : Number(rate.branded_goods_rate),
    fragile_rate: rate.fragile_goods_rate == null ? null : Number(rate.fragile_goods_rate),
    liquid_rate: rate.liquid_goods_rate == null ? null : Number(rate.liquid_goods_rate),
    electronics_rate: rate.electronics_rate == null ? null : Number(rate.electronics_rate),
    documents_rate: rate.documents_rate == null ? null : Number(rate.documents_rate),
    clothing_rate: rate.clothing_rate == null ? null : Number(rate.clothing_rate),
    cosmetics_rate: rate.cosmetics_rate == null ? null : Number(rate.cosmetics_rate),
    minimum_charge: rate.minimum_charge == null ? null : Number(rate.minimum_charge),
    warehouse_name: rate.warehouse_name,
    warehouse_address: rate.warehouse_address,
    warehouse_city: rate.warehouse_city,
    warehouse_state: rate.warehouse_state,
    warehouse_country: rate.warehouse_country,
    warehouse_postcode: rate.warehouse_postcode,
    warehouse_contact_phone: rate.warehouse_contact_phone,
    warehouse_notes: rate.warehouse_notes,
    is_active: rate.is_active,
    created_at: rate.created_at,
  };
}

// ─── SlotCard ─────────────────────────────────────────────────────────────────
type SlotCardProps = {
  slot:     Slot;
  selected: boolean;
  onSelect: () => void;
};

const SlotCard: React.FC<SlotCardProps> = ({ slot, selected, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const tagStyle = getTagStyle(slot.tag);

  type RateRow = { label: string; rate: number | null };
  const rates: RateRow[] = [
    { label: 'General goods',    rate: slot.general_rate },
    { label: 'Battery items',    rate: slot.battery_rate },
    { label: 'Branded goods',    rate: slot.branded_rate },
    { label: 'Fragile goods',    rate: slot.fragile_rate ?? null },
    { label: 'Liquid goods',     rate: slot.liquid_rate  },
    { label: 'Electronics',      rate: slot.electronics_rate ?? null },
    { label: 'Documents',        rate: slot.documents_rate ?? null },
    { label: 'Clothing',         rate: slot.clothing_rate ?? null },
    { label: 'Cosmetics',        rate: slot.cosmetics_rate ?? null },
  ].filter(r => r.rate != null);
  const symbol = currencySymbol(slot.currency);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      style={[
        styles.slotCard,
        selected ? styles.slotCardSelected : styles.slotCardDefault,
      ]}
    >
      {/* Top row: name + tag pill */}
      <View style={styles.row}>
        <Text style={[styles.slotName, selected && styles.onDark]}>{slot.name}</Text>
        {slot.tag && (
          <View style={[styles.tagPill, { backgroundColor: tagStyle.bg }]}>
            <Text style={[styles.tagText, { color: tagStyle.color }]}>{slot.tag}</Text>
          </View>
        )}
      </View>

      {/* Main rate row */}
      <View style={[styles.row, { marginTop: 10 }]}>
        <Text style={[styles.rateLabel, selected && styles.onDarkMuted]}>{slot.general_rate == null ? 'Available service' : 'General goods'}</Text>
        <Text style={[styles.rateValue, selected && styles.onDark]}>{slot.general_rate == null ? slot.currency : `${symbol}${slot.general_rate}/kg`}</Text>
      </View>

      {/* Duration */}
      {(slot as any).estimated_duration && (
        <Text style={[styles.durationText, selected && styles.onDarkMuted]}>{(slot as any).estimated_duration}</Text>
      )}

      {/* Expand toggle */}
      {rates.length > 1 && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setExpanded(prev => !prev)}
          style={{ marginTop: 8 }}
        >
          <Text style={[styles.expandToggle, selected && { color: '#E0875F' }]}>
            {expanded ? 'Hide rates ↑' : 'See all rates ↓'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Expanded rates */}
      {expanded && (
        <View style={[styles.expandedSection, selected && { borderTopColor: 'rgba(255,255,255,0.14)' }]}>
          {rates.map(row => (
            <View key={row.label} style={[styles.row, styles.expandedRow]}>
              <Text style={[styles.expandedLabel, selected && styles.onDarkMuted]}>{row.label}</Text>
              <Text style={[styles.expandedRate, selected && styles.onDark]}>{symbol}{row.rate}/kg</Text>
            </View>
          ))}
          {slot.minimum_charge != null && (
            <View style={[styles.row, styles.expandedRow]}>
              <Text style={[styles.expandedLabel, selected && styles.onDarkMuted]}>Minimum charge</Text>
              <Text style={[styles.expandedRate, selected && styles.onDark]}>{symbol}{slot.minimum_charge}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SlotSelectionScreen({ navigation, route }: Props) {
  const { origin, destination } = route.params;

  const [slots,      setSlots]      = useState<Slot[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const { data, error } = await supabase
          .from('shipping_rates')
          .select('*')
          .eq('origin_country', origin)
          .eq('destination_country', destination)
          .eq('is_active', true)
          .order('general_goods_rate', { ascending: true });

        if (error) { Alert.alert('Error', error.message); return; }
        if (data && data.length > 0) {
          setSlots((data as ShippingRate[]).map(shippingRateToSlot));
          setSelectedId(data[0].id); // select first slot by default
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, []);

  if (!fontsLoaded) return null;

  const selectedSlot = slots.find(s => s.id === selectedId) ?? null;

  const handleContinue = () => {
    if (!selectedSlot) return;
    navigation.navigate('ShipmentWorkspace', {
      slot:        selectedSlot,
      origin,
      destination,
      source:      'creation',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Choose a freight slot</Text>
            <Text style={styles.subtitle}>Rates vary by item type</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MainTabs')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={DS.accent} style={{ marginTop: 40 }} />
        ) : slots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No slots available for this route</Text>
          </View>
        ) : (
          <>
            {/* Slot cards */}
            <View style={{ marginTop: 24 }}>
              {slots.map(slot => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  selected={selectedId === slot.id}
                  onSelect={() => setSelectedId(slot.id)}
                />
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.85}
              onPress={handleContinue}
              disabled={!selectedSlot}
            >
              <Text style={styles.ctaText}>Create Shipment →</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DS.bg },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop:        24,
    paddingBottom:     40,
  },

  // Header
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
  },
  cancelButton: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      '#6B6B6B',
    paddingTop: 3,
  },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   20,
    color:      DS.textPrimary,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    marginTop:  4,
  },

  // Empty state
  emptyState: {
    paddingVertical: 48,
    alignItems:      'center',
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#A0A0A0',
  },

  // Slot card
  slotCard: {
    backgroundColor:   DS.card,
    borderRadius:      18,
    padding:           16,
    paddingHorizontal: 18,
    marginBottom:      10,
  },
  // Borderless neutral card; selected = solid dark fill (no border, no blue).
  slotCardDefault: {
    shadowColor: '#1A1A1A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  slotCardSelected: {
    backgroundColor: '#1A1712',
    shadowColor: '#140F08', shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  onDark:      { color: '#FFFFFF' },
  onDarkMuted: { color: 'rgba(255,255,255,0.66)' },

  // Inside card
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  slotName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  tagPill: {
    borderRadius:      20,
    paddingVertical:   3,
    paddingHorizontal: 10,
  },
  tagText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   10,
  },
  rateLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
  },
  rateValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   15,
    color:      DS.textPrimary,
  },
  durationText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
    marginTop:  4,
  },
  expandToggle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.accent,
  },

  // Expanded section
  expandedSection: {
    borderTopWidth:  1,
    borderTopColor:  '#F0EEE8',
    paddingTop:      10,
    marginTop:       10,
  },
  expandedRow: { paddingVertical: 6 },
  expandedLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  expandedRate: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.textPrimary,
  },

  // CTA
  ctaButton: {
    backgroundColor: '#1A1712',
    borderRadius:    14,
    paddingVertical: 15,
    alignItems:      'center',
    marginTop:       8,
  },
  ctaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
});
