// Powered by OnSpace.AI
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Button } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useAlert } from '@/template';
import { fontSize, fontWeight, radius, spacing, ThemeColors } from '@/constants/theme';
import { useThemeStyles } from '@/hooks/useThemeStyles';

type Account = 'user' | 'business';
type Mode = 'login' | 'register';
type Gender = 'male' | 'female' | '';

export default function AuthScreen() {
  const { colors, styles } = useThemeStyles(createStyles);
  const router = useRouter();
  const { showAlert } = useAlert();
  const { authUser, loading, signIn, sendOtp, registerWithOtp, operationLoading, passwordRecovery } = useAuth();

  const [account, setAccount] = useState<Account>('user');
  const [mode, setMode] = useState<Mode>('login');
  const [otpSent, setOtpSent] = useState(false);

  const [name, setName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  const resetFlow = () => {
    setOtpSent(false);
    setOtp('');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Eksik bilgi', 'Lütfen e-posta ve şifre alanlarını doldur.', [{ text: 'Tamam' }]);
      return;
    }
    const { error } = await signIn(email, password, account);
    if (error) {
      showAlert('Giriş başarısız', error, [{ text: 'Tamam' }]);
      return;
    }
    // The authenticated route selects navigation from the database role.
  };

  const handleSendOtp = async () => {
    if (account === 'business') {
      if (!name.trim()) {
        showAlert('Eksik bilgi', 'İşletme yetkilisinin adını gir.', [{ text: 'Tamam' }]);
        return;
      }
    } else {
      if (!firstName.trim() || !lastName.trim()) {
        showAlert('Eksik bilgi', 'Ad ve soyadını girmen zorunlu.', [{ text: 'Tamam' }]);
        return;
      }
      if (gender !== 'male' && gender !== 'female') {
        showAlert('Cinsiyet seç', 'Devam etmek için kadın veya erkek seçmelisin.', [{ text: 'Tamam' }]);
        return;
      }
    }
    if (!email.trim() || password.length < 6) {
      showAlert('Eksik bilgi', 'Geçerli bir e-posta ve en az 6 haneli şifre gir.', [{ text: 'Tamam' }]);
      return;
    }
    if (password !== confirmPassword) { showAlert('Şifreler eşleşmiyor', 'Şifreyi tekrar kontrol edin.'); return; }
    const { error } = await sendOtp(email, {
      role: account,
      username: account === 'business' ? name.trim() : `${firstName.trim()} ${lastName.trim()}`.trim(),
      phone: phone.trim() || undefined,
      first_name: account === 'user' ? firstName.trim() : undefined,
      last_name: account === 'user' ? lastName.trim() : undefined,
      gender: account === 'user' && gender ? gender : undefined,
    });
    if (error) {
      showAlert('Kod gönderilemedi', error, [{ text: 'Tamam' }]);
      return;
    }
    setOtpSent(true);
    showAlert('Kod gönderildi', 'E-postana gelen doğrulama kodunu gir.', [{ text: 'Tamam' }]);
  };

  const handleVerify = async () => {
    if (otp.trim().length < 4) {
      showAlert('Eksik kod', 'E-postana gelen doğrulama kodunu gir.', [{ text: 'Tamam' }]);
      return;
    }
    const username =
      account === 'business'
        ? name.trim()
        : `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ').trim();
    const { error } = await registerWithOtp(email, otp, password, {
      username,
      phone: phone.trim() || undefined,
      role: account,
      first_name: account === 'user' ? firstName.trim() : undefined,
      last_name: account === 'user' ? lastName.trim() : undefined,
      gender: account === 'user' ? (gender as 'male' | 'female') : undefined,
    });
    if (error) {
      showAlert('Doğrulama başarısız', error, [{ text: 'Tamam' }]);
      return;
    }
    // Auth state drives the redirect; account type is never changed here.
  };

  if (passwordRecovery) return <Redirect href="/password-reset" />;
  if (authUser && !loading && !operationLoading) return <Redirect href="/" />;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Caddeden</Text>
        <Text style={styles.subtitle}>
          {account === 'business' ? 'İşletme hesabınla devam et' : 'Topluluğa katıl, keşfet ve kazan'}
        </Text>

        {account === 'business' ? <View style={styles.approvalNote}><MaterialCommunityIcons name="shield-lock-outline" size={20} color={colors.primary} /><Text style={styles.approvalText}>İşletme hesabınızla giriş yapabilirsiniz. İşletme paneli, kayıt sonrası yönetici giriş onayıyla açılır.</Text></View> : null}

        <View style={styles.segment}>
          <SegmentBtn label="Kullanıcı" active={account === 'user'} onPress={() => { setAccount('user'); resetFlow(); }} />
          <SegmentBtn label="İşletme" active={account === 'business'} onPress={() => { setAccount('business'); resetFlow(); }} />
        </View>

        {mode === 'register' && otpSent ? (
          <View style={styles.otpBox}>
            <Text style={styles.otpInfo}>{email} adresine gönderilen kodu gir.</Text>
            <Field label="Doğrulama Kodu" icon="shield-check-outline" value={otp} onChangeText={setOtp} placeholder="Kod" keyboardType="phone-pad" />
            <Button
              label={operationLoading ? 'Doğrulanıyor...' : 'Doğrula ve Kaydı Tamamla'}
              icon="check-circle-outline"
              onPress={handleVerify}
              disabled={operationLoading}
            />
            <Pressable style={styles.resend} onPress={handleSendOtp} disabled={operationLoading}>
              <Text style={styles.resendText}>Kodu tekrar gönder</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {mode === 'register' ? (
              account === 'business' ? (
                <Field
                  label="Yetkili Adı"
                  icon="account-tie-outline"
                  value={name}
                  onChangeText={setName}
                  placeholder="Yetkili kişi"
                />
              ) : (
                <>
                  <Field label="Ad" icon="account-outline" value={firstName} onChangeText={setFirstName} placeholder="Adın" />
                  <Field label="Soyad" icon="account-outline" value={lastName} onChangeText={setLastName} placeholder="Soyadın" />
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Cinsiyet</Text>
                    <Text style={styles.subtitle}>Tüm hesaplarda turuncu ve hardal tema kullanılır. Profil ayarlarından istediğin zaman değiştirebilirsin.</Text>
                    <View style={styles.genderRow}>
                      <Pressable
                        onPress={() => setGender('female')}
                        style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                        accessibilityLabel="Kadın"
                      >
                        <MaterialCommunityIcons name="gender-female" size={18} color={gender === 'female' ? colors.onPrimary : colors.textSubtle} />
                        <Text style={[styles.genderText, gender === 'female' && { color: colors.onPrimary }]}>Kadın</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setGender('male')}
                        style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                        accessibilityLabel="Erkek"
                      >
                        <MaterialCommunityIcons name="gender-male" size={18} color={gender === 'male' ? colors.onPrimary : colors.textSubtle} />
                        <Text style={[styles.genderText, gender === 'male' && { color: colors.onPrimary }]}>Erkek</Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )
            ) : null}

            <Field label="E-posta" icon="email-outline" value={email} onChangeText={setEmail} placeholder="ornek@eposta.com" keyboardType="email-address" />

            {mode === 'register' ? (
              <Field
                label={account === 'business' ? 'Telefon' : 'Telefon (opsiyonel)'}
                icon="phone-outline"
                value={phone}
                onChangeText={setPhone}
                placeholder="+90 5xx xxx xx xx"
                keyboardType="phone-pad"
              />
            ) : null}

            <Field label="Şifre" icon="lock-outline" value={password} onChangeText={setPassword} placeholder="En az 6 karakter" secureTextEntry />
            {mode === 'login' ? <Pressable
              accessibilityRole="button"
              accessibilityLabel="Şifremi unuttum"
              accessibilityState={{ disabled: loading || operationLoading }}
              disabled={loading || operationLoading}
              onPress={() => router.push({ pathname: '/password-reset', params: { email: email.trim() } })}
              style={({ pressed }) => [styles.forgotPassword, pressed ? styles.pressed : null, loading || operationLoading ? styles.disabled : null]}
            ><MaterialCommunityIcons name="lock-reset" size={20} color={colors.primaryDark} /><Text style={styles.forgotPasswordText}>Şifremi unuttum</Text></Pressable> : null}
            {mode === 'register' ? <Field label="Şifreyi tekrar gir" icon="lock-check-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Şifreni doğrula" secureTextEntry /> : null}

            <View style={{ marginTop: spacing.lg }}>
              <Button
                label={
                  operationLoading
                    ? 'Lütfen bekle...'
                    : mode === 'login'
                    ? 'Giriş Yap'
                    : 'Doğrulama Kodu Gönder'
                }
                icon={mode === 'login' ? 'login' : 'email-fast-outline'}
                onPress={mode === 'login' ? handleLogin : handleSendOtp}
                disabled={operationLoading}
              />
            </View>
          </>
        )}

        <Pressable
          style={styles.switchRow}
          onPress={() => {
            setMode((m) => (m === 'login' ? 'register' : 'login'));
            resetFlow();
          }}
        >
          <Text style={styles.switchText}>
            {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
            <Text style={styles.switchLink}>{mode === 'login' ? 'Kayıt ol' : 'Giriş yap'}</Text>
          </Text>
        </Pressable>

        {account === 'user' ? (
          <Pressable style={styles.guestBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.guestText}>Misafir olarak devam et</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SegmentBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={[styles.segmentBtn, active && styles.segmentBtnActive]}>
      <Text style={[styles.segmentText, active && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  icon: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  const { colors, styles } = useThemeStyles(createStyles);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color={colors.textFaint} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={secureTextEntry || keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={!secureTextEntry && keyboardType !== 'email-address'}
          accessibilityLabel={label}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, width: '100%', maxWidth: 600, alignSelf: 'center' },
  brand: { fontSize: fontSize.xxxl, fontWeight: fontWeight.bold, color: colors.primaryDark, letterSpacing: -1, marginTop: spacing.sm, includeFontPadding: false },
  subtitle: { fontSize: fontSize.sm, color: colors.textSubtle, marginTop: 4, marginBottom: spacing.xl },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceTint, borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.pill },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSubtle },
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text, padding: 0 },
  genderRow: { flexDirection: 'row', gap: spacing.sm },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textSubtle },
  approvalNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft, marginBottom: spacing.lg },
  approvalText: { flex: 1, color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6 },
  otpBox: { gap: spacing.sm },
  otpInfo: { fontSize: fontSize.sm, color: colors.textSubtle, marginBottom: spacing.sm },
  resend: { alignItems: 'center', paddingVertical: spacing.sm },
  resendText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  switchRow: { alignItems: 'center', marginTop: spacing.lg },
  switchText: { fontSize: fontSize.sm, color: colors.textSubtle },
  switchLink: { color: colors.primary, fontWeight: fontWeight.bold },
  guestBtn: { alignItems: 'center', marginTop: spacing.lg, padding: spacing.sm },
  guestText: { fontSize: fontSize.sm, color: colors.textSubtle, textDecorationLine: 'underline' },
  forgotPassword: { minHeight: spacing.xxxl, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  forgotPasswordText: { color: colors.primaryDark, fontSize: fontSize.md, fontWeight: fontWeight.semibold, includeFontPadding: false },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
