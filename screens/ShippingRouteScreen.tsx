import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path, Polyline } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'ShippingRoute'>;

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:            '#F5F9F6',
  card:          '#FFFFFF',
  border:        '#E2E0DA',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  accent:        '#CD643D',
  accentDisabled:'#E2E0DA',
} as const;

// ─── Country data ─────────────────────────────────────────────────────────────
type Country = { flag: string; name: string };

// Canonical country lists — these always appear in the pickers. Any extra active
// routes found in Supabase are merged in on top of these (see fetch below).
const FALLBACK_ORIGINS: Country[] = [
  { flag: '🇨🇳', name: 'China'          },
  { flag: '🇹🇷', name: 'Turkey'         },
  { flag: '🇬🇧', name: 'United Kingdom' },
  { flag: '🇳🇬', name: 'Nigeria'        },
  { flag: '🇪🇸', name: 'Spain'          },
];

const FALLBACK_DESTINATIONS: Country[] = [
  { flag: '🇬🇧', name: 'United Kingdom' },
  { flag: '🇳🇬', name: 'Nigeria'        },
  { flag: '🇺🇸', name: 'United States'  },
  { flag: '🇨🇦', name: 'Canada'         },
  { flag: '🇪🇸', name: 'Spain'          },
  { flag: '🇬🇭', name: 'Ghana'          },
];

// Flag emoji map for country names from DB
const COUNTRY_FLAGS: Record<string, string> = {
  'China':          '🇨🇳',
  'Turkey':         '🇹🇷',
  'United Kingdom': '🇬🇧',
  'Nigeria':        '🇳🇬',
  'United States':  '🇺🇸',
  'Canada':         '🇨🇦',
  'Spain':          '🇪🇸',
  'UAE':            '🇦🇪',
  'Ghana':          '🇬🇭',
  'Kenya':          '🇰🇪',
  'South Africa':   '🇿🇦',
  'India':          '🇮🇳',
  'Pakistan':       '🇵🇰',
};

// Merge canonical countries with any extra names returned from the DB (deduped,
// canonical order first). Guarantees the requested countries always show.
function mergeCountries(base: Country[], names: string[]): Country[] {
  const seen = new Set(base.map(c => c.name));
  const extra = names
    .filter(n => !!n && !seen.has(n))
    .map(name => ({ name, flag: COUNTRY_FLAGS[name] ?? '🌍' }));
  return [...base, ...extra];
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const ChevronDownIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Polyline points="6 9 12 15 18 9" stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <Polyline points="20 6 9 17 4 12" stroke="#CD643D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── CountryPickerModal ───────────────────────────────────────────────────────
type CountryPickerModalProps = {
  visible:  boolean;
  options:  Country[];
  selected: Country | null;
  onSelect: (country: Country) => void;
  onClose:  () => void;
};

const CountryPickerModal: React.FC<CountryPickerModalProps> = ({
  visible, options, selected, onSelect, onClose,
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={onClose} />
    <View style={pickerStyles.sheet}>
      <View style={pickerStyles.handle} />
      <FlatList
        data={options}
        keyExtractor={item => item.name}
        renderItem={({ item, index }) => (
          <>
            {index > 0 && <View style={pickerStyles.divider} />}
            <TouchableOpacity
              style={pickerStyles.optionRow}
              activeOpacity={0.7}
              onPress={() => { onSelect(item); onClose(); }}
            >
              <Text style={pickerStyles.optionText}>{item.flag}{'  '}{item.name}</Text>
              {selected?.name === item.name && <CheckIcon />}
            </TouchableOpacity>
          </>
        )}
      />
    </View>
  </Modal>
);

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor:      DS.card,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingTop:           16,
    paddingBottom:        40,
    maxHeight:            '55%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: DS.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: DS.border, marginHorizontal: 20 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 20,
  },
  optionText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#1A1A1A' },
});

// ─── CountryPicker (inline row) ───────────────────────────────────────────────
type CountryPickerProps = {
  label:       string;
  selected:    Country | null;
  placeholder: string;
  onPress:     () => void;
};

