import React, { memo } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBusinessProfile } from '@/hooks/useBusinessProfile';
import { useBusinessReservation } from '@/hooks/useBusinessReservation';
import { useBusinessTheme } from '@/hooks/useBusinessTheme';
import { BusinessChips, BusinessError, BusinessHeader, BusinessPrimary } from './BusinessProfileControls';
interface BusinessReservationViewProps { businessId: string }
export const BusinessReservationView = memo(function BusinessReservationView({ businessId }: BusinessReservationViewProps) {
  const { colors: c, styles: s, isDark } = useBusinessTheme();
  const p = useBusinessProfile(businessId); const m = useBusinessReservation(p.business, p.canReserve, p.data?.isDemo ?? false);
  return <SafeAreaView style={s.screen} edges={['top', 'bottom']}><StatusBar style={isDark ? 'light' : 'dark'} /><KeyboardAvoidingView style={s.frame} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><BusinessHeader title={m.appointment ? 'Randevu al' : 'Rezervasyon yap'} onBack={() => p.router.back()} />
    {p.loading ? <View style={s.center}><ActivityIndicator color={c.primary} /></View> : <ScrollView style={s.screen} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={s.card}><Text style={s.title}>{p.business?.name}</Text><Text style={s.subtle}>Talebiniz işletme onayına gönderilir. Sonucu Geçmişim sayfasından takip edebilirsiniz.</Text></View>
      <BusinessError message={p.error || m.error} />
      <Text style={s.heading}>Tarih</Text><BusinessChips label="Rezervasyon tarihi" items={m.dates} selected={m.date} onSelect={m.setDate} disabled={m.busy} />
      <Text style={s.heading}>Saat</Text><BusinessChips label="Rezervasyon saati" items={m.times} selected={m.time} onSelect={m.setTime} disabled={m.busy} />
      {m.appointment ? <><Text style={s.heading}>Hizmet</Text><BusinessChips label="Randevu hizmeti" items={(p.business?.menu ?? []).map(item => ({ id: item.id, label: item.name }))} selected={m.serviceId} onSelect={m.setServiceId} disabled={m.busy} /></> : <View style={s.campaign}><Text style={[s.heading, s.info]}>Kişi sayısı</Text><Pressable accessibilityLabel="Kişi sayısını azalt" style={({ pressed }) => [s.headerSide, pressed ? s.pressed : null]} disabled={m.busy} onPress={() => m.setGuests(value => Math.max(1, value - 1))}><MaterialCommunityIcons name="minus-circle-outline" size={25} color={c.primary} /></Pressable><Text style={s.heading}>{m.guests}</Text><Pressable accessibilityLabel="Kişi sayısını artır" style={({ pressed }) => [s.headerSide, pressed ? s.pressed : null]} disabled={m.busy} onPress={() => m.setGuests(value => Math.min(12, value + 1))}><MaterialCommunityIcons name="plus-circle-outline" size={25} color={c.primary} /></Pressable></View>}
      <Text style={s.heading}>Telefon (zorunlu)</Text><TextInput style={s.input} value={m.phone} onChangeText={m.setPhone} keyboardType="phone-pad" editable={!m.busy} accessibilityLabel="Rezervasyon telefon numarası" placeholder="+90 5xx xxx xx xx" placeholderTextColor={c.textFaint} />
      <BusinessPrimary label={!p.authUser ? 'Giriş yap' : m.appointment ? 'Randevu talebi gönder' : 'Rezervasyon talebi gönder'} busy={m.busy} disabled={!!p.authUser && !p.canReserve} onPress={() => { void m.submit(); }} />
    </ScrollView>}
  </KeyboardAvoidingView></SafeAreaView>;
});
