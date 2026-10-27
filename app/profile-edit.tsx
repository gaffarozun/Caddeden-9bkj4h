// Powered by OnSpace.AI
// Personal account details: name (required), gender, phone and saved delivery
// location. Saved once here, these pre-fill every order and reservation so the
// customer never has to re-enter them.
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EducationProfileCard } from '@/components/feature/EducationProfileCard';
import { CafeProfilePhotoCard } from '@/components/feature/CafeProfilePhotoCard';
import { CafeVisitPrivacyCard } from '@/components/feature/CafeVisitPrivacyCard';
import { CafeInstagramProfileCard } from '@/components/feature/CafeInstagramProfileCard';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Button } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { updateMyProfile } from '@/services/authService';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';

type Gender = 'male' | 'female' | '';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { authUser, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [firstName, setFirstName] = useState(authUser?.first_name ?? '');
  const [lastName, setLastName] = useState(authUser?.last_name ?? '');
  const [gender, setGender] = useState<Gender>((authUser?.gender as Gender) ?? '');
  const [phone, setPhone] = useState(authUser?.phone ?? '');
  const [address, setAddress] = useState(authUser?.address ?? '');
  const [lat, setLat] = useState<number | null>(authUser?.lat ?? null);
  const [lng, setLng] = useState<number | null>(authUser?.lng ?? null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!authUser) {
    return (
      <View style={styles.guard}>
        <MaterialCommunityIcons name="account-lock-outline" size={48} color={colors.textFaint} />
        <Text style={styles.guardText}>Bilgilerini düzenlemek için giriş yapmalısın.</Text>
        <Button label="Giriş Yap" icon="login" onPress={() => router.replace('/auth')} />
      </View>
    );
  }

  const useMyLocation = async () => {
    setLocating(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocating(false);
      showAlert('Konum izni gerekli', 'Konumunu kaydetmek için izin vermelisin.', [{ text: 'Tamam' }]);
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const g = geo[0];
        const line = [g?.street, g?.name, g?.district, g?.city].filter(Boolean).join(' ');
        if (line) setAddress(line);
      } catch {
        // reverse geocode is best-effort
      }
    } catch {
      showAlert('Konum alınamadı', 'Lütfen tekrar dene.', [{ text: 'Tamam' }]);
    }
    setLocating(false);
  };

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showAlert('Eksik bilgi', 'Ad ve soyad zorunludur.', [{ text: 'Tamam' }]);
      return;
    }
    setSaving(true);
    const { error } = await updateMyProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender: gender || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      lat,
      lng,
    });
    setSaving(false);
    if (error) {
      showAlert('Kaydedilemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    await refreshProfile();
    showAlert('Kaydedildi', 'Bilgilerin güncellendi. Sipariş ve rezervasyonlarda otomatik kullanılacak.', [
      { text: 'Tamam', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CafeProfilePhotoCard />
        <CafeVisitPrivacyCard />
        <CafeInstagramProfileCard />
        <EducationProfileCard />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kişisel Bilgiler</Text>

          <Text style={styles.label}>Ad (zorunlu)</Text>
          <TextInput value={firstName} onChangeText={setFirstName} placeholder="Adın" placeholderTextColor={colors.textFaint} style={styles.input} accessibilityLabel="Ad" />

          <Text style={styles.label}>Soyad (zorunlu)</Text>
          <TextInput value={lastName} onChangeText={setLastName} placeholder="Soyadın" placeholderTextColor={colors.textFaint} style={styles.input} accessibilityLabel="Soyad" />

          <Text style={styles.label}>Cinsiyet</Text>
          <View style={styles.genderRow}>
            <Pressable onPress={() => setGender('female')} style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]} accessibilityLabel="Kadın">
              <MaterialCommunityIcons name="gender-female" size={18} color={gender === 'female' ? colors.onPrimary : colors.textSubtle} />
              <Text style={[styles.genderText, gender === 'female' && { color: colors.onPrimary }]}>Kadın</Text>
            </Pressable>
            <Pressable onPress={() => setGender('male')} style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]} accessibilityLabel="Erkek">
              <MaterialCommunityIcons name="gender-male" size={18} color={gender === 'male' ? colors.onPrimary : colors.textSubtle} />
              <Text style={[styles.genderText, gender === 'male' && { color: colors.onPrimary }]}>Erkek</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>İletişim & Konum</Text>
          <Text style={styles.cardHint}>Bir kez kaydet; her sipariş ve rezervasyonda otomatik dolsun.</Text>

          <Text style={styles.label}>Telefon</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="+90 5xx xxx xx xx" placeholderTextColor={colors.textFaint} keyboardType="phone-pad" style={styles.input} accessibilityLabel="Telefon" />

          <Text style={styles.label}>Adres</Text>
          <TextInput value={address} onChangeText={setAddress} placeholder="Teslimat adresi veya tarifi" placeholderTextColor={colors.textFaint} style={[styles.input, styles.textArea]} multiline accessibilityLabel="Adres" />

          <View style={styles.locRow}>
            <MaterialCommunityIcons name={lat != null ? 'map-marker-check' : 'map-marker-outline'} size={18} color={lat != null ? colors.success : colors.textSubtle} />
            <Text style={styles.locText}>{lat != null ? 'Konum kaydedildi' : 'Konum eklenmedi'}</Text>
          </View>
          <Button
            label={locating ? 'Konum alınıyor...' : lat != null ? 'Konumu Güncelle' : 'Konumumu Kullan'}
            icon="crosshairs-gps"
            variant="secondary"
            onPress={useMyLocation}
            loading={locating}
          />
        </View>

        <Button label={saving ? 'Kaydediliyor...' : 'Bilgileri Kaydet'} icon="content-save-outline" onPress={save} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
    guard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
    guardText: { fontSize: fontSize.md, color: colors.textSubtle, textAlign: 'center' },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
    cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
    cardHint: { fontSize: fontSize.xs, color: colors.textSubtle, lineHeight: fontSize.xs * 1.5, marginBottom: spacing.xs },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginTop: spacing.sm },
    input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: fontSize.md, color: colors.text },
    textArea: { height: 76, textAlignVertical: 'top' },
    genderRow: { flexDirection: 'row', gap: spacing.sm },
    genderBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    genderBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    genderText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textSubtle },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    locText: { fontSize: fontSize.sm, color: colors.textSubtle },
  });
