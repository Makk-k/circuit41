import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors as C, font as F, shadow as SH } from '../lib/theme';

const BAR_H = 64;
const PAD   = 7;

// Monzo-style floating frosted nav with a RESTRAINED translucent sliding selector.
// No liquid stretch / no wobble — a single smooth spring slide; active tab tinted #CD643D.
export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [rowW, setRowW] = useState(0);
  const tx = useRef(new Animated.Value(0)).current;

  const n = state.routes.length;
  const tabW = rowW > 0 ? rowW / n : 0;

  useEffect(() => {
    if (tabW <= 0) return;
    Animated.spring(tx, {
      toValue: state.index * tabW,
      useNativeDriver: true,
      friction: 18,   // high friction → settles cleanly, no overshoot/wobble
      tension: 80,
    }).start();
  }, [state.index, tabW, tx]);

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }, SH.nav]} pointerEvents="box-none">
      <View style={styles.bar}>
        <BlurView intensity={32} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.navFrost }]} />

        <View style={styles.row} onLayout={(e: LayoutChangeEvent) => setRowW(e.nativeEvent.layout.width)}>
          {tabW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, { width: tabW - 8, transform: [{ translateX: tx }] }]}
            />
          )}

          {state.routes.map((route, i) => {
            const { options } = descriptors[route.key];
            const focused = state.index === i;
            const color = focused ? C.accent : C.text;
            const label =
              typeof options.tabBarLabel === 'string' ? options.tabBarLabel
              : options.title ?? route.name;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
            };

            return (
              <Pressable key={route.key} style={styles.tab} onPress={onPress} hitSlop={6}>
                {options.tabBarIcon?.({ focused, color, size: 23 })}
                <Text style={[styles.label, { color }]} allowFontScaling={false}>{label}</Text>
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
    padding: PAD,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 4,
    borderRadius: 20,
    backgroundColor: C.navPill,
    // soft frosted lozenge — translucency, not a colored blob
    shadowColor: '#28384F',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
