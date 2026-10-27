// Legacy route retained for existing links; this screen never assigns admin roles.
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAdminEntry } from '@/hooks/useAdminEntry';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { ThemeColors } from '@/constants/theme';

export default function AdminSetup() {
  const { loading, operationLoading, authUser } = useAuth();
  const allowed = useAdminEntry(true);
  const { colors, styles } = useThemeStyles(createStyles);
  if (loading || operationLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (allowed) return <Redirect href="/admin" />;
  return <Redirect href={authUser?.role === 'business' && authUser.businessAccess ? '/(business-tabs)/profile' : '/(tabs)/profile'} />;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
