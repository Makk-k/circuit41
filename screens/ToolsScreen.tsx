import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { TabScreenProps } from '../App';

type Props = TabScreenProps<'Tools'>;

const DS = {
  bg:           '#F7F6F0',
  card:         '#FFFFFF',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  accent:       '#C10F1D',
  border:       '#E2E0DA',
  cardBorder:   '#D4D2CC',
} as const;

export default function ToolsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
  });
  if (!fontsLoaded) return null;

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Tools</Text>
      </View>

      {/* Coming Soon card */}
      <View style={styles.card}>
        {/* Wrench icon */}
        <Ionicons
          name="construct-outline"
          size={32}
          color="#D4D2CC"
          style={{ alignSelf: 'center' }}
        />
        <Text style={styles.cardHeading}>Coming Soon</Text>
        <Text style={styles.cardBody}>
          Useful tools for shippers will appear here
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.bg, flexDirection: 'column' },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom:     8,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   22,
    color:      DS.textPrimary,
  },

  // Coming Soon card
  card: {
    backgroundColor:   DS.card,
    borderWidth:       1,
    borderColor:       DS.border,
    borderRadius:      16,
    padding:           24,
    marginHorizontal:  20,
    marginTop:         24,
    alignItems:        'center',
  },
  cardHeading: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   16,
    color:      DS.textPrimary,
    marginTop:  12,
    textAlign:  'center',
  },
  cardBody: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    textAlign:  'center',
    marginTop:  8,
  },

});
