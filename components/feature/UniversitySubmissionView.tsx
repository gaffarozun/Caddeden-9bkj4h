import React, { memo } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUniversitySubmission } from '@/hooks/useUniversitySubmission';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { FeedbackButton, FeedbackError, FeedbackInput } from '@/components/feature/FeedbackControls';
import { StatusPill } from '@/components/admin/ui';
import { universityMessageLimit, universityStatusLabels, UniversityMessage } from '@/services/universityService';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface UniversityRequestCardProps { item: UniversityMessage; removing: boolean; disabled: boolean; onRemove: (item: UniversityMessage) => void }
const UniversityRequestCard = memo(function UniversityRequestCard({ item, removing, disabled, onRemove }: UniversityRequestCardProps) {
  const { styles } = useThemeStyles(createStyles);
  const tone = item.withdrawn_at ? 'warning' : item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning';
  return <View style={styles.card}>
    <View style={styles.requestHead}><StatusPill label={item.withdrawn_at ? 'Kaldırıldı' : universityStatusLabels[item.status]} tone={tone} /><Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text></View>
    <Text style={styles.requestText}>{item.text}</Text>
    {item.moderation_reason ? <Text style={styles.reason}>Yönetici notu: {item.moderation_reason}</Text> : null}
    {item.withdrawn_at ? <Text style={styles.helper}>Bu yazı artık Cadde TV akışında yayınlanmaz.</Text> : <FeedbackButton label={item.status === 'pending' ? 'Yazı isteğini kaldır' : 'Yazımı kaldır'} icon="trash-can-outline" secondary busy={removing} disabled={disabled} onPress={() => onRemove(item)} />}
  </View>;
});

interface UniversitySubmissionViewProps {}
export function UniversitySubmissionView(_: UniversitySubmissionViewProps) {
  const state = useUniversitySubmission();
  const { colors, styles } = useThemeStyles(createStyles);
  return <SafeAreaView style={styles.screen} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <FlatList data={state.items} keyExtractor={item => item.id} renderItem={({ item }) => <UniversityRequestCard item={item} removing={state.removingId === item.id} disabled={state.busy || !!state.removingId || state.operationLoading} onRemove={state.confirmRemove} />}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.primary} />}
        ListHeaderComponent={<View style={styles.form}>
          <View style={styles.neonHero}><MaterialCommunityIcons name="television-classic" size={28} color={colors.primary} /><Text style={styles.sectionTitle}>Cadde TV · Kampüsün sesi</Text></View>
          <View style={styles.intro}><Text style={styles.title}>Kampüsten bir ses bırak.</Text><Text style={styles.body}>Kısa bir not, güzel bir söz ya da kampüsten bir duyuru. Yazın yönetici onayından sonra Cadde TV ekranının altındaki yazı akışında yayınlanacak.</Text></View>
          <FeedbackError message={state.error} />
          {state.authLoading ? <ActivityIndicator color={colors.primary} /> : state.customer ? <View style={styles.card}>
            <FeedbackInput label="Bantta yayınlanmasını istediğin yazı" value={state.text} onChange={state.changeText} maxLength={universityMessageLimit} disabled={state.busy || !!state.removingId || state.operationLoading} placeholder="Kampüste bugün güzel bir şey oldu…" />
            <Text style={styles.helper}>4–160 karakter · En fazla 3 bekleyen istek · İstekler arasında 1 dakika</Text>
            <View style={styles.info}><MaterialCommunityIcons name="shield-check-outline" size={21} color={colors.primary} /><Text style={styles.infoText}>Onaylanmadan yayınlanmaz. Telefon, adres veya başka kişilerin özel bilgilerini paylaşma.</Text></View>
            <FeedbackButton label={state.busy ? 'Gönderiliyor…' : 'Yayın isteği gönder'} icon="send-outline" busy={state.busy} disabled={!state.valid || !!state.removingId || state.operationLoading} onPress={state.submit} />
          </View> : <View style={styles.card}><Text style={styles.body}>{state.guest ? 'Yazı göndermek için kullanıcı hesabınla giriş yap.' : 'Yazı gönderme alanı aktif kullanıcı hesaplarına açıktır. İşletme ve yönetici hesapları buradan yazı gönderemez.'}</Text>{state.guest ? <FeedbackButton label="Kullanıcı girişi yap" icon="login" onPress={state.login} /> : null}</View>}
          {state.success ? <View style={styles.success} accessibilityLiveRegion="polite"><MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.success} /><View style={styles.successCopy}><Text style={styles.successTitle}>Yazı isteğin yöneticiye gönderildi.</Text><Text style={styles.infoText}>Onaylandığında Cadde TV altyazı akışında yayınlanacak.</Text></View></View> : null}
          {state.guest ? null : <View style={styles.historyHead}><Text style={styles.sectionTitle}>Yazı isteklerin</Text><Text style={styles.helper}>Durumu takip et; kendi yazını istediğin zaman kaldır.</Text>{state.loading ? <ActivityIndicator color={colors.primary} /> : null}</View>}
        </View>}
        ListEmptyComponent={!state.guest && !state.loading ? <View style={styles.empty}><MaterialCommunityIcons name="message-text-outline" size={30} color={colors.textFaint} /><Text style={styles.body}>Henüz bir yazı isteğin yok.</Text></View> : null}
      />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  form: { gap: spacing.lg, paddingBottom: spacing.lg },
  neonHero: { padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  intro: { gap: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, includeFontPadding: false },
  body: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, includeFontPadding: false },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  helper: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoText: { flex: 1, color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  success: { backgroundColor: colors.successSoft, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, flexDirection: 'row' },
  successCopy: { flex: 1, gap: spacing.xs },
  successTitle: { fontSize: fontSize.md, color: colors.success, fontWeight: fontWeight.semibold },
  historyHead: { gap: spacing.xs },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  separator: { height: spacing.md },
  requestHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'center' },
  date: { fontSize: fontSize.xs, color: colors.textSubtle },
  requestText: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.text, includeFontPadding: false },
  reason: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6, color: colors.danger },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
});
