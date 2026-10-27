// Powered by OnSpace.AI
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminEmpty, AdminLoading } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

interface LogRow {
  id: string;
  action: string;
  detail?: unknown;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  bootstrap_admin: 'Yönetici atandı',
  update_business_status: 'İşletme durumu güncellendi',
  set_business_published: 'İşletme yayın durumu değişti',
  set_business_featured: 'Öne çıkarma değişti',
  update_ad: 'Reklam güncellendi',
  upsert_ad_package: 'Reklam paketi kaydedildi',
  send_notification: 'Bildirim gönderildi',
  restrict_user: 'Kullanıcı kısıtlandı',
  update_complaint: 'Şikâyet güncellendi',
};

export default function AdminLogs() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { showAlert } = useAlert();
  const [items, setItems] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await adminApi.listLogs();
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else setItems((data?.logs as LogRow[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: LogRow }) => (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="history" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.action}>{ACTION_LABELS[item.action] ?? item.action}</Text>
        <Text style={styles.detail} numberOfLines={2}>{item.detail ? JSON.stringify(item.detail) : '-'}</Text>
        <Text style={styles.date}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>
      </View>
    </View>
  );

  if (loading) return <AdminLoading />;

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(i) => i.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListEmptyComponent={<AdminEmpty icon="history" text="İşlem kaydı yok." />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  action: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  detail: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  date: { fontSize: fontSize.xs, color: colors.textFaint, marginTop: 4 },
});
