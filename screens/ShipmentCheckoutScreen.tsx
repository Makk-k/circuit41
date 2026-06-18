import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Modal,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { pickImageFromLibrary } from '../lib/imagePicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path, Rect, G, Circle } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useStripe, usePlatformPay, PlatformPay } from '@stripe/stripe-react-native';
import { RootStackParamList } from '../App';
import AddressBottomSheet from '../components/AddressBottomSheet';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { FxRate, PaymentAccount, PickupPoint, SavedAddress, ShipmentProof, ShippingRate } from '../lib/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShipmentCheckout'>;

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

// ─── Payment method definitions ───────────────────────────────────────────────
type PaymentMethod = 'apple_pay' | 'google_pay' | 'card' | 'bank';

function countryCodeForAccount(countryName?: string | null): 'GB' | 'NG' {
  const normalized = (countryName ?? '').trim().toLowerCase();
  return normalized.includes('nigeria') ? 'NG' : 'GB';
}

function isNigeriaDestination(countryName?: string | null): boolean {
  return (countryName ?? '').trim().toLowerCase().includes('nigeria');
}

function shipmentReference(shipment: any, fallbackId: string): string {
  return (
    shipment?.tracking_reference ||
    shipment?.reference_id ||
    shipment?.order_reference ||
    '#' + fallbackId.substring(0, 8).toUpperCase()
  );
}

