// Powered by OnSpace.AI
// Admin approval for business notification requests. Approving publishes the
// notification to users (server-side); rejecting keeps it unpublished. Payments
// are tracked manually. All actions run through the server-verified admin-api.
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminEmpty, AdminLoading, FilterTabs, SmallButton, StatusPill } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { categoryLabel } from '@/services/categories';
import { WEEKDAYS } from '@/services/businessStatus';
import { timeAgo } from '@/services/contentService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

interface Req {
  id: string;
  title: string;
  body: string;
  target_category: string | null;
  send_count: number;
  time_start: string | null;
  time_end: string | null;
  days: number[];
  price: number;
  payment_status: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  businesses?: { name?: string; category?: string } | null;
}

const TABS = [
  { id: 'pending', label: 'Bekleyen' },
  { id: 'approved', label: 'Onaylı' },
  { id: 'rejected', label: 'Red' },
  { id: 'all', label: 'Tümü' },
];

export default function AdminNotificationRequests() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { showAlert } = useAlert();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await adminApi.listNotificationRequests(filter === 'all' ? undefined : filter);
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else setItems((data?.requests as Req[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [filter, showAlert]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (promise: Promise<{ error: string | null }>, msg?: string) => {
    const { error } = await promise;
    if (error) {
      showAlert('Hata', error, [{ text: 'Tamam' }]);
      return;
    }
    if (msg) showAlert('Başarılı', msg, [{ text: 'Tamam' }]);
    load();
  };

  const approve = (r: Req) => run(adminApi.updateNotificationRequest(r.id, 'approved'), 'Onaylandı ve kullanıcılara gönderildi.');

  const reject = (r: Req) =>
    showAlert('Reddet', 'Bu bildirim talebi reddedilsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Reddet',
        style: 'destructive',
        onPress: () => run(adminApi.updateNotificationRequest(r.id, 'rejected', 'Yönetici tarafından reddedildi'), 'Reddedildi.'),
      },
    ]);

  const markPaid = (r: Req) => {
    const paid = r.payment_status === 'paid';
    run(adminApi.setNotificationRequestPaid(r.id, paid ? 'unpaid' : 'paid'));
  };

  const statusMeta = (status: string): { label: string; tone: 'success' | 'warning' | 'danger' } =>
    status === 'approved'
      ? { label: 'Onaylı', tone: 'success' }
      : status === 'rejected'
      ? { label: 'Reddedildi', tone: 'danger' }
      : { label: 'Bekliyor', tone: 'warning' };

  const renderItem = ({ item }: { item: Req }) => {
    const st = statusMeta(item.status);
    const paid = item.payment_status === 'paid';
    const dayLabels = (item.days ?? [])
      .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
      .filter(Boolean)
      .join(', ');
    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.biz} numberOfLines={1}>{item.businesses?.name ?? 'İşletme'}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.target_category ? categoryLabel(item.target_category) : 'Tüm kullanıcılar'} · {timeAgo(item.created_at)}
            </Text>
          </View>
          <StatusPill label={st.label} tone={st.tone} />
        </View>

        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.body} numberOfLines={3}>{item.body}</Text>

        <View style={styles.scheduleRow}>
          <MaterialScheduleChip icon="repeat" text={`${item.send_count} gönderim`} />
          <MaterialScheduleChip icon="clock-outline" text={`${item.time_start ?? '--'}-${item.time_end ?? '--'}`} />
        </View>
        {dayLabels ? <Text style={styles.days}>Günler: {dayLabels}</Text> : null}

        <View style={styles.infoRow}>
          <Text style={styles.price}>{Number(item.price).toLocaleString('tr-TR')} ₺</Text>
          <StatusPill label={paid ? 'Ödendi (manuel)' : 'Ödenmedi'} tone={paid ? 'success' : 'warning'} />
        </View>

        <View style={styles.actions}>
          {item.status !== 'approved' ? (
            <SmallButton label="Onayla & Gönder" icon="check" tone="success" onPress={() => approve(item)} />
          ) : null}
          {item.status !== 'rejected' ? (
            <SmallButton label="Reddet" icon="close" tone="danger" outline onPress={() => reject(item)} />
          ) : null}
          <SmallButton
            label={paid ? 'Ödemeyi geri al' : 'Ödendi işaretle'}
            icon="cash"
            tone={paid ? 'neutral' : 'primary'}
            outline
            onPress={() => markPaid(item)}
          />
        </View>
        {item.status === 'rejected' && item.rejection_reason ? (
          <Text style={styles.reason}>Ret nedeni: {item.rejection_reason}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabsWrap}>
        <FilterTabs options={TABS} value={filter} onChange={setFilter} />
      </View>
      {loading ? (
        <AdminLoading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={<AdminEmpty icon="bell-check-outline" text="Bu durumda bildirim talebi yok." />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function MaterialScheduleChip({ icon, text }: { icon: string; text: string }) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.schedChip}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={14} color={colors.textSubtle} />
      <Text style={styles.schedText}>{text}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabsWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  biz: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  body: { fontSize: fontSize.sm, color: colors.textSubtle },
  scheduleRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  schedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceTint, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  schedText: { fontSize: fontSize.xs, color: colors.textSubtle, fontWeight: fontWeight.medium },
  days: { fontSize: fontSize.xs, color: colors.textSubtle },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
  reason: { fontSize: fontSize.xs, color: colors.danger },
});
