import React, { memo, useCallback } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUniversityAdmin } from '@/hooks/useUniversityAdmin';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { UniversityAdminMessage, UniversityAdminFilter, universityStatusLabels } from '@/services/universityService';
import { FeedbackButton, FeedbackChips, FeedbackError, FeedbackInput } from '@/components/feature/FeedbackControls';
import { StatusPill } from '@/components/admin/ui';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface ModerationCardProps {
  item: UniversityAdminMessage; busy: boolean; busyId: string;
  onApprove: (item: UniversityAdminMessage) => void; onReject: (item: UniversityAdminMessage) => void; onRemove: (item: UniversityAdminMessage) => void;
}
const ModerationCard = memo(function ModerationCard({ item, busy, busyId, onApprove, onReject, onRemove }: ModerationCardProps) {
  const { styles } = useThemeStyles(createStyles);
  return <View style={styles.card}>
    <View style={styles.cardHeader}><StatusPill label={item.withdrawn_at ? 'Kaldırıldı' : universityStatusLabels[item.status]} tone={item.withdrawn_at ? 'warning' : item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'} /><Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text></View>
    <Text style={styles.message}>{item.text}</Text>
    <Text style={styles.author}>{item.author?.username || 'Kullanıcı'} · {item.author?.email || 'Hesap bilgisi bulunamadı'}</Text>
    {item.moderation_reason ? <Text style={styles.reason}>Not: {item.moderation_reason}</Text> : null}
    {item.withdrawn_at ? <Text style={styles.body}>{item.withdrawn_by === item.user_id ? 'Yazarı tarafından kaldırıldı.' : 'Yönetici tarafından kaldırıldı.'} Yeniden yayınlanamaz.</Text> : <View style={styles.actions}>
      {item.status !== 'approved' ? <View style={styles.action}><FeedbackButton label="Onayla ve yayınla" icon="check-outline" busy={busyId === item.id} disabled={busy} onPress={() => onApprove(item)} /></View> : null}
      {item.status === 'pending' ? <View style={styles.action}><FeedbackButton label="Reddet" icon="close" secondary disabled={busy} onPress={() => onReject(item)} /></View> : null}
      <View style={styles.action}><FeedbackButton label={item.status === 'approved' ? 'Yayından kaldır' : 'Yazıyı kaldır'} icon="trash-can-outline" secondary busy={busyId === item.id} disabled={busy} onPress={() => onRemove(item)} /></View>
    </View>}
  </View>;
});
const filters = [{ id: 'pending', label: 'Bekleyen' }, { id: 'approved', label: 'Yayında' }, { id: 'rejected', label: 'Yayınlanmadı' }, { id: 'withdrawn', label: 'Kaldırılan' }];
interface UniversityModerationViewProps {}
export function UniversityModerationView(_: UniversityModerationViewProps) {
  const state = useUniversityAdmin();
  const { colors, styles } = useThemeStyles(createStyles);
  const approve = useCallback((item: UniversityAdminMessage) => { void state.decide(item, 'approved'); }, [state.decide]);
  return <SafeAreaView style={styles.screen} edges={['bottom']}>
    <FlatList data={state.items} keyExtractor={item => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={state.refresh} tintColor={colors.primary} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <ModerationCard item={item} busy={!!state.busyId} busyId={state.busyId} onApprove={approve} onReject={state.openRejection} onRemove={state.confirmRemove} />}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.overview}><Text style={styles.title}>Kampüsün sesi, senin onayınla.</Text><Text style={styles.body}>Kullanıcı yazılarını incele. Onayladığın yazılar Cadde TV altyazı akışında yayınlanır; yayından kaldırdığın yazılar akıştan çıkar.</Text></View>
        <FeedbackChips label="Yazı istekleri" items={filters} selected={state.status} onSelect={value => state.changeStatus(value as UniversityAdminFilter)} disabled={!!state.busyId} />
        <FeedbackError message={state.error} />
        <Text style={styles.counter}>{state.status === 'withdrawn' ? 'Kaldırılan' : universityStatusLabels[state.status]} · {state.items.length} yazı</Text>
      </View>}
      ListEmptyComponent={state.loading ? <ActivityIndicator style={styles.empty} color={colors.primary} /> : <View style={styles.empty}><Text style={styles.body}>{state.error ? 'Liste yüklenemedi.' : 'Bu durumda bir yazı yok.'}</Text>{state.error ? <FeedbackButton label="Yeniden dene" secondary onPress={state.refresh} /> : null}</View>}
    />
    <Modal visible={state.selected !== null} transparent animationType="fade" onRequestClose={state.closeRejection}>
      <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <FlatList data={[]} renderItem={() => null} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}
            ListHeaderComponent={<View style={styles.modalCard}>
              <Text style={styles.sectionTitle}>{state.selected?.status === 'approved' ? 'Yazıyı yayından kaldır' : 'Yayın isteğini reddet'}</Text>
              <Text style={styles.message}>{state.selected?.text ?? ''}</Text>
              <FeedbackInput label="Kullanıcıya iletilecek not (isteğe bağlı)" value={state.reason} onChange={state.setReason} maxLength={300} disabled={!!state.busyId} />
              <FeedbackError message={state.error} />
              <FeedbackButton label={state.selected?.status === 'approved' ? 'Yayından kaldır' : 'Reddet'} icon="close" danger busy={!!state.busyId} onPress={state.reject} />
              <FeedbackButton label="Vazgeç" secondary disabled={!!state.busyId} onPress={state.closeRejection} />
            </View>}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.lg, paddingBottom: spacing.lg }, overview: { borderRadius: radius.lg, padding: spacing.lg, backgroundColor: colors.primarySoft, gap: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, includeFontPadding: false },
  body: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
  counter: { fontSize: fontSize.sm, color: colors.textSubtle },
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: spacing.md },
  cardHeader: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', alignItems: 'center' }, date: { fontSize: fontSize.xs, color: colors.textSubtle },
  message: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, lineHeight: fontSize.lg * 1.6, includeFontPadding: false },
  author: { fontSize: fontSize.sm, color: colors.textSubtle, lineHeight: fontSize.sm * 1.6 }, reason: { color: colors.danger, fontSize: fontSize.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, action: { flexGrow: 1, flexBasis: 180 },
  separator: { height: spacing.md }, empty: { paddingVertical: spacing.xxl, gap: spacing.md, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlayStrong }, modalKeyboard: { flex: 1 },
  modalContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  modalCard: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, gap: spacing.lg, width: '100%', maxWidth: 600, alignSelf: 'center' },
  sectionTitle: { fontSize: fontSize.lg, color: colors.text, fontWeight: fontWeight.bold },
});
