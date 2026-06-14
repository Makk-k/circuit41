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
import { Svg, Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StripeProvider } from '@stripe/stripe-react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import { colors as C, font as F, shadow as SH } from './lib/theme';
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
  Profile:   undefined;
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
  Activity:          undefined;
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
const LoadingScreen: React.FC = () => (
  <View style={{
    flex: 1,
    backgroundColor: '#F7F6F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  }}>
    <Image
      source={require('./assets/images/circuit40s icon.png')}
      style={{ width: 80, height: 80 }}
      resizeMode="contain"
    />
    <View style={{
      position: 'absolute',
      bottom: 48,
      alignItems: 'center',
    }}>
      <Image
        source={require('./assets/images/circuit 40s wordmark.png')}
        style={{ width: 120, height: 32 }}
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

      {/* Profile */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Circle cx="12" cy="8" r="4" fill={color} />
              <Path d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
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
      <Stack.Screen name="Activity"       component={ActivityScreen} />

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
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
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
