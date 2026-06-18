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

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

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

export default function PrivacyPolicyScreen({ navigation }: Props) {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.updated}>Last updated: May 2026</Text>

        <Text style={styles.body}>
          Circuit41 is operated by Circuit40s Limited ("we", "our", "us"). This policy explains what data we collect, how we use it, and your rights.
        </Text>

        <Text style={styles.sectionTitle}>1. Who we are</Text>
        <Text style={styles.body}>
          Circuit40s Limited operates Circuit41. You can contact us at hello@circuit40s.com.
        </Text>

        <Text style={styles.sectionTitle}>2. Data we collect</Text>

        <Text style={styles.subTitle}>Account information</Text>
        <Text style={styles.body}>
          When you sign up, we collect your name, email address, and the authentication provider you used (email OTP, Apple Sign-In, or Google Sign-In). If you add a phone number to your profile, that is also stored.
        </Text>

        <Text style={styles.subTitle}>Shipment information</Text>
        <Text style={styles.body}>
          When you create or manage shipments, we collect shipment addresses, parcel details, uploaded documents and images, and shipment status information.
        </Text>

        <Text style={styles.subTitle}>Payment information</Text>
        <Text style={styles.body}>
          Payments are processed through Stripe. Circuit41 does not store your full card details. We may retain records of payment transactions for accounting, reconciliation, and compliance purposes.
        </Text>

        <Text style={styles.subTitle}>Feedback</Text>
        <Text style={styles.body}>
          If you submit feedback through the app, that content is stored.
        </Text>

        <Text style={styles.sectionTitle}>3. How we use your data</Text>
        <Text style={styles.body}>
          We use your data to provide the shipment coordination service, process payments, maintain your account, and improve the app.
        </Text>

        <Text style={styles.sectionTitle}>4. Data storage and authentication</Text>
        <Text style={styles.body}>
          Your account data and shipment information are stored securely using Supabase. Authentication is handled by Supabase Auth, which supports email OTP, Apple Sign-In, and Google Sign-In.
        </Text>

        <Text style={styles.sectionTitle}>5. Data retention</Text>
        <Text style={styles.body}>
          If you delete your account, your personal profile data is removed. Operational records related to completed shipments, payments, and associated logistics activity may be retained where required for logistics reconciliation, payment disputes, fraud prevention, or legal and compliance obligations.
        </Text>

        <Text style={styles.sectionTitle}>6. Account deletion</Text>
        <Text style={styles.body}>
          You can delete your account from within the app via the Profile screen. Accounts with active shipments cannot be immediately deleted.
        </Text>

        <Text style={styles.sectionTitle}>7. Your rights</Text>
        <Text style={styles.body}>
          You have the right to access, correct, or request deletion of your personal data. Contact us at hello@circuit40s.com.
        </Text>

        <View style={styles.contactBlock}>
          <Text style={styles.contactLabel}>Contact</Text>
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

  subTitle: {
    fontFamily:   'PlusJakartaSans_600SemiBold',
    fontSize:     13,
    color:        DS.textPrimary,
    marginTop:    14,
    marginBottom: 4,
  },

  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    lineHeight: 20,
  },

  contactBlock: {
    marginTop:      32,
    paddingTop:     20,
    borderTopWidth: 1,
    borderTopColor: DS.border,
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
