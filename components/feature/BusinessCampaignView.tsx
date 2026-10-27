import { memo } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCampaignSubmission } from '@/hooks/useCampaignSubmission';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { CROP_PRESETS, ImageCropper } from '@/components/feature/ImageCropper';
import { CampaignHeader } from '@/components/feature/CampaignTicker';
import { FeedbackButton, FeedbackError, FeedbackInput } from '@/components/feature/FeedbackControls';
import { AdminEmpty, AdminLoading, StatusPill } from '@/components/admin/ui';
import { MyCampaign, campaignMoney, campaignTitleLimit } from '@/services/campaignService';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

const campaignRatios = [CROP_PRESETS['3:2'], CROP_PRESETS['16:9'], CROP_PRESETS['1:1'], CROP_PRESETS['4:5'], CROP_PRESETS.free];
interface CampaignRequestCardProps { item: MyCampaign; disabled: boolean; onRemove: (id: string) => void }
const CampaignRequestCard = memo(function CampaignRequestCard({ item, disabled, onRemove }: CampaignRequestCardProps) {
  const { colors, styles } = useThemeStyles(createStyles);
  const today = new Date().toISOString().slice(0, 10);
  const expired = item.status === 'approved' && !!item.end_date && item.end_date < today;
  const status = item.status === 'rejected' ? 'Reddedildi' : expired ? 'Süresi doldu' : item.status === 'approved' && item.payment_status === 'paid' ? 'Yayında' : item.payment_status === 'paid' ? 'Ödendi · Onay bekliyor' : 'Ödeme ve onay bekliyor';
  const tone = item.status === 'rejected' ? 'danger' : item.status === 'approved' && !expired ? 'success' : 'warning';
  return <View style={styles.card}>
    <View style={styles.row}><StatusPill label={status} tone={tone} /><Pressable onPress={() => onRemove(item.id)} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${item.title} başvurusunu sil`} style={({ pressed }) => [styles.iconButton, pressed || disabled ? styles.pressed : null]}><MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.danger} /></Pressable></View>
    {item.image_url ? <Image source={{ uri: item.image_url }} contentFit="cover" transition={200} style={styles.campaignImage} /> : null}
    <Text style={styles.title}>{item.title}</Text>
    <Text style={styles.body}>{item.businesses?.name ?? 'İşletme'} · {campaignMoney(item.price)}{item.publication_days ? ` · ${item.publication_days} gün` : ''}</Text>
    {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
    {item.start_date && item.end_date ? <Text style={styles.helper}>Yayın: {item.start_date} – {item.end_date}</Text> : null}
    {item.rejection_reason ? <Text style={styles.rejection}>Yönetici notu: {item.rejection_reason}</Text> : null}
    {Number(item.price) <= 0 ? <Text style={styles.helper}>Eski ücretsiz başvuru korunur; ücretli yayın için yönetici fiyat belirledikten sonra yeniden başvurun.</Text> : null}
  </View>;
});
interface BusinessCampaignViewProps {}
export function BusinessCampaignView(_: BusinessCampaignViewProps) {
  const state = useCampaignSubmission();
  const { colors, styles } = useThemeStyles(createStyles);
  if (state.loading) return <AdminLoading />;
  return <SafeAreaView style={styles.screen} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
      <FlatList data={state.items} keyExtractor={item => item.id} renderItem={({ item }) => <CampaignRequestCard item={item} disabled={state.disabled} onRemove={state.remove} />} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ItemSeparatorComponent={() => <View style={styles.separator} />} refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.primary} />}
        ListHeaderComponent={<View style={styles.form}>
          <View style={styles.hero}><CampaignHeader /></View>
          <Text style={styles.heading}>Kampanyanızı paylaşın.</Text>
          <Text style={styles.body}>İşletmenin teklifini gönder. Yönetici belirlediği ücretin ödemesini doğruladıktan sonra yayınını onaylar; kampanya seçtiğin süre boyunca uygulamanın aktif temasıyla uyumlu kampanya bandında görünür.</Text>
          <FeedbackError message={state.error} />
          {state.success ? <View style={styles.success} accessibilityLiveRegion="polite"><MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.success} /><Text style={styles.successText}>Başvurun yöneticiye gönderildi. Ödeme doğrulaması ve yayın onayı bekleniyor.</Text></View> : null}
          {state.businesses.length === 0 ? <View style={styles.card}><Text style={styles.body}>Başvuru için önce işletmeni ekle.</Text><FeedbackButton label="İşletme ekle" icon="storefront-outline" onPress={state.addBusiness} /></View> : <View style={styles.card}>
            <Text style={styles.label}>İşletme</Text>
            <View style={styles.chipRail}><FlatList horizontal data={state.businesses} keyExtractor={item => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} renderItem={({ item }) => <Pressable disabled={state.disabled} onPress={() => state.setBizId(item.id)} accessibilityRole="button" accessibilityState={{ selected: state.bizId === item.id }} style={({ pressed }) => [styles.chip, state.bizId === item.id ? styles.chipActive : null, pressed ? styles.pressed : null]}><Text style={[styles.chipText, state.bizId === item.id ? styles.chipTextActive : null]}>{item.name}</Text></Pressable>} /></View>
            <FeedbackInput label="Bantta görünecek kampanya başlığı" value={state.title} onChange={state.setTitle} multiline={false} maxLength={campaignTitleLimit} disabled={state.disabled} placeholder="Öğrencilere hafta içi %20 indirim" />
            <Text style={styles.helper}>4–160 karakter · Bantta işletme adıyla birlikte görünür.</Text>
            <FeedbackInput label="Kampanya koşulları (isteğe bağlı)" value={state.description} onChange={state.setDescription} maxLength={2000} disabled={state.disabled} multiline placeholder="Geçerlilik ve kullanım koşullarını belirt." />
            <Text style={styles.label}>Görsel (isteğe bağlı)</Text>
            <Pressable disabled={state.disabled} onPress={state.pickImage} accessibilityRole="button" accessibilityLabel="Kampanya görseli seç ve kırp" style={({ pressed }) => [styles.picker, pressed ? styles.pressed : null]}>{state.picked ? <Image source={{ uri: state.picked.uri }} contentFit="cover" transition={200} style={styles.preview} /> : <View style={styles.pickerCopy}><MaterialCommunityIcons name="image-plus-outline" size={28} color={colors.primary} /><Text style={styles.body}>Görsel seç ve kırp</Text></View>}</Pressable>
            <Text style={styles.label}>Yöneticinin belirlediği ücret ve yayın süresi</Text>
            {state.packages.length === 0 ? <View style={styles.info}><MaterialCommunityIcons name="information-outline" size={22} color={colors.warning} /><Text style={styles.bodyFlex}>Henüz ücretli paket satışta değil. Yönetici kampanya fiyatını belirledikten sonra başvuru yapabilirsin.</Text></View> : <FlatList data={state.packages} keyExtractor={item => item.id} scrollEnabled={false} ItemSeparatorComponent={() => <View style={styles.separator} />} renderItem={({ item }) => {
              const selected = state.planId === item.id;
              return <Pressable onPress={() => state.setPlanId(item.id)} disabled={state.disabled} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={({ pressed }) => [styles.plan, selected ? styles.planActive : null, pressed ? styles.pressed : null]}><MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={colors.primary} /><View style={styles.planCopy}><Text style={styles.title}>{item.name}</Text><Text style={styles.helper}>{item.duration_days} gün · Onay günü başlar</Text></View><Text style={styles.price}>{campaignMoney(item.price)}</Text></Pressable>;
            }} />}
            <View style={styles.info}><MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.primary} /><Text style={styles.bodyFlex}>Otomatik tahsilat yoktur. Ödeme yönetici tarafından manuel doğrulanır. Ödeme yapmak tek başına yayın onayı değildir.</Text></View>
            <FeedbackButton label={state.busy ? 'Gönderiliyor…' : 'Ücreti kabul et ve onaya gönder'} icon="send-outline" busy={state.busy} disabled={!state.valid || state.disabled} onPress={state.submit} />
          </View>}
          <Text style={styles.heading}>Kampanya başvuruların</Text>
        </View>}
        ListEmptyComponent={<AdminEmpty icon="ticket-percent-outline" text="Henüz kampanya başvurun yok." />}
      />
      <ImageCropper visible={state.cropVisible} uri={state.cropUri} ratios={campaignRatios} initialRatioId={campaignRatios[0].id} onCancel={state.closeCrop} onDone={state.finishCrop} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, form: { gap: spacing.lg, paddingBottom: spacing.lg },
  hero: { borderRadius: radius.md, overflow: 'hidden', padding: spacing.lg, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.primarySoft }, heading: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, includeFontPadding: false },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold, includeFontPadding: false },
  body: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, includeFontPadding: false }, bodyFlex: { flex: 1, color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  label: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold }, helper: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  chipRail: { minHeight: spacing.xxxl }, chipRow: { gap: spacing.sm, alignItems: 'center' }, chip: { minHeight: spacing.xxxl, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.text, fontSize: fontSize.sm }, chipTextActive: { color: colors.onPrimary },
  picker: { height: spacing.xxxl * 3, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', justifyContent: 'center' }, preview: { width: '100%', height: '100%' }, pickerCopy: { alignItems: 'center', gap: spacing.sm },
  plan: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, borderRadius: radius.md },
  planActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, planCopy: { flex: 1, minWidth: spacing.xxxl * 2 }, price: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  info: { flexDirection: 'row', gap: spacing.sm }, success: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.successSoft, borderRadius: radius.md }, successText: { flex: 1, fontSize: fontSize.md, color: colors.success, lineHeight: fontSize.md * 1.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }, iconButton: { width: spacing.xxxl, height: spacing.xxxl, justifyContent: 'center', alignItems: 'center' },
  campaignImage: { height: spacing.xxxl * 3, borderRadius: radius.md }, rejection: { color: colors.danger, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
  separator: { height: spacing.md }, pressed: { opacity: 0.65, transform: [{ scale: 0.98 }] },
});
