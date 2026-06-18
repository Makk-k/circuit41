import React, { createContext, useCallback, useEffect, useState } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Svg, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import { colors as C, font as F, shadow as SH } from './lib/theme';
import CustomTabBar from './components/CustomTabBar';
import type { Slot } from './lib/database.types';
import { configureGoogleSignIn } from './lib/googleAuth';
import { supabase } from './lib/supabase';

import WelcomeScreen           from './screens/WelcomeScreen';
import PhoneEmailScreen        from './screens/PhoneEmailScreen';
import VerificationScreen      from './screens/VerificationScreen';
import ProfileSetupScreen      from './screens/ProfileSetupScreen';
import TermsOfServiceScreen    from './screens/TermsOfServiceScreen';
import PrivacyPolicyScreen     from './screens/PrivacyPolicyScreen';
import DashboardScreen         from './screens/DashboardScreen';
import ShipmentsScreen         from './screens/ShipmentsScreen';
import ShipmentDetailScreen    from './screens/ShipmentDetailScreen';
import ShipmentSupportScreen   from './screens/ShipmentSupportScreen';
import ActivityScreen          from './screens/ActivityScreen';
import ActionsScreen           from './screens/ActionsScreen';
import ProfileScreen           from './screens/ProfileScreen';
import SlotSelectionScreen     from './screens/SlotSelectionScreen';
import ShipmentWorkspaceScreen from './screens/ShipmentWorkspaceScreen';
import ShipmentCheckoutScreen  from './screens/ShipmentCheckoutScreen';
import ShipmentActiveScreen    from './screens/ShipmentActiveScreen';
import ShippingRouteScreen     from './screens/ShippingRouteScreen';
import EmailWaitingScreen      from './screens/EmailWaitingScreen';
import SavedCardsScreen        from './screens/SavedCardsScreen';
import FeedbackScreen          from './screens/FeedbackScreen';

// ─── Tab param list ────────────────────────────────────────────────────────────
export type TabParamList = {
  Home:      { isNewUser?: boolean } | undefined;
  Shipments: undefined;
  Actions:   undefined;
  Activity:  undefined;
};

// ─── Stack param list — non-tab screens only ──────────────────────────────────
export type RootStackParamList = {
  Welcome:           undefined;
  PhoneEmail:        undefined;
  Verification:      { contact: string };
  EmailWaiting:      { email: string };
  ProfileSetup:      undefined;
  MainTabs:          NavigatorScreenParams<TabParamList> | undefined;
  ShipmentDetail:    { shipmentId: string; isCompleted?: boolean };
  ShipmentSupport:   { shipmentId: string };
  Profile:           undefined;
  ShippingRoute:     undefined;
  SlotSelection:     { origin: string; destination: string };
  ShipmentWorkspace: { slot?: Slot; origin?: string; destination?: string; shipmentId?: string; source?: 'home' | 'shipments' | 'creation' };
  ShipmentCheckout:  { shipmentId: string };
  ShipmentActive:    { shipmentId?: string };
  SavedCards:        undefined;
  Feedback:          undefined;
  TermsOfService:    undefined;
  PrivacyPolicy:     undefined;
};

// ─── Composite type for tab screens that also navigate to stack screens ────────
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

// ─── Navigators ───────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

type ActionBadgeContextValue = {
  refreshActionBadge: () => Promise<void>;
  setHasIncompleteActions: (value: boolean) => void;
};

export const ActionBadgeContext = createContext<ActionBadgeContextValue>({
  refreshActionBadge: async () => {},
  setHasIncompleteActions: () => {},
});

