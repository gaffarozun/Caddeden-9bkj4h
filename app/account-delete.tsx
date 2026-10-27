import React, { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAccountDeletion } from '@/hooks/useAccountDeletion';
import { useAlert } from '@/template';
import { createFeedbackStyles } from '@/constants/feedbackStyles';
import { FeedbackButton, FeedbackError, FeedbackInput } from '@/components/feature/FeedbackControls';

export default function AccountDeleteScreen() {
  const router = useRouter(); const { showAlert } = useAlert();
  const { colors } = useTheme(); const styles = useMemo(() => createFeedbackStyles(colors), [colors]);
  const m = useAccountDeletion();
  const confirm = () => showAlert('Hesabı kalıcı olarak sil', 'Giriş hesabınız silinecek. Kimlik ve iletişim alanlarınız temizlenecek; gerekli işlem kayıtları korunacak. Bu işlem geri alınamaz.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Hesabımı Sil', style: 'destructive', onPress: () => { void m.submit(); } }]);
  return <SafeAreaView style={styles.screen} edges={['bottom']}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView style={styles.screen} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.tint}><Text style={styles.title}>Hesabımı sil</Text><Text style={styles.text}>Yalnızca kendi hesabınızı, mevcut şifrenizle tekrar doğrulayarak silebilirsiniz.</Text></View>
    {m.completed ? <View style={styles.card}><Text style={styles.heading}>Hesabınız silindi</Text><FeedbackError message={m.error} /><Text style={styles.text}>Giriş hesabınız kapatıldı. Kişisel profil ve iletişim alanlarınız temizlendi; ilişkili işlem kayıtları korundu.</Text><FeedbackButton label="Keşfete dön" onPress={() => router.replace('/(tabs)')} /></View> : m.isAdmin ? <View style={styles.card}><Text style={styles.text}>Yönetici hesabı bu silme akışının dışında tutulur. Yönetici yetkileri değiştirilmez.</Text><FeedbackButton secondary label="Geri dön" onPress={() => router.back()} /></View> : !m.authUser ? <FeedbackButton label="Giriş yap" onPress={() => router.push('/auth')} /> : <>
      <View style={styles.card}><Text style={styles.heading}>Silme işleminin kapsamı</Text><Text style={styles.text}>Profil adı, e-posta, telefon, adres, konum ve profil kişisel alanları temizlenir. Puan ve yorumlarınız görünürlükten çıkarılır, öneri destekleriniz geri çekilir. Şikâyet açıklamalarınız ve kanıt fotoğraflarınız kaldırılır.</Text><Text style={styles.text}>Sipariş ve rezervasyon tutarları, durumları ve işlem tarihleri korunur; sizin müşteri adı, telefon, adres, konum ve sipariş notunuz kaldırılır.</Text><Text style={styles.text}>İşletme hesabı silinirse işletmeler yayından kaldırılır. İşletme, reklam, ödeme ve mevcut onay kayıtları sıfırlanmaz.</Text><Text style={styles.subtle}>Referans bütünlüğü için teknik hesap kimliği korunur; bu, tüm kayıtların tamamen ve geri döndürülemez anonimleştirildiği anlamına gelmez. Yasal saklama süresi belirlenmeden otomatik kayıt imhası yapılmaz.</Text></View>
      <View style={styles.card}><FeedbackInput label="Mevcut şifreniz" value={m.password} onChange={m.setPassword} secure multiline={false} maxLength={200} disabled={m.busy} /><FeedbackInput label="Onay için HESABIMI SİL yazın" value={m.confirmation} onChange={m.setConfirmation} multiline={false} maxLength={30} disabled={m.busy} /><FeedbackError message={m.error} /><FeedbackButton danger label="Hesabımı kalıcı olarak sil" icon="account-remove-outline" onPress={confirm} busy={m.busy} disabled={m.confirmation !== 'HESABIMI SİL' || m.password.length < 6} /><FeedbackButton secondary label="Vazgeç" onPress={() => router.back()} disabled={m.busy} /></View>
    </>}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
