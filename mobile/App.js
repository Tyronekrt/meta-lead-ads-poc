import { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { io } from 'socket.io-client';
import { DEFAULT_BACKEND_URL, DEBUG_SOCKET } from './src/config';

function resolveBackendUrl() {
  const extraUrl = Constants?.expoConfig?.extra?.backendUrl;
  if (extraUrl) return extraUrl;
  return DEFAULT_BACKEND_URL;
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso || '';
  }
}

function LeadCard({ lead, highlight }) {
  const name = lead.full_name || lead.fields?.full_name || 'Unnamed lead';
  const email = lead.email || lead.fields?.email || '';
  const phone = lead.phone || lead.fields?.phone_number || '';
  const extraEntries = Object.entries(lead.fields || {}).filter(
    ([k]) => !['full_name', 'fullname', 'name', 'email', 'phone_number', 'phone', '_note'].includes(k)
  );
  const note = lead.fields?._note;

  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <View style={styles.cardTopRow}>
        <Text style={styles.cardName}>{name}</Text>
        <View style={[styles.badge, lead.source?.includes('meta') ? styles.badgeMeta : styles.badgeTest]}>
          <Text style={styles.badgeText}>
            {lead.source?.includes('meta') ? '● META' : '● ' + String(lead.source || 'NEW').toUpperCase()}
          </Text>
        </View>
      </View>
      {!!email && <Text style={styles.cardLine}>✉️ {email}</Text>}
      {!!phone && <Text style={styles.cardLine}>📞 {phone}</Text>}
      {extraEntries.map(([k, v]) => (
        <Text key={k} style={styles.cardLine}>
          • {k}: {String(v)}
        </Text>
      ))}
      {!!note && <Text style={styles.cardNote}>{note}</Text>}
      <Text style={styles.cardMeta}>
        id: {String(lead.id).slice(0, 24)}  •  {formatTime(lead.created_time || lead.received_at)}
      </Text>
    </View>
  );
}

export default function App() {
  const backendUrl = resolveBackendUrl();
  const [leads, setLeads] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastEventAt, setLastEventAt] = useState(null);
  const [socketId, setSocketId] = useState('');
  const newestIdRef = useRef(null);
  const socketRef = useRef(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/leads`);
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (e) {
      if (DEBUG_SOCKET) console.log('fetch /api/leads failed:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    const socket = io(backendUrl, { transports: ['websocket'], reconnection: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id || '');
      if (DEBUG_SOCKET) console.log('socket connected', socket.id);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    // Full history on (re)connect — keeps list correct even if a push was missed.
    socket.on('leads:init', (history) => {
      if (Array.isArray(history)) setLeads(history);
    });

    // Live lead — prepend without any user action. This is the PoC's core moment.
    socket.on('new-lead', (lead) => {
      setLastEventAt(new Date().toISOString());
      newestIdRef.current = lead.id;
      setLeads((prev) => {
        if (prev.some((l) => l.id === lead.id)) return prev;
        return [lead, ...prev];
      });
      // clear highlight after 4s
      setTimeout(() => {
        if (newestIdRef.current === lead.id) newestIdRef.current = null;
      }, 4000);
    });

    return () => socket.disconnect();
  }, [backendUrl]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Live Leads</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]} />
          <Text style={styles.statusText}>{connected ? 'LIVE — waiting for Meta leads…' : 'connecting…'}</Text>
        </View>
        <Text style={styles.sub}>
          {leads.length} lead{leads.length === 1 ? '' : 's'} • {backendUrl}
        </Text>
        {lastEventAt && <Text style={styles.subSmall}>last push: {formatTime(lastEventAt)}</Text>}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.hint}>Loading leads…</Text>
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={leads.length === 0 ? styles.emptyWrap : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No leads yet</Text>
              <Text style={styles.hint}>
                Keep this screen open,{'\n'}then submit a test lead from{'\n'}Meta's Lead Ads Testing Tool.
              </Text>
              <Text style={styles.hintDim}>It will appear here automatically.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <LeadCard lead={item} highlight={newestIdRef.current === item.id} />
          )}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {connected ? `socket ${socketId.slice(0, 8)}… connected` : 'socket disconnected — check backend URL'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6FB' },
  header: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E9F0' },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  dotOn: { backgroundColor: '#16A34A' },
  dotOff: { backgroundColor: '#DC2626' },
  statusText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  sub: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  subSmall: { fontSize: 11, color: '#9CA3AF' },
  list: { padding: 14 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  center: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  hint: { textAlign: 'center', color: '#6B7280', lineHeight: 20 },
  hintDim: { textAlign: 'center', color: '#9CA3AF', marginTop: 6, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E9F0' },
  cardHighlight: { borderColor: '#16A34A', borderWidth: 2, backgroundColor: '#F0FDF4' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardName: { fontSize: 17, fontWeight: '700', color: '#111827', flex: 1 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeMeta: { backgroundColor: '#DBEAFE' },
  badgeTest: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#1F2937' },
  cardLine: { fontSize: 14, color: '#374151', marginTop: 2 },
  cardNote: { fontSize: 12, color: '#B45309', marginTop: 6 },
  cardMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 8 },
  footer: { padding: 10, alignItems: 'center', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E9F0' },
  footerText: { fontSize: 11, color: '#9CA3AF' },
});
