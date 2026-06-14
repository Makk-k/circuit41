import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { pickImageFromLibrary } from '../lib/imagePicker';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import ActionBottomSheet from '../components/ActionBottomSheet';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props       = NativeStackScreenProps<RootStackParamList, 'ShipmentDetail'>;
type DetailTab   = 'Timeline' | 'Details' | 'Documents' | 'Events';
type SectionKey  = 'shipmentInfo' | 'cargoInfo' | 'parties' | 'cost';
type StageStatus = 'completed' | 'active' | 'upcoming';

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:           '#F7F6F0',
  card:         '#FFFFFF',
  textPrimary:  '#1A1A1A',
  textSecondary:'#6B6B6B',
  textMuted:    '#A0A0A0',
  accent:       '#CD643D',
  border:       '#E8E6DF',
  cardBorder:   '#D9D7D0',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type DetailRow = { label: string; value: string; muted?: boolean };
type Section = {
  key:     SectionKey;
  title:   string;
  locked?: boolean;
  rows:    DetailRow[];
  note?:   string;
};

type EventItem = {
  id:           string;
  type:         'activity' | 'action';
  message?:     string;
  title?:       string;
  description?: string;
  action_type?: string;
  status?:      string;
  created_at:   string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

function currencySymbol(currency?: string | null): string {
  switch ((currency ?? 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'NGN': return '₦';
    case 'GBP': return '£';
    default: return '$';
  }
}

function timeAgo(isoStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (seconds < 60)    return 'Just now';
  if (seconds < 3600)  return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function shipmentRef(id: string): string {
  return '#' + id.substring(0, 8).toUpperCase();
}

function getStatusBadge(status: string): { bg: string; text: string; label: string } {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  switch (status) {
    case 'in_progress':      return { bg: '#FEF3C7', text: '#92400E', label: 'In Progress' };
    case 'received':         return { bg: '#DBEAFE', text: '#1E40AF', label: 'Received' };
    case 'origin_port':      return { bg: '#DBEAFE', text: '#1E40AF', label: 'Origin Port' };
    case 'in_transit':       return { bg: '#DBEAFE', text: '#1E40AF', label: 'In Transit' };
    case 'destination_port': return { bg: '#EDE9FE', text: '#5B21B6', label: 'Destination Port' };
    case 'out_for_delivery': return { bg: '#FED7AA', text: '#9A3412', label: 'Out for Delivery' };
    case 'delivered':        return { bg: '#DCFCE7', text: '#15803D', label: 'Delivered' };
    case 'cancelled':        return { bg: '#F0EEE8', text: '#6B6B6B', label: 'Cancelled' };
    default:                 return { bg: '#F0EEE8', text: '#6B6B6B', label };
  }
}

// ─── Helper: resolve dot colours and inner size by stage status ───────────────
function dotColors(status: StageStatus): {
  borderColor: string;
  fillColor:   string;
  innerSize:   number;
} {
  if (status === 'completed') return { borderColor: '#22C55E', fillColor: '#22C55E', innerSize: 5 };
  if (status === 'active')    return { borderColor: DS.accent,  fillColor: DS.accent,  innerSize: 6 };
  return                             { borderColor: DS.cardBorder, fillColor: DS.cardBorder, innerSize: 5 };
}

// ─── Footer fading divider ────────────────────────────────────────────────────
// Approximates transparent → #D4D2CC → transparent using opacity segments.
const FadingDivider: React.FC = () => (
  <View style={styles.fadingDividerRow}>
    {[0, 0.15, 0.3, 0.5, 0.6, 0.6, 0.5, 0.3, 0.15, 0].map((op, i) => (
      <View key={i} style={[styles.fadingDividerSegment, { opacity: op }]} />
    ))}
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ShipmentDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { isCompleted, shipmentId } = route.params;
  const { user } = useAuth();

  const [activeTab,     setActiveTab]     = useState<DetailTab>('Timeline');
  const [openSections,  setOpenSections]  = useState<Record<SectionKey, boolean>>({
    shipmentInfo: true,   // open by default
    cargoInfo:    false,
    parties:      false,
    cost:         false,
  });
  const [shipment,        setShipment]        = useState<any>(null);
  const [parcels,         setParcels]         = useState<any[]>([]);
  const [events,          setEvents]          = useState<EventItem[]>([]);
  const [documents,       setDocuments]       = useState<any[]>([]);
  const [uploading,       setUploading]       = useState(false);
  const [selectedAction,  setSelectedAction]  = useState<EventItem | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchShipment = useCallback(async () => {
    if (!shipmentId) { setInitialLoading(false); return; }
    try {
      const [shipmentRes, activityRes, actionsRes, docsRes] = await Promise.all([
        supabase.from('shipments').select('*, parcels(*)').eq('id', shipmentId).single(),
        supabase.from('activity').select('*').eq('shipment_id', shipmentId).order('created_at', { ascending: false }),
        supabase.from('actions').select('*').eq('shipment_id', shipmentId).order('created_at', { ascending: false }),
        supabase.from('documents').select('*').eq('shipment_id', shipmentId).order('created_at', { ascending: false }),
      ]);
      if (shipmentRes.data) {
        setShipment(shipmentRes.data);
        setParcels(shipmentRes.data.parcels || []);
      }
      if (shipmentRes.error) console.error('ShipmentDetail fetch error:', shipmentRes.error.message);
      if (docsRes.data) setDocuments(docsRes.data);

      const isInProgress = shipmentRes.data?.status === 'in_progress';
      const combined: EventItem[] = [
        ...(activityRes.data ?? []).map((a: any) => ({ ...a, type: 'activity' as const })),
        ...(!isInProgress ? (actionsRes.data ?? []).map((a: any) => ({ ...a, type: 'action' as const })) : []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEvents(combined);
    } finally {
      setInitialLoading(false);
    }
  }, [shipmentId]);

  useFocusEffect(
    useCallback(() => {
      fetchShipment();
    }, [fetchShipment]),
  );

  const sanitizeFileName = (name: string): string =>
    name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').toLowerCase();

  const uploadFile = async (uri: string, mimeType: string, fileName: string) => {
    setUploading(true);
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File not found at: ' + uri);

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64) throw new Error('Could not read file');

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const safeFileName = sanitizeFileName(fileName);
      const filePath = user!.id + '/' + route.params.shipmentId + '/' + Date.now() + '_' + safeFileName;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, bytes, { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: docRecord } = await supabase
        .from('documents')
        .insert({
          shipment_id:  route.params.shipmentId,
          user_id:      user!.id,
          name:         safeFileName,
          file_path:    filePath,
          file_type:    mimeType,
          uploaded_by:  'user',
        })
        .select()
        .single();
      if (docRecord) setDocuments(prev => [docRecord, ...prev]);
      Alert.alert('Success', 'Document uploaded successfully');
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDocument = () => {
    Alert.alert('Upload Document', 'Choose what to upload', [
      {
        text: 'Photo / Image',
        onPress: async () => {
          const image = await pickImageFromLibrary();
          if (image) {
            await uploadFile(image.uri, image.mimeType, image.fileName);
          }
        },
      },
      {
        text: 'PDF / Document',
        onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({
              type: ['application/pdf', '*/*'],
              copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              const asset = result.assets[0];
              await uploadFile(
                asset.uri,
                asset.mimeType || 'application/octet-stream',
                asset.name || 'document-' + Date.now(),
              );
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadDocument = async (doc: any) => {
    setDownloadingId(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 3600);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Could not generate download link');

      const localPath = FileSystem.documentDirectory + doc.name;
      const downloadResult = await FileSystem.downloadAsync(data.signedUrl, localPath);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: doc.file_type || 'application/octet-stream',
          dialogTitle: doc.name,
        });
      } else {
        Alert.alert('Downloaded', 'File saved to: ' + localPath);
      }
    } catch (err: any) {
      Alert.alert('Download failed', err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleActionSubmit = async () => {
    if (!selectedAction) return;
    await supabase.from('actions').update({ status: 'submitted' }).eq('id', selectedAction.id);
    setEvents(prev => prev.map(e => e.id === selectedAction.id ? { ...e, status: 'submitted' } : e));
    setShowActionSheet(false);
  };

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return null;

  if (initialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: DS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={DS.accent} />
      </View>
    );
  }

  const toggleSection = (key: SectionKey) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ─── Timeline tab content ────────────────────────────────────────────────
  const TIMELINE_STATUSES = [
    'received',
    'origin_port',
    'in_transit',
    'destination_port',
    'out_for_delivery',
    'delivered',
  ] as const;

  const renderTimeline = () => {
    if (!shipment) return null;
    const timelineStages = [
      {
        key:      'received',
        label:    'Received',
        subtitle: 'Parcels received at our warehouse',
        timestamp: shipment.received_at,
      },
      {
        key:      'origin_port',
        label:    'Origin Port',
        subtitle: shipment.origin_port_name
          ? 'Departed from ' + shipment.origin_port_name
          : 'Departed from origin port',
        timestamp: shipment.origin_port_at,
      },
      {
        key:      'in_transit',
        label:    'In Transit',
        subtitle: shipment.carrier_vessel
          ? 'On board ' + shipment.carrier_vessel
          : 'Shipment on its way',
        timestamp: shipment.in_transit_at,
      },
      {
        key:      'destination_port',
        label:    'Destination Port',
        subtitle: shipment.destination_port_name
          ? 'Arrived at ' + shipment.destination_port_name
          : 'Arrived at destination port',
        timestamp: shipment.destination_port_at,
      },
      {
        key:      'out_for_delivery',
        label:    'Out for Delivery',
        subtitle: shipment.out_for_delivery_note || 'With local courier for final delivery',
        timestamp: shipment.out_for_delivery_at,
      },
      {
        key:      'delivered',
        label:    'Delivered',
        subtitle: 'Shipment successfully delivered',
        timestamp: shipment.delivered_at,
      },
    ];

    return (
      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.timelineContent}
        showsVerticalScrollIndicator={false}
      >
        {timelineStages.map((stage, idx) => {
          const isFirst = idx === 0;
          const isLast  = idx === timelineStages.length - 1;

          const currentStatusIndex = TIMELINE_STATUSES.indexOf(shipment.status as any);
          const isCompleted = currentStatusIndex > -1 && idx < currentStatusIndex;
          const isActive    = currentStatusIndex > -1 && idx === currentStatusIndex;
          const isUpcoming  = currentStatusIndex === -1 || idx > currentStatusIndex;

          const displayTimestamp = stage.timestamp ? formatDateTime(stage.timestamp) : null;

          const stageStatus: StageStatus = isCompleted ? 'completed' : isActive ? 'active' : 'upcoming';
          const { borderColor, fillColor, innerSize } = dotColors(stageStatus);

          // Line above this dot: green if this stage or a prior stage is the current/completed
          const lineAboveColor = (isCompleted || isActive) ? '#22C55E' : DS.cardBorder;
          // Line below this dot: green only if this stage is completed
          const lineBelowColor = isCompleted ? '#22C55E' : DS.cardBorder;

          return (
            <View key={stage.key} style={styles.stageRow}>
              <View style={styles.stageLeft}>
                <View style={[styles.stageLineFixed, { backgroundColor: isFirst ? 'transparent' : lineAboveColor }]} />
                <View style={[styles.dotOuter, { borderColor }]}>
                  <View style={[styles.dotInner, { backgroundColor: fillColor, width: innerSize, height: innerSize, borderRadius: innerSize / 2 }]} />
                </View>
                <View style={[styles.stageLineFlex, { backgroundColor: isLast ? 'transparent' : lineBelowColor }]} />
              </View>
              <View style={styles.stageCard}>
                <Text
                  style={[styles.stageName, isActive && styles.stageNameActive, isUpcoming && styles.stageNameUpcoming]}
                  allowFontScaling={false}
                  numberOfLines={1}
                >
                  {stage.label}
                </Text>
                <Text
                  style={[styles.stageSubtitle, isUpcoming && styles.stageSubtitleUpcoming]}
                  allowFontScaling={false}
                  numberOfLines={2}
                >
                  {stage.subtitle}
                </Text>
                {!!displayTimestamp && (
                  <Text style={styles.stageTimestamp} allowFontScaling={false}>{displayTimestamp}</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ─── Cargo table — rendered inside the Cargo Info collapsible section ────
  const renderCargoTable = () => (
    <View style={styles.sectionContent}>
      {/* Table header row */}
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.tableHeader, { flex: 3 }]}>Item</Text>
        <Text style={[styles.tableHeader, { flex: 2, textAlign: 'right' }]}>Reference</Text>
      </View>

      {/* Parcel rows */}
      {parcels.length === 0 ? (
        <View style={styles.tableDivider} />
      ) : parcels.map((parcel) => (
        <React.Fragment key={parcel.id}>
          <View style={styles.tableDivider} />
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 3 }]}>
              {parcel.item_names?.join(', ') || '—'}
            </Text>
            <Text style={[styles.tableCell, { flex: 2, textAlign: 'right' }]}>
              {parcel.tracking_id ?? parcel.reference_id ?? '—'}
            </Text>
          </View>
          {parcel.category && (
            <View style={[styles.tableRow, { paddingTop: 0 }]}>
              <Text style={[styles.tableCell, { flex: 1, color: DS.textMuted, fontSize: 11 }]}>
                {parcel.category}
              </Text>
            </View>
          )}
        </React.Fragment>
      ))}
    </View>
  );

  // ─── Details tab content ─────────────────────────────────────────────────
  const renderDetails = () => {
    const dynamicSections: Section[] = [
      {
        key:   'shipmentInfo',
        title: 'Shipment Info',
        rows:  [
          { label: 'Slot',          value: [shipment?.slot_name, shipment?.slot_tag].filter(Boolean).join(' · ') || '—' },
          { label: 'Origin',        value: shipment?.origin_country ?? '—' },
          { label: 'Destination',      value: shipment?.destination_country ?? '—' },
          { label: 'Delivery Address', value: shipment?.delivery_address || 'Not set yet', muted: !shipment?.delivery_address },
          { label: 'Carrier',          value: shipment?.carrier || 'TBC' },
          { label: 'Tracking ref',  value: shipment?.tracking_reference || 'TBC' },
          { label: 'Est. delivery', value: shipment?.estimated_delivery ? formatDate(shipment.estimated_delivery) : 'TBC' },
          { label: 'Created',       value: shipment?.created_at ? formatDate(shipment.created_at) : '—' },
        ],
      },
      {
        key:   'cargoInfo',
        title: 'Cargo Info',
        rows:  [],
      },
      {
        key:    'cost',
        title:  'Cost',
        locked: true,
        rows:   [
          { label: 'Rate',   value: shipment?.slot_rate != null ? `${currencySymbol((shipment as any)?.rate_currency)}${shipment.slot_rate}/kg` : 'TBC' },
          { label: 'Weight', value: shipment?.total_weight != null ? `${shipment.total_weight}kg` : 'Pending' },
          { label: 'Total',  value: shipment?.total_cost != null ? `${currencySymbol((shipment as any)?.rate_currency)}${shipment.total_cost}` : 'Pending' },
        ],
        note: 'Inclusive of all fees',
      },
    ];

    return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.detailsContent}
      showsVerticalScrollIndicator={false}
    >
      {dynamicSections.map((section, sIdx) => {
        const isOpen = openSections[section.key];
        return (
          <View key={section.key}>
            {sIdx > 0 && <View style={styles.sectionDivider} />}

            {/* Collapsible header row */}
            <TouchableOpacity
              style={styles.sectionHeader}
              activeOpacity={0.7}
              onPress={() => toggleSection(section.key)}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>{section.title}</Text>
                {section.locked && (
                  <Ionicons
                    name="lock-closed-outline"
                    size={13}
                    color={DS.textSecondary}
                    style={{ marginLeft: 6 }}
                  />
                )}
              </View>
              <Ionicons
                name="chevron-down"
                size={16}
                color={DS.textSecondary}
                style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {/* Expanded content — Cargo Info uses a table; all others use label/value rows */}
            {isOpen && (
              section.key === 'cargoInfo'
                ? renderCargoTable()
                : (
                  <View style={styles.sectionContent}>
                    {section.rows.map((row, rIdx) => (
                      <View
                        key={row.label}
                        style={[
                          styles.detailRow,
                          rIdx < section.rows.length - 1 && styles.detailRowBorder,
                        ]}
                      >
                        <Text style={styles.detailLabel} maxFontSizeMultiplier={1.2}>{row.label}</Text>
                        <Text style={[styles.detailValue, row.muted && styles.detailValueMuted]} maxFontSizeMultiplier={1.2}>{row.value}</Text>
                      </View>
                    ))}
                    {section.note && (
                      <Text style={styles.sectionNote}>{section.note}</Text>
                    )}
                  </View>
                )
            )}
          </View>
        );
      })}
    </ScrollView>
    );
  };

  // ─── Documents tab content ───────────────────────────────────────────────
  const renderDocuments = () => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.docsContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.docsLabel}>DOCUMENTS</Text>

      {documents.length === 0 ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#A0A0A0' }}>
            No documents yet
          </Text>
        </View>
      ) : (
        <View style={styles.docsCard}>
          {documents.map((doc, idx) => (
            <React.Fragment key={doc.id}>
              {idx > 0 && <View style={styles.docDivider} />}
              <View style={styles.docRow}>
                <Ionicons name="document-outline" size={16} color={DS.textSecondary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={styles.docDate}>{formatDate(doc.created_at)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.docDownloadBtn}
                  activeOpacity={0.7}
                  onPress={() => handleDownloadDocument(doc)}
                  disabled={downloadingId === doc.id}
                >
                  {downloadingId === doc.id ? (
                    <ActivityIndicator size="small" color={DS.textSecondary} />
                  ) : (
                    <Ionicons name="arrow-down-circle-outline" size={22} color={DS.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      <Text style={styles.docsPlaceholder}>
        More documents may be added by your operator
      </Text>

      <TouchableOpacity
        style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
        activeOpacity={0.8}
        onPress={handleUploadDocument}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={DS.textPrimary} />
        ) : (
          <Text style={styles.uploadBtnText}>Upload Document</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Events tab content ──────────────────────────────────────────────────
  const renderEvents = () => (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.eventsContent}
      showsVerticalScrollIndicator={false}
    >
      {events.length === 0 ? (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#A0A0A0' }}>
            No events yet
          </Text>
        </View>
      ) : events.map(item => {

        if (item.type === 'activity') {
          const isAlert = (item as any).type_label === 'alert' || (item as any).alert_type === 'alert';
          return (
            <View key={item.id} style={evtStyles.activityCard}>
              <View style={evtStyles.row}>
                <View style={[evtStyles.dot, { backgroundColor: isAlert ? DS.accent : '#D4D2CC' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={evtStyles.activityMsg}>{item.message}</Text>
                  <Text style={evtStyles.timestamp}>{timeAgo(item.created_at)}</Text>
                </View>
              </View>
            </View>
          );
        }

        // action item
        const isPending   = item.status === 'pending';
        const isSubmitted = item.status === 'submitted';
        const isCompleted = item.status === 'completed';

        const dotColor   = isPending ? '#F59E0B' : isSubmitted ? '#3B82F6' : '#22C55E';
        const pillBg     = isPending ? 'rgba(205,100,61,0.10)' : isSubmitted ? '#EFF6FF' : '#DCFCE7';
        const pillBorder = isPending ? DS.accent : isSubmitted ? '#3B82F6' : '#22C55E';
        const pillText   = isPending ? DS.accent : isSubmitted ? '#3B82F6' : '#15803D';
        const pillLabel  = isPending ? 'Take action' : isSubmitted ? 'Submitted' : 'Completed';

        const inner = (
          <View style={evtStyles.row}>
            <View style={[evtStyles.dot, { backgroundColor: dotColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[
                evtStyles.actionTitle,
                (isSubmitted || isCompleted) && evtStyles.actionTitleDone,
              ]}>
                {item.title}
              </Text>
              {!!item.description && isPending && (
                <Text style={evtStyles.actionDesc}>{item.description}</Text>
              )}
              <Text style={evtStyles.timestamp}>{timeAgo(item.created_at)}</Text>
            </View>
            <View style={[evtStyles.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
              <Text style={[evtStyles.pillText, { color: pillText }]} allowFontScaling={false}>{pillLabel}</Text>
            </View>
          </View>
        );

        return isPending ? (
          <TouchableOpacity
            key={item.id}
            style={evtStyles.actionCard}
            activeOpacity={0.85}
            onPress={() => { setSelectedAction(item); setShowActionSheet(true); }}
          >
            {inner}
          </TouchableOpacity>
        ) : (
          <View key={item.id} style={evtStyles.actionCard}>
            {inner}
          </View>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.root}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>

        {/* Row 1: back button + help (raise a question) */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.helpBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => navigation.navigate('ShipmentSupport', { shipmentId: route.params.shipmentId })}
          >
            <Ionicons name="help-circle-outline" size={26} color="#CD643D" />
          </TouchableOpacity>
        </View>

        {/* Row 2: shipment ID + status / archived pills */}
        <View style={[styles.headerRow, { marginTop: 16 }]}>
          <Text style={styles.shipmentId} allowFontScaling={false}>
            Shipment {shipment ? shipmentRef(shipment.id) : '—'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {shipment?.archived_at && (
              <View style={styles.archivedPill}>
                <Text style={styles.archivedPillText} allowFontScaling={false} numberOfLines={1}>Archived</Text>
              </View>
            )}
            {shipment && (() => {
              const badge = getStatusBadge(shipment.status);
              return (
                <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusPillText, { color: badge.text }]} allowFontScaling={false} numberOfLines={1}>{badge.label}</Text>
                </View>
              );
            })()}
          </View>
        </View>

        {/* Row 3: route */}
        <Text style={[styles.headerRoute, { marginTop: 8 }]} maxFontSizeMultiplier={1.2}>
          {shipment ? `${shipment.origin_country} → ${shipment.destination_country}` : '—'}
        </Text>

        {/* Thin divider */}
        <View style={[styles.headerDivider, { marginTop: 14 }]} />

        {/* Row 4: cargo summary */}
        <View style={[styles.headerRow, { marginTop: 14, flexWrap: 'wrap' }]}>
          <Text style={styles.cargoName} maxFontSizeMultiplier={1.2}>
            {parcels.length > 0
              ? `${parcels.length} parcel${parcels.length !== 1 ? 's' : ''}`
              : 'No parcels'}
          </Text>
          {shipment?.total_weight != null && (
            <Text style={styles.cargoDims} maxFontSizeMultiplier={1.2}>{' '}· {shipment.total_weight}kg</Text>
          )}
        </View>

        {/* Row 5: ETA */}
        <View style={[styles.headerRow, { marginTop: 8 }]}>
          <Text style={styles.etaLabel} maxFontSizeMultiplier={1.2}>Estimated arrival </Text>
          <Text style={styles.etaValue} maxFontSizeMultiplier={1.2}>
            {shipment?.estimated_delivery ? formatDate(shipment.estimated_delivery) : 'TBC'}
          </Text>
        </View>

      </View>

      {/* ── DELIVERY BANNER — shown when shipment is completed ──────────── */}
      {isCompleted && (
        <View style={styles.deliveryBanner}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke="#15803D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.deliveryBannerText} maxFontSizeMultiplier={1.2}>
            Delivered{shipment?.delivered_at ? ` · ${formatDate(shipment.delivered_at)}` : ''}
          </Text>
        </View>
      )}

      {/* ── TAB BAR — 4 tabs: Timeline, Details, Documents, Events ─────── */}
      {/* Container border-bottom is the 1px #E2E0DA full-width rule.       */}
      {/* Each tab's 2px indicator uses marginBottom: -1 to overlap it.     */}
      <View style={styles.tabBar}>
        {(['Timeline', 'Events', 'Details', 'Documents'] as const).map(tab => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabBarBtn,
                { borderBottomColor: isActive ? DS.accent : 'transparent' },
              ]}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabBarBtnText,
                  {
                    color:      isActive ? DS.textPrimary : DS.textSecondary,
                    fontFamily: isActive
                      ? 'PlusJakartaSans_700Bold'
                      : 'PlusJakartaSans_400Regular',
                  },
                ]}
                allowFontScaling={false}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}
      {activeTab === 'Timeline'  && renderTimeline()}
      {activeTab === 'Events'    && renderEvents()}
      {activeTab === 'Details'   && renderDetails()}
      {activeTab === 'Documents' && renderDocuments()}

      {/* ── FOOTER — always visible on all tabs ─────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <FadingDivider />
        <Text style={styles.footerText} allowFontScaling={false}>
          {shipment?.updated_at ? `Last updated · ${formatDateTime(shipment.updated_at)}` : ''}
        </Text>
      </View>

      {/* ── ACTION BOTTOM SHEET — opened from Events tab action items ───── */}
      <ActionBottomSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onSubmit={handleActionSubmit}
        actionTitle={selectedAction?.title || ''}
        actionDescription={selectedAction?.description || ''}
        actionType={(selectedAction?.action_type as any) || 'default'}
        actionId={selectedAction?.id}
        shipmentId={route.params.shipmentId}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  root: {
    flex:            1,
    backgroundColor: DS.bg,
    flexDirection:   'column',
  },

  // ── Delivery banner ──────────────────────────────────────────────────────────
  deliveryBanner: {
    backgroundColor:   '#DCFCE7',
    borderRadius:      12,
    padding:           12,
    paddingHorizontal: 16,
    marginHorizontal:  20,
    marginBottom:      12,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
  },
  deliveryBannerText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      '#15803D',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20, // increased from 16 per spec
  },
  headerTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  backBtn: {
    padding:         8,
    alignSelf:       'flex-start',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    20,
  },
  helpBtn: {
    padding:    6,
    alignSelf:  'center',
  },
  archivedPill: {
    backgroundColor:   'rgba(205,100,61,0.12)',
    borderWidth:       0.75,
    borderColor:       'rgba(205,100,61,0.32)',
    borderRadius:      20,
    paddingVertical:   4,
    paddingHorizontal: 12,
  },
  archivedPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   11,
    color:      '#9A3B1C',
  },
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  shipmentId: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   20,
    color:      DS.textPrimary,
  },
  statusPill: {
    borderRadius:      20,
    paddingVertical:   4,
    paddingHorizontal: 12,
  },
  statusPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   11,
  },
  headerRoute: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
    // marginTop set inline — 8px per spec
  },
  headerDivider: {
    height:          1,
    backgroundColor: DS.border,
  },
  cargoName: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   12,
    color:      DS.textPrimary,
  },
  cargoDims: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  etaLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  etaValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      DS.textPrimary,
  },

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection:     'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  tabBarBtn: {
    flex:              1,
    alignItems:        'center',
    paddingBottom:     10,
    borderBottomWidth: 2,
    marginBottom:      -1, // overlap the container's 1px border so indicator sits flush
  },
  tabBarBtnText: {
    fontSize: 13,
  },

  // ── Shared scroll container for all tab content ──────────────────────────────
  tabScroll: {
    flex: 1,
  },

  // ── Timeline tab ─────────────────────────────────────────────────────────────
  timelineContent: {
    paddingTop:    20,
    paddingLeft:   16,
    paddingRight:  20,
    paddingBottom: 20,
  },
  stageRow: {
    flexDirection: 'row',
  },

  // Left column: lines and dot
  stageLeft: {
    width:      28,
    alignItems: 'center',
  },
  stageLineFixed: {
    height:          15,
    width:           1.5,
    backgroundColor: DS.cardBorder,
  },
  stageLineFlex: {
    flex:            1,
    width:           1.5,
    backgroundColor: DS.cardBorder,
  },
  dotOuter: {
    width:          14,
    height:         14,
    borderRadius:   7,
    borderWidth:    1.5,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dotInner: {
    // width / height / borderRadius set inline per-stage
  },

  // Right column: stage card
  stageCard: {
    flex:                    1,
    backgroundColor:         DS.bg,
    borderWidth:             1,
    borderColor:             DS.border,
    borderTopLeftRadius:     0,
    borderBottomLeftRadius:  0,
    borderTopRightRadius:    12,
    borderBottomRightRadius: 12,
    marginLeft:              4,
    marginBottom:            8,
    paddingVertical:         12,
    paddingHorizontal:       14,
  },
  stageCardHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  stageName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  stageNameActive: {
    color: DS.accent,
  },
  stageNameUpcoming: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color:      DS.textMuted,
  },
  stageTimestamp: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      '#A0A0A0',
  },
  stageSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      DS.textSecondary,
    marginTop:  2,
  },
  stageSubtitleUpcoming: {
    color: DS.textMuted,
  },
  stageDetail: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
    marginTop:  3,
  },
  stageDetailActive: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color:      DS.accent,
  },

  // ── Details tab ──────────────────────────────────────────────────────────────
  detailsContent: {
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     20,
  },
  sectionDivider: {
    height:          1,
    backgroundColor: DS.border,
  },
  sectionHeader: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      DS.textPrimary,
  },
  sectionContent: {
    paddingBottom: 12,
  },
  detailRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    paddingVertical: 8,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  detailLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textSecondary,
  },
  detailValue: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   13,
    color:      DS.textPrimary,
    flexShrink: 1,
    flexWrap:   'wrap',
    textAlign:  'right',
  },
  detailValueMuted: {
    fontFamily: 'PlusJakartaSans_400Regular',
    color:      DS.textMuted,
    fontStyle:  'italic',
  },
  sectionNote: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textMuted,
    marginTop:  6,
    fontStyle:  'italic',
  },

  // ── Cargo table (inside Cargo Info collapsible section) ──────────────────────
  tableHeaderRow: {
    backgroundColor: DS.bg,
    borderRadius:    4,
    marginBottom:    2,
  },
  tableRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 10,
  },
  tableHeader: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      11,
    color:         DS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableCell: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  tableDivider: {
    height:          1,
    backgroundColor: DS.border,
  },
  tableSummaryRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 8,
  },
  tableSummaryLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      DS.textSecondary,
  },
  tableSummaryValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   13,
    color:      DS.textPrimary,
  },

  // ── Documents tab ─────────────────────────────────────────────────────────────
  docsContent: {
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     20,
  },
  docsLabel: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      11,
    color:         DS.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom:  12,
  },
  docsCard: {
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    12,
    overflow:        'hidden',
  },
  docRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  docDivider: {
    height:           1,
    backgroundColor:  DS.border,
    marginHorizontal: 16,
  },
  docName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  docDate: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      DS.textSecondary,
    marginTop:  2,
  },
  docDownloadBtn: {
    padding:   6,
    marginLeft: 4,
  },
  docsPlaceholder: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      '#A0A0A0',
    fontStyle:  'italic',
    marginTop:  16,
    textAlign:  'center',
  },
  uploadBtn: {
    marginTop:       16,
    backgroundColor: DS.card,
    borderWidth:     1,
    borderColor:     DS.border,
    borderRadius:    10,
    paddingVertical: 14,
    alignItems:      'center',
  },
  uploadBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   14,
    color:      DS.textPrimary,
  },

  // ── Events tab ───────────────────────────────────────────────────────────────
  eventsContent: {
    paddingTop:    16,
    paddingBottom: 20,
  },
  eventRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  eventDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: DS.cardBorder,
    marginRight:     12,
    flexShrink:      0,
  },
  eventDotAction: {
    backgroundColor: DS.accent,
  },
  eventBody: {
    flex: 1,
  },
  eventText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textPrimary,
  },
  eventTextAction: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  eventTimestamp: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      '#A0A0A0',
    marginTop:  3,
  },
  eventTimestampAction: {
    color: DS.accent,
  },
  eventActionBtn: {
    backgroundColor:   DS.accent,
    borderRadius:      8,
    paddingVertical:   4,
    paddingHorizontal: 10,
    marginLeft:        8,
  },
  eventActionBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   11,
    color:      '#FFFFFF',
  },
  eventDivider: {
    height:           1,
    backgroundColor:  DS.border,
    marginHorizontal: 20,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    paddingTop: 10,
  },
  fadingDividerRow: {
    flexDirection: 'row',
    height:        1,
  },
  fadingDividerSegment: {
    flex:            1,
    height:          1,
    backgroundColor: DS.cardBorder,
  },
  footerText: {
    fontFamily:    'PlusJakartaSans_400Regular',
    fontSize:      11,
    color:         '#B0AEA8',
    letterSpacing: 0.3,
    textAlign:     'center',
    marginTop:     10,
  },
});

// ─── Event card styles (used only in renderEvents) ────────────────────────────
const evtStyles = StyleSheet.create({
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth:     1,
    borderColor:     '#F0EEE8',
    borderRadius:    12,
    padding:         14,
    marginBottom:    8,
    marginHorizontal: 20,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth:     1,
    borderColor:     '#E2E0DA',
    borderRadius:    12,
    padding:         14,
    marginBottom:    8,
    marginHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           10,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginTop:    4,
    flexShrink:   0,
  },
  activityMsg: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#1A1A1A',
  },
  actionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   13,
    color:      '#1A1A1A',
  },
  actionTitleDone: {
    textDecorationLine: 'line-through',
    color:              '#A0A0A0',
  },
  actionDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   12,
    color:      '#6B6B6B',
    marginTop:  2,
  },
  timestamp: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   11,
    color:      '#A0A0A0',
    marginTop:  4,
  },
  pill: {
    borderWidth:       1,
    borderRadius:      20,
    paddingVertical:   5,
    paddingHorizontal: 12,
    alignSelf:         'flex-start',
    marginLeft:        4,
  },
  pillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   11,
  },
});
