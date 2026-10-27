// Powered by OnSpace.AI
import React from 'react';
import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { AdminLoading } from '@/components/admin/ui';
import { useTheme } from '@/hooks/useTheme';

export default function AdminLayout() {
  const { colors } = useTheme();
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AdminLoading label="Yetki doğrulanıyor..." />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Yönetici Paneli' }} />
      <Stack.Screen name="businesses" options={{ title: 'İşletme Yönetimi' }} />
      <Stack.Screen name="content" options={{ title: 'İçerik Onayı' }} />
      <Stack.Screen name="university" options={{ title: 'Cadde TV · Yazı Onayları' }} />
      <Stack.Screen name="alerts" options={{ title: 'Başvuru Bildirimleri' }} />
      <Stack.Screen name="ads" options={{ title: 'Reklam Yönetimi' }} />
      <Stack.Screen name="packages" options={{ title: 'Reklam Fiyatları' }} />
      <Stack.Screen name="notifications" options={{ title: 'Bildirim Merkezi' }} />
      <Stack.Screen name="notification-requests" options={{ title: 'Bildirim Talepleri' }} />
      <Stack.Screen name="users" options={{ title: 'Kullanıcı Yönetimi' }} />
      <Stack.Screen name="revenue" options={{ title: 'Gelir Yönetimi' }} />
      <Stack.Screen name="orders" options={{ title: 'Tüm Siparişler ve Ciro' }} />
      <Stack.Screen name="complaints" options={{ title: 'Şikâyet ve Denetim' }} />
      <Stack.Screen name="support-settings" options={{ title: 'Şikâyet E-posta Adresi' }} />
      <Stack.Screen name="feedback" options={{ title: 'Müşteri Deneyimi Denetimi' }} />
      <Stack.Screen name="logs" options={{ title: 'İşlem Kayıtları' }} />
    </Stack>
  );
}
