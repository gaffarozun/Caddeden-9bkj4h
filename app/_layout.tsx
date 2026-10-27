// Powered by OnSpace.AI
import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
import { RatingProvider } from '@/contexts/RatingContext';
import { BusinessCartProvider } from '@/contexts/BusinessCartContext';
import { AccountAccessProvider } from '@/contexts/AccountAccessContext';
import { UniversityProvider } from '@/contexts/UniversityContext';
import { CampaignProvider } from '@/contexts/CampaignContext';
import { OrderMessagesProvider } from '@/contexts/OrderMessagesContext';
import { OrderRatingsProvider } from '@/contexts/OrderRatingsContext';
import { CafePresenceProvider } from '@/contexts/CafePresenceContext';
import { CafeSocialProvider } from '@/contexts/CafeSocialContext';
import { CafeArrivalProvider } from '@/contexts/CafeArrivalContext';
import { CustomerInboxProvider } from '@/contexts/CustomerInboxContext';
import { InstagramNotificationBubble } from '@/components/feature/InstagramNotificationBubble';
import { OrderNotifications } from '@/components/feature/OrderNotifications';
import { CafeArrivalBubble } from '@/components/feature/CafeArrivalBubble';
import { useCafeArrival } from '@/hooks/useCafeArrival';
import { useMediaMaintenance } from '@/hooks/useMediaMaintenance';
import { AccountRouteBoundary } from '@/components/auth/AccountRouteBoundary';
import { BusinessApprovalView } from '@/components/feature/BusinessApprovalView';
import { CaddedenIntro } from '@/components/feature/CaddedenIntro';
import { useCaddedenIntro } from '@/hooks/useCaddedenIntro';
import { usePasswordRecoveryRouting } from '@/hooks/usePasswordRecoveryRouting';
import { useAuth } from '@/hooks/useAuth';
import { businessProfileLayout, spacing, fontSize } from '@/constants/theme';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <AccountAccessProvider>
            <CafePresenceProvider>
            <CafeSocialProvider>
            <CafeArrivalProvider>
            <CampaignProvider>
            <UniversityProvider>
            <AppProvider>
            <OrderMessagesProvider>
            <CustomerInboxProvider>
              <FeedbackProvider>
                <RatingProvider>
                  <OrderRatingsProvider>
                    <BusinessCartProvider>
                      <RootNavigator />
                    </BusinessCartProvider>
                  </OrderRatingsProvider>
                </RatingProvider>
              </FeedbackProvider>
            </CustomerInboxProvider>
            </OrderMessagesProvider>
            </AppProvider>
            </UniversityProvider>
            </CampaignProvider>
            </CafeArrivalProvider>
            </CafeSocialProvider>
            </CafePresenceProvider>
            </AccountAccessProvider>
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}

function RootNavigator() {
  useMediaMaintenance();
  usePasswordRecoveryRouting();
  const intro = useCaddedenIntro();
  const { colors, isDark, ready } = useTheme();
  const { profileError, authUser, loading, operationLoading, passwordRecovery } = useAuth();
  const path = usePathname();
  const approvalGate = !passwordRecovery && !loading && !operationLoading && authUser?.role === 'business' && !authUser.businessAccess && !['/', '/auth', '/password-reset', '/business-approval', '/complaint'].includes(path);
  const overlaysHidden = intro.visible || !ready || passwordRecovery || approvalGate || !!profileError;
  const arrival = useCafeArrival(!overlaysHidden && !loading && !operationLoading && !['/auth', '/password-reset', '/account-delete', '/complaint', '/profile-edit'].includes(path));
  const header = {
    headerTintColor: colors.text,
    headerStyle: { backgroundColor: colors.surface },
    headerShadowVisible: false,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={intro.visible ? 'light' : isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }} accessibilityElementsHidden={intro.visible} importantForAccessibility={intro.visible ? 'no-hide-descendants' : 'auto'}>
      <View accessibilityElementsHidden={approvalGate} importantForAccessibility={approvalGate ? 'no-hide-descendants' : 'auto'} style={{ flex: 1, width: '100%', maxWidth: businessProfileLayout.maxWidth, alignSelf: 'center' }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(business-tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="business-approval" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="admin-setup" options={{ headerShown: true, title: 'Yönetici Erişimi', ...header }} />
        <Stack.Screen name="business/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="business/menu/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="business/reserve/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="business/rate/[id]" options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="business/feedback/[id]" options={{ headerShown: true, title: 'Müşteri Deneyimleri', ...header }} />
        <Stack.Screen name="account-delete" options={{ headerShown: true, title: 'Hesabımı Sil', ...header }} />
        <Stack.Screen name="complaint" options={{ headerShown: true, title: 'Şikâyet / Sorun Bildir', ...header }} />
        <Stack.Screen name="business/manage/[id]" options={{ headerShown: true, title: 'İşletme Sayfam', ...header }} />
        <Stack.Screen name="business/register" options={{ headerShown: true, title: 'İşletme Kaydı', ...header }} />
        <Stack.Screen name="business/ads" options={{ headerShown: true, title: 'Reklam Ver', ...header }} />
        <Stack.Screen name="business/posts" options={{ headerShown: true, title: 'Paylaşım Ekle', ...header }} />
        <Stack.Screen name="business/campaigns" options={{ headerShown: true, title: 'Kampanya Ekle', ...header }} />
        <Stack.Screen name="business/requests" options={{ headerShown: true, title: 'Gelen Talepler', ...header }} />
        <Stack.Screen name="business/order-history" options={{ headerShown: true, title: 'Sipariş Geçmişi ve Ciro', ...header }} />
        <Stack.Screen name="business/notifications" options={{ headerShown: true, title: 'Bildirim Gönder', ...header }} />
        <Stack.Screen name="profile-edit" options={{ headerShown: true, title: 'Hesap Bilgilerim', ...header }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Bildirimler', ...header }} />
        <Stack.Screen name="university" options={{ headerShown: true, title: 'Cadde TV · Yazı Gönder', ...header }} />
        <Stack.Screen name="history" options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="saved" options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <Stack.Screen name="auth" options={{ headerShown: true, title: '', presentation: 'modal', ...header }} />
        <Stack.Screen name="password-reset" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      </View>
      {approvalGate ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]}><BusinessApprovalView /></View> : null}
      {profileError && !passwordRecovery && !['/auth', '/password-reset', '/complaint'].includes(path) ? <View style={StyleSheet.absoluteFillObject}><AccountRouteBoundary>{null}</AccountRouteBoundary></View> : null}
      {passwordRecovery && path !== '/password-reset' ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md }]} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textSubtle, fontSize: fontSize.md }}>Şifre yenileme açılıyor…</Text></View> : null}
      {!ready ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: spacing.md }]} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.textSubtle, fontSize: fontSize.md }}>Görünüm hazırlanıyor…</Text></View> : null}
      </View>
      <CaddedenIntro intro={intro} />
      <OrderNotifications hidden={overlaysHidden || !!arrival.cafe || path === '/notifications'} />
      <InstagramNotificationBubble hidden={overlaysHidden || !!arrival.cafe || path === '/notifications'} />
      <CafeArrivalBubble arrival={arrival} hidden={overlaysHidden} />
    </View>
  );
}
