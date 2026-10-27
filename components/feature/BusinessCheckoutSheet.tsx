import React, { memo } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBusinessTheme } from '@/hooks/useBusinessTheme';
import { useBusinessOrder } from '@/hooks/useBusinessOrder';
import { money } from '@/services/businessProfileService';
import { BusinessError, BusinessHeader, BusinessLink, BusinessPrimary } from './BusinessProfileControls';
interface BusinessCheckoutSheetProps { model: ReturnType<typeof useBusinessOrder>; deliveryMinutes?: number }
export const BusinessCheckoutSheet = memo(function BusinessCheckoutSheet({ model: m, deliveryMinutes }: BusinessCheckoutSheetProps) {
  const { colors: c, styles: s } = useBusinessTheme();
  return <Modal visible={m.contactOpen} animationType="slide" onRequestClose={m.closeContact}><SafeAreaView style={s.screen} edges={['top', 'bottom']}><KeyboardAvoidingView style={s.frame} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><BusinessHeader title="Sipariş bilgileri" onBack={m.closeContact} />
    <FlatList data={m.items} keyExtractor={row => row.item.id} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.body} renderItem={({ item: row }) => <View style={s.meta}><Text style={[s.text, s.info]}>{row.qty} × {row.item.name}</Text><Text style={s.price}>{money(row.qty * row.item.price)}</Text></View>}
      ListFooterComponent={<View style={s.menuRows}><View style={s.campaign}><View style={s.info}><Text style={s.heading}>Toplam {money(m.total)}</Text><Text style={s.subtle}>Minimum {money(m.minimum)}{deliveryMinutes ? ` · ~${deliveryMinutes} dk` : ''}</Text></View></View><Text style={s.subtle}>Telefon ve teslimat konumu zorunludur. Teslimat konumunuzla bulunduğunuz yer arasında en fazla 1 km olmalıdır.</Text>
      <Text style={s.text}>Telefon (zorunlu)</Text><TextInput editable={!m.busy} style={s.input} value={m.phone} onChangeText={m.setPhone} keyboardType="phone-pad" accessibilityLabel="Teslimat telefon numarası" placeholder="+90 5xx xxx xx xx" placeholderTextColor={c.textFaint} />
      <Text style={s.text}>Adres / Konum (zorunlu)</Text><TextInput editable={!m.busy} style={[s.input, s.inputMultiline]} value={m.address} onChangeText={m.setAddress} multiline accessibilityLabel="Teslimat adresi" placeholder="Açık adres ve teslimat tarifi" placeholderTextColor={c.textFaint} />
      <Text style={s.text}>Sipariş notu (isteğe bağlı)</Text><TextInput editable={!m.busy} style={[s.input, s.inputMultiline]} value={m.note} onChangeText={m.setNote} multiline maxLength={1000} accessibilityLabel="Sipariş notu" placeholder="İşletmeye iletmek istediğiniz not" placeholderTextColor={c.textFaint} />
      <BusinessLink label={m.locating ? 'Konum alınıyor…' : m.lat != null ? 'Teslimat konumunu güncelle' : 'Konumumu kullan'} icon="crosshairs-gps" disabled={m.locating || m.busy} onPress={() => { void m.locate(); }} /><BusinessError message={m.error} />
      <BusinessPrimary label={`Sipariş talebi gönder · ${money(m.total)}`} busy={m.busy} disabled={m.locating || m.remaining > 0} onPress={() => { void m.submit(); }} />
      <Text style={s.subtle}>İşletmenin onayı ve teslimat durumu Aktif siparişler sayfasında görünür.</Text></View>} />
  </KeyboardAvoidingView></SafeAreaView></Modal>;
});
