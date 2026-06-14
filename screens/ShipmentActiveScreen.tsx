import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path, Circle } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ShipmentActive'>;

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:            '#F7F6F0',
  card:          '#FFFFFF',
  border:        '#E2E0DA',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  accent:        '#C10F1D',
} as const;

// ─── Progress ring dimensions ─────────────────────────────────────────────────
const RING_RADIUS      = 48;
const RING_STROKE      = 3;
const RING_SIZE        = (RING_RADIUS + RING_STROKE) * 2; // 102
const RING_CENTER      = RING_SIZE / 2;                   // 51
const CIRCUMFERENCE    = 2 * Math.PI * RING_RADIUS;       // ≈301.59

// AnimatedCircle — wraps SVG Circle so Animated can drive strokeDashoffset
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Green checkmark SVG ──────────────────────────────────────────────────────
const CheckIcon: React.FC = () => (
  <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 13l4 4L19 7"
      stroke="#15803D"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ShipmentActiveScreen({ navigation }: Props) {
  const dashOffset = useRef(new Animated.Value(CIRCUMFERENCE)).current;

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue:         0,
      duration:        4000,
      easing:          Easing.linear,
      useNativeDriver: false, // SVG prop — cannot use native driver
    }).start(({ finished }) => {
      if (finished) {
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }
    });
  }, [dashOffset, navigation]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Progress ring wrapping the green checkmark circle */}
        <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          {/* SVG ring — absolutely positioned behind the icon circle */}
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            style={{ position: 'absolute' }}
          >
            {/* Background track */}
            <Circle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke="#E2E0DA"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Animated progress arc */}
            <AnimatedCircle
              cx={RING_CENTER}
              cy={RING_CENTER}
              r={RING_RADIUS}
              stroke="#15803D"
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${RING_CENTER}, ${RING_CENTER}`}
            />
          </Svg>

          {/* Green circle with checkmark — centred inside the ring */}
          <View style={styles.iconCircle}>
            <CheckIcon />
          </View>
        </View>

        {/* Headline */}
        <Text style={styles.title}>Shipment activated</Text>
        <Text style={styles.subtitle}>
          Your shipment is now active and will begin moving shortly.
        </Text>

        {/* Track Shipment button */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: 'C0401' })} // MOCK
        >
          <Text style={styles.primaryButtonText}>Track Shipment</Text>
        </TouchableOpacity>

        {/* Back to Home outline button */}
        <TouchableOpacity
          style={styles.outlineButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('MainTabs')}
        >
          <Text style={styles.outlineButtonText}>Back to Home</Text>
        </TouchableOpacity>

        {/* Auto-redirect hint */}
        <Text style={styles.autoHint}>Returning to home automatically...</Text>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: DS.bg,
  },
  container: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 20,
  },

  // Icon
  iconCircle: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: '#DCFCE7',
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Text
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   22,
    color:      DS.textPrimary,
    textAlign:  'center',
    marginTop:  20,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    textAlign:  'center',
    marginTop:  8,
    maxWidth:   260,
    lineHeight: 20,
  },

  // Buttons
  primaryButton: {
    backgroundColor: DS.accent,
    borderRadius:    14,
    paddingVertical: 15,
    width:           '100%',
    alignItems:      'center',
    marginTop:       32,
  },
  primaryButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      '#FFFFFF',
  },
  outlineButton: {
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    14,
    paddingVertical: 15,
    width:           '100%',
    alignItems:      'center',
    marginTop:       12,
  },
  outlineButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   14,
    color:      DS.textSecondary,
  },

  // Auto-redirect hint
  autoHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      '#A0A0A0',
    textAlign:  'center',
    marginTop:  20,
  },
});
