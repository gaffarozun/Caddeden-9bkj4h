import { withRequestTimeout } from './requestTimeoutService';

// Narrow port also permits regression checks without touching a real account.
export interface SessionLogoutClient {
  signOut: (options: { scope: 'local' }) => Promise<{ error: unknown }>;
  getSession: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  // Compatibility fallback for SDK versions that return a stale-session 403
  // before removing credentials. Use the existing SDK's own storage cleanup;
  // never guess storage keys, clear all device storage, or create another client.
  _removeSession?: () => Promise<void>;
}

export function isMissingLogoutSession(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;
  const error = reason as { status?: number; code?: string; message?: string };
  return [401, 403, 404].includes(error.status ?? 0)
    || ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error.code ?? '')
    || /session from session_id claim in jwt does not exist|auth session missing/i.test(error.message ?? '');
}

function logoutMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === 'object' && 'message' in reason && typeof reason.message === 'string') return reason.message;
  return 'Çıkış tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.';
}

async function readSession(auth: SessionLogoutClient): Promise<unknown | null> {
  const { data, error } = await withRequestTimeout(auth.getSession(), 'Cihaz oturumu doğrulanamadı. Yeniden deneyin.');
  if (error) throw error;
  return data.session;
}

export async function logoutCurrentSession(auth: SessionLogoutClient): Promise<void> {
  let failure: unknown = null;
  try {
    // Only this device/session: ordinary logout must not revoke other devices.
    const { error } = await auth.signOut({ scope: 'local' });
    failure = error;
  } catch (reason) { failure = reason; }

  let remaining: unknown | null;
  try { remaining = await readSession(auth); }
  catch (reason) {
    if (!isMissingLogoutSession(reason)) throw new Error(logoutMessage(reason));
    remaining = true;
    failure = failure ?? reason;
  }
  // A subscriber may fail after the SDK already removed persisted credentials.
  if (remaining === null) return;
  if (failure && !isMissingLogoutSession(failure)) throw new Error(logoutMessage(failure));

  if (typeof auth._removeSession !== 'function') {
    throw new Error('Cihaz oturumu temizlenemedi. Uygulamayı yeniden açıp tekrar deneyin.');
  }
  let cleanupFailure: unknown = null;
  try { await auth._removeSession(); }
  catch (reason) { cleanupFailure = reason; }
  // Never claim success by merely clearing the React profile: persisted SDK
  // credentials must be gone too, including after an expired/revoked session.
  if (await readSession(auth) !== null) {
    throw new Error(logoutMessage(cleanupFailure));
  }
}
