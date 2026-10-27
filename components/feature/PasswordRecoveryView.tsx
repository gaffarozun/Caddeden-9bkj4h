import React, { memo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { FeedbackError } from '@/components/feature/FeedbackControls';
import { RecoveryRouteParams, usePasswordRecovery } from '@/hooks/usePasswordRecovery';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { passwordRecoveryConfig } from '@/constants/passwordRecovery';

interface PasswordRecoveryViewProps { params: RecoveryRouteParams }
export const PasswordRecoveryView = memo(function PasswordRecoveryView({ params }: PasswordRecoveryViewProps) {
  const model = usePasswordRecovery(params);
  const { colors, styles } = useThemeStyles(createStyles);
  const success = model.stage === 'success';
  const passwordStep = model.stage === 'password';
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={model.exit} disabled={model.busy} accessibilityRole="button" accessibilityLabel="Giriş ekranına dön" style={({ pressed }) => [styles.back, pressed ? styles.pressed : null, model.busy ? styles.disabled : null]}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primaryDark} /><Text style={styles.backText}>Girişe dön</Text>
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.brand}>Caddeden</Text>
          <View style={styles.heroHeading}><MaterialCommunityIcons name={success ? 'shield-check-outline' : 'lock-reset'} size={32} color={colors.primaryDark} /><Text style={styles.title}>{success ? 'Şifreniz yenilendi' : passwordStep ? 'Yeni şifre belirleyin' : 'Şifremi unuttum'}</Text></View>
          <Text style={styles.body}>{success ? 'Yeni şifrenizle hesabınıza giriş yapabilirsiniz. Hesap türünüz ve işletme onayınız değişmez.' : passwordStep ? 'E-postanız doğrulandı. Hesabınız için yeni bir şifre belirleyin.' : 'Kullanıcı ve işletme hesapları için kayıtlı e-posta adresinizle şifrenizi güvenle yenileyin.'}</Text>
        </View>
        <View style={styles.card}>
          {model.error ? <FeedbackError message={model.error} /> : null}
          {model.stage === 'email' ? <>
            <RecoveryField label="Kayıtlı e-posta adresi" value={model.email} onChange={model.setEmail} placeholder="ornek@eposta.com" keyboard="email-address" disabled={model.busy} />
            <Button label="Sıfırlama e-postası gönder" icon="email-fast-outline" loading={model.busy} disabled={model.busy || model.resendSeconds > 0} onPress={model.send} />
            <Text style={styles.body}>Şifre yenileme, yeni hesap oluşturmaz ve mevcut hesabınızın türünü değiştirmez.</Text>
          </> : null}
          {model.stage === 'sent' ? <>
            <View style={styles.notice} accessibilityLiveRegion="polite"><MaterialCommunityIcons name="email-check-outline" size={24} color={colors.primaryDark} /><Text style={styles.noticeText}>{model.email} adresine kayıtlı bir hesap varsa sıfırlama e-postası gönderildi.</Text></View>
            <Text style={styles.body}>E-postanızdaki sıfırlama bağlantısına dokunun. E-postanızın spam klasörünü de kontrol edin.</Text>
            <View style={styles.codeSection}>
              <Text style={styles.sectionTitle}>E-postada kod varsa</Text>
              <Text style={styles.body}>Bağlantı yerine {passwordRecoveryConfig.otpLength} haneli kod aldıysanız buradan doğrulayabilirsiniz.</Text>
              <RecoveryField label="Şifre sıfırlama kodu" value={model.token} onChange={model.setToken} placeholder={'0'.repeat(passwordRecoveryConfig.otpLength)} keyboard="number-pad" maxLength={passwordRecoveryConfig.otpLength} disabled={model.busy} />
              <Button label="Kodu doğrula" icon="shield-check-outline" loading={model.busy} disabled={model.busy || model.token.length !== passwordRecoveryConfig.otpLength} onPress={model.verifyCode} />
            </View>
            <Button label={model.resendSeconds > 0 ? `Tekrar gönder · ${model.resendSeconds} sn` : 'E-postayı tekrar gönder'} variant="secondary" disabled={model.busy || model.resendSeconds > 0} onPress={model.send} />
            <Button label="E-posta adresini değiştir" variant="ghost" disabled={model.busy} onPress={model.changeEmail} />
          </> : null}
          {passwordStep ? <>
            <RecoveryField label="Yeni şifre" value={model.password} onChange={model.setPassword} placeholder={`En az ${passwordRecoveryConfig.minimumPasswordLength} karakter`} secure disabled={model.busy} />
            <RecoveryField label="Yeni şifreyi tekrar girin" value={model.confirmation} onChange={model.setConfirmation} placeholder="Yeni şifrenizi doğrulayın" secure disabled={model.busy} />
            <Button label="Şifremi yenile" icon="lock-check-outline" loading={model.busy} disabled={model.busy} onPress={model.savePassword} />
          </> : null}
          {success ? <Button label="Giriş yap" icon="login" loading={model.busy} disabled={model.busy} onPress={model.exit} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
});
interface RecoveryFieldProps {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
  keyboard?: 'default' | 'email-address' | 'number-pad'; secure?: boolean; maxLength?: number; disabled?: boolean;
}
const RecoveryField = memo(function RecoveryField({ label, value, onChange, placeholder, keyboard = 'default', secure = false, maxLength, disabled }: RecoveryFieldProps) {
  const { colors, styles } = useThemeStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textFaint} keyboardType={keyboard} secureTextEntry={secure} editable={!disabled} autoCapitalize="none" autoCorrect={false} maxLength={maxLength} textContentType={secure ? 'newPassword' : keyboard === 'number-pad' ? 'oneTimeCode' : 'emailAddress'} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.input, focused ? styles.inputFocused : null]} />
  </View>;
});
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  back: { minHeight: spacing.xxxl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingRight: spacing.lg },
  backText: { color: colors.primaryDark, fontSize: fontSize.md, fontWeight: fontWeight.semibold, includeFontPadding: false },
  hero: { gap: spacing.md },
  heroHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  brand: { color: colors.primaryDark, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, includeFontPadding: false },
  title: { flex: 1, color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, includeFontPadding: false },
  body: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, includeFontPadding: false },
  card: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.medium, includeFontPadding: false },
  input: { minHeight: spacing.xxxl, padding: spacing.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, color: colors.text, fontSize: fontSize.md, includeFontPadding: false },
  inputFocused: { borderColor: colors.primary },
  notice: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  noticeText: { flex: 1, color: colors.text, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, includeFontPadding: false },
  codeSection: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, includeFontPadding: false },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 },
});