const CountryPicker: React.FC<CountryPickerProps> = ({ label, selected, placeholder, onPress }) => (
  <View style={styles.pickerGroup}>
    <Text style={styles.pickerLabel}>{label}</Text>
    <TouchableOpacity style={styles.pickerRow} activeOpacity={0.8} onPress={onPress}>
      <Text style={selected ? styles.pickerValue : styles.pickerPlaceholder}>
        {selected ? `${selected.flag}  ${selected.name}` : placeholder}
      </Text>
      <ChevronDownIcon />
    </TouchableOpacity>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ShippingRouteScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [origin,      setOrigin]      = useState<Country | null>(null);
  const [destination, setDestination] = useState<Country | null>(null);

  const [originModalOpen, setOriginModalOpen] = useState(false);
  const [destModalOpen,   setDestModalOpen]   = useState(false);

  const [originOptions, setOriginOptions] = useState<Country[]>(FALLBACK_ORIGINS);
  const [destOptions,   setDestOptions]   = useState<Country[]>(FALLBACK_DESTINATIONS);
  const [fetching,      setFetching]      = useState(true);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    supabase
      .from('shipping_rates')
      .select('origin_country, destination_country')
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (error || !data) {
          // FALLBACK — use hardcoded lists
          setFetching(false);
          return;
        }

        const originNames = [...new Set(data.map(d => d.origin_country))];
        const destNames   = [...new Set(data.map(d => d.destination_country))];

        // Always keep the canonical list visible; append any extra DB countries.
        setOriginOptions(mergeCountries(FALLBACK_ORIGINS, originNames));
        setDestOptions(mergeCountries(FALLBACK_DESTINATIONS, destNames));
        setFetching(false);
      });
  }, []);

  if (!fontsLoaded) return null;

  const canContinue = origin !== null && destination !== null;

  const handleContinue = () => {
    if (!canContinue) return;
    navigation.navigate('SlotSelection', {
      origin:      origin.name,
      destination: destination.name,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.content, { paddingTop: insets.top + 24 }]}>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Where are you shipping?</Text>
            <Text style={styles.subtitle}>Select your origin and destination</Text>
          </View>
        </View>

        {fetching ? (
          <ActivityIndicator color={DS.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Origin picker */}
            <CountryPicker
              label="ORIGIN"
              selected={origin}
              placeholder="Select origin country"
              onPress={() => setOriginModalOpen(true)}
            />

            {/* Destination picker */}
            <CountryPicker
              label="DESTINATION"
              selected={destination}
              placeholder="Select destination country"
              onPress={() => setDestModalOpen(true)}
            />

            {/* Continue button */}
            <TouchableOpacity
              style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
              activeOpacity={canContinue ? 0.85 : 1}
              onPress={handleContinue}
              disabled={!canContinue}
            >
              <Text style={[styles.ctaText, !canContinue && styles.ctaTextDisabled]}>Continue</Text>
            </TouchableOpacity>

          </>
        )}
      </View>

      {/* Cancel button — absolute at bottom */}
      <TouchableOpacity
        style={[styles.cancelBtnBottom, { bottom: insets.bottom + 24 }]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('MainTabs')}
      >
        <Text style={styles.cancelBtnBottomText}>Cancel</Text>
      </TouchableOpacity>

      {/* Origin picker modal */}
      <CountryPickerModal
        visible={originModalOpen}
        options={originOptions}
        selected={origin}
        onSelect={setOrigin}
        onClose={() => setOriginModalOpen(false)}
      />

      {/* Destination picker modal */}
      <CountryPickerModal
        visible={destModalOpen}
        options={destOptions}
        selected={destination}
        onSelect={setDestination}
        onClose={() => setDestModalOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DS.bg },
  content:  { flex: 1, paddingHorizontal: 20 },

  // Header
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   20,
    color:      '#1A1A1A',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#6B6B6B',
    marginTop:  4,
  },
  cancelBtnBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnBottomText: {
    fontFamily:  'PlusJakartaSans_500Medium',
    fontSize:    14,
    color:       DS.textSecondary,
    textAlign:   'center',
  },

  // Picker group
  pickerGroup: { marginBottom: 16 },
  pickerLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         '#6B6B6B',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  8,
  },
  pickerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      12,
    padding:           14,
    paddingHorizontal: 16,
  },
  pickerValue: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   14,
    color:      '#1A1A1A',
  },
  pickerPlaceholder: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   14,
    color:      '#A0A0A0',
  },

  // CTA button
  ctaButton: {
    backgroundColor: '#1A1712',
    borderRadius:    12,
    padding:         15,
    alignItems:      'center',
    marginTop:       40,
  },
  ctaButtonDisabled: { backgroundColor: DS.accentDisabled },
  ctaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
  ctaTextDisabled: { color: '#A0A0A0' },
});
