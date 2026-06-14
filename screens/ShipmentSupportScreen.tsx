import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Svg, Path } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { shadow as SH } from '../lib/theme';
import type { ShipmentTicket, ShipmentTicketMessage, TicketStatus } from '../lib/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShipmentSupport'>;

// C41 accent (warm) per brand — used for small emphasis only.
const DS = {
  bg:            '#F7F6F0',
  card:          '#FFFFFF',
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  accent:        '#CD643D',
  border:        '#E2E0DA',
} as const;

function shipmentRef(id: string): string {
  return '#' + id.substring(0, 8).toUpperCase();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
};

export default function ShipmentSupportScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { shipmentId } = route.params;

  const [tickets, setTickets]   = useState<ShipmentTicket[]>([]);
  const [messages, setMessages] = useState<ShipmentTicketMessage[]>([]);
  const [loading, setLoading]   = useState(true);

  const [subject, setSubject]   = useState('');
  const [body, setBody]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [openId, setOpenId]     = useState<string | null>(null);
  const [reply, setReply]       = useState('');
  const [replying, setReplying] = useState(false);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const fetchTickets = useCallback(async () => {
    if (!shipmentId) { setLoading(false); return; }
    try {
      const { data: tData, error: tErr } = await supabase
        .from('shipment_tickets')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('created_at', { ascending: false });
      if (tErr) { Alert.alert('Error', tErr.message); return; }
      const rows = (tData ?? []) as ShipmentTicket[];
      setTickets(rows);
      if (rows.length > 0) {
        const { data: mData } = await supabase
          .from('shipment_ticket_messages')
          .select('*')
          .in('ticket_id', rows.map(t => t.id))
          .order('created_at', { ascending: true });
        setMessages((mData ?? []) as ShipmentTicketMessage[]);
      } else {
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useFocusEffect(useCallback(() => { fetchTickets(); }, [fetchTickets]));

  async function createTicket() {
    if (!body.trim() || !user?.id) return;
    setSubmitting(true);
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('shipment_tickets')
        .insert({ shipment_id: shipmentId, user_id: user.id, subject: subject.trim() || null, status: 'new' })
        .select()
        .single();
      if (tErr || !ticket) { Alert.alert('Could not send', tErr?.message ?? 'Unknown error'); return; }
      const { error: mErr } = await supabase
        .from('shipment_ticket_messages')
        .insert({ ticket_id: ticket.id, sender_user_id: user.id, sender_type: 'customer', message: body.trim() });
      if (mErr) { Alert.alert('Could not send', mErr.message); return; }
      setSubject('');
      setBody('');
      await fetchTickets();
      setOpenId(ticket.id);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(ticket: ShipmentTicket) {
    if (!reply.trim() || !user?.id) return;
    setReplying(true);
    try {
      const { error } = await supabase
        .from('shipment_ticket_messages')
        .insert({ ticket_id: ticket.id, sender_user_id: user.id, sender_type: 'customer', message: reply.trim() });
      if (error) { Alert.alert('Could not send', error.message); return; }
      setReply('');
      await fetchTickets();
    } finally {
      setReplying(false);
    }
  }

  if (!fontsLoaded) return null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => navigation.goBack()}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.title} allowFontScaling={false}>Help & questions</Text>
        <Text style={styles.subtitle} allowFontScaling={false}>Shipment {shipmentRef(shipmentId)}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ask a question */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle} allowFontScaling={false}>Ask a question</Text>
          <TextInput
            style={styles.input}
            placeholder="Subject (optional)"
            placeholderTextColor={DS.textMuted}
            value={subject}
            onChangeText={setSubject}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="What do you need help with?"
            placeholderTextColor={DS.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
          />
          <TouchableOpacity
            style={[styles.submitBtn, (!body.trim() || submitting) && { opacity: 0.5 }]}
            activeOpacity={0.85}
            onPress={createTicket}
            disabled={!body.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Text style={styles.submitBtnText} allowFontScaling={false}>Send</Text>}
          </TouchableOpacity>
        </View>

        {/* Existing tickets */}
        <Text style={styles.sectionLabel} allowFontScaling={false}>YOUR QUESTIONS</Text>
        {loading ? (
          <ActivityIndicator color={DS.accent} style={{ marginTop: 24 }} />
        ) : tickets.length === 0 ? (
          <Text style={styles.emptyText} allowFontScaling={false}>No questions yet for this shipment.</Text>
        ) : (
          tickets.map(t => {
            const expanded = openId === t.id;
            const thread = messages.filter(m => m.ticket_id === t.id);
            return (
              <View key={t.id} style={styles.ticketCard}>
                <TouchableOpacity style={styles.ticketHead} activeOpacity={0.7} onPress={() => setOpenId(expanded ? null : t.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketSubject} allowFontScaling={false} numberOfLines={1}>
                      {t.subject || 'Question'}
                    </Text>
                    <Text style={styles.ticketMeta} allowFontScaling={false}>{formatDateTime(t.updated_at)}</Text>
                  </View>
                  <View style={[styles.statusPill, t.status === 'closed' ? styles.statusClosed : styles.statusOpen]}>
                    <Text style={[styles.statusText, t.status === 'closed' ? styles.statusTextClosed : styles.statusTextOpen]} allowFontScaling={false}>
                      {STATUS_LABEL[t.status]}
                    </Text>
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.thread}>
                    {thread.map(m => (
                      <View key={m.id} style={[styles.msg, m.sender_type === 'customer' ? styles.msgMine : styles.msgStaff]}>
                        <Text style={styles.msgMeta} allowFontScaling={false}>
                          {m.sender_type === 'customer' ? 'You' : m.sender_type === 'staff' ? 'Circuit team' : 'System'} · {formatDateTime(m.created_at)}
                        </Text>
                        <Text style={styles.msgBody} allowFontScaling={false}>{m.message}</Text>
                      </View>
                    ))}

                    {t.status !== 'closed' ? (
                      <View style={styles.replyRow}>
                        <TextInput
                          style={[styles.input, styles.inputMultiline, { marginBottom: 8 }]}
                          placeholder="Add a reply…"
                          placeholderTextColor={DS.textMuted}
                          value={reply}
                          onChangeText={setReply}
                          multiline
                        />
                        <TouchableOpacity
                          style={[styles.submitBtn, (!reply.trim() || replying) && { opacity: 0.5 }]}
                          activeOpacity={0.85}
                          onPress={() => sendReply(t)}
                          disabled={!reply.trim() || replying}
                        >
                          {replying
                            ? <ActivityIndicator size="small" color="#FFFFFF" />
                            : <Text style={styles.submitBtnText} allowFontScaling={false}>Send reply</Text>}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.closedNote} allowFontScaling={false}>This question is closed. Ask a new question above if you still need help.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.bg },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 20, marginBottom: 12 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: DS.textPrimary },
  subtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: DS.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },

  formCard: { backgroundColor: DS.card, borderWidth: 1, borderColor: DS.border, borderRadius: 18, padding: 16, ...SH.card },
  formTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: DS.textPrimary, marginBottom: 12 },
  input: {
    backgroundColor: DS.bg, borderWidth: 1, borderColor: DS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14, color: DS.textPrimary, marginBottom: 10,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: DS.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  submitBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#FFFFFF' },

  sectionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: DS.textMuted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 24, marginBottom: 10,
  },
  emptyText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: DS.textMuted, textAlign: 'center', marginTop: 12 },

  ticketCard: { backgroundColor: DS.card, borderWidth: 1, borderColor: DS.border, borderRadius: 16, marginBottom: 10, overflow: 'hidden', ...SH.card },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  ticketSubject: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: DS.textPrimary },
  ticketMeta: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: DS.textMuted, marginTop: 2 },
  statusPill: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, borderWidth: 0.75 },
  statusOpen: { backgroundColor: 'rgba(205,100,61,0.12)', borderColor: 'rgba(205,100,61,0.32)' },
  statusClosed: { backgroundColor: '#F0EEE8', borderColor: '#D4D2CC' },
  statusText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10 },
  statusTextOpen: { color: '#9A3B1C' },
  statusTextClosed: { color: DS.textSecondary },

  thread: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: DS.border, paddingTop: 12 },
  msg: { borderRadius: 10, padding: 10, marginBottom: 8 },
  msgMine: { backgroundColor: DS.bg },
  msgStaff: { backgroundColor: 'rgba(205,100,61,0.08)', borderWidth: 1, borderColor: 'rgba(205,100,61,0.20)' },
  msgMeta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: DS.textMuted, marginBottom: 3 },
  msgBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: DS.textPrimary, lineHeight: 19 },
  replyRow: { marginTop: 4 },
  closedNote: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: DS.textMuted, fontStyle: 'italic', marginTop: 4 },
});
