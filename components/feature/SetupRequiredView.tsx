import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

// Supabase değişkenleri tanımlı değilken uygulama çökmek yerine bu ekranı gösterir.
export function SetupRequiredView() {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.title}>Supabase yapılandırması gerekli</Text>
        <Text style={s.text}>Caddeden, verilerini Supabase üzerinden okur. Proje kök dizininde bir .env dosyası oluşturun:</Text>
        <Text style={s.code}>{'EXPO_PUBLIC_SUPABASE_URL=https://<proje-ref>.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-veya-anon-anahtar>'}</Text>
        <Text style={s.text}>Değerleri Supabase panelinde Project Settings → API bölümünden alın, sonra uygulamayı yeniden başlatın (expo start -c).</Text>
        <Text style={s.note}>service_role / secret anahtarını buraya yazmayın; yalnızca publishable/anon anahtar kullanılır.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  text: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: 22 },
  code: { color: colors.text, fontSize: fontSize.sm, fontFamily: 'monospace', backgroundColor: colors.background, padding: spacing.md, borderRadius: radius.md },
  note: { color: colors.textSubtle, fontSize: fontSize.sm },
});
