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
import { LinearGradient } from 'expo-linear-gradient';
import { gradients as G, shadow as SH } from '../lib/theme';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { RootStackParamList } from '../App';
import ActionBottomSheet from '../components/ActionBottomSheet';
import StaticTabBar from '../components/StaticTabBar';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props       = NativeStackScreenProps<RootStackParamList, 'ShipmentDetail'>;
type SectionKey  = 'events' | 'parcels' | 'info' | 'documents' | 'cost';
type StageStatus = 'completed' | 'active' | 'upcoming';

// ─── Design tokens ────────────────────────────────────────────────────────────
const DS = {
  bg:           '#F5F9F6',
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

function formatDateShort(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function prettify(value?: string | null): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

  const [openSections,  setOpenSections]  = useState<Record<SectionKey, boolean>>({
    events:    false,
    parcels:   false,
    info:      false,
    documents: false,
    cost:      false,
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
      <View style={styles.timelineContent}>
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
      </View>
    );
  };

  // ─── Reusable label/value rows ───────────────────────────────────────────
  const renderRows = (rows: DetailRow[], note?: string) => (
    <View style={styles.sectionContent}>
      {rows.map((row, rIdx) => (
        <View
          key={row.label}
          style={[styles.detailRow, rIdx < rows.length - 1 && styles.detailRowBorder]}
        >
          <Text style={styles.detailLabel} maxFontSizeMultiplier={1.2}>{row.label}</Text>
          <Text style={[styles.detailValue, row.muted && styles.detailValueMuted]} maxFontSizeMultiplier={1.2}>{row.value}</Text>
        </View>
      ))}
      {note && <Text style={styles.sectionNote}>{note}</Text>}
    </View>
  );

  // ─── Accordion body: Parcels (what's actually inside the shipment) ───────
  const renderParcels = () => {
    if (parcels.length === 0) {
      return (
        <View style={styles.sectionContent}>
          <Text style={styles.emptyMini}>No parcels added yet</Text>
        </View>
      );
    }
    return (
      <View style={styles.sectionContent}>
        {parcels.map((p, i) => {
          const photoCount = p.photos?.length ?? 0;
          const rows: DetailRow[] = [
            { label: 'Category',     value: prettify(p.category) },
            { label: 'Status',       value: prettify(p.status) },
            { label: 'Tracking',     value: p.tracking_id || p.reference_id || '—' },
            { label: 'Weight',       value: p.weight != null ? `${p.weight}kg` : 'Pending' },
            { label: 'Added',        value: p.created_at ? formatDate(p.created_at) : '—' },
            { label: 'Photos/proofs', value: photoCount > 0
                ? `${photoCount} file${photoCount !== 1 ? 's' : ''}`
                : (p.has_receipt ? 'Receipt on file' : 'None') },
          ];
          return (
            <View key={p.id} style={i > 0 ? styles.parcelBlock : undefined}>
              <Text style={styles.parcelName} numberOfLines={2}>
                {p.item_names?.join(', ') || `Parcel ${i + 1}`}
              </Text>
              {renderRows(rows)}
            </View>
          );
        })}
      </View>
    );
  };

  // ─── Accordion body: Shipment Information (simplified) ───────────────────
  const renderInfoBody = () => {
    const infoRows: DetailRow[] = [
      { label: 'Shipment ID',      value: shipment ? shipmentRef(shipment.id) : '—' },
      { label: 'Slot',             value: [shipment?.slot_name, shipment?.slot_tag].filter(Boolean).join(' · ') || '—' },
      { label: 'Origin',           value: shipment?.origin_country ?? '—' },
      { label: 'Destination',      value: shipment?.destination_country ?? '—' },
      { label: 'Delivery Address', value: shipment?.delivery_address || 'Not set yet', muted: !shipment?.delivery_address },
      { label: 'Total weight',     value: shipment?.total_weight != null ? `${shipment.total_weight}kg` : 'Pending' },
      { label: 'Created',          value: shipment?.created_at ? formatDate(shipment.created_at) : '—' },
    ];
    return renderRows(infoRows);
  };

  // ─── Accordion body: Cost ─────────────────────────────────────────────────
  const renderCostBody = () => {
    const hasCostData = shipment?.slot_rate != null || shipment?.total_weight != null || shipment?.total_cost != null;
    if (!hasCostData) {
      return (
        <View style={styles.sectionContent}>
          <Text style={styles.emptyMini}>No cost records yet</Text>
        </View>
      );
    }
    const costRows: DetailRow[] = [
      { label: 'Rate',   value: shipment?.slot_rate != null ? `${currencySymbol((shipment as any)?.rate_currency)}${shipment.slot_rate}/kg` : 'TBC' },
      { label: 'Weight', value: shipment?.total_weight != null ? `${shipment.total_weight}kg` : 'Pending' },
      { label: 'Total',  value: shipment?.total_cost != null ? `${currencySymbol((shipment as any)?.rate_currency)}${shipment.total_cost}` : 'Pending' },
    ];
    return renderRows(costRows, 'Inclusive of all fees');
  };

  // ─── Documents tab content ───────────────────────────────────────────────
  const renderDocuments = () => (
    <View style={styles.docsContent}>
      <Text style={styles.subHeading}>Documents & photos</Text>

      {documents.length === 0 ? (
        <Text style={styles.emptyMini}>No documents uploaded yet</Text>
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
    </View>
  );

  // ─── Events tab content ──────────────────────────────────────────────────
  const renderEvents = () => (
    <View style={styles.eventsContent}>
      {events.length === 0 ? (
        <Text style={styles.emptyMini}>No activity recorded yet</Text>
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
    </View>
  );

  // ─── Hero card data (all derived from real shipment data) ────────────────
  const statusBadge = shipment ? getStatusBadge(shipment.status) : null;

  // Headline prefers customer-facing delivery info; only falls back to the raw
  // status when no ETA/friendly phrase is available.
  const computeHeroHeadline = (): string => {
    if (shipment?.estimated_delivery) return `Arriving ${formatDateShort(shipment.estimated_delivery)}`;
    const dest = shipment?.destination_country;
    switch (shipment?.status) {
      case 'received':         return 'Delivery pending';
      case 'origin_port':
      case 'in_transit':       return dest ? `In transit to ${dest}` : 'In transit';
      case 'destination_port': return dest ? `Arriving in ${dest}` : 'Arriving soon';
      case 'out_for_delivery': return 'Out for delivery';
      case 'delivered':        return 'Delivered';
      default:                 return statusBadge?.label ?? '—';
    }
  };
  const heroHeadline = computeHeroHeadline();

  const stageEvents = [
    { ts: shipment?.received_at,         text: 'Received at warehouse' },
    { ts: shipment?.origin_port_at,      text: shipment?.origin_port_name ? `Left ${shipment.origin_port_name}` : 'Departed origin port' },
    { ts: shipment?.in_transit_at,       text: shipment?.carrier_vessel ? `On board ${shipment.carrier_vessel}` : 'In transit' },
    { ts: shipment?.destination_port_at, text: shipment?.destination_port_name ? `Arrived ${shipment.destination_port_name}` : 'Arrived destination port' },
    { ts: shipment?.out_for_delivery_at, text: 'Out for delivery' },
    { ts: shipment?.delivered_at,        text: 'Delivered' },
  ].filter(e => !!e.ts) as { ts: string; text: string }[];
  const latestEvent = stageEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];
  const heroSub = latestEvent
    ? `${latestEvent.text} · ${timeAgo(latestEvent.ts)}`
    : (shipment?.created_at ? `Created · ${timeAgo(shipment.created_at)}` : '');

  // ─── Bottom card sections (order + right-aligned summary value) ──────────
  const fmtMoney = (n: number) => `${currencySymbol((shipment as any)?.rate_currency)}${Number(n).toFixed(2)}`;
  const sections: { key: SectionKey; title: string; summary?: string; body: () => React.ReactNode }[] = [
    { key: 'events',    title: 'Events',         summary: events.length > 0 ? `${events.length}` : undefined,                       body: renderEvents },
    { key: 'parcels',   title: 'Parcels',        summary: `${parcels.length} item${parcels.length !== 1 ? 's' : ''}`,               body: renderParcels },
    { key: 'info',      title: 'Shipment info',  body: renderInfoBody },
    { key: 'documents', title: 'Documents',      summary: documents.length > 0 ? `${documents.length} file${documents.length !== 1 ? 's' : ''}` : undefined, body: renderDocuments },
    { key: 'cost',      title: 'Cost',           summary: shipment?.total_cost != null ? fmtMoney(shipment.total_cost) : undefined,  body: renderCostBody },
  ];

  return (
    <View style={styles.root}>

      {/* ── TOP BAR: back · route title · help ──────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.topTitle} numberOfLines={1} allowFontScaling={false}>
          {shipment ? `${shipment.origin_country} → ${shipment.destination_country}` : 'Shipment'}
        </Text>

        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.navigate('ShipmentSupport', { shipmentId: route.params.shipmentId })}
        >
          <Ionicons name="help-circle-outline" size={26} color={DS.accent} />
        </TouchableOpacity>
      </View>

      {/* ── SCROLL: hero · timeline · accordion ─────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO / STATUS CARD ── */}
        <View style={styles.heroWrap}>
          <LinearGradient colors={G.heroDark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroGlow} pointerEvents="none" />
            <View style={styles.heroTopRow}>
              <Text style={styles.heroStatusLine} allowFontScaling={false}>
                {(statusBadge?.label ?? '—').toUpperCase()}
              </Text>
              {shipment?.archived_at && (
                <View style={styles.heroArchivedPill}>
                  <Text style={styles.heroArchivedText} allowFontScaling={false}>Archived</Text>
                </View>
              )}
            </View>
            <Text style={styles.heroHeadline} allowFontScaling={false}>{heroHeadline}</Text>
            {!!heroSub && (
              <Text style={styles.heroSub} allowFontScaling={false} numberOfLines={2}>{heroSub}</Text>
            )}
          </LinearGradient>
        </View>

        {/* ── DELIVERY BANNER — shown when shipment is completed ── */}
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

        {/* ── TIMELINE — original boxed style, compact + internally scrollable ── */}
        <View style={styles.timelineViewport}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {renderTimeline()}
          </ScrollView>
        </View>

        {/* ── ONE unified card: Events · Parcels · Shipment info · Documents · Cost ── */}
        <View style={styles.listCard}>
          {sections.map((section, idx) => {
            const isOpen = openSections[section.key];
            return (
              <View key={section.key}>
                {idx > 0 && <View style={styles.listDivider} />}
                <TouchableOpacity
                  style={styles.listRow}
                  activeOpacity={0.6}
                  onPress={() => toggleSection(section.key)}
                >
                  <Text style={styles.listRowLabel} maxFontSizeMultiplier={1.2}>{section.title}</Text>
                  <View style={styles.listRowRight}>
                    {!!section.summary && (
                      <Text style={styles.listRowValue} allowFontScaling={false}>{section.summary}</Text>
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={DS.textMuted}
                      style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }], marginLeft: 6 }}
                    />
                  </View>
                </TouchableOpacity>
                {isOpen && <View style={styles.listRowBody}>{section.body()}</View>}
              </View>
            );
          })}
        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          <FadingDivider />
          <Text style={styles.footerText} allowFontScaling={false}>
            {shipment?.updated_at ? `Last updated · ${formatDateTime(shipment.updated_at)}` : ''}
          </Text>
        </View>
      </ScrollView>

      {/* ── BOTTOM NAVIGATION — kept visible on this detail screen ───────── */}
      <StaticTabBar navigation={navigation} activeKey="Shipments" />

      {/* ── ACTION BOTTOM SHEET — opened from Events section action items ─── */}
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

  // ── Top bar (back · route title · help) ──────────────────────────────────────
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingBottom:     12,
  },
  iconBtn: {
    width:           38,
    height:          38,
    borderRadius:    19,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  topTitle: {
    flex:       1,
    textAlign:  'center',
    marginHorizontal: 8,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   16,
    color:      DS.textPrimary,
  },

  // ── Hero / status card ───────────────────────────────────────────────────────
  heroWrap: {
    marginHorizontal: 20,
    marginTop:        4,
    borderRadius:     24,
    shadowColor: '#140F08', shadowOpacity: 0.30, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8,
  },
  hero: {
    borderRadius: 24,
    padding:      20,
    overflow:     'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -60, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(205,100,61,0.18)',
  },
  heroTopRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  heroStatusLine: {
    fontFamily:    'PlusJakartaSans_700Bold',
    fontSize:      11,
    letterSpacing: 1.4,
    color:         '#7CC698',
  },
  heroArchivedPill: {
    backgroundColor:   'rgba(255,255,255,0.10)',
    borderRadius:      20,
    paddingVertical:   3,
    paddingHorizontal: 10,
  },
  heroArchivedText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   10,
    color:      '#E0875F',
  },
  heroHeadline: {
    fontFamily:    'PlusJakartaSans_700Bold',
    fontSize:      28,
    color:         '#FFFFFF',
    marginTop:     12,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      '#A39C8F',
    marginTop:  6,
  },

  // ── Unified list card (Events · Parcels · Shipment info · Documents · Cost) ──
  listCard: {
    backgroundColor:  DS.card,
    borderRadius:     18,
    marginHorizontal: 20,
    marginTop:        20,
    overflow:         'hidden',
    ...SH.card,
  },
  listDivider: {
    height:           1,
    backgroundColor:  DS.border,
    marginHorizontal: 18,
  },
  listRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 18,
    paddingVertical:   18,
  },
  listRowLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize:   15,
    color:      DS.textPrimary,
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  listRowValue: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize:   14,
    color:      DS.textSecondary,
  },
  listRowBody: {
    paddingHorizontal: 18,
    paddingBottom:     8,
  },
  subHeading: {
    fontFamily:    'PlusJakartaSans_600SemiBold',
    fontSize:      11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color:         DS.textSecondary,
    marginTop:     6,
    marginBottom:  2,
  },

  // ── Parcels section ──────────────────────────────────────────────────────────
  parcelBlock: {
    borderTopWidth:  1,
    borderTopColor:  DS.border,
    marginTop:       8,
    paddingTop:      8,
  },
  parcelName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize:   14,
    color:      DS.textPrimary,
    marginTop:  10,
  },
  emptyMini: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize:   13,
    color:      DS.textMuted,
    paddingVertical: 12,
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

  // ── Timeline (original boxed style, compact + internally scrollable) ────────
  timelineViewport: {
    maxHeight: 232,
  },
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

  // ── Documents section (nested inside accordion body) ─────────────────────────
  docsContent: {
    paddingHorizontal: 0,
    paddingTop:        12,
    paddingBottom:     16,
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

  // ── Events section (nested inside accordion body) ────────────────────────────
  eventsContent: {
    paddingTop:    12,
    paddingBottom: 16,
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
    backgroundColor: '#FCFBF8',
    borderWidth:     1,
    borderColor:     '#F0EEE8',
    borderRadius:    12,
    padding:         14,
    marginBottom:    8,
  },
  actionCard: {
    backgroundColor: '#FCFBF8',
    borderWidth:     1,
    borderColor:     '#E2E0DA',
    borderRadius:    12,
    padding:         14,
    marginBottom:    8,
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
