import React, { memo, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components';
import { useBusinessRegistration } from '@/hooks/useBusinessRegistration';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { MAIN_CATEGORIES, MainCategoryId, subCategoriesOf } from '@/services/categories';
import { useAlert } from '@/template';
import { fontSize, radius, spacing, ThemeColors } from '@/constants/theme';
interface BusinessRegistrationViewProps { title?: string }
export const BusinessRegistrationView = memo(function BusinessRegistrationView({ title = 'İşletme Kaydı' }: BusinessRegistrationViewProps) {
 const { colors: c, styles: s } = useThemeStyles(createStyles); const router = useRouter(); const { showAlert } = useAlert(); const { save } = useBusinessRegistration();
 const [main, setMain] = useState<MainCategoryId>('yeme_icme'); const [sub, setSub] = useState('restoran');
 const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState(''); const [hours, setHours] = useState(''); const [busy, setBusy] = useState(false);
 const subs = useMemo(() => subCategoriesOf(main), [main]);
 const submit = async () => {
  if (busy) return;
  setBusy(true);
  const result = await save({ main_category: main, category: sub, name: name.trim(), description: description.trim(), phone: phone.trim(), address: address.trim(), hours: hours.trim() });
  setBusy(false);
  if (result.error) { showAlert('İşletme kaydedilemedi', result.error); return; }
  showAlert('İşletme kaydedildi', 'Yönetici onayından sonra yayınlanacak.', [{ text: 'Tamam', onPress: () => router.replace('/(business-tabs)') }]);
 };
 return <SafeAreaView style={s.screen} edges={['bottom']}><KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
  <View style={s.hero}><Text style={s.heading}>{title}</Text><Text style={s.text}>İşletmeniz bu hesaba bağlanır. Yönetici onay süreci ve mevcut hesap türünüz korunur.</Text></View>
  <Text style={s.label}>Ana kategori</Text><View style={s.wrap}>{MAIN_CATEGORIES.map(item => <Pressable key={item.id} disabled={busy} onPress={() => { setMain(item.id); setSub(subCategoriesOf(item.id)[0].id); }} style={({ pressed }) => [s.chip, item.id === main ? s.selected : null, pressed ? s.pressed : null]}><Text style={[s.label, item.id === main ? { color: c.onPrimary } : null]}>{item.label}</Text></Pressable>)}</View>
  <Text style={s.label}>Alt kategori</Text><View style={s.wrap}>{subs.map(item => <Pressable key={item.id} disabled={busy} onPress={() => setSub(item.id)} style={({ pressed }) => [s.chip, item.id === sub ? s.selected : null, pressed ? s.pressed : null]}><Text style={[s.label, item.id === sub ? { color: c.onPrimary } : null]}>{item.label}</Text></Pressable>)}</View>
  <Field label="İşletme Adı" value={name} onChange={setName} disabled={busy} />
  <Field label="Açıklama" value={description} onChange={setDescription} multiline disabled={busy} />
  <Field label="Telefon" value={phone} onChange={setPhone} phone disabled={busy} />
  <Field label="Adres" value={address} onChange={setAddress} multiline disabled={busy} />
  <Field label="Çalışma Saatleri" value={hours} onChange={setHours} disabled={busy} />
  <View style={s.note}><MaterialCommunityIcons name="shield-check-outline" size={22} color={c.primary} /><Text style={s.text}>Onay durumunu İşletmelerim bölümünden takip edebilirsiniz.</Text></View>
  <Button label="İşletmeyi Kaydet" icon="content-save-outline" loading={busy} disabled={busy} onPress={() => { void submit(); }} />
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
});
interface FieldProps { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; phone?: boolean; disabled: boolean }
const Field = memo(function Field({ label, value, onChange, multiline = false, phone = false, disabled }: FieldProps) {
 const { colors, styles: s } = useThemeStyles(createStyles);
 return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} multiline={multiline} keyboardType={phone ? 'phone-pad' : 'default'} placeholderTextColor={colors.textFaint} style={[s.input, multiline ? s.multiline : null]} /></View>;
});
const createStyles = (c: ThemeColors) => StyleSheet.create({
 screen: { flex: 1, backgroundColor: c.background }, content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }, hero: { padding: spacing.lg, gap: spacing.sm, backgroundColor: c.primarySoft, borderRadius: radius.lg }, heading: { fontSize: fontSize.lg, color: c.text, fontWeight: '700' }, text: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: c.textSubtle, flexShrink: 1 }, label: { fontSize: fontSize.md, color: c.text, fontWeight: '600' }, field: { gap: spacing.sm },
 input: { minHeight: spacing.xxxl, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, color: c.text, fontSize: fontSize.md, padding: spacing.md }, multiline: { minHeight: spacing.xxxl * 2, textAlignVertical: 'top' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { minHeight: spacing.xxxl, padding: spacing.md, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, selected: { backgroundColor: c.primary, borderColor: c.primary }, note: { flexDirection: 'row', gap: spacing.md }, pressed: { opacity: 0.7 },
});
