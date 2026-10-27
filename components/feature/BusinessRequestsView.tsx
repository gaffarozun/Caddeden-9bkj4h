import React, { memo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { RequestSection, useBusinessRequests } from '@/hooks/useBusinessRequests';
import { OrderRow, ReservationRow, requestStatusMeta } from '@/services/businessRequestService';
import { money } from '@/services/businessProfileService';
import { timeAgo } from '@/services/contentService';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { BusinessChips } from './BusinessProfileControls';
import { spacing, radius, fontSize, ThemeColors } from '@/constants/theme';
interface BusinessRequestsViewProps { initialSection?: RequestSection; tabPage?: boolean }
export const BusinessRequestsView = memo(function BusinessRequestsView({ initialSection = 'orders', tabPage = false }: BusinessRequestsViewProps) {
 const m = useBusinessRequests(initialSection); const { colors: c, styles: s } = useThemeStyles(createStyles); const router = useRouter();
 const render = ({ item }: { item: OrderRow | ReservationRow }) => {
  const order = 'items' in item ? item : null; const booking = 'date' in item ? item : null; const meta = requestStatusMeta(item.status);
  return <View style={s.card}><View style={s.row}><View style={s.info}><Text style={s.heading}>{item.businesses?.name ?? 'İşletmem'}</Text><Text style={s.subtle}>{order ? 'Sipariş' : booking?.type === 'appointment' ? 'Randevu' : 'Rezervasyon'} · {timeAgo(item.created_at)}</Text></View><Text style={[s.status, { color: c[meta.tone] }]}>{meta.label}</Text></View>
   <View style={s.row}><MaterialCommunityIcons name="account-outline" size={20} color={c.textSubtle} /><Text style={s.text}>{item.customer_name ?? 'Müşteri'}</Text></View>
   {order ? <><Text style={s.text}>{(order.items ?? []).map(row => `${row.qty} × ${row.name}`).join('\n')}</Text><Text style={s.total}>{money(Number(order.total))}</Text>{order.note ? <Text style={s.subtle}>{order.note}</Text> : null}<Pressable style={({ pressed }) => [s.contact, pressed ? s.pressed : null]} disabled={!order.address && order.lat == null} onPress={() => { const q = order.lat != null && order.lng != null ? `${order.lat},${order.lng}` : encodeURIComponent(order.address ?? ''); void m.link(`https://www.google.com/maps/search/?api=1&query=${q}`); }}><MaterialCommunityIcons name="map-marker-outline" size={22} color={c.primary} /><Text style={s.text}>{order.address || 'Adres belirtilmemiş'}</Text></Pressable></> : <Text style={s.text}>{booking?.date} · {booking?.time}{booking?.type === 'appointment' ? '' : ` · ${booking?.guests} kişi`}</Text>}
   <Pressable disabled={!item.phone} style={({ pressed }) => [s.contact, pressed ? s.pressed : null]} onPress={() => { void m.link(`tel:${(item.phone ?? '').replace(/[^+\d]/g,'')}`); }}><MaterialCommunityIcons name="phone-outline" size={22} color={c.primary} /><Text style={s.text}>{item.phone || 'Telefon belirtilmemiş'}</Text></Pressable>
   {m.busy === item.id ? <ActivityIndicator color={c.primary} /> : null}
   <View style={s.row}>{['pending','rejected'].includes(item.status) ? <Action label="Onayla" icon="check" onPress={() => { void m.setStatus(order ? 'order' : 'booking', item.id, 'approved'); }} disabled={!!m.busy} /> : null}{order && item.status === 'approved' ? <Action label="Yola çıktı" icon="truck-delivery-outline" onPress={() => { void m.setStatus('order', item.id, 'on_the_way'); }} disabled={!!m.busy} /> : null}{order && item.status === 'on_the_way' ? <Action label="Teslim edildiğini onayla" icon="check-all" onPress={() => { void m.setStatus('order', item.id, 'delivered'); }} disabled={!!m.busy} /> : null}{!['rejected','delivered','on_the_way','cancelled','completed'].includes(item.status) ? <Action label="Reddet" icon="close" danger onPress={() => { void m.setStatus(order ? 'order' : 'booking', item.id, 'rejected'); }} disabled={!!m.busy} /> : null}</View>
  </View>;
 };
 return <SafeAreaView style={s.screen} edges={tabPage ? ['top'] : ['bottom']}><FlatList<OrderRow | ReservationRow> data={m.data} keyExtractor={item => item.id} renderItem={render} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={m.refreshing} onRefresh={m.refresh} tintColor={c.primary} />} ItemSeparatorComponent={() => <View style={s.space} />}
  ListHeaderComponent={<View style={s.blocks}><View style={s.hero}><Text style={s.title}>Gelen talepler</Text><Text style={s.subtle}>Yalnızca size ait işletmelerin sipariş, rezervasyon ve randevuları. Durumlar 15 saniyede bir yenilenir.</Text></View>{m.section === 'orders' ? <Action label="Sipariş geçmişi ve günlük ciro" icon="chart-timeline-variant" disabled={false} onPress={() => router.push('/business/order-history')} /> : null}<BusinessChips label="Talep türü" items={[{ id: 'orders', label: 'Siparişler' }, { id: 'reservations', label: 'Rezervasyonlar' }, { id: 'appointments', label: 'Randevular' }]} selected={m.section} onSelect={value => m.setSection(value as RequestSection)} /><BusinessChips label="Talep durumu" items={[{ id: 'pending', label: 'Bekleyen' }, { id: 'approved', label: 'Onaylı' }, ...(m.section === 'orders' ? [{ id: 'on_the_way', label: 'Yola çıktı' }, { id: 'delivered', label: 'Teslim edildi' }] : []), { id: 'rejected', label: 'Reddedilen' }, { id: 'all', label: 'Tümü' }]} selected={m.filter} onSelect={m.setFilter} />{m.error ? <View style={s.errorRow}><MaterialCommunityIcons name="alert-circle-outline" size={22} color={c.danger} /><Text style={s.error}>{m.error}</Text></View> : null}{m.loading ? <ActivityIndicator color={c.primary} /> : null}</View>}
  ListEmptyComponent={!m.loading ? <View style={s.card}><Text style={s.text}>Bu alanda talep bulunmuyor.</Text></View> : null} /></SafeAreaView>;
});
interface ActionProps { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void; disabled: boolean; danger?: boolean }
const Action = memo(function Action({ label, icon, onPress, disabled, danger = false }: ActionProps) {
 const { colors: c, styles: s } = useThemeStyles(createStyles);
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, danger ? { backgroundColor: c.dangerSoft } : null, pressed || disabled ? s.pressed : null]}><MaterialCommunityIcons name={icon} size={20} color={danger ? c.danger : c.primary} /><Text style={[s.status, { color: danger ? c.danger : c.primary }]}>{label}</Text></Pressable>;
});
const createStyles = (c: ThemeColors) => StyleSheet.create({
 screen: { flex: 1, backgroundColor: c.background }, content: { padding: spacing.lg, paddingBottom: spacing.xxxl }, blocks: { gap: spacing.md, paddingBottom: spacing.lg },
 hero: { backgroundColor: c.primarySoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, title: { fontSize: fontSize.xl, fontWeight: '700', color: c.text }, heading: { fontSize: fontSize.md, color: c.text, fontWeight: '600' },
 card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: spacing.md }, row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }, info: { flex: 1 },
 text: { color: c.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, flexShrink: 1 }, subtle: { fontSize: fontSize.sm, color: c.textSubtle, lineHeight: fontSize.sm * 1.6 }, status: { fontSize: fontSize.sm, fontWeight: '600' }, total: { color: c.primary, fontSize: fontSize.lg, fontWeight: '700' },
 contact: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', minHeight: spacing.xxxl }, action: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, minHeight: spacing.xxxl, backgroundColor: c.primarySoft, borderRadius: radius.md, alignItems: 'center' },
 errorRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: c.dangerSoft, borderRadius: radius.md }, error: { flex: 1, color: c.danger, fontSize: fontSize.md }, space: { height: spacing.md }, pressed: { opacity: 0.6 },
});
