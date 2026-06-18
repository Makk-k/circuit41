import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

const DS = {
  bg:            '#F5F9F6',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  border:        '#E2E0DA',
  accent:        '#CD643D',
} as const;

const BackChevron: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={DS.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function TermsOfServiceScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea}>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <BackChevron />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated: May 2026</Text>

        <Text style={styles.body}>
          Circuit41 is operated by Circuit40s Limited ("we", "our", "us"). By creating an account and using Circuit41, you agree to these Terms of Service.
        </Text>

        <Text style={styles.sectionTitle}>1. What Circuit41 does</Text>
        <Text style={styles.body}>
          Circuit41 is a shipment coordination and logistics workflow application. It allows you to manage and track international shipment bookings, coordinate with logistics operators, and handle related payments.
        </Text>

        <Text style={styles.sectionTitle}>2. Your account</Text>
        <Text style={styles.body}>
          You must provide accurate and complete information when creating your account and when submitting shipment details. You are responsible for maintaining the security of your account credentials.
        </Text>

        <Text style={styles.sectionTitle}>3. Accurate information</Text>
        <Text style={styles.body}>
          You must provide accurate information about your shipments, including parcel contents, weight, dimensions, origin, and destination. Providing false or misleading information about shipment contents is your sole responsibility and may result in account suspension.
        </Text>

        <Text style={styles.sectionTitle}>4. Prohibited shipments</Text>
        <Text style={styles.body}>
          You must not use Circuit41 to ship or attempt to ship items that are illegal, prohibited, or restricted under applicable law, or under the rules of any logistics or freight operator. This includes goods prohibited under UK customs regulations.
        </Text>

        <Text style={styles.sectionTitle}>5. Payments</Text>
        <Text style={styles.body}>
          Payments are processed through Stripe. By making a payment, you agree to Stripe's terms of service. Circuit41 does not store your full card details.
        </Text>

        <Text style={styles.sectionTitle}>6. Third-party logistics providers</Text>
        <Text style={styles.body}>
          Circuit41 may coordinate shipments with third-party logistics operators and freight carriers. We are not responsible for the performance, delays, or failures of any third-party provider.
        </Text>

        <Text style={styles.sectionTitle}>7. Limitation of liability</Text>
        <Text style={styles.body}>
          To the fullest extent permitted by law, Circuit41 and Circuit40s Limited are not liable for any indirect, incidental, or consequential losses arising from your use of the app, including delays, shipment damage, or service unavailability.
        </Text>

        <Text style={styles.sectionTitle}>8. Account deletion</Text>
        <Text style={styles.body}>
          You may delete your account from within the app. Accounts with active shipments cannot be deleted until those shipments are completed or cancelled. Operational records related to completed shipments and payments may be retained as required for legal, financial, or compliance purposes.
        </Text>

        <Text style={styles.sectionTitle}>9. Prohibited use</Text>
        <Text style={styles.body}>
          You must not misuse Circuit41 by attempting to gain unauthorised access to systems, interfering with other users, or using the app for any unlawful purpose.
        </Text>

        <Text style={styles.sectionTitle}>10. Governing law</Text>
        <Text style={styles.body}>
          These Terms are governed by the laws of England and Wales.
        </Text>

        <View style={styles.contactBlock}>
          <Text style={styles.contactLabel}>Questions?</Text>
          <Text style={styles.contactEmail}>hello@circuit40s.com</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: DS.bg,
  },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  backBtn: {
    padding:         8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
  },
  headerTitle: {
    flex:       1,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   16,
    color:      DS.textPrimary,
    textAlign:  'center',
  },
  headerSpacer: {
    width: 38,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop:        24,
    paddingBottom:     48,
  },

  updated: {
    fontFamily:   'PlusJakartaSans_400Regular',
    fontSize:     11,
    color:        DS.textMuted,
    marginBottom: 20,
  },

  sectionTitle: {
    fontFamily:   'PlusJakartaSans_700Bold',
    fontSize:     14,
    color:        DS.textPrimary,
    marginTop:    24,
    marginBottom: 6,
  },

  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    lineHeight: 20,
  },

  contactBlock: {
    marginTop:         32,
    paddingTop:        20,
    borderTopWidth:    1,
    borderTopColor:    DS.border,
  },
  contactLabel: {
    fontFamily:   'PlusJakartaSans_600SemiBold',
    fontSize:     13,
    color:        DS.textPrimary,
    marginBottom: 4,
  },
  contactEmail: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.accent,
  },
});