// ─── Loading screen — shown while Supabase restores the session ───────────────
// Circuit 41 launch identity: large, zoomed-in flowing accent-family waves
// (logistics / movement feel) behind a centred logo. JS + SVG only — no spinner,
// no native deps. Waves are kept tasteful via low opacity so the logo stays clear.
const LoadingScreen: React.FC = () => (
  <View style={{
    flex: 1,
    backgroundColor: '#F5F9F6',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {/* Top flowing cluster */}
      <Path d="M-60 110 C 80 30, 230 200, 470 70"  stroke="#9A3B1C" strokeWidth={12} strokeLinecap="round" fill="none" opacity={0.10} />
      <Path d="M-60 165 C 90 80, 220 250, 470 130" stroke="#CD643D" strokeWidth={22} strokeLinecap="round" fill="none" opacity={0.16} />
      <Path d="M-60 225 C 110 140, 240 320, 470 195" stroke="#E0875F" strokeWidth={30} strokeLinecap="round" fill="none" opacity={0.20} />
      {/* Bottom flowing cluster */}
      <Path d="M-60 600 C 120 700, 250 520, 470 650" stroke="#E0875F" strokeWidth={30} strokeLinecap="round" fill="none" opacity={0.20} />
      <Path d="M-60 665 C 110 760, 250 560, 470 710" stroke="#CD643D" strokeWidth={22} strokeLinecap="round" fill="none" opacity={0.16} />
      <Path d="M-60 735 C 100 820, 260 620, 470 775" stroke="#F2B79B" strokeWidth={14} strokeLinecap="round" fill="none" opacity={0.45} />
    </Svg>

    <Image
      source={require('./assets/images/circuit40s icon.png')}
      style={{ width: 96, height: 96 }}
      resizeMode="contain"
    />

    <View style={{
      position: 'absolute',
      bottom: 48,
      alignItems: 'center',
    }}>
      <Image
        source={require('./assets/images/circuit 40s wordmark.png')}
        style={{ width: 124, height: 34 }}
        resizeMode="contain"
      />
    </View>
  </View>
);

// ─── Tab Navigator ────────────────────────────────────────────────────────────
function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [hasIncompleteActions, setHasIncompleteActions] = useState(false);

  const refreshActionBadge = useCallback(async () => {
    if (!user?.id) {
      setHasIncompleteActions(false);
      return;
    }

    const { data, error } = await supabase
      .from('actions')
      .select('id, shipments(status)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .limit(50);

    if (error) {
      console.warn('[actions] badge refresh failed:', error.message);
      return;
    }

    const visiblePending = (data ?? []).some((action: any) => action.shipments?.status !== 'in_progress');
    setHasIncompleteActions(visiblePending);
  }, [user?.id]);

  useEffect(() => {
    refreshActionBadge();
    const timer = setInterval(refreshActionBadge, 30_000);
    return () => clearInterval(timer);
  }, [refreshActionBadge]);

  return (
    <ActionBadgeContext.Provider value={{ refreshActionBadge, setHasIncompleteActions }}>
      <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Monzo-style floating, rounded, light bottom nav.
        tabBarStyle: {
          position:        'absolute',
          left:            16,
          right:           16,
          bottom:          Math.max(insets.bottom, 12),
          height:          64,
          paddingTop:      8,
          paddingBottom:   8,
          paddingHorizontal: 6,
          backgroundColor: C.navSurface,
          borderRadius:    28,
          borderTopWidth:  0,
          borderWidth:     1,
          borderColor:     C.border,
          ...SH.nav,
        },
        tabBarItemStyle:   { backgroundColor: 'transparent', borderRadius: 20, paddingVertical: 4 },
        tabBarShowLabel:         true,
        tabBarLabelStyle:        { fontFamily: F.medium, fontSize: 11, marginTop: 2 },
        tabBarActiveTintColor:   C.navActive,
        tabBarInactiveTintColor: C.navInactive,
      }}
    >

      {/* Home */}
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Svg width={26} height={26} viewBox="0 0 24 24">
              <Path d="M12 3L4 9.5V20a1 1 0 001 1h4.5v-5.5a1 1 0 011-1h3a1 1 0 011 1V21H19a1 1 0 001-1V9.5L12 3z" fill={color} />
            </Svg>
          ),
        }}
      />

      {/* Shipments */}
      <Tab.Screen
        name="Shipments"
        component={ShipmentsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path d="M12 2L2 7l10 5 10-5-10-5z" fill={color} />
              <Path d="M2 17l10 5 10-5" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
              <Path d="M2 12l10 5 10-5" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            </Svg>
          ),
        }}
      />

      {/* Actions */}
      <Tab.Screen
        name="Actions"
        component={ActionsScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={24} height={24} viewBox="0 0 24 24">
                <Path
                  d="M12 2l2.9 6.3 6.8.8-5 4.9 1.3 6.8L12 17.7l-6 3.1 1.3-6.8-5-4.9 6.8-.8L12 2z"
                  stroke={color}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
              {hasIncompleteActions && (
                <View style={{
                  position: 'absolute',
                  top: 1,
                  right: 1,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: C.accent,
                  borderWidth: 1.5,
                  borderColor: C.navSurface,
                }} />
              )}
            </View>
          ),
        }}
      />

      {/* Activity */}
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path
                d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
                fill="none"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M13.73 21a2 2 0 01-3.46 0"
                fill="none"
                stroke={color}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        }}
      />

      </Tab.Navigator>
    </ActionBadgeContext.Provider>
  );
}

// ─── Root Navigator — auth-aware, inside AuthProvider + NavigationContainer ───
function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Stack.Navigator
      initialRouteName={session ? 'MainTabs' : 'Welcome'}
      screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'none' }}
    >
      {/* ── Auth flow ──────────────────────────────────────────────────────── */}
      <Stack.Screen name="Welcome"      component={WelcomeScreen} />
      <Stack.Screen name="PhoneEmail"   component={PhoneEmailScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="EmailWaiting" component={EmailWaitingScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

      {/* ── Main app — tab navigator ───────────────────────────────────────── */}
      <Stack.Screen name="MainTabs" component={TabNavigator} />

      {/* ── Detail / flow screens ──────────────────────────────────────────── */}
      <Stack.Screen name="ShipmentDetail" component={ShipmentDetailScreen} />
      <Stack.Screen name="ShipmentSupport" component={ShipmentSupportScreen} />
      <Stack.Screen name="Profile"        component={ProfileScreen} />

      {/* ── Shipment creation flow ─────────────────────────────────────────── */}
      <Stack.Screen name="ShippingRoute"     component={ShippingRouteScreen} />
      <Stack.Screen name="SlotSelection"     component={SlotSelectionScreen} />
      <Stack.Screen name="ShipmentWorkspace" component={ShipmentWorkspaceScreen} />
      <Stack.Screen name="ShipmentCheckout"  component={ShipmentCheckoutScreen} />
      <Stack.Screen name="ShipmentActive"    component={ShipmentActiveScreen} />
      <Stack.Screen name="SavedCards"         component={SavedCardsScreen} />
      <Stack.Screen name="Feedback"           component={FeedbackScreen} />
      <Stack.Screen name="TermsOfService"     component={TermsOfServiceScreen} />
      <Stack.Screen name="PrivacyPolicy"      component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      merchantIdentifier="merchant.com.circuit40s.circuit41app"
    >
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </StripeProvider>
  );
}
