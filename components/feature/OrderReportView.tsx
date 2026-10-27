import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useOrderReport } from '@/hooks/useOrderReport';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { orderReportPeriods, orderReportSorts, orderReportStatuses, orderReportViews } from '@/constants/orderReport';
import { businessProfileLayout, fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { OrderReportListRow, reportDateTime, reportDayLabel } from '@/services/orderReportService';
import { requestStatusMeta } from '@/services/businessRequestService';
import { money } from '@/services/businessProfileService';
import { FeedbackButton, FeedbackChips, FeedbackError, FeedbackInput } from './FeedbackControls';

interface OrderReportViewProps { adminMode?: boolean }
export const OrderReportView = memo(function OrderReportView({ adminMode = false }: OrderReportViewProps) {
  const m = useOrderReport(adminMode);
  const { colors, styles } = useThemeStyles(createStyles);
  const list = useRef<FlatList<OrderReportListRow>>(null);
  useEffect(() => { list.current?.scrollToOffset({ offset: 0, animated: false }); }, [m.filters.page]);
  const businessOptions = useMemo(() => [{ id: 'all', label: adminMode ? 'Tüm işletmeler' : 'İşletmelerimin tümü' }, ...m.businesses.map(item => ({ id: item.id, label: item.name }))], [adminMode, m.businesses]);
  const summary = m.report?.summary;
  const dateContext = m.filters.start && m.filters.end
    ? m.filters.start === m.filters.end ? reportDayLabel(m.filters.start) : `${reportDayLabel(m.filters.start)} – ${reportDayLabel(m.filters.end)}`
    : 'Tüm tarihler';
  const businessName = m.filters.business ? m.businesses.find(item => item.id === m.filters.business)?.name ?? 'Seçili işletme' : adminMode ? 'Tüm işletmeler' : 'Tüm işletmelerim';
  const statusLabel = orderReportStatuses.find(item => item.id === m.filters.status)?.label ?? 'Tüm durumlar';
  const pageCount = m.report ? Math.max(1, Math.ceil(m.report.totalRows / m.report.pageSize)) : 1;
  const renderItem = useCallback(({ item }: { item: OrderReportListRow }) => {
    if (item.kind === 'day') return <View style={styles.card}>
      <View style={styles.row}><MaterialCommunityIcons name="calendar-outline" size={24} color={colors.primary} /><Text style={styles.cardTitle}>{reportDayLabel(item.day.day)}</Text></View>
      <Text style={styles.subtle}>Günlük ciro · Teslim edilen siparişler</Text>
      <Text style={styles.amount}>{money(Number(item.day.revenue))}</Text>
      <View style={styles.row}><Text style={styles.body}>{item.day.order_count} sipariş</Text><Text style={styles.subtle}>{item.day.delivered_count} teslim edildi</Text></View>
    </View>;
    const order = item.order;
    const meta = requestStatusMeta(order.status);
    const statusSurface = meta.tone === 'success' ? colors.successSoft : meta.tone === 'danger' ? colors.dangerSoft : colors.warningSoft;
    return <View style={styles.card}>
      <View style={styles.between}><View style={styles.copy}><Text style={styles.cardTitle}>{order.businesses?.name ?? 'İşletme'}</Text><Text style={styles.subtle}>Sipariş #{order.id.slice(0, 8).toUpperCase()}</Text></View><View style={[styles.status, { backgroundColor: statusSurface }]}><Text style={[styles.statusText, { color: colors[meta.tone] }]}>{meta.label}</Text></View></View>
      <View style={styles.between}><View style={styles.row}><MaterialCommunityIcons name="clock-outline" size={20} color={colors.textSubtle} /><Text style={styles.body}>{reportDateTime(order.created_at)}</Text></View><Text style={styles.orderAmount}>{money(Number(order.total))}</Text></View>
      <View style={styles.customer}><MaterialCommunityIcons name="account-outline" size={20} color={colors.primary} /><Text style={styles.body}>{order.customer_name || 'Müşteri'}</Text></View>
      <Text style={styles.body}>{(order.items ?? []).map(product => `${product.qty} × ${product.name} · ${money(Number(product.price) * Number(product.qty))}`).join('\n') || 'Ürün bilgisi bulunmuyor.'}</Text>
      {order.note ? <Text style={styles.subtle}>Not: {order.note}</Text> : null}
      {order.address ? <Text style={styles.subtle}>Adres: {order.address}</Text> : null}
      {order.phone ? <Text style={styles.subtle}>Telefon: {order.phone}</Text> : null}
    </View>;
  }, [styles, colors]);
  return <SafeAreaView style={styles.screen} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList<OrderReportListRow>
        ref={list} data={m.rows} keyExtractor={item => item.key} renderItem={renderItem}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content} ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={m.refreshing} onRefresh={m.refresh} tintColor={colors.primary} />}
        ListHeaderComponent={<View style={styles.blocks}>
          <View style={styles.hero}>
            <View style={styles.row}><MaterialCommunityIcons name="chart-timeline-variant" size={24} color={colors.primaryDark} /><Text style={styles.title}>{adminMode ? 'Tüm siparişler ve ciro' : 'Sipariş geçmişim ve ciro'}</Text></View>
            <Text style={styles.context}>{businessName} · {dateContext}</Text>
            <Text style={styles.subtle}>{statusLabel}</Text>
            <View style={styles.revenue} accessibilityLiveRegion="polite"><Text style={styles.revenueLabel}>{m.filters.start && m.filters.start === m.filters.end ? 'Günlük ciro' : 'Seçili dönemin cirosu'}</Text><Text style={styles.revenueAmount}>{summary ? money(Number(summary.revenue)) : '—'}</Text></View>
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={styles.metricValue}>{summary ? summary.orderCount : '—'}</Text><Text style={styles.subtle}>Sipariş</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{summary ? summary.deliveredCount : '—'}</Text><Text style={styles.subtle}>Teslim edildi</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{summary ? money(Number(summary.average)) : '—'}</Text><Text style={styles.subtle}>Ortalama teslim</Text></View>
            </View>
            <Text style={styles.note}>Ciro, yalnızca teslim edilen siparişlerin toplamıdır. Günler sipariş oluşturma tarihine göre Türkiye saatiyle hesaplanır. Tahsilat veya net kazanç raporu değildir.</Text>
            <Text style={styles.note}>{adminMode ? 'Tüm işletmelerin sipariş ayrıntılarını görüntüleyebilirsiniz.' : 'Yalnızca size ait işletmelerin siparişleri gösterilir.'} Toplamlar, sadece bu sayfayı değil filtreye uyan tüm kayıtları kapsar.</Text>
          </View>
          <View style={styles.filters}>
            <FeedbackChips label="Tarih" compact items={orderReportPeriods} selected={m.period} onSelect={value => m.choosePeriod(value as typeof m.period)} />
            {m.period === 'custom' ? <View style={styles.dateBlock}>
              <View style={styles.dates}><View style={styles.dateField}><FeedbackInput label="Başlangıç (YYYY-AA-GG)" value={m.draftStart} onChange={m.updateStart} maxLength={10} multiline={false} placeholder="2026-10-01" /></View><View style={styles.dateField}><FeedbackInput label="Bitiş (YYYY-AA-GG)" value={m.draftEnd} onChange={m.updateEnd} maxLength={10} multiline={false} placeholder="2026-10-23" /></View></View>
              {m.dateError ? <FeedbackError message={m.dateError} /> : null}
              <FeedbackButton label="Tarih aralığını uygula" icon="calendar-check-outline" onPress={m.applyDates} />
            </View> : null}
            {businessOptions.length > 1 ? <FeedbackChips label="İşletme" compact items={businessOptions} selected={m.filters.business ?? 'all'} onSelect={m.selectBusiness} /> : null}
            <FeedbackChips label="Rapor görünümü" compact items={orderReportViews} selected={m.filters.view} onSelect={m.selectView} />
            <FeedbackChips label="Sipariş durumu" compact items={orderReportStatuses} selected={m.filters.status} onSelect={m.selectStatus} />
            <FeedbackChips label={m.filters.view === 'daily' ? 'Tarih / günlük ciro sıralaması' : 'Tarih / sipariş tutarı sıralaması'} compact items={orderReportSorts} selected={m.filters.sort} onSelect={m.selectSort} />
          </View>
          <View style={styles.between}><Text style={styles.cardTitle}>{m.filters.view === 'daily' ? 'Gün bazında rapor' : 'Sipariş kayıtları'}</Text><Text style={styles.subtle}>{m.report ? `${m.report.totalRows} ${m.filters.view === 'daily' ? 'gün' : 'kayıt'}` : '—'}</Text></View>
          {m.error ? <View style={styles.dateBlock}><FeedbackError message={m.error} /><FeedbackButton label="Raporu yeniden yükle" secondary onPress={m.refresh} busy={m.refreshing} /></View> : null}
          {m.loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Sipariş raporu yükleniyor" /> : null}
        </View>}
        ListEmptyComponent={!m.loading && !m.error ? <View style={styles.empty}><MaterialCommunityIcons name="receipt-text-outline" size={spacing.xxxl} color={colors.textFaint} /><Text style={styles.body}>Seçili filtrelere uyan sipariş yok.</Text></View> : null}
        ListFooterComponent={m.report && m.report.totalRows > 0 ? <View style={styles.footer}>
          <Text style={styles.subtle}>Sayfa {m.filters.page + 1} / {pageCount} · {m.report.totalRows} {m.filters.view === 'daily' ? 'gün' : 'kayıt'}</Text>
          <View style={styles.pagination}><View style={styles.pageButton}><FeedbackButton label="Önceki" secondary disabled={m.loading || m.filters.page === 0} onPress={() => m.selectPage(m.filters.page - 1)} /></View><View style={styles.pageButton}><FeedbackButton label="Sonraki" secondary disabled={m.loading || m.filters.page + 1 >= pageCount} onPress={() => m.selectPage(m.filters.page + 1)} /></View></View>
        </View> : null}
      />
    </KeyboardAvoidingView>
  </SafeAreaView>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, maxWidth: businessProfileLayout.maxWidth, width: '100%', alignSelf: 'center' },
  blocks: { gap: spacing.lg, marginBottom: spacing.lg },
  hero: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primaryDark, flexShrink: 1, includeFontPadding: false },
  context: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: fontSize.md * 1.6, includeFontPadding: false },
  revenue: { paddingVertical: spacing.md, gap: spacing.xs },
  revenueLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.medium },
  revenueAmount: { fontSize: fontSize.xxxl, fontWeight: fontWeight.bold, color: colors.primaryDark, includeFontPadding: false },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexGrow: 1, minWidth: spacing.xxxl * 2, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  metricValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, includeFontPadding: false },
  note: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  filters: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: spacing.md, borderRadius: radius.lg, gap: spacing.md },
  dateBlock: { gap: spacing.md }, dates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, dateField: { flex: 1, minWidth: spacing.xxxl * 3 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, borderRadius: radius.lg, gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, includeFontPadding: false },
  copy: { flex: 1, minWidth: spacing.xxxl * 3, gap: spacing.xs },
  body: { color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, flexShrink: 1, includeFontPadding: false },
  subtle: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6, flexShrink: 1, includeFontPadding: false },
  status: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  statusText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  amount: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.primary, includeFontPadding: false },
  orderAmount: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary, includeFontPadding: false },
  customer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, separator: { height: spacing.md },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md }, footer: { paddingTop: spacing.lg, gap: spacing.md },
  pagination: { flexDirection: 'row', gap: spacing.sm }, pageButton: { flex: 1 },
});
