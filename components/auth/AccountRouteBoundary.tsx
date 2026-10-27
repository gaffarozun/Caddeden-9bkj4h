import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouteAccess } from '@/hooks/useRouteAccess';
import { useAuth } from '@/hooks/useAuth';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { Button } from '@/components/ui/Button';
import { spacing, fontSize, radius, ThemeColors } from '@/constants/theme';
interface AccountRouteBoundaryProps { children: React.ReactNode }
export function AccountRouteBoundary({ children }: AccountRouteBoundaryProps) {
  const m = useRouteAccess(); const router = useRouter(); const { refreshProfile } = useAuth();
  const { colors, styles } = useThemeStyles(createStyles);
  if (m.checking) return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.text}>Oturum yükleniyor…</Text></View>;
  if (m.blocked || m.error) return <SafeAreaView style={styles.center}><View style={styles.card}><MaterialCommunityIcons name="shield-lock-outline" size={36} color={colors.primary} /><Text style={styles.heading}>Bu işlem hesabınıza açık değil</Text><Text style={styles.text}>{m.error || 'Hesap türünüz bu ekrana erişemez. İşletme hesapları müşteri işlemi yapamaz; kullanıcı hesapları işletme yönetemez.'}</Text>{m.error ? <Button label="Yeniden dene" variant="secondary" onPress={() => { void refreshProfile(); }} /> : null}<Button label="Ana sayfaya dön" onPress={() => router.replace(m.home)} /></View></SafeAreaView>;
  return <>{children}</>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
 center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
 card: { width: '100%', maxWidth: 600, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
 text: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6 },
 heading: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
});
