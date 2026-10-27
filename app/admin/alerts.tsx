// Powered by OnSpace.AI
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AdminEmpty, AdminLoading, SmallButton } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

interface AlertRow {
  id: string;
  type: string;
  ref_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

export default function AdminAlerts() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const { showAlert } = useAlert();
  const [items, setItems] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await adminApi.listAdminAlerts();
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else setItems((data?.alerts as AlertRow[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id?: string) => {
    const { error } = await adminApi.markAlertRead(id);
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else load();
  };

  const open = (a: AlertRow) => {
    if (!a.is_read) markRead(a.id);
    const dest =
      a.type === 'business_account_approval'
        ? '/admin/users'
        : a.type === 'ad'
        ? '/admin/ads'
        : a.type === 'content' || a.type === 'campaign'
        ? '/admin/content'
        : '/admin/businesses';
    router.push(dest);
  };

  const alertIcon = (type: string) => {
    if (type === 'business_account_approval') return 'shield-clock-outline';
    if (type === 'ad') return 'bullhorn-outline';
    if (type === 'content') return 'image-multiple-outline';
    if (type === 'campaign') return 'sale';
    return 'storefront-outline';
  };

  const renderItem = ({ item }: { item: AlertRow }) => {
    const accent = item.type === 'ad' || item.type === 'campaign';
    return (
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.card, !item.is_read && styles.unread, pressed && { opacity: 0.75 }]} onPress={() => open(item)}>
        <View style={[styles.icon, { backgroundColor: accent ? colors.primarySoft : colors.surfaceTint }]}>
          <MaterialCommunityIcons name={alertIcon(item.type) as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={accent ? colors.primaryDark : colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.top}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            {!item.is_read ? <View style={styles.dot} /> : null}
          </View>
          {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textFaint} />
      </Pressable>
    );
  };

  if (loading) return <AdminLoading />;

  return (
    <View style={styles.screen}>
      {items.some((i) => !i.is_read) ? (
        <View style={styles.actionBar}>
          <SmallButton label="Tümünü okundu yap" icon="check-all" tone="info" outline onPress={() => markRead(undefined)} />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={<AdminEmpty icon="bell-check-outline" text="Yeni başvuru bildirimi yok." />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  actionBar: { padding: spacing.lg, paddingBottom: spacing.sm, alignItems: 'flex-end' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, paddingTop: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  unread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  body: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
});
