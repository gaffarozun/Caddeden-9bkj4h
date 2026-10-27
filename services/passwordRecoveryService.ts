import { getSupabaseClient } from '@/template';
import { passwordRecoveryConfig } from '@/constants/passwordRecovery';

export interface RecoveryCallback {
  code?: string;
  token_hash?: string;
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error?: string;
  error_code?: string;
}
export interface RecoveryResult { userId: string | null; error: string | null }
const callbackRequests = new Map<string, Promise<RecoveryResult>>();
const client = () => getSupabaseClient();
const failure = (error: unknown): RecoveryResult => ({
  userId: null,
  error: error instanceof Error ? error.message : 'Şifre sıfırlama doğrulanamadı. Yeni bağlantı isteyin.',
});

// Password recovery only. OAuth callbacks never enter this parser or flow.
export function parseRecoveryUrl(url: string): RecoveryCallback {
  const result: RecoveryCallback = {};
  const allowed = new Set(['code', 'token_hash', 'access_token', 'refresh_token', 'type', 'error', 'error_code']);
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const fragment = url.split('#')[1] ?? '';
  for (const part of `${query}&${fragment}`.split('&')) {
    const pieces = part.split('=');
    try {
      const key = decodeURIComponent((pieces.shift() ?? '').replace(/\+/g, ' '));
      const value = decodeURIComponent(pieces.join('=').replace(/\+/g, ' '));
      if (allowed.has(key) && value) result[key as keyof RecoveryCallback] = value;
    } catch { result.error = 'invalid_callback'; }
  }
  return result;
}
export function hasRecoveryCallback(callback: RecoveryCallback): boolean {
  return !!(callback.code || callback.token_hash || callback.access_token || callback.error || callback.error_code);
}
export function validateRecoveryFields(email: string, token?: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Geçerli bir e-posta adresi girin.';
  if (token !== undefined && !new RegExp(`^\\d{${passwordRecoveryConfig.otpLength}}$`).test(token.trim())) {
    return `E-postanızdaki ${passwordRecoveryConfig.otpLength} haneli sıfırlama kodunu girin.`;
  }
  return null;
}
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < passwordRecoveryConfig.minimumPasswordLength) return `Yeni şifre en az ${passwordRecoveryConfig.minimumPasswordLength} karakter olmalıdır.`;
  if (password !== confirmation) return 'Şifreler eşleşmiyor.';
  return null;
}
export async function sendPasswordRecovery(email: string, redirectTo: string): Promise<{ error: string | null }> {
  const invalid = validateRecoveryFields(email);
  if (invalid) return { error: invalid };
  try {
    // Does not create users, assign roles, change approvals or update profile data.
    const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return { error: error?.message ?? null };
  } catch (reason) { return { error: failure(reason).error }; }
}
export async function verifyPasswordRecoveryCode(email: string, token: string): Promise<RecoveryResult> {
  const invalid = validateRecoveryFields(email, token);
  if (invalid) return { userId: null, error: invalid };
  try {
    const { data, error } = await client().auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'recovery' });
    if (error || !data.user || !data.session) return { userId: null, error: error?.message ?? 'Kod doğrulanamadı. Yeni sıfırlama e-postası isteyin.' };
    return { userId: data.user.id, error: null };
  } catch (reason) { return failure(reason); }
}
export function verifyPasswordRecoveryCallback(callback: RecoveryCallback): Promise<RecoveryResult> {
  if (callback.error || callback.error_code) return Promise.resolve({ userId: null, error: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş. Yeni sıfırlama e-postası isteyin.' });
  if (callback.type && callback.type !== 'recovery') return Promise.resolve({ userId: null, error: 'Bu bağlantı şifre sıfırlama için kullanılamaz.' });
  const key = callback.code || callback.token_hash || callback.access_token;
  if (!key) return Promise.resolve({ userId: null, error: 'Sıfırlama bağlantısı eksik. Yeni e-posta isteyin.' });
  const existing = callbackRequests.get(key);
  if (existing) return existing;
  const request = (async (): Promise<RecoveryResult> => {
    try {
      const auth = client().auth;
      const response = callback.code
        ? await auth.exchangeCodeForSession(callback.code)
        : callback.token_hash
          ? await auth.verifyOtp({ token_hash: callback.token_hash, type: 'recovery' })
          : callback.type === 'recovery' && callback.access_token && callback.refresh_token
            ? await auth.setSession({ access_token: callback.access_token, refresh_token: callback.refresh_token })
            : null;
      if (!response) return { userId: null, error: 'Sıfırlama bağlantısı eksik veya geçersiz.' };
      if (response.error || !response.data.user || !response.data.session) return { userId: null, error: response.error?.message ?? 'Sıfırlama oturumu doğrulanamadı.' };
      return { userId: response.data.user.id, error: null };
    } catch (reason) { return failure(reason); }
  })();
  if (callbackRequests.size >= 20) callbackRequests.delete(callbackRequests.keys().next().value as string);
  callbackRequests.set(key, request);
  return request;
}
export async function closePasswordRecovery(): Promise<{ error: string | null }> {
  try {
    // The recovery session must not become a normal login. Other devices stay signed in.
    const { error } = await client().auth.signOut({ scope: 'local' });
    if (error) return { error: error.message };
    callbackRequests.clear();
    return { error: null };
  } catch (reason) { return { error: failure(reason).error }; }
}
export async function updateRecoveredPassword(userId: string, password: string, confirmation: string): Promise<{ updated: boolean; error: string | null }> {
  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return { updated: false, error: invalid };
  try {
    const { data: sessionData, error: sessionError } = await client().auth.getUser();
    if (sessionError || !sessionData.user || sessionData.user.id !== userId) return { updated: false, error: 'Sıfırlama oturumunuz sona erdi. Yeni e-posta isteyin.' };
    const { data, error } = await client().auth.updateUser({ password });
    if (error || !data.user) return { updated: false, error: error?.message ?? 'Şifre güncellenemedi.' };
    const closed = await closePasswordRecovery();
    return { updated: true, error: closed.error };
  } catch (reason) { return { updated: false, error: failure(reason).error }; }
}
