import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Svg, Path } from 'react-native-svg';
import { colors as C, font as F, shadow as SH } from '../lib/theme';

// Tabs mirror the live bottom navigation (Home · Shipments · Actions · Activity).
type TabKey = 'Home' | 'Shipments' | 'Actions' | 'Activity';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'Home',      label: 'Home' },
  { key: 'Shipments', label: 'Shipments' },
  { key: 'Actions',   label: 'Actions' },
  { key: 'Activity',  label: 'Activity' },
];

function TabIcon({ name, color }: { name: TabKey; color: string }) {
  switch (name) {
    case 'Home':
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path d="M12 3L4 9.5V20a1 1 0 001 1h4.5v-5.5a1 1 0 011-1h3a1 1 0 011 1V21H19a1 1 0 001-1V9.5L12 3z" fill={color} />
        </Svg>
      );
    case 'Shipments':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M12 2L2 7l10 5 10-5-10-5z" fill={color} />
          <Path d="M2 17l10 5 10-5" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M2 12l10 5 10-5" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </Svg>
      );
    case 'Actions':
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d="M12 2l2.9 6.3 6.8.8-5 4.9 1.3 6.8L12 17.7l-6 3.1 1.3-6.8-5-4.9 6.8-.8L12 2z"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'Activity':
      return (
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
      );
  }
}

const BAR_H = 64;

// Presentational copy of the floating bottom nav for STACK screens (e.g. Shipment
// Detail) where the real Tab.Navigator bar is not mounted. Tapping a tab jumps
// back into the tab navigator at the chosen tab.
export default function StaticTabBar({ navigation, activeKey }: { navigation: any; activeKey?: TabKey }) {
  const insets = useSafeAreaInsets();

  const go = (key: TabKey) => {
    navigation.navigate('MainTabs', { screen: key });
  };

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }, SH.nav]} pointerEvents="box-none">
      <View style={styles.bar}>
        <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.navFrost }]} />
        <View style={styles.row}>
          {TABS.map(tab => {
            const focused = activeKey === tab.key;
            const color = focused ? C.accent : C.text;
            return (
              <Pressable key={tab.key} style={styles.tab} onPress={() => go(tab.key)} hitSlop={6}>
                <TabIcon name={tab.key} color={color} />
                <Text style={[styles.label, { color }]} allowFontScaling={false}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: BAR_H,
    borderRadius: 30,
  },
  bar: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    padding: 7,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontFamily: F.medium,
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
