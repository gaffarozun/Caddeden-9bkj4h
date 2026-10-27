import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBusinessApproval } from '@/hooks/useBusinessApproval';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { Button } from '@/components/ui/Button';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

interface BusinessApprovalViewProps { showBrand?: boolean }
export function BusinessApprovalView({ showBrand = true }: BusinessApprovalViewProps) {
  const m = useBusinessApproval();
  const { colors, styles } = useThemeStyles(createStyles);
  const disabled = m.refreshing || m.signingOut || m.loading;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={m.refreshing} onRefresh={m.refresh} tintColor={colors.primary} />}>
        {showBrand ? <View style={styles.brandRow}><MaterialCommunityIcons name="storefront-outline" size={24} color={colors.primary} /><Text style={styles.brand}>Caddeden</Text><View style={styles.badge}><Text style={styles.badgeText}>İşletme hesabı</Text></View></View> : null}
        <View style={styles.hero}>
          <View style={styles.symbol}><MaterialCommunityIcons name="shield-clock-outline" size={44} color={colors.primary} /></View>
          <View style={styles.statusRow}><View style={styles.statusDot} /><Text style={styles.statusText}>{m.approved ? 'Giriş onayınız mevcut' : 'Yönetici incelemesinde'}</Text></View>
          <Text accessibilityRole="header" style={styles.title}>{m.approved ? 'Hesap erişimi bekletiliyor' : 'Yönetici tarafından onay bekleniyor'}</Text>
          <Text style={styles.body}>{m.approved ? 'Giriş onayınız mevcut ancak hesabınız şu anda aktif değil. Yönetici kontrolünden sonra durumu yeniden kontrol edebilirsiniz.' : 'Kaydınız alındı. İşletme panelinizi kullanabilmeniz için yöneticinin hesabınıza giriş onayı vermesi gerekiyor. Onaylandıktan sonra paneliniz otomatik açılır.'}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Başvuru durumunuz</Text>
          {m.authUser?.email ? <Text style={styles.email}>{m.authUser.email}</Text> : null}
          <View style={styles.step}><MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.success} /><View style={styles.stepText}><Text style={styles.stepTitle}>Kayıt ve e-posta doğrulaması</Text><Text style={styles.caption}>Tamamlandı</Text></View></View>
          <View style={styles.divider} />
          <View style={styles.step}><MaterialCommunityIcons name={m.approved ? 'check-circle-outline' : 'clock-outline'} size={24} color={m.approved ? colors.success : colors.primary} /><View style={styles.stepText}><Text style={styles.stepTitle}>Yönetici giriş onayı</Text><Text style={styles.caption}>{m.approved ? 'Onaylandı' : 'Onay bekliyor'}</Text></View></View>
          <View style={styles.divider} />
          <View style={styles.step}><MaterialCommunityIcons name="lock-outline" size={24} color={colors.textFaint} /><View style={styles.stepText}><Text style={styles.stepTitle}>İşletme paneli</Text><Text style={styles.caption}>Hesabınız aktif olduğunda açılır</Text></View></View>
        </View>
        <View style={styles.actions}>
          {m.error ? <View style={styles.error}><MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} /><Text style={styles.errorText}>{m.error}</Text></View> : null}
          <Button label="Sayfayı yenile" icon="refresh" loading={m.refreshing} disabled={disabled} onPress={() => { void m.refresh(); }} />
          <View accessibilityLiveRegion="polite" style={styles.refreshNote}>{m.loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}<Text style={styles.caption}>{m.checkedAt ? `Son kontrol: ${m.checkedAt}` : 'Onay durumunu kontrol etmek için yenileyin.'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Hesaptan çıkış yap" disabled={disabled} onPress={() => { void m.logout(); }} style={({ pressed }) => [styles.logout, pressed && styles.pressed, disabled && styles.disabled]}>
            <MaterialCommunityIcons name="logout" size={20} color={colors.textSubtle} /><Text style={styles.logoutText}>{m.signingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  brand: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text, includeFontPadding: false },
  badge: { borderRadius: radius.pill, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary },
  hero: { gap: spacing.lg, paddingTop: spacing.md },
  symbol: { width: 88, height: 88, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderStrong },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary },
  statusText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary },
  title: { fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.2, fontWeight: fontWeight.bold, color: colors.text, includeFontPadding: false },
  body: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.textSubtle },
  card: { gap: spacing.lg, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: fontSize.lg, color: colors.text, fontWeight: fontWeight.semibold },
  email: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepText: { flex: 1, gap: spacing.xs },
  stepTitle: { fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.medium },
  caption: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.xxxl },
  actions: { gap: spacing.md },
  refreshNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  logout: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  logoutText: { fontSize: fontSize.md, color: colors.textSubtle, fontWeight: fontWeight.medium },
  pressed: { opacity: 0.7 }, disabled: { opacity: 0.5 },
  error: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radius.md },
  errorText: { flex: 1, fontSize: fontSize.md, color: colors.danger, lineHeight: fontSize.md * 1.6 },
});
