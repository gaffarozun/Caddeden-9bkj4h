// Powered by OnSpace.AI
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AdminEmpty, AdminLoading, FilterTabs, SmallButton, StatusPill } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { categoryLabel, getMainCategory } from '@/services/categories';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

interface Biz {
  id: string;
  name: string;
  category: string;
  main_category: string;
  approval_status: string;
  is_published: boolean;
  featured: boolean;
  phone?: string;
  address?: string;
}

const TABS = [
  { id: 'pending', label: 'Bekleyen' },
  { id: 'approved', label: 'Onaylı' },
  { id: 'rejected', label: 'Red' },
  { id: 'all', label: 'Tümü' },
];

export default function AdminBusinesses() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { showAlert } = useAlert();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState<Biz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await adminApi.listBusinesses(filter === 'all' ? undefined : filter);
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else setItems((data?.businesses as Biz[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [filter, showAlert]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const run = async (promise: Promise<{ error: string | null }>, successMsg?: string) => {
    const { error } = await promise;
    if (error) {
      showAlert('Hata', error, [{ text: 'Tamam' }]);
      return;
    }
    if (successMsg) showAlert('Başarılı', successMsg, [{ text: 'Tamam' }]);
    load();
  };

  const confirmReject = (b: Biz) =>
    showAlert('İşletmeyi reddet', `${b.name} reddedilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Reddet', style: 'destructive', onPress: () => run(adminApi.updateBusinessStatus(b.id, 'rejected', 'Yönetici tarafından reddedildi'), `${b.name} reddedildi.`) },
    ]);

  const renderItem = ({ item }: { item: Biz }) => {
    const main = getMainCategory(item.main_category);
    const tone = item.approval_status === 'approved' ? 'success' : item.approval_status === 'rejected' ? 'danger' : 'warning';
    const label = item.approval_status === 'approved' ? 'Onaylı' : item.approval_status === 'rejected' ? 'Reddedildi' : 'Bekliyor';
    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.meta}>{main?.label ?? ''} · {categoryLabel(item.category)}</Text>
          </View>
          <StatusPill label={label} tone={tone} />
        </View>
        {item.address ? <Text style={styles.addr} numberOfLines={1}>{item.address}</Text> : null}

        <View style={styles.badges}>
          {item.is_published ? <StatusPill label="Yayında" tone="info" /> : <StatusPill label="Yayında değil" tone="neutral" />}
          {item.featured ? <StatusPill label="Öne çıkan" tone="primary" /> : null}
        </View>

        <View style={styles.actions}>
          {item.approval_status !== 'approved' ? (
            <SmallButton label="Onayla" icon="check" tone="success" onPress={() => run(adminApi.updateBusinessStatus(item.id, 'approved'), `${item.name} onaylandı ve yayına alındı.`)} />
          ) : null}
          {item.approval_status !== 'rejected' ? (
            <SmallButton label="Reddet" icon="close" tone="danger" outline onPress={() => confirmReject(item)} />
          ) : null}
          {item.approval_status === 'approved' ? (
            <SmallButton
              label={item.is_published ? 'Yayından kaldır' : 'Yayınla'}
              icon={item.is_published ? 'eye-off-outline' : 'eye-outline'}
              tone="info"
              outline
              onPress={() => run(adminApi.setBusinessPublished(item.id, !item.is_published), item.is_published ? 'Yayından kaldırıldı.' : 'Yayına alındı.')}
            />
          ) : null}
          {item.approval_status === 'approved' ? (
            <SmallButton
              label={item.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
              icon="star-outline"
              tone="primary"
              outline
              onPress={() => run(adminApi.setBusinessFeatured(item.id, !item.featured), item.featured ? 'Öne çıkarma kaldırıldı.' : 'Öne çıkarıldı.')}
            />
          ) : null}
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
          ListEmptyComponent={<AdminEmpty icon="storefront-outline" text="Bu durumda işletme yok." />}
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
  addr: { fontSize: fontSize.xs, color: colors.textSubtle },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
});
