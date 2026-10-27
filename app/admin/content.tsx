// Admin content UI; all data operations and moderation run through useAdminContent.
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AdminEmpty, AdminLoading, FilterTabs, SmallButton, StatusPill } from '@/components/admin/ui';
import { useAdminContent, AdminContentRow } from '@/hooks/useAdminContent';
import { categoryLabel } from '@/services/categories';
import { timeAgo } from '@/services/contentService';
import { campaignMoney } from '@/services/campaignService';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { paymentFilters, paymentOrders, PaymentFilter, PaymentOrder } from '@/services/adminContentService';
import { broadcastDay } from '@/services/mediaPublicationService';
import { FeedbackChips } from '@/components/feature/FeedbackControls';

const statusTabs = [{ id: 'pending', label: 'Bekleyen' }, { id: 'approved', label: 'Onaylı' }, { id: 'rejected', label: 'Red' }, { id: 'all', label: 'Tümü' }];
export default function AdminContent() {
  const { colors, styles } = useThemeStyles(createStyles);
  const state = useAdminContent();
  const router = useRouter();
  const renderItem = ({ item }: { item: AdminContentRow }) => {
    const campaign = state.section === 'campaign';
    const ad = state.section === 'ad';
    const published = item.status === 'approved' || item.status === 'active';
    const expired = !!item.end_date && item.end_date < broadcastDay();
    const label = published ? expired ? 'Süresi doldu' : 'Onaylı' : item.status === 'rejected' ? 'Reddedildi' : item.status === 'paused' ? 'Durduruldu' : 'Bekliyor';
    const tone = published && !expired ? 'success' : item.status === 'rejected' ? 'danger' : 'warning';
    const text = campaign || ad ? item.title : item.caption;
    const paid = item.payment_status === 'paid';
    const positive = Number(item.price ?? 0) > 0;
    return <View style={styles.card}>
      <View style={styles.rowTop}>
        {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} contentFit="cover" transition={200} /> : <View style={[styles.thumb, styles.thumbEmpty]}><MaterialCommunityIcons name={campaign ? 'tag-outline' : 'image-outline'} size={22} color={colors.textFaint} /></View>}
        <View style={styles.copy}><View style={styles.badges}><StatusPill label={campaign ? 'Kampanya bandı' : ad ? item.type === 'reels_sponsored' ? 'Cadde TV reklamı' : 'Reklam' : item.kind === 'reel' ? 'Cadde TV' : 'Gönderi'} tone="primary" /><StatusPill label={label} tone={tone} /></View><Text style={styles.biz}>{item.businesses?.name ?? 'İşletme'}</Text><Text style={styles.meta}>{categoryLabel(item.businesses?.category)} · {timeAgo(item.created_at)}</Text></View>
      </View>
      {text ? <Text style={styles.caption}>{text}</Text> : null}
      {campaign && item.description ? <Text style={styles.detail}>{item.description}</Text> : null}
      <View style={styles.payRow}><Text style={styles.price}>{campaignMoney(item.price ?? 0)}</Text><StatusPill label={paid ? 'Ödeme doğrulandı' : 'Ödeme bekliyor'} tone={paid ? 'success' : 'warning'} /></View>
      {item.end_date ? <Text style={styles.dates}>Yayın: {item.start_date ?? '-'} → {item.end_date}</Text> : null}
      {item.media_removed_at ? <Text style={styles.note}>Yayın süresi dolan fotoğraf kaldırıldı. Ödeme ve onay geçmişi korunur.</Text> : null}
      {campaign && !positive ? <Text style={styles.note}>Eski ücretsiz başvuru korunur; ücretli paket tanımlandıktan sonra işletme yeniden başvurmalıdır.</Text> : campaign && !paid ? <Text style={styles.note}>Önce ücreti uygulama dışında alın ve ödemeyi doğrulayın; ardından yayını onaylayın.</Text> : null}
      <View style={styles.actions}>
        {!published ? <SmallButton label="Onayla ve yayınla" icon="check" tone="success" disabled={state.busy || !!item.media_removed_at || (positive && !paid) || (campaign && !positive)} onPress={() => state.approve(item)} /> : null}
        {item.status !== 'rejected' ? <SmallButton label={published ? 'Yayından kaldır' : 'Reddet'} icon="close" tone="danger" outline disabled={state.busy} onPress={() => state.reject(item)} /> : null}
        <SmallButton label={paid ? 'Ödeme doğrulamasını kaldır' : 'Ödemeyi doğrula'} icon="cash" tone={paid ? 'neutral' : 'primary'} outline disabled={state.busy || (campaign && !positive)} onPress={() => state.markPaid(item)} />
        {item.status === 'rejected' ? <SmallButton label="Sil" icon="trash-can-outline" tone="danger" outline disabled={state.busy} onPress={() => state.remove(item)} /> : null}
      </View>
    </View>;
  };
  return <SafeAreaView style={styles.screen} edges={['bottom']}>
    <View style={styles.segment}>
      <Pressable disabled={state.busy} onPress={() => state.setSection('content')} accessibilityRole="button" accessibilityState={{ selected: state.section === 'content' }} style={({ pressed }) => [styles.segBtn, state.section === 'content' ? styles.segBtnActive : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name="image-multiple-outline" size={18} color={state.section === 'content' ? colors.onPrimary : colors.textSubtle} /><Text style={[styles.segText, state.section === 'content' ? styles.segTextActive : null]}>Gönderi & Cadde TV</Text></Pressable>
      <Pressable disabled={state.busy} onPress={() => state.setSection('campaign')} accessibilityRole="button" accessibilityState={{ selected: state.section === 'campaign' }} style={({ pressed }) => [styles.segBtn, state.section === 'campaign' ? styles.segBtnActive : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name="tag-outline" size={18} color={state.section === 'campaign' ? colors.onPrimary : colors.textSubtle} /><Text style={[styles.segText, state.section === 'campaign' ? styles.segTextActive : null]}>Kampanyalar</Text></Pressable>
      <Pressable disabled={state.busy} onPress={() => state.setSection('ad')} accessibilityRole="button" accessibilityState={{ selected: state.section === 'ad' }} style={({ pressed }) => [styles.segBtn, state.section === 'ad' ? styles.segBtnActive : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name="bullhorn-outline" size={18} color={state.section === 'ad' ? colors.onPrimary : colors.textSubtle} /><Text style={[styles.segText, state.section === 'ad' ? styles.segTextActive : null]}>Reklamlar</Text></Pressable>
    </View>
    {state.section === 'campaign' ? <View style={styles.info}><Text style={styles.note}>Kampanya ücreti Paketler ve Fiyatlar ekranından belirlenir. Otomatik tahsilat yoktur; ödeme doğrulaması ve yayın onayı ayrı işlemlerdir.</Text><SmallButton label="Kampanya ücretini belirle" icon="cash" outline onPress={() => router.push('/admin/packages')} /></View> : null}
    <View style={styles.tabsWrap} pointerEvents={state.busy ? 'none' : 'auto'}><FilterTabs options={statusTabs} value={state.filter} onChange={state.setFilter} /></View>
    <View style={styles.paymentControls}>
      <FeedbackChips label="Ödeme durumu" hideLabel compact disabled={state.busy} items={paymentFilters} selected={state.paymentFilter} onSelect={value => state.setPaymentFilter(value as PaymentFilter)} />
      <FeedbackChips label="İçerik sıralaması" hideLabel compact disabled={state.busy} items={paymentOrders} selected={state.paymentOrder} onSelect={value => state.setPaymentOrder(value as PaymentOrder)} />
      <Text style={styles.note}>{state.items.length} / {state.total} kayıt · {paymentFilters.find(item => item.id === state.paymentFilter)?.label}</Text>
    </View>
    {state.loading ? <AdminLoading /> : <FlatList data={state.items} keyExtractor={item => item.id} renderItem={renderItem} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} ListEmptyComponent={<AdminEmpty icon="image-check-outline" text="Bu durumda içerik yok." />} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.primary} />} showsVerticalScrollIndicator={false} />}
  </SafeAreaView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, segment: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  paymentControls: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  segBtn: { flex: 1, minWidth: spacing.xxxl * 3, minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary }, segText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSubtle }, segTextActive: { color: colors.onPrimary },
  info: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }, note: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  tabsWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }, list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, paddingTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }, rowTop: { flexDirection: 'row', gap: spacing.md }, copy: { flex: 1 },
  thumb: { width: spacing.xxl * 2, height: spacing.xxl * 2, borderRadius: radius.md, backgroundColor: colors.surfaceTint }, thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.xs }, biz: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text }, meta: { fontSize: fontSize.xs, color: colors.textSubtle, marginTop: spacing.xs },
  caption: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, lineHeight: fontSize.md * 1.6 }, detail: { fontSize: fontSize.md, color: colors.textSubtle, lineHeight: fontSize.md * 1.6 },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }, price: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary }, dates: { fontSize: fontSize.sm, color: colors.textSubtle },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }, separator: { height: spacing.md }, pressed: { opacity: 0.65 },
});