function currencySymbol(currency?: string | null): string {
  switch ((currency ?? 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'NGN': return '₦';
    case 'GBP': return '£';
    default: return '$';
  }
}

function formatMoney(amount: number, currency?: string | null): string {
  const normalized = (currency ?? 'USD').toUpperCase();
  const fractionDigits = normalized === 'NGN' ? 0 : 2;
  return `${currencySymbol(normalized)}${amount.toLocaleString('en-GB', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function rateForParcels(rate: ShippingRate | null, parcels: { category?: string | null; sensitive_types?: string[] | null }[]): number | null {
  if (!rate) return null;
  const categoryRates = parcels.flatMap(parcel => {
    if (parcel.category !== 'sensitive') return [rate.general_goods_rate];
    const types = parcel.sensitive_types ?? [];
    return types.map(type => {
      const normalized = type.toLowerCase();
      if (normalized.includes('battery')) return rate.battery_items_rate;
      if (normalized.includes('brand')) return rate.branded_goods_rate;
      if (normalized.includes('perfume')) return rate.liquid_goods_rate;
      if (normalized.includes('cell phone')) return rate.electronics_rate;
      return rate.general_goods_rate;
    });
  }).filter((value): value is number => value != null).map(Number);

  if (categoryRates.length === 0) return rate.general_goods_rate == null ? null : Number(rate.general_goods_rate);
  return Math.max(...categoryRates);
}

// ─── Apple logo SVG ───────────────────────────────────────────────────────────
const AppleIcon: React.FC = () => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="#1A1A1A">
    <Path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </Svg>
);

// ─── Google G SVG (multicolour) ───────────────────────────────────────────────
const GoogleIcon: React.FC = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24">
    <G>
      <Path d="M21.35 11.1H12v2.85h5.35c-.48 2.3-2.5 3.95-5.35 3.95-3.31 0-6-2.69-6-6s2.69-6 6-6c1.54 0 2.94.57 4.01 1.5l2.12-2.12A9.94 9.94 0 0012 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10 0-.67-.07-1.32-.2-1.95l-.45.05z" fill="#4285F4" />
      <Path d="M3.15 7.35l2.45 1.8A5.99 5.99 0 0112 6c1.54 0 2.94.57 4.01 1.5l2.12-2.12A9.94 9.94 0 0012 2a9.97 9.97 0 00-8.85 5.35z" fill="#EA4335" />
      <Path d="M12 22c2.43 0 4.67-.8 6.41-2.15l-2.96-2.43A6.01 6.01 0 0112 18c-2.84 0-5.25-1.9-6.1-4.5l-2.43 1.87A9.97 9.97 0 0012 22z" fill="#34A853" />
      <Path d="M21.8 10.05l-9.8.05v2.85h5.35a5.7 5.7 0 01-2.44 3.57l2.96 2.43C20.16 17.3 21.8 14.9 21.8 12c0-.67-.07-1.32-.2-1.95h.2z" fill="#FBBC05" />
    </G>
  </Svg>
);

// ─── Card icon SVG ────────────────────────────────────────────────────────────
const CardIcon: React.FC<{ color?: string }> = ({ color = '#6B6B6B' }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" />
    <Path d="M2 10h20" stroke={color} strokeWidth="1.5" />
  </Svg>
);

// ─── Upload / camera placeholder icon (32px) ─────────────────────────────────
const UploadIcon: React.FC = () => (
  <Svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <Path
      d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
      stroke="#D4D2CC"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="13" r="4" stroke="#D4D2CC" strokeWidth="1.5" />
  </Svg>
);

// ─── Bank icon SVG ────────────────────────────────────────────────────────────
const BankIcon: React.FC<{ color?: string }> = ({ color = '#6B6B6B' }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M8 10v11M12 10v11M16 10v11M20 10v11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ShipmentCheckoutScreen({ navigation, route }: Props) {
  const { shipmentId } = route.params;
  const { user } = useAuth();

  const { initPaymentSheet, presentPaymentSheet, handleNextAction } = useStripe();
  const { confirmPlatformPayPayment, isPlatformPaySupported } = usePlatformPay();
  const [confirmedAddress,   setConfirmedAddress]   = useState<string | null>(null);
  const [addressSheetOpen,   setAddressSheetOpen]   = useState(false);
  const [paymentMethod,      setPaymentMethod]      = useState<PaymentMethod>('card');
  const [savedAddresses,     setSavedAddresses]     = useState<SavedAddress[]>([]);
  const [paymentLoading,     setPaymentLoading]     = useState(false);
  const [proofUploaded,      setProofUploaded]      = useState(false);
  const [proofFileName,      setProofFileName]      = useState('');
  const [accountSelectorOpen, setAccountSelectorOpen] = useState(false);
  const [pickupInfoOpen,     setPickupInfoOpen]     = useState(false);

  const [shipmentData,      setShipmentData]      = useState<any>(null);
  const [savedCards,        setSavedCards]        = useState<any[]>([]);
  const [selectedCardId,    setSelectedCardId]    = useState<string | null>(null);
  const [stripeCustomerId,  setStripeCustomerId]  = useState<string | null>(null);
  const [proofs,            setProofs]            = useState<ShipmentProof[]>([]);
  const [paymentAccounts,   setPaymentAccounts]   = useState<PaymentAccount[]>([]);
  const [fxRates,           setFxRates]           = useState<FxRate[]>([]);
  const [accountsLoading,   setAccountsLoading]   = useState(false);
  const [selectedPaymentAccountId, setSelectedPaymentAccountId] = useState<string | null>(null);
  const [pickupPoints,      setPickupPoints]      = useState<PickupPoint[]>([]);
  const [pickupPointsLoading, setPickupPointsLoading] = useState(false);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | null>(null);
  const [expandedPickupPointId, setExpandedPickupPointId] = useState<string | null>(null);
  const [selectedShippingRate, setSelectedShippingRate] = useState<ShippingRate | null>(null);

  const [parcels, setParcels] = useState<{ status: string; category?: string | null; sensitive_types?: string[] | null }[]>([]);

  const effectiveRate = rateForParcels(selectedShippingRate, parcels) ?? (shipmentData?.slot_rate == null ? null : Number(shipmentData.slot_rate));
  const calculatedTotalCost =
    shipmentData?.total_weight && effectiveRate
      ? Number(shipmentData.total_weight) * effectiveRate
      : null;
  const totalCost: number | null = shipmentData?.total_cost ?? calculatedTotalCost;
  const isValidCost = totalCost !== null && !isNaN(totalCost) && totalCost > 0;
  const baseCurrency = (shipmentData?.rate_currency ?? 'USD').toUpperCase();
  const destinationIsNigeria = isNigeriaDestination(shipmentData?.destination_country);
  const selectedPaymentAccount =
    paymentAccounts.find(a => a.id === selectedPaymentAccountId) ?? null;
  const selectedPickupPoint =
    pickupPoints.find(p => p.id === selectedPickupPointId) ?? null;
  const paymentRef = shipmentReference(shipmentData, shipmentId);
  const canContinue = destinationIsNigeria ? !!selectedPickupPointId : !!confirmedAddress;
  const selectedFxRate =
    selectedPaymentAccount && baseCurrency !== selectedPaymentAccount.currency
      ? fxRates.find(rate =>
          rate.base_currency === baseCurrency &&
          rate.target_currency === selectedPaymentAccount.currency &&
          rate.is_active
        ) ?? null
      : null;
  const gbpFxRate =
    baseCurrency === 'GBP'
      ? null
      : fxRates.find(rate =>
          rate.base_currency === baseCurrency &&
          rate.target_currency === 'GBP' &&
          rate.is_active
        ) ?? null;
  const transferAmount =
    totalCost && selectedPaymentAccount
      ? baseCurrency === selectedPaymentAccount.currency
        ? totalCost
        : selectedFxRate
          ? totalCost * Number(selectedFxRate.rate)
          : null
      : null;
  const fxMissing = !!selectedPaymentAccount && !!totalCost && baseCurrency !== selectedPaymentAccount.currency && !selectedFxRate;
  const cardChargeAmount =
    totalCost == null
      ? null
      : baseCurrency === 'GBP'
        ? totalCost
        : gbpFxRate
          ? totalCost * Number(gbpFxRate.rate)
          : null;

  async function copyPickupAddress(point: PickupPoint) {
    await Clipboard.setStringAsync(point.address);
    Alert.alert('Copied', 'Pickup point address copied.');
  }

  // Addresses only need fetching once on mount — the user doesn't visit an
  // address screen mid-checkout, so no focus refresh is needed here.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data, error }) => {
        if (error) { Alert.alert('Error', error.message); return; }
        if (data) setSavedAddresses(data as SavedAddress[]);
      });
  }, [user]);

  // Cards and Stripe customer ID are refreshed every time this screen is focused.
  // This ensures that cards saved from SavedCardsScreen appear immediately when
  // the user navigates back to checkout without requiring a full re-mount.
  const fetchSavedCardsAndProfile = useCallback(async () => {
    if (!user) return;
    const [cardsRes, profileRes] = await Promise.all([
      supabase
        .from('saved_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false }),
      supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single(),
    ]);

    const cards = cardsRes.data || [];
    setSavedCards(cards);

    // Preserve current selection if it still exists in the refreshed list,
    // otherwise fall back to the first (default) card.
    setSelectedCardId(prev => {
      if (prev && cards.some((c: any) => c.id === prev)) return prev;
      return cards.length > 0 ? cards[0].id : null;
    });

    if (profileRes.data?.stripe_customer_id) {
      setStripeCustomerId(profileRes.data.stripe_customer_id);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const run = async () => {
        try {
          await fetchSavedCardsAndProfile();
        } catch (e) {
          console.error(e);
        }
      };
      run();
      return () => { isActive = false; };
    }, [fetchSavedCardsAndProfile])
  );

  useEffect(() => {
    supabase
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .single()
      .then(({ data }) => {
        if (data) setShipmentData(data);
      });
  }, [shipmentId]);

  useEffect(() => {
    if (!shipmentData?.shipping_rate_id) {
      setSelectedShippingRate(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('shipping_rates')
      .select('*')
      .eq('id', shipmentData.shipping_rate_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('[checkout] shipping rate unavailable:', error.message);
        setSelectedShippingRate((data ?? null) as ShippingRate | null);
      });
    return () => { cancelled = true; };
  }, [shipmentData?.shipping_rate_id]);

  useEffect(() => {
    let cancelled = false;
    const loadAccounts = async () => {
      setAccountsLoading(true);
      const { data, error } = await supabase
        .from('payment_accounts')
        .select('*')
        .eq('is_active', true)
        .in('country_code', ['GB', 'NG'])
        .order('country_name', { ascending: true });
      if (!cancelled) {
        if (error) {
          Alert.alert('Bank details unavailable', error.message);
        } else {
          const accounts = (data ?? []) as PaymentAccount[];
          setPaymentAccounts(accounts);
        }
        setAccountsLoading(false);
      }
    };
    loadAccounts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('fx_rates')
      .select('*')
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          Alert.alert('FX rates unavailable', error.message);
        } else {
          setFxRates((data ?? []) as FxRate[]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!paymentAccounts.length) return;
    const preferredCountry = countryCodeForAccount(shipmentData?.destination_country);
    const preferred = paymentAccounts.find(a => a.country_code === preferredCountry);
    setSelectedPaymentAccountId(prev => {
      if (prev && paymentAccounts.some(a => a.id === prev)) return prev;
      return preferred?.id ?? paymentAccounts[0]?.id ?? null;
    });
  }, [paymentAccounts, shipmentData?.destination_country]);

  useEffect(() => {
    if (!destinationIsNigeria) {
      setPickupPoints([]);
      setSelectedPickupPointId(null);
      setExpandedPickupPointId(null);
      return;
    }

    let cancelled = false;
    const loadPickupPoints = async () => {
      setPickupPointsLoading(true);
      const { data, error } = await supabase
        .from('pickup_points')
        .select('*')
        .eq('is_active', true)
        .eq('country_code', 'NG')
        .order('city', { ascending: true });
      if (!cancelled) {
        if (error) {
          Alert.alert('Pickup points unavailable', error.message);
        } else {
          const points = (data ?? []) as PickupPoint[];
          setPickupPoints(points);
          setSelectedPickupPointId(prev => {
            if (prev && points.some(p => p.id === prev)) return prev;
            return points[0]?.id ?? null;
          });
        }
        setPickupPointsLoading(false);
      }
    };
    loadPickupPoints();
    return () => { cancelled = true; };
  }, [destinationIsNigeria]);

  useEffect(() => {
    supabase
      .from('parcels')
      .select('status, category, sensitive_types')
      .eq('shipment_id', shipmentId)
      .then(({ data }) => {
        if (data) setParcels(data);
      });
  }, [shipmentId]);

  useEffect(() => {
    supabase
      .from('shipment_proofs')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setProofs(data as ShipmentProof[]);
      });
  }, [shipmentId]);

  const handleSaveNewAddress = async (address: string) => {
    if (!user) return;
    const label = savedAddresses.length === 0 ? 'Home' : 'Address';
    const { error } = await supabase
      .from('saved_addresses')
      .insert({ user_id: user.id, label, address_line: address, is_default: false });
    if (error) Alert.alert('Error', error.message);
  };

  const sanitizeFileName = (name: string): string =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').toLowerCase();

  const uploadPaymentProofFile = async (uri: string, rawName: string, mimeType: string) => {
    if (!user) {
      Alert.alert('Session expired', 'Please sign in again before uploading payment proof.');
      return;
    }
    if (!selectedPaymentAccount) {
      Alert.alert('Select bank account', 'Please select the bank account you paid before uploading proof.');
      return;
    }

    const safeFileName = sanitizeFileName(rawName || 'payment_proof_' + Date.now());
    const filePath = `${user.id}/${shipmentId}/payment-proof/${Date.now()}_${safeFileName}`;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      Alert.alert('Upload failed', uploadError.message);
      return;
    }

    const { error: recordError } = await supabase
      .from('payment_proofs')
      .insert({
        shipment_id: shipmentId,
        user_id: user.id,
        payment_account_id: selectedPaymentAccount.id,
        file_url: filePath,
        file_name: safeFileName,
        file_type: mimeType,
        status: 'submitted',
      });

    if (recordError) {
      Alert.alert('Proof saved to storage, but not recorded', recordError.message);
      return;
    }

    setProofUploaded(true);
    setProofFileName(safeFileName);
  };

  const uploadImage = async () => {
    const image = await pickImageFromLibrary();
    if (!image) return;
    try {
      await uploadPaymentProofFile(image.uri, image.fileName, image.mimeType);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload image');
    }
  };

  const uploadDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    const rawName = file.name || 'payment_proof_' + Date.now();
    try {
      await uploadPaymentProofFile(file.uri, rawName, file.mimeType ?? 'application/octet-stream');
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
  };

  const handleUploadProof = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Upload photo', 'Upload PDF / document'], cancelButtonIndex: 0 },
        idx => {
          if (idx === 1) uploadImage();
          if (idx === 2) uploadDocument();
        },
      );
    } else {
      Alert.alert('Upload payment proof', 'Choose file type', [
        { text: 'Upload photo',         onPress: uploadImage },
        { text: 'Upload PDF / document', onPress: uploadDocument },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleConfirmAndPay = async () => {
    if (!canContinue) {
      Alert.alert(
        destinationIsNigeria ? 'Select a pickup point' : 'Select a delivery address',
        destinationIsNigeria
          ? 'Please select where the recipient will collect this shipment before continuing to payment.'
          : 'Please select or add a delivery address before continuing to payment.',
      );
      return;
    }

    const hasUnArrived = parcels.some(p => p.status !== 'arrived');
    if (hasUnArrived) {
      Alert.alert(
        'Parcels still in transit',
        'All parcels must be marked as arrived before you can proceed to checkout.',
      );
      return;
    }

    setPaymentLoading(true);

    try {
      if (!isValidCost || totalCost == null) {
        Alert.alert('Payment unavailable', 'Amount due is not available yet.');
        return;
      }

      const costUpdate = {
        total_cost: totalCost,
        rate_currency: baseCurrency,
        slot_rate: effectiveRate,
      };

      // For bank transfer — skip Stripe, just update shipment
      if (paymentMethod === 'bank') {
        if (!selectedPaymentAccount) {
          Alert.alert('Select bank account', 'Please select a bank account for your transfer.');
          return;
        }
        if (!proofUploaded) {
          Alert.alert('Upload payment proof', 'Please upload a screenshot or PDF of your bank transfer before continuing.');
          return;
        }
        if (fxMissing || transferAmount == null) {
          Alert.alert('FX rate unavailable', `No active ${baseCurrency} to ${selectedPaymentAccount.currency} FX rate is available. Please contact support before making a bank transfer.`);
          return;
        }
        const { error } = await supabase
          .from('shipments')
          .update({
            ...costUpdate,
            delivery_address: destinationIsNigeria ? selectedPickupPoint?.address ?? null : confirmedAddress,
            pickup_point_id:  destinationIsNigeria ? selectedPickupPointId : null,
            payment_method:   'bank_transfer',
            payment_status:   'pending',
            status:           'received',
          })
          .eq('id', shipmentId);

        if (error) throw error;
        navigation.navigate('ShipmentActive', { shipmentId });
        return;
      }

      // For card / Apple Pay / Google Pay — use Stripe
      const amount: number | null = cardChargeAmount;

      // ── Session check ────────────────────────────────────────────────────────
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session     = sessionData?.session;
      const accessToken = session?.access_token;

      if (sessionError || !session || !accessToken) {
        Alert.alert('Session expired', 'Please sign in again before making payment.');
        return;
      }

      // ── Amount guard ─────────────────────────────────────────────────────────
      if (amount === null || amount === undefined || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
        Alert.alert('Payment unavailable', baseCurrency === 'GBP'
          ? 'Total cost must be greater than 0 before payment can proceed.'
          : `No active ${baseCurrency} to GBP FX rate is available for card payment.`);
        return;
      }

      // ── Resolve saved card fields (if applicable) ─────────────────────────────
      // A saved card is usable only when:
      //   1. The user has a Stripe customer ID (means cards are properly attached)
      //   2. A card is selected
      //   3. That card record has a stripe_payment_method_id
      const selectedCard = savedCards.find(c => c.id === selectedCardId);
      const savedPaymentMethodId: string | null =
        paymentMethod === 'card' &&
        selectedCardId !== null &&
        stripeCustomerId !== null &&
        selectedCard?.stripe_payment_method_id
          ? selectedCard.stripe_payment_method_id
          : null;

      const usingSavedCard = savedPaymentMethodId !== null;

      // Guard: if saved cards exist, the user must select one before proceeding.
      // If there are no saved cards, fall through to the PaymentSheet card entry flow.
      if (paymentMethod === 'card' && savedCards.length > 0 && !usingSavedCard) {
        Alert.alert('Select a card', 'Please select a saved card or add a new one to continue.');
        return;
      }

      // ── Fetch clientSecret from Edge Function ──────────────────────────────────
      const functionUrl = `${SUPABASE_URL}/functions/v1/create-payment-intent`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey:         SUPABASE_ANON_KEY,
          Authorization:  `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          shipmentId,
          amount,
          currency:      'gbp',
          paymentMethod,
          // Saved-card fields — only present when reusing an attached card
          ...(usingSavedCard ? {
            stripeCustomerId,
            savedPaymentMethodId,
          } : {}),
        }),
      });

      const rawText = await response.text();

      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        const errorMessage: string =
          parsed?.error ??
          parsed?.message ??
          'Payment request failed. Please try again.';
        Alert.alert('Payment failed', errorMessage);
        return;
      }

      if (!parsed?.clientSecret) {
        const errMsg: string = parsed?.error ?? 'Edge Function did not return a clientSecret';
        Alert.alert('Payment failed', errMsg);
        return;
      }

      const clientSecret: string = parsed.clientSecret;

      // ── Branch: present the correct Stripe flow per selected method ────────────

      if (paymentMethod === 'apple_pay') {
        // Native Apple Pay sheet — no generic PaymentSheet
        const supported = await isPlatformPaySupported();
        if (!supported) {
          Alert.alert('Apple Pay unavailable', 'Apple Pay is not available on this device or build.');
          return;
        }
        const { error: applePayError } = await confirmPlatformPayPayment(clientSecret, {
          applePay: {
            cartItems: [
              {
                label:       'Circuit 40s Shipment',
                amount:      amount.toFixed(2),
                paymentType: PlatformPay.PaymentType.Immediate,
              },
            ],
            merchantCountryCode: 'GB',
            currencyCode:        'GBP',
          },
        });
        if (applePayError) {
          if (applePayError.code === 'Canceled') return;
          throw applePayError;
        }

      } else if (paymentMethod === 'google_pay') {
        // Native Google Pay sheet — no generic PaymentSheet
        const supported = await isPlatformPaySupported({ googlePay: { testEnv: __DEV__ } });
        if (!supported) {
          Alert.alert('Google Pay unavailable', 'Google Pay is not available on this device or build.');
          return;
        }
        const { error: googlePayError } = await confirmPlatformPayPayment(clientSecret, {
          googlePay: {
            merchantCountryCode: 'GB',
            currencyCode:        'GBP',
            testEnv:             __DEV__,
            merchantName:        'Circuit 40s',
          },
        });
        if (googlePayError) {
          if (googlePayError.code === 'Canceled') return;
          throw googlePayError;
        }

      } else if (paymentMethod === 'card') {
        if (usingSavedCard) {
          // ── Saved card path ────────────────────────────────────────────────
          // The backend already confirmed the PaymentIntent server-side using
          // confirm:true. We never ask Stripe for new card details here.
          //
          // Three outcomes from the backend:
          //   'succeeded'        → payment done, no client action needed
          //   'requires_action'  → 3DS challenge required, call handleNextAction
          //   anything else      → treat as a decline / error
          const piStatus: string = parsed.paymentIntentStatus ?? '';

          if (piStatus === 'succeeded') {
            // Payment confirmed server-side with no additional authentication needed.

          } else if (piStatus === 'requires_action') {
            // Stripe requires 3DS or another next action — let the SDK handle it.
            // handleNextAction shows the challenge sheet and returns the updated
            // PaymentIntent once the user completes (or abandons) authentication.
            const { paymentIntent: updatedIntent, error: nextActionError } =
              await handleNextAction(clientSecret, 'circuit41://stripe-redirect');

            if (nextActionError) {
              if (nextActionError.code === 'Canceled') return;
              throw nextActionError;
            }

            if (!updatedIntent || updatedIntent.status !== 'Succeeded') {
              throw new Error(
                `Payment authentication failed (status: ${updatedIntent?.status ?? 'unknown'})`,
              );
            }

          } else {
            // Payment was declined or failed during server-side confirmation.
            throw new Error(
              piStatus === 'requires_payment_method'
                ? 'Your card was declined. Please try a different card.'
                : `Payment could not be completed (status: ${piStatus || 'unknown'})`,
            );
          }

        } else {
          // ── New card entry path ────────────────────────────────────────────
          // No saved card selected (or card not yet attached to a customer).
          // Fall back to the generic PaymentSheet so the user can enter details.
          const { error: initError } = await initPaymentSheet({
            merchantDisplayName:         'Circuit 40s',
            paymentIntentClientSecret:   clientSecret,
            allowsDelayedPaymentMethods: false,
            style:                       'automatic',
            returnURL:                   'circuit41://stripe-redirect',
          });

          if (initError) throw initError;

          const { error: paymentError } = await presentPaymentSheet();
          if (paymentError) {
            if (paymentError.code === 'Canceled') return;
            throw paymentError;
          }
        }
      }

      // Payment succeeded — update shipment
      const { error: updateError } = await supabase
        .from('shipments')
        .update({
          ...costUpdate,
          delivery_address: destinationIsNigeria ? selectedPickupPoint?.address ?? null : confirmedAddress,
          pickup_point_id:  destinationIsNigeria ? selectedPickupPointId : null,
          payment_method:   paymentMethod,
          payment_status:   'paid',
          status:           'received',
        })
        .eq('id', shipmentId);

      if (updateError) throw updateError;

      navigation.navigate('ShipmentActive', { shipmentId });

    } catch (err: any) {
      Alert.alert('Payment failed', err.message || 'Something went wrong');
    } finally {
      setPaymentLoading(false);
    }
  };

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Back header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={DS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete your shipment</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SECTION 1: Delivery / Pickup ───────────────────────────────── */}
        <Text style={[styles.sectionLabel, destinationIsNigeria && styles.pickupSectionTitle]}>
          {destinationIsNigeria ? 'Select pickup point' : 'DELIVERY ADDRESS'}
        </Text>

        {destinationIsNigeria ? (
          <View style={styles.pickupCard}>
            <View style={styles.pickupIntroRow}>
              <Text style={styles.pickupIntro}>
                Choose where the recipient will collect this shipment.
              </Text>
              <TouchableOpacity
                style={styles.pickupInfoButton}
                activeOpacity={0.7}
                onPress={() => setPickupInfoOpen(true)}
              >
                <Ionicons name="information-circle-outline" size={19} color={DS.textSecondary} />
              </TouchableOpacity>
            </View>

            {pickupPointsLoading ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={DS.accent} />
                <Text style={styles.inlineLoadingText}>Loading pickup points…</Text>
              </View>
            ) : pickupPoints.length === 0 ? (
              <Text style={styles.emptyHelper}>No pickup points are available yet.</Text>
            ) : (
              pickupPoints.map(point => (
                <TouchableOpacity
                  key={point.id}
                  style={[
                    styles.pickupOption,
                    selectedPickupPointId === point.id && styles.pickupOptionSelected,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedPickupPointId(point.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickupName}>{point.name}</Text>
                    {expandedPickupPointId === point.id && (
                      <View style={styles.pickupDetails}>
                        <Text style={styles.pickupFullAddress}>{point.address}</Text>
                        <TouchableOpacity
                          style={styles.pickupCopyButton}
                          activeOpacity={0.7}
                          onPress={(event) => {
                            event.stopPropagation();
                            copyPickupAddress(point);
                          }}
                        >
                          <Ionicons name="copy-outline" size={14} color={DS.textSecondary} />
                          <Text style={styles.pickupCopyText}>Copy address</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={(event) => {
                        event.stopPropagation();
                        setExpandedPickupPointId(prev => prev === point.id ? null : point.id);
                      }}
                    >
                      <Text style={styles.pickupDetailsToggle}>
                        {expandedPickupPointId === point.id ? 'Hide details' : 'View details'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {selectedPickupPointId === point.id && (
                    <Ionicons name="checkmark-circle" size={19} color={DS.accent} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addressTrigger}
            activeOpacity={0.8}
            onPress={() => setAddressSheetOpen(true)}
          >
            {/* Location pin icon */}
            <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"
                stroke={confirmedAddress ? DS.textPrimary : DS.textSecondary}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <Path
                d="M12 13a3 3 0 100-6 3 3 0 000 6z"
                stroke={confirmedAddress ? DS.textPrimary : DS.textSecondary}
                strokeWidth="1.5"
              />
            </Svg>
            <Text
              style={[styles.addressTriggerText, confirmedAddress && styles.addressTriggerConfirmed]}
              numberOfLines={1}
            >
              {confirmedAddress ?? 'Select delivery address'}
            </Text>
            {/* Chevron right */}
            <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <Path d="M9 18l6-6-6-6" stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}

        {/* ── SECTION 2: Cost Breakdown ─────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>COST BREAKDOWN</Text>

        <View style={styles.pricingCard}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Total weight</Text>
            <Text style={styles.pricingAmount}>
              {shipmentData?.total_weight ? shipmentData.total_weight + ' kg' : 'Pending'}
            </Text>
          </View>

          <View style={[styles.pricingRow, { marginTop: 8 }]}>
            <Text style={styles.pricingLabel}>Rate per kg</Text>
            <Text style={styles.pricingAmount}>
              {effectiveRate ? `${currencySymbol(baseCurrency)}${effectiveRate}/kg` : 'TBC'}
            </Text>
          </View>

          <View style={styles.pricingDivider} />

          <View style={styles.pricingRow}>
            <Text style={styles.totalLabel}>Amount due</Text>
            <Text style={[styles.totalAmount, { fontSize: 16 }]}>
              {shipmentData?.total_cost
                ? formatMoney(Number(shipmentData.total_cost), baseCurrency)
                : calculatedTotalCost
                  ? formatMoney(calculatedTotalCost, baseCurrency)
                : 'Pending'}
            </Text>
          </View>
        </View>

        {/* ── SECTION: Weight & Volume Proof ───────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>WEIGHT & VOLUME PROOF</Text>

        <View style={[styles.photoCard, { height: undefined, justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12 }]}>
          {/* Weight proofs */}
          {(() => {
            const weightProofs = proofs.filter(p => p.proof_type === 'weight');
            return (
              <View style={{ width: '100%' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#A0A0A0', marginBottom: 6 }}>WEIGHT</Text>
                {weightProofs.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {weightProofs.map(p => (
                      <Image key={p.id} source={{ uri: p.file_url }} style={styles.proofThumb} resizeMode="cover" />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.photoEmptyState}>
                    <UploadIcon />
                    <Text style={styles.photoEmptyTitle}>No photos yet</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Volume proofs */}
          {(() => {
            const volumeProofs = proofs.filter(p => p.proof_type === 'volume');
            return (
              <View style={{ width: '100%' }}>
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#A0A0A0', marginBottom: 6 }}>VOLUME</Text>
                {volumeProofs.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {volumeProofs.map(p => (
                      <Image key={p.id} source={{ uri: p.file_url }} style={styles.proofThumb} resizeMode="cover" />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.photoEmptyState}>
                    <UploadIcon />
                    <Text style={styles.photoEmptyTitle}>No photos yet</Text>
                  </View>
                )}
              </View>
            );
          })()}
        </View>

        {/* ── SECTION 3: Payment Method ─────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PAYMENT</Text>

        {/* Card payment */}
        <TouchableOpacity
          style={[
            styles.paymentCard,
            paymentMethod === 'card' && styles.paymentCardSelected,
          ]}
          activeOpacity={0.8}
          onPress={() => setPaymentMethod('card')}
        >
          <CardIcon color={paymentMethod === 'card' ? '#FFFFFF' : '#6B6B6B'} />
          <Text style={[styles.paymentLabel, paymentMethod === 'card' && styles.paymentLabelOn]}>Pay by card</Text>
          {paymentMethod === 'card' && (
            <View style={styles.selectedDot} />
          )}
        </TouchableOpacity>

        {/* Saved cards — shown when card is selected */}
        {paymentMethod === 'card' && (
          <View style={{ backgroundColor: '#F5F9F6', borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 8 }}>
            {savedCards.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#A0A0A0', marginBottom: 12 }}>
                No saved cards yet
              </Text>
            ) : (
              savedCards.map(card => (
                <TouchableOpacity
                  key={card.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: '#E2E0DA',
                  }}
                  onPress={() => setSelectedCardId(card.id)}
                >
                  <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500' }}>
                    {card.card_brand?.toUpperCase()} •••• {card.card_last4}
                    {'  '}
                    <Text style={{ fontSize: 11, color: '#6B6B6B', fontWeight: '400' }}>
                      {card.card_exp_month}/{card.card_exp_year}
                    </Text>
                  </Text>
                  <View style={{
                    width: 18, height: 18, borderRadius: 9,
                    borderWidth: 1.5,
                    borderColor: selectedCardId === card.id ? '#CD643D' : '#D4D2CC',
                    backgroundColor: selectedCardId === card.id ? '#CD643D' : 'transparent',
                  }} />
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity
              style={{ marginTop: 12 }}
              onPress={() => navigation.navigate('SavedCards')}
            >
              <Text style={{ fontSize: 13, color: '#CD643D', fontWeight: '600' }}>
                + Add new card
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bank transfer */}
        <TouchableOpacity
          style={[
            styles.paymentCard,
            paymentMethod === 'bank' && styles.paymentCardSelected,
          ]}
          activeOpacity={0.8}
          onPress={() => setPaymentMethod('bank')}
        >
          <BankIcon color={paymentMethod === 'bank' ? '#FFFFFF' : '#6B6B6B'} />
          <Text style={[styles.paymentLabel, paymentMethod === 'bank' && styles.paymentLabelOn]}>Bank transfer</Text>
          {paymentMethod === 'bank' && (
            <View style={styles.selectedDot} />
          )}
        </TouchableOpacity>

        {/* Bank details block — shown only when bank transfer is selected */}
        {paymentMethod === 'bank' && (
          <View style={styles.bankDetailsCard}>
            <Text style={styles.bankSelectorLabel}>Bank account country</Text>
            <TouchableOpacity
              style={styles.bankSelector}
              activeOpacity={0.8}
              onPress={() => setAccountSelectorOpen(open => !open)}
            >
              <Text style={styles.bankSelectorText}>
                {selectedPaymentAccount
                  ? `${selectedPaymentAccount.country_name} (${selectedPaymentAccount.currency})`
                  : accountsLoading ? 'Loading accounts…' : 'Select account'}
              </Text>
              <Ionicons name={accountSelectorOpen ? 'chevron-up' : 'chevron-down'} size={16} color={DS.textSecondary} />
            </TouchableOpacity>

            {accountSelectorOpen && (
              <View style={styles.bankSelectorMenu}>
                {paymentAccounts.map(account => (
                  <TouchableOpacity
                    key={account.id}
                    style={styles.bankSelectorOption}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedPaymentAccountId(account.id);
                      setProofUploaded(false);
                      setProofFileName('');
                      setAccountSelectorOpen(false);
                    }}
                  >
                    <Text style={styles.bankSelectorOptionText}>
                      {account.country_name} ({account.currency})
                    </Text>
                    {selectedPaymentAccountId === account.id && (
                      <Ionicons name="checkmark" size={16} color={DS.accent} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedPaymentAccount ? (
              <>
                <BankDetailRow label="Bank"           value={selectedPaymentAccount.bank_name} />
                <BankDetailRow label="Account name"   value={selectedPaymentAccount.account_name} />
                <BankDetailRow label="Account number" value={selectedPaymentAccount.account_number} />
                {selectedPaymentAccount.sort_code ? (
                  <BankDetailRow label="Sort code" value={selectedPaymentAccount.sort_code} />
                ) : null}
                {selectedPaymentAccount.iban ? (
                  <BankDetailRow label="IBAN" value={selectedPaymentAccount.iban} />
                ) : null}
                {selectedPaymentAccount.swift_bic ? (
                  <BankDetailRow label="SWIFT/BIC" value={selectedPaymentAccount.swift_bic} />
                ) : null}
                <BankDetailRow label="Reference" value={paymentRef} last />
                {transferAmount != null ? (
                  <View style={styles.transferAmountBox}>
                    <Text style={styles.transferAmountLabel}>Transfer amount</Text>
                    <Text style={styles.transferAmountValue}>
                      {formatMoney(transferAmount, selectedPaymentAccount.currency)}
                    </Text>
                  </View>
                ) : fxMissing ? (
                  <View style={styles.transferErrorBox}>
                    <Text style={styles.transferErrorText}>
                      FX rate unavailable. Please contact support before making this transfer.
                    </Text>
                  </View>
                ) : null}
                {selectedPaymentAccount.instructions ? (
                  <Text style={styles.bankInstructions}>{selectedPaymentAccount.instructions}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.emptyHelper}>
                Bank details are currently unavailable. Please try again shortly.
              </Text>
            )}

            {/* Divider */}
            <View style={styles.bankUploadDivider} />

            {/* Upload payment proof */}
            {proofUploaded ? (
              <View style={styles.bankUploadSuccessRow}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={styles.bankUploadSuccessText}>{proofFileName}</Text>
                <TouchableOpacity onPress={handleUploadProof}>
                  <Text style={styles.bankUploadRemove}>Upload another</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.bankUploadBtn}
                  activeOpacity={0.7}
                  onPress={handleUploadProof}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                      stroke="#A0A0A0"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={styles.bankUploadText}>Upload payment proof</Text>
                </TouchableOpacity>
                <Text style={styles.bankUploadHelper}>
                  Upload a screenshot or PDF of your bank transfer
                </Text>
              </>
            )}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={canContinue ? styles.ctaButton : styles.ctaButtonHollow}
          activeOpacity={0.85}
          onPress={handleConfirmAndPay}
          disabled={paymentLoading}
        >
          {paymentLoading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={canContinue ? styles.ctaText : styles.ctaTextHollow}>
                {canContinue
                  ? 'Confirm and pay'
                  : destinationIsNigeria ? 'Select pickup point to continue' : 'Select address to continue'}
              </Text>
          }
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={pickupInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickupInfoOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPickupInfoOpen(false)}
        >
          <TouchableOpacity style={styles.infoModalCard} activeOpacity={1}>
            <View style={styles.infoModalHeader}>
              <Text style={styles.infoModalTitle}>Pickup information</Text>
              <TouchableOpacity onPress={() => setPickupInfoOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={DS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.infoModalText}>
              Nigeria-bound shipments may be collected from designated pickup warehouses. Final local delivery may be arranged separately where available.
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delivery address bottom sheet */}
      <AddressBottomSheet
        visible={!destinationIsNigeria && addressSheetOpen}
        onClose={() => setAddressSheetOpen(false)}
        onConfirm={(addr) => setConfirmedAddress(addr)}
        onSaveNewAddress={handleSaveNewAddress}
        savedAddresses={savedAddresses}
      />
    </SafeAreaView>
  );
}

// ─── Bank detail row helper ───────────────────────────────────────────────────
type BankDetailRowProps = { label: string; value: string; last?: boolean };

const BankDetailRow: React.FC<BankDetailRowProps> = ({ label, value, last }) => (
  <View style={[bankRowStyles.row, !last && bankRowStyles.bordered]}>
    <Text style={bankRowStyles.label}>{label}</Text>
    <Text style={bankRowStyles.value}>{value}</Text>
  </View>
);

const bankRowStyles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  label: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      'rgba(255,255,255,0.60)',
  },
  value: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   13,
    color:      '#FFFFFF',
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: DS.bg,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   16,
  },
  backButton: {
    width:           36,
    height:          36,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
    padding:         8,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   20,
    color:      DS.textPrimary,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom:     48,
  },

  // Section label
  sectionLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         DS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom:  10,
  },
  pickupSectionTitle: {
    fontFamily:    'PlusJakartaSans_700Bold',
    fontSize:      15,
    color:         DS.textPrimary,
    letterSpacing: 0,
    textTransform: 'none',
  },

  // Address trigger row — taps to open bottom sheet
  addressTrigger: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      12,
    padding:           14,
    paddingHorizontal: 16,
    gap:               10,
    marginBottom:      0,
  },
  addressTriggerText: {
    flex:       1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   14,
    color:      DS.textSecondary,
  },
  addressTriggerConfirmed: {
    color: DS.textPrimary,
  },
  pickupCard: {
    backgroundColor: DS.card,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  pickupIntroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickupIntro: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: DS.textSecondary,
  },
  pickupInfoButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F5F9F6',
  },
  pickupOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    backgroundColor: '#F5F9F6',
  },
  pickupOptionSelected: {
    borderColor: DS.accent,
    backgroundColor: '#FFFCFA',
  },
  pickupName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: DS.textPrimary,
  },
  pickupDetails: {
    borderTopWidth: 1,
    borderTopColor: '#EDEBE5',
    marginTop: 10,
    paddingTop: 10,
    gap: 8,
  },
  pickupFullAddress: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: DS.textSecondary,
  },
  pickupDetailsToggle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: DS.accent,
    marginTop: 8,
  },
  pickupCopyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F5F9F6',
  },
  pickupCopyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: DS.textSecondary,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  inlineLoadingText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: DS.textSecondary,
  },
  emptyHelper: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: DS.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    padding: 24,
  },
  infoModalCard: {
    backgroundColor: DS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: DS.border,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoModalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: DS.textPrimary,
  },
  infoModalText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: DS.textSecondary,
  },

  // Pricing card
  pricingCard: {
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    14,
    padding:         16,
    paddingHorizontal: 18,
  },
  amberNotice: {
    backgroundColor: '#FEF3C7',
    borderRadius:    10,
    padding:         10,
    paddingHorizontal: 12,
    marginBottom:    12,
  },
  amberNoticeText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      '#B45309',
  },
  pricingRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  pricingLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
  },
  pricingAmount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  pricingDivider: {
    height:          1,
    backgroundColor: DS.border,
    marginVertical:  12,
  },
  totalLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  totalAmount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   15,
    color:      DS.textPrimary,
  },

  // Photo evidence card
  photoCard: {
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    14,
    padding:         20,
    paddingHorizontal: 18,
    height:          120,
    justifyContent:  'center',
    alignItems:      'center',
  },
  photoEmptyState: {
    alignItems: 'center',
  },
  photoEmptyTitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      '#A0A0A0',
    marginTop:  8,
  },
  photoEmptySubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      '#A0A0A0',
    textAlign:  'center',
    marginTop:  4,
    maxWidth:   200,
  },
  proofThumb: {
    width:        80,
    height:       80,
    borderRadius: 10,
    marginRight:  8,
    backgroundColor: '#ECEAE4',
  },

  // Apple Pay + Google Pay side-by-side row
  digitalPayRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  8,
  },
  digitalPayCard: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    12,
    padding:         14,
    paddingHorizontal: 10,
  },
  digitalPayLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   13,
    color:      DS.textPrimary,
  },

  // Payment cards
  paymentCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: DS.card,
    borderRadius:    14,
    padding:         14,
    paddingHorizontal: 16,
    marginBottom:    8,
    gap:             10,
    // borderless — depth via soft shadow
    shadowColor: '#1A1A1A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  paymentCardSelected: {
    backgroundColor: '#1A1712',   // dark solid selected (like the service card), no border, no blue
  },
  paymentLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   14,
    color:      DS.textPrimary,
    flex:       1,
  },
  paymentLabelOn: {
    color: '#FFFFFF',
  },
  selectedDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#FFFFFF',
  },

  // Bank details — borderless solid card
  bankDetailsCard: {
    backgroundColor: '#1A1712',
    shadowColor: '#140F08', shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 8,
    borderRadius:    16,
    padding:         16,
    paddingHorizontal: 16,
    marginBottom:    8,
    marginTop:       8,
  },
  bankSelectorLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bankSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#231F19',
    marginBottom: 8,
  },
  bankSelectorText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  bankSelectorMenu: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  bankSelectorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#231F19',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bankSelectorOptionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
  bankInstructions: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.60)',
    marginTop: 8,
  },
  transferAmountBox: {
    backgroundColor: '#231F19',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  transferAmountLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.60)',
    marginBottom: 4,
  },
  transferAmountValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  transferErrorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  transferErrorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: '#991B1B',
  },

  // Bank upload proof
  bankUploadDivider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop:       12,
    marginBottom:    12,
  },
  bankUploadBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.28)',
    borderStyle:     'dashed',
    borderRadius:    10,
    padding:         13,
  },
  bankUploadText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      'rgba(255,255,255,0.75)',
  },
  bankUploadHelper: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      '#A0A0A0',
    textAlign:  'center',
    marginTop:  6,
  },
  bankUploadSuccessRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    paddingVertical: 4,
  },
  bankUploadSuccessText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      '#22C55E',
    flex:       1,
  },
  bankUploadRemove: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      '#A0A0A0',
  },

  // CTA
  ctaButton: {
    backgroundColor: '#1A1712',
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       24,
  },
  ctaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },

  // CTA hollow state — shown when no address is selected
  ctaButtonHollow: {
    borderWidth:     1.5,
    borderColor:     DS.border,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       24,
  },
  ctaTextHollow: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   14,
    color:      '#C0BDBB',
  },
});
