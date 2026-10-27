// Powered by OnSpace.AI
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AdminEmpty, AdminLoading, FilterTabs, SmallButton, StatusPill } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { AD_TYPE_LABELS } from '@/services/adService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { useRejectedAdRemoval } from '@/hooks/useRejectedAdRemoval';

interface Ad {
  id: string;
  title?: string;
  type: string;
  status: string;
  price: number;
  payment_status: string;
  start_date?: string;
  end_date?: string;
  businesses?: { name?: string; category?: string } | null;
}

const TABS = [
  { id: 'pending', label: 'Bekleyen' },
  { id: 'active', label: 'Aktif' },
  { id: 'paused', label: 'Durdurulan' },
  { id: 'rejected', label: 'Red' },
  { id: 'all', label: 'Tümü' },
];

export default function AdminAds() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { showAlert } = useAlert();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await adminApi.listAds(filter === 'all' ? undefined : filter);
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else setItems((data?.ads as Ad[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [filter, showAlert]);

  const removal = useRejectedAdRemoval(load);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (promise: Promise<{ error: string | null }>) => {
    const { error } = await promise;
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else load();
  };

  const renderItem = ({ item }: { item: Ad }) => {
    const statusTone = item.status === 'active' ? 'success' : item.status === 'rejected' ? 'danger' : item.status === 'paused' ? 'neutral' : 'warning';
    const statusLabel = item.status === 'active' ? 'Aktif' : item.status === 'rejected' ? 'Reddedildi' : item.status === 'paused' ? 'Durduruldu' : 'Bekliyor';
    const paid = item.payment_status === 'paid';
    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.businesses?.name ?? 'İşletme'}</Text>
            <Text style={styles.meta}>{AD_TYPE_LABELS[item.type] ?? item.type}</Text>
          </View>
          <StatusPill label={statusLabel} tone={statusTone} />
        </View>

        {item.title ? <Text style={styles.title} numberOfLines={1}>{item.title}</Text> : null}

        <View style={styles.infoRow}>
          <Text style={styles.price}>{Number(item.price).toLocaleString('tr-TR')} ₺</Text>
          <StatusPill label={paid ? 'Ödendi (manuel)' : 'Ödenmedi'} tone={paid ? 'success' : 'warning'} />
        </View>
        {item.start_date ? <Text style={styles.dates}>{item.start_date} → {item.end_date ?? '-'}</Text> : null}

        <View style={styles.actions}>
          {item.status !== 'active' ? (
            <SmallButton label="Yayınla" icon="play" tone="success" onPress={() => run(adminApi.updateAd(item.id, { status: 'active' }))} />
          ) : (
            <SmallButton label="Durdur" icon="pause" tone="neutral" outline onPress={() => run(adminApi.updateAd(item.id, { status: 'paused' }))} />
          )}
          {item.status !== 'rejected' ? (
            <SmallButton label="Reddet" icon="close" tone="danger" outline onPress={() => run(adminApi.updateAd(item.id, { status: 'rejected', rejection_reason: 'Yönetici tarafından reddedildi' }))} />
          ) : null}
          {item.status === 'rejected' ? <SmallButton label="Sil" icon="trash-can-outline" tone="danger" outline disabled={!!removal.busy} onPress={() => removal.remove(item.id)} /> : null}
          <SmallButton
            label={paid ? 'Ödeme doğrulamasını kaldır' : 'Ödendi işaretle'}
            icon="cash"
            tone={paid ? 'neutral' : 'primary'}
            outline
            onPress={() => run(adminApi.updateAd(item.id, { payment_status: paid ? 'unpaid' : 'paid' }))}
          />
        </View>
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
          ListEmptyComponent={<AdminEmpty icon="bullhorn-outline" text="Bu durumda reklam yok." />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabsWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  title: { fontSize: fontSize.sm, color: colors.text },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  dates: { fontSize: fontSize.xs, color: colors.textSubtle },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
});
