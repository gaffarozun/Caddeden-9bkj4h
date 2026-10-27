// In-memory tests only: no network, passwords, accounts or device storage.
import { isMissingLogoutSession, logoutCurrentSession, SessionLogoutClient } from '../services/sessionLogoutService';
function assert(condition: boolean, message: string): void { if (!condition) throw new Error(message); }

export async function runSessionLogoutChecks(): Promise<string> {
  assert(isMissingLogoutSession({ status: 403, code: 'session_not_found' }), 'Revoked-session 403 must allow device cleanup.');
  assert(isMissingLogoutSession({ status: 401 }), 'Expired-session 401 must allow cleanup.');
  assert(!isMissingLogoutSession({ status: 500 }), 'A server failure must not be treated as a missing session.');
  assert(!isMissingLogoutSession(new Error('Network request failed')), 'Network errors are not missing-session errors.');

  let session: unknown | null = { test: true };
  let fallbackCalls = 0;
  let scope = '';
  const auth: SessionLogoutClient = {
    signOut: async options => { scope = options.scope; session = null; return { error: null }; },
    getSession: async () => ({ data: { session }, error: null }),
    _removeSession: async () => { fallbackCalls++; session = null; },
  };
  await logoutCurrentSession(auth);
  assert(scope === 'local' && session === null && fallbackCalls === 0, 'Normal logout removes this session without global revocation or fallback.');

  session = { test: true };
  auth.signOut = async () => ({ error: { status: 403, code: 'session_not_found' } });
  await logoutCurrentSession(auth);
  assert(session === null && fallbackCalls === 1, 'Stale 403 must remove persisted SDK credentials.');
  await logoutCurrentSession(auth);
  assert(fallbackCalls === 1, 'Already signed-out retries must be idempotent.');

  session = { test: true };
  auth.signOut = async () => ({ error: new Error('Network request failed') });
  let failed = false;
  try { await logoutCurrentSession(auth); } catch { failed = true; }
  assert(failed && session !== null && fallbackCalls === 1, 'A genuine failure must not falsely report logout or erase the profile.');

  auth.signOut = async () => { session = null; throw new Error('Subscriber failed'); };
  await logoutCurrentSession(auth);
  assert(session === null, 'Subscriber errors after credential removal must not trap the user.');

  session = { test: true };
  auth.signOut = async () => ({ error: { status: 403 } });
  auth._removeSession = async () => {};
  failed = false;
  try { await logoutCurrentSession(auth); } catch { failed = true; }
  assert(failed, 'Successful UI logout requires verified removal, not a no-op cleanup.');
  return 'passed: local scope, revoked sessions, repeated logout, persisted cleanup verification, network and subscriber errors';
}
