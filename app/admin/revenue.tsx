// Powered by OnSpace.AI
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AdminEmpty, AdminLoading, StatusPill } from '@/components/admin/ui';
import { adminApi } from '@/services/adminService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

interface Payment {
  id: string;
  amount: number;
  status: string;
  method?: string;
  note?: string;
  created_at: string;
  businesses?: { name?: string } | null;
}

interface RevenueData {
  payments: Payment[];
  totals: { paid: number; pending: number; refunded: number };
}

const fmt = (n: number) => Number(n || 0).toLocaleString('tr-TR') + ' ₺';

export default function AdminRevenue() {
  const { colors, styles } = useThemeStyles(createStyles);
  const { showAlert } = useAlert();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: d, error } = await adminApi.revenue();
    if (error) showAlert('Hata', error, [{ text: 'Tamam' }]);
    else setData(d as RevenueData);
    setLoading(false);
    setRefreshing(false);
  }, [showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <AdminLoading />;

  const totals = data?.totals ?? { paid: 0, pending: 0, refunded: 0 };
  const payments = data?.payments ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <View style={styles.noteCard}>
        <MaterialCommunityIcons name="information-outline" size={18} color={colors.info} />
        <Text style={styles.noteText}>
          Gerçek ödeme entegrasyonu (Stripe) henüz kurulmadı. Aşağıdaki kayıtlar yönetici tarafından manuel takip içindir; otomatik tahsilat yapılmaz.
        </Text>
      </View>

      <View style={styles.totals}>
        <TotalCard label="Tahsil edilen" value={fmt(totals.paid)} tone="success" icon="cash-check" />
        <TotalCard label="Bekleyen" value={fmt(totals.pending)} tone="warning" icon="timer-sand" />
        <TotalCard label="İade" value={fmt(totals.refunded)} tone="danger" icon="cash-refund" />
      </View>

      <Text style={styles.sectionTitle}>Ödeme Kayıtları</Text>
      {payments.length === 0 ? (
        <AdminEmpty icon="cash-multiple" text="Henüz ödeme kaydı yok. Reklam yönetiminden 'Ödendi' işaretlenen reklamlar burada görünür." />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {payments.map((p) => {
            const tone = p.status === 'paid' ? 'success' : p.status === 'refunded' ? 'danger' : 'warning';
            const label = p.status === 'paid' ? 'Tahsil edildi' : p.status === 'refunded' ? 'İade' : 'Bekliyor';
            return (
              <View key={p.id} style={styles.payRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payBiz} numberOfLines={1}>{p.businesses?.name ?? 'İşletme'}</Text>
                  <Text style={styles.payMeta}>{new Date(p.created_at).toLocaleDateString('tr-TR')} · {p.method ?? 'manuel'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.payAmount}>{fmt(p.amount)}</Text>
                  <StatusPill label={label} tone={tone} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function TotalCard({ label, value, tone, icon }: { label: string; value: string; tone: 'success' | 'warning' | 'danger'; icon: string }) {
  const { colors, styles } = useThemeStyles(createStyles);
  const map = { success: colors.success, warning: colors.warning, danger: colors.danger };
  return (
    <View style={styles.totalCard}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={map[tone]} />
      <Text style={styles.totalValue}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  noteCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surfaceTint, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: fontSize.xs, color: colors.info, lineHeight: fontSize.xs * 1.5 },
  totals: { flexDirection: 'row', gap: spacing.sm },
  totalCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4, alignItems: 'flex-start' },
  totalValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  totalLabel: { fontSize: fontSize.xs, color: colors.textSubtle },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.sm },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  payBiz: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  payMeta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
  payAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
});
