import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { Svg, Path } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedCards'>;

const DS = {
  bg:            '#F5F9F6',
  card:          '#FFFFFF',
  border:        '#E2E0DA',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  accent:        '#CD643D',
} as const;

export default function SavedCardsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { createPaymentMethod } = useStripe();

  const [cards,        setCards]        = useState<any[]>([]);
  const [cardComplete, setCardComplete] = useState(false);
  const [saving,       setSaving]       = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const fetchCards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });
    setCards(data || []);
  }, [user]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSetDefault = async (cardId: string) => {
    if (!user) return;
    await supabase
      .from('saved_cards')
      .update({ is_default: false })
      .eq('user_id', user.id);
    await supabase
      .from('saved_cards')
      .update({ is_default: true })
      .eq('id', cardId);
    fetchCards();
  };

  const handleDelete = (cardId: string) => {
    Alert.alert('Remove card', 'Are you sure you want to remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('saved_cards').delete().eq('id', cardId);
          fetchCards();
        },
      },
    ]);
  };

  const handleSaveCard = async () => {
    if (!cardComplete || !user) return;
    setSaving(true);
    try {
      // Step 1: Create a Stripe PaymentMethod from the card field
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: 'Card',
      });
      if (error) { Alert.alert('Error', error.message); return; }

      // Step 2: Extract and validate card metadata.
      // The Stripe React Native SDK returns card details under `Card` (capital C),
      // not `card` (lowercase).  Accessing the wrong key returns undefined, which
      // causes fallback zeros to be stored — so we read from the correct key here.
      const cardData = paymentMethod!.Card;

      const pmId     = paymentMethod!.id;
      const brand    = cardData?.brand;
      const last4    = cardData?.last4;
      const expMonth = cardData?.expMonth;
      const expYear  = cardData?.expYear;

      if (!pmId || !brand || !last4 || !(expMonth && expMonth > 0) || !(expYear && expYear > 0)) {
        Alert.alert('Card save failed', 'Could not read card details. Please try again.');
        return;
      }

      // Step 3: Attach the PaymentMethod to a Stripe Customer via Edge Function.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        Alert.alert('Session expired', 'Please sign in again before saving a card.');
        return;
      }

      const setupRes = await fetch(`${SUPABASE_URL}/functions/v1/setup-payment-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey:         SUPABASE_ANON_KEY,
          Authorization:  `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ paymentMethodId: pmId }),
      });

      if (!setupRes.ok) {
        const setupErr = await setupRes.json().catch(() => ({}));
        Alert.alert('Error', setupErr?.error ?? 'Failed to save card. Please try again.');
        return;
      }

      // Step 4: Store validated card metadata in saved_cards
      const { error: dbError } = await supabase.from('saved_cards').insert({
        user_id:                  user.id,
        stripe_payment_method_id: pmId,
        card_brand:               brand,
        card_last4:               last4,
        card_exp_month:           expMonth,
        card_exp_year:            expYear,
        is_default:               cards.length === 0,
      });
      if (dbError) { Alert.alert('Error', dbError.message); return; }

      Alert.alert('Success', 'Card saved');
      setCardComplete(false);
      fetchCards();
    } finally {
      setSaving(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={DS.textPrimary}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment methods</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Saved cards */}
        {cards.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>SAVED CARDS</Text>
            <View style={styles.card}>
              {cards.map((card, idx) => (
                <React.Fragment key={card.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.cardRow}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardBrand}>
                        {card.card_brand?.toUpperCase()} •••• {card.card_last4}
                      </Text>
                      <Text style={styles.cardExpiry}>
                        Expires {card.card_exp_month}/{card.card_exp_year}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      {card.is_default ? (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultPillText}>Default</Text>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => handleSetDefault(card.id)} activeOpacity={0.7}>
                          <Text style={styles.setDefaultText}>Set default</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => handleDelete(card.id)}
                        activeOpacity={0.7}
                        style={{ marginLeft: 12 }}
                      >
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                            stroke="#DC2626"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </TouchableOpacity>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* Add new card */}
        <Text style={[styles.sectionLabel, { marginTop: cards.length > 0 ? 24 : 0 }]}>
          ADD NEW CARD
        </Text>

        <CardField
          postalCodeEnabled={false}
          placeholders={{ number: '4242 4242 4242 4242' }}
          cardStyle={{
            backgroundColor:  '#FFFFFF',
            textColor:        '#1A1A1A',
            borderColor:      '#E2E0DA',
            borderWidth:      1,
            borderRadius:     12,
            placeholderColor: '#A0A0A0',
          }}
          style={{ width: '100%', height: 50, marginVertical: 12 }}
          onCardChange={(cardDetails) => setCardComplete(cardDetails.complete)}
        />

        <TouchableOpacity
          style={[styles.saveButton, !cardComplete && styles.saveButtonDisabled]}
          activeOpacity={cardComplete ? 0.85 : 1}
          disabled={!cardComplete || saving}
          onPress={handleSaveCard}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.saveButtonText}>Save card</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DS.bg },

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
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   18,
    color:      DS.textPrimary,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom:     48,
  },

  sectionLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      10,
    color:         DS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  10,
  },

  card: {
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    16,
    overflow:        'hidden',
  },

  cardRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  cardInfo: { flex: 1 },
  cardBrand: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  cardExpiry: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
    marginTop:  2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  setDefaultText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      DS.textSecondary,
  },
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

  divider: {
    height:          1,
    backgroundColor: DS.border,
    marginHorizontal: 16,
  },

  saveButton: {
    backgroundColor: '#1A1712',
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#D4D2CC',
  },
  saveButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
});
