import React, { memo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '@/components';
import { OwnCafePhoto } from './CafePhoto';
import { CafeAccountPanel } from './CafeAccountPanel';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { useProfileOverview } from '@/hooks/useProfileOverview';
import { useAdminEntry } from '@/hooks/useAdminEntry';
import { useTabScrollToTop } from '@/hooks/useTabScrollToTop';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { useProfileLogout } from '@/hooks/useProfileLogout';
import { AppearanceSettings } from './AppearanceSettings';
import { RefreshButton } from './RefreshButton';
import { fontSize, spacing, radius, ThemeColors } from '@/constants/theme';
interface AccountProfileViewProps { businessPage?: boolean }
interface ProfileAction { id: string; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void; danger?: boolean }
export const AccountProfileView = memo(function AccountProfileView({ businessPage = false }: AccountProfileViewProps) {
  const router = useRouter(); const { colors, styles: s } = useThemeStyles(createStyles);
  const { authUser, isAdmin, isBusiness } = useAuth();
  const { busy, confirmLogout } = useProfileLogout();
  const showAdminEntry = useAdminEntry(businessPage);
  const listRef = useTabScrollToTop<ProfileAction>();
  const { user, savedBusinessIds, savedPosts, savedReels, savedCampaigns, notificationsEnabled, setNotificationsEnabled } = useApp();
  const m = useProfileOverview(); const guest = !authUser;
  const saved = savedBusinessIds.length + savedPosts.length + savedReels.length + savedCampaigns.length;
  const rows: ProfileAction[] = [
    { id: 'complaint', label: 'Şikâyet / Sorun Bildir', icon: 'flag-outline', onPress: () => router.push('/complaint') },
    ...(authUser ? [{ id: 'edit', label: 'Hesap Bilgilerim', icon: 'account-edit-outline' as const, onPress: () => router.push('/profile-edit') }] : []),
    ...(showAdminEntry ? [{ id: 'admin', label: 'Yönetici Girişi', icon: 'shield-account-outline' as const, onPress: () => router.push('/admin') }] : []),
    ...(!guest && !isAdmin ? [{ id: 'delete', label: 'Hesabımı Sil', icon: 'account-remove-outline' as const, danger: true, onPress: () => router.push('/account-delete') }] : []),
    ...(!guest ? [{ id: 'logout', label: busy ? 'Çıkış yapılıyor…' : 'Çıkış Yap', icon: 'logout' as const, danger: true, onPress: confirmLogout }] : []),
  ];
  return <SafeAreaView style={s.screen} edges={['top']}><FlatList ref={listRef} data={rows} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={m.refreshing} onRefresh={() => void m.refresh()} tintColor={colors.primary} />} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} ItemSeparatorComponent={() => <View style={s.space} />}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy: busy && item.id === 'logout' }} disabled={busy} style={({ pressed }) => [s.row, busy ? s.disabled : null, pressed ? s.pressed : null]} onPress={item.onPress}><MaterialCommunityIcons name={item.icon} size={22} color={item.danger ? colors.danger : colors.primary} /><Text style={[s.rowText, item.danger ? { color: colors.danger } : null]}>{item.label}</Text><MaterialCommunityIcons name="chevron-right" size={22} color={colors.textFaint} /></Pressable>}
    ListHeaderComponent={<View style={s.blocks}>
      <View style={s.identity}><OwnCafePhoto name={user.name} size={60} /><View style={s.info}><Text style={s.title}>{user.name}</Text><Text style={s.subtle}>{isAdmin ? 'Yönetici Hesabı' : isBusiness ? 'İşletme Hesabı' : guest ? 'Misafir' : 'Kullanıcı Hesabı'}</Text>{authUser ? <Text style={s.subtle}>{authUser.email}</Text> : null}</View>{authUser ? <RefreshButton onPress={() => void m.refresh()} refreshing={m.refreshing} label="Profili yenile" /> : null}</View>
      <View style={s.stats}>{(isBusiness || businessPage ? [{ label: 'İşletme', value: m.owned.length }, { label: 'Yayında', value: m.owned.filter(b => b.is_published).length }, { label: 'Onayda', value: m.owned.filter(b => b.approval_status === 'pending').length }] : [{ label: 'Sipariş', value: m.myOrders.length }, { label: 'Rezervasyon / Randevu', value: m.myReservations.length }, { label: 'Kayıtlı', value: saved }]).map(item => <View key={item.label} style={s.stat}><Text style={s.title}>{item.value}</Text><Text style={s.small}>{item.label}</Text></View>)}</View>
      {m.error ? <View style={s.notice}><Text style={s.error}>{m.error}</Text></View> : null}
      {isBusiness || businessPage ? <Button label="İşletmelerim" icon="storefront-outline" variant="secondary" onPress={() => router.push('/(business-tabs)')} /> : <><Text style={s.heading}>Kayıtlılarım</Text><Pressable style={({ pressed }) => [s.row, pressed ? s.pressed : null]} onPress={() => router.push('/saved')}><MaterialCommunityIcons name="bookmark-multiple-outline" color={colors.primary} size={26} /><View style={s.info}><Text style={s.heading}>Tüm kayıtlarım</Text><Text style={s.subtle}>{saved} kayıt · İşletme, gönderi, Cadde TV ve kampanya</Text></View><MaterialCommunityIcons name="chevron-right" color={colors.primary} size={24} /></Pressable>{!guest ? <Button label="Sipariş, Rezervasyon ve Randevu Geçmişim" variant="secondary" icon="history" onPress={() => router.push('/history')} /> : <Button label="Giriş Yap / Kayıt Ol" icon="login" onPress={() => router.push('/auth')} />}</>}
      <CafeAccountPanel />
      <Text style={s.heading}>Ayarlar</Text><AppearanceSettings />
      <View style={s.row}><MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary} /><Text style={s.rowText}>Bildirimler</Text><Switch accessibilityLabel="Bildirimler" disabled={busy} value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.onPrimary} /></View>
    </View>}
    ListFooterComponent={<Text style={[s.small, s.footer]}>Caddeden · Sürüm 1.1</Text>} /></SafeAreaView>;
});
const createStyles = (c: ThemeColors) => StyleSheet.create({
 screen: { flex: 1, backgroundColor: c.background }, content: { padding: spacing.lg, paddingBottom: spacing.xxxl, width: '100%', maxWidth: 960, alignSelf: 'center' },
 blocks: { gap: spacing.lg, paddingBottom: spacing.lg }, identity: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.brand, alignItems: 'center' },
 info: { flex: 1, gap: spacing.xs }, title: { fontSize: fontSize.lg, color: c.text, fontWeight: '700', includeFontPadding: false }, heading: { fontSize: fontSize.md, color: c.text, fontWeight: '600' }, subtle: { fontSize: fontSize.sm, color: c.textSubtle, lineHeight: fontSize.sm * 1.6 }, small: { fontSize: fontSize.xs, color: c.textSubtle },
 stats: { flexDirection: 'row', gap: spacing.sm }, stat: { flex: 1, alignItems: 'center', padding: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, gap: spacing.sm },
 notice: { padding: spacing.md, gap: spacing.sm, backgroundColor: c.primarySoft, borderRadius: radius.lg }, error: { color: c.danger, fontSize: fontSize.md },
 row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, padding: spacing.md, minHeight: spacing.xxxl }, rowText: { flex: 1, fontSize: fontSize.md, color: c.text },
 space: { height: spacing.sm }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] }, footer: { textAlign: 'center', marginTop: spacing.lg },
});
