import React, { memo } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { AdminAccountFilter, AdminUserRow } from '@/services/adminUsersService';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { AdminEmpty, AdminLoading, SmallButton, StatusPill } from './ui';

interface AdminUsersViewProps { initialFilter?: AdminAccountFilter }
const filterOptions: { id: AdminAccountFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: 'user', label: 'Kullanıcılar', icon: 'account-group-outline' },
  { id: 'business', label: 'İşletmeler', icon: 'storefront-outline' },
  { id: 'admin', label: 'Yönetici', icon: 'shield-account-outline' },
];
export const AdminUsersView = memo(function AdminUsersView({ initialFilter = 'user' }: AdminUsersViewProps) {
  const { colors, styles } = useThemeStyles(createStyles);
  const m = useAdminUsers(initialFilter);
  const selected = filterOptions.find(option => option.id === m.filter) ?? filterOptions[0];
  const renderItem = ({ item }: { item: AdminUserRow }) => {
    const isBusiness = item.role === 'business';
    const isAdmin = item.role === 'admin';
    const approved = item.business_account_approval?.status === 'approved';
    const statusTone = item.status === 'active' ? 'success' : item.status === 'restricted' ? 'warning' : 'danger';
    const statusLabel = item.status === 'active' ? 'Aktif' : item.status === 'restricted' ? 'Kısıtlı' : 'Yasaklı';
    return <View style={styles.card}>
      <View style={styles.identity}>
        <View style={styles.icon}><MaterialCommunityIcons name={isBusiness ? 'storefront-outline' : isAdmin ? 'shield-account-outline' : 'account-outline'} size={24} color={colors.primary} /></View>
        <View style={styles.details}><Text style={styles.name}>{item.username || item.email || 'Hesap'}</Text><Text style={styles.email}>{item.email}</Text></View>
      </View>
      <View style={styles.pills}>
        <StatusPill label={isBusiness ? 'İşletme hesabı' : isAdmin ? 'Yönetici hesabı' : 'Kullanıcı hesabı'} tone={isAdmin ? 'primary' : 'neutral'} />
        <StatusPill label={statusLabel} tone={statusTone} />
        {isBusiness ? <StatusPill label={approved ? 'Giriş onaylı' : 'Giriş onayı bekliyor'} tone={approved ? 'success' : 'warning'} /> : null}
      </View>
      {isBusiness ? <View style={styles.approvalBox}>
        <Text style={styles.approvalTitle}>İşletme giriş onayı</Text>
        <Text style={styles.body}>{approved ? 'Giriş onayı verildi. Aktif hesap işletme panelini kullanabilir.' : 'Giriş yapabilir; işletme paneli açılana kadar yönetici onayı bekleme ekranında kalır.'}</Text>
        <SmallButton label={approved ? 'Giriş onayını geri al' : 'İşletme girişini onayla'} icon={approved ? 'lock-outline' : 'check-circle-outline'} tone={approved ? 'warning' : 'success'} disabled={m.busy} onPress={() => m.businessApproval.decide(item.id, item.username || item.email || 'İşletme hesabı', approved ? 'pending' : 'approved')} />
        <Text style={styles.note}>{item.businesses?.length ?? 0} bağlı işletme · Profil yayın onayı ayrıdır.</Text>
      </View> : <Text style={styles.body}>{isAdmin ? 'Yönetici yetkileri korunur. Yönetici hesabı kısıtlanamaz.' : 'Kullanıcı girişi için yönetici onayı gerekmez. Hesap işletme hesabına dönüştürülmez.'}</Text>}
      {!isAdmin ? <View style={styles.actions}>
        {item.status === 'active' ? <>
          <SmallButton label="3 gün kısıtla" icon="clock-outline" tone="warning" outline disabled={m.busy} onPress={() => m.changeStatus(item, 'restricted')} />
          <SmallButton label="Yasakla" icon="block-helper" tone="danger" outline disabled={m.busy} onPress={() => m.changeStatus(item, 'banned')} />
        </> : <SmallButton label="Aktifleştir" icon="check-circle-outline" tone="success" disabled={m.busy} onPress={() => m.changeStatus(item, 'active')} />}
      </View> : null}
    </View>;
  };
  return <SafeAreaView style={styles.screen} edges={['bottom']}>
    <FlatList
      style={styles.screen}
      data={m.visible}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.overview}>
          <Text style={styles.eyebrow}>HESAP YÖNETİMİ</Text>
          <Text style={styles.title}>Kullanıcı ve işletme girişleri</Text>
          <Text style={styles.body}>Kullanıcılar onaysız devam eder. Yalnızca işletme paneline giriş için onay verilir.</Text>
          <View style={styles.pills}><StatusPill label={`${m.counts.user} kullanıcı`} /><StatusPill label={`${m.counts.business} işletme`} /><StatusPill label={`${m.counts.pending} işletme onay bekliyor`} tone="warning" /></View>
        </View>
        <View style={styles.filters}>
          {filterOptions.map(option => {
            const active = m.filter === option.id;
            return <Pressable key={option.id} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: active }} onPress={() => m.setFilter(option.id)} style={({ pressed }) => [styles.filter, active ? styles.filterActive : null, pressed ? styles.pressed : null]}>
              <MaterialCommunityIcons name={option.icon} size={20} color={active ? colors.onPrimary : colors.textSubtle} />
              <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{option.label}</Text>
              <Text style={[styles.filterCount, active ? styles.filterTextActive : null]}>{m.counts[option.id]}</Text>
            </Pressable>;
          })}
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>{selected.label} · {m.visible.length} hesap</Text><SmallButton label="Yenile" icon="refresh" outline disabled={m.refreshing || m.loading} onPress={m.refresh} /></View>
        {m.error ? <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.danger} /><View style={styles.details}><Text style={styles.errorText}>{m.error}</Text><SmallButton label="Yeniden dene" icon="refresh" outline disabled={m.refreshing} onPress={m.refresh} /></View></View> : null}
      </View>}
      ListEmptyComponent={m.loading ? <AdminLoading label="Hesaplar yükleniyor…" /> : m.error ? null : <AdminEmpty icon={selected.icon} text={`Bu bölümde ${m.filter === 'business' ? 'işletme' : m.filter === 'admin' ? 'yönetici' : 'kullanıcı'} hesabı yok.`} />}
      refreshControl={<RefreshControl refreshing={m.refreshing} onRefresh={m.refresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    />
  </SafeAreaView>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  overview: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg },
  eyebrow: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, color: colors.primary },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, includeFontPadding: false },
  body: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: { flex: 1, minHeight: spacing.xxxl, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceTint, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  filterActive: { backgroundColor: colors.primary },
  filterText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  filterCount: { color: colors.textSubtle, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  filterTextActive: { color: colors.onPrimary },
  pressed: { opacity: 0.75 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: spacing.xxxl, height: spacing.xxxl, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, gap: spacing.sm },
  name: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, includeFontPadding: false },
  email: { fontSize: fontSize.md, color: colors.textSubtle },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  approvalBox: { padding: spacing.md, gap: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderStrong },
  approvalTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  note: { fontSize: fontSize.sm, color: colors.textSubtle, lineHeight: fontSize.sm * 1.6 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  separator: { height: spacing.md },
  errorBox: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radius.md },
  errorText: { color: colors.danger, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
});
