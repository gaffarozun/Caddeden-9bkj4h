// Redirect must be listed in Supabase Dashboard > Authentication > URL Configuration > Redirect URLs.
// E-posta kodu uzunluğu Supabase panelindeki "Email OTP Length" ayarıyla aynı olmalıdır (varsayılan 6).
// Farklı bir uzunluk için EXPO_PUBLIC_RECOVERY_OTP_LENGTH tanımlayın (4-10 arası).
const configuredOtpLength = Number(process.env.EXPO_PUBLIC_RECOVERY_OTP_LENGTH);
export const passwordRecoveryConfig = {
  nativeRedirect: 'onspaceapp://password-reset',
  minimumPasswordLength: 6,
  otpLength: Number.isInteger(configuredOtpLength) && configuredOtpLength >= 4 && configuredOtpLength <= 10 ? configuredOtpLength : 6,
  resendSeconds: 60,
};
