import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { passwordRecoveryConfig } from '@/constants/passwordRecovery';
import {
  RecoveryCallback, closePasswordRecovery, hasRecoveryCallback, parseRecoveryUrl,
  sendPasswordRecovery, updateRecoveredPassword, validateNewPassword, validateRecoveryFields,
  verifyPasswordRecoveryCallback, verifyPasswordRecoveryCode,
} from '@/services/passwordRecoveryService';

export type RecoveryRouteParams = Record<string, string | string[] | undefined>;
type RecoveryStage = 'email' | 'sent' | 'password' | 'success';
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function usePasswordRecovery(params: RecoveryRouteParams) {
  const router = useRouter();
  const navigation = useNavigation();
  const auth = useAuth();
  const authRef = useRef(auth);
  authRef.current = auth;
  const [stage, setStage] = useState<RecoveryStage>('email');
  const [email, setEmail] = useState(first(params.email) ?? '');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [redirectUrl, setRedirectUrl] = useState(passwordRecoveryConfig.nativeRedirect);
  const alive = useRef(true);
  const locked = useRef(false);
  const allowRemove = useRef(false);
  const seenCallbacks = useRef(new Set<string>());
  const verifiedUser = useRef<string | null>(null);
  const callbackKey = JSON.stringify({ code: first(params.code), token_hash: first(params.token_hash),
    access_token: first(params.access_token), refresh_token: first(params.refresh_token),
    type: first(params.type), error: first(params.error), error_code: first(params.error_code) });
  const callback = useMemo<RecoveryCallback>(() => JSON.parse(callbackKey), [callbackKey]);

  useEffect(() => {
    alive.current = true;
    if (Platform.OS === 'web') setRedirectUrl(Linking.createURL('password-reset'));
    return () => { alive.current = false; };
  }, []);
  const coolingDown = resendSeconds > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setResendSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);
  useEffect(() => {
    if (auth.recoveryUserId) {
      verifiedUser.current = auth.recoveryUserId;
      setStage(current => current === 'success' ? current : 'password');
    }
  }, [auth.recoveryUserId]);

  const release = useCallback(() => {
    locked.current = false;
    if (alive.current) setBusy(false);
  }, []);
  const consumeCallback = useCallback(async (input: RecoveryCallback) => {
    if (!hasRecoveryCallback(input) || locked.current || authRef.current.operationLoading) return;
    if (input.type && input.type !== 'recovery') {
      setError('Bu bağlantı şifre sıfırlama için kullanılamaz.');
      return;
    }
    const fingerprint = JSON.stringify(input);
    if (seenCallbacks.current.has(fingerprint)) return;
    seenCallbacks.current.add(fingerprint);
    // Web auto-detection can complete PKCE before this component mounts.
    if (authRef.current.recoveryUserId && !input.error && !input.error_code) {
      verifiedUser.current = authRef.current.recoveryUserId;
      setStage('password');
      return;
    }
    locked.current = true; setBusy(true); setError('');
    authRef.current.beginPasswordRecovery();
    try {
      const result = await verifyPasswordRecoveryCallback(input);
      const userId = result.userId ?? authRef.current.recoveryUserId;
      if (!alive.current) {
        const closed = await closePasswordRecovery();
        if (!closed.error) authRef.current.endPasswordRecovery();
        return;
      }
      if (!result.error || (userId && !input.error && !input.error_code)) {
        if (!userId) { setError('Sıfırlama oturumu bulunamadı. Yeni e-posta isteyin.'); return; }
        verifiedUser.current = userId;
        authRef.current.beginPasswordRecovery(userId);
        setStage('password');
      } else {
        const closed = await closePasswordRecovery();
        if (!closed.error) authRef.current.endPasswordRecovery();
        verifiedUser.current = null;
        setError(closed.error ?? result.error);
        setStage('email');
      }
    } finally { release(); }
  }, [release]);

  useEffect(() => {
    if (!busy) void consumeCallback(callback);
  }, [callback, consumeCallback, busy]);
  useEffect(() => {
    const handleUrl = (url: string) => {
      const route = url.split(/[?#]/)[0].replace(/\/+$/, '');
      if (!route.endsWith('/password-reset') && route !== passwordRecoveryConfig.nativeRedirect) return;
      void consumeCallback(parseRecoveryUrl(url));
    };
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    void Linking.getInitialURL().then(url => { if (alive.current && url) handleUrl(url); }).catch(() => {});
    // Expo Router may expose query params but not implicit-flow hash tokens on web.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (hasRecoveryCallback(parseRecoveryUrl(currentUrl))) {
        handleUrl(currentUrl);
        if (!busy) window.history.replaceState(window.history.state, '', window.location.pathname);
      }
    }
    return () => subscription.remove();
  }, [consumeCallback, busy]);

  useEffect(() => navigation.addListener('beforeRemove', event => {
    if (allowRemove.current || !authRef.current.passwordRecovery) return;
    event.preventDefault();
    if (locked.current) { setError('İşlemin tamamlanmasını bekleyin.'); return; }
    locked.current = true; setBusy(true);
    void closePasswordRecovery().then(result => {
      if (result.error) { if (alive.current) setError(result.error); return; }
      authRef.current.endPasswordRecovery();
      allowRemove.current = true;
      navigation.dispatch(event.data.action);
    }).finally(release);
  }), [navigation, release]);

  const send = useCallback(async () => {
    if (locked.current || authRef.current.operationLoading || resendSeconds > 0) return;
    const invalid = validateRecoveryFields(email);
    if (invalid) { setError(invalid); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await sendPasswordRecovery(email, redirectUrl);
      if (!alive.current) return;
      if (result.error) setError(result.error);
      else { setStage('sent'); setToken(''); setResendSeconds(passwordRecoveryConfig.resendSeconds); }
    } finally { release(); }
  }, [email, redirectUrl, resendSeconds, release]);
  const verifyCode = useCallback(async () => {
    if (locked.current || authRef.current.operationLoading) return;
    const invalid = validateRecoveryFields(email, token);
    if (invalid) { setError(invalid); return; }
    locked.current = true; setBusy(true); setError('');
    authRef.current.beginPasswordRecovery();
    try {
      const result = await verifyPasswordRecoveryCode(email, token);
      if (!alive.current) {
        const closed = await closePasswordRecovery();
        if (!closed.error) authRef.current.endPasswordRecovery();
        return;
      }
      if (result.error || !result.userId) {
        const closed = await closePasswordRecovery();
        if (!closed.error) authRef.current.endPasswordRecovery();
        setError(closed.error ?? result.error ?? 'Kod doğrulanamadı.');
        setStage('sent');
      } else {
        verifiedUser.current = result.userId;
        authRef.current.beginPasswordRecovery(result.userId);
        setStage('password');
      }
    } finally { release(); }
  }, [email, token, release]);
  const savePassword = useCallback(async () => {
    if (locked.current || authRef.current.operationLoading) return;
    const invalid = validateNewPassword(password, confirmation);
    if (invalid) { setError(invalid); return; }
    const userId = verifiedUser.current;
    if (!userId) { setError('Önce e-postanızdaki sıfırlama bağlantısını veya kodunu doğrulayın.'); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await updateRecoveredPassword(userId, password, confirmation);
      if (result.updated && !result.error) authRef.current.endPasswordRecovery();
      if (!alive.current) return;
      if (result.updated) {
        setStage('success'); setPassword(''); setConfirmation(''); setToken('');
        verifiedUser.current = null;
        if (result.error) setError(`Şifreniz değişti ancak sıfırlama oturumu kapatılamadı: ${result.error}`);
      } else setError(result.error ?? 'Şifre değiştirilemedi.');
    } finally { release(); }
  }, [password, confirmation, release]);
  const exit = useCallback(async () => {
    if (locked.current || authRef.current.operationLoading) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (authRef.current.passwordRecovery) {
        const result = await closePasswordRecovery();
        if (result.error) { if (alive.current) setError(result.error); return; }
        authRef.current.endPasswordRecovery();
      }
      allowRemove.current = true;
      router.replace('/auth');
    } finally { release(); }
  }, [router, release]);
  const changeEmail = useCallback(() => {
    if (locked.current) return;
    setStage('email'); setToken(''); setError(''); setResendSeconds(0);
  }, []);
  return { stage, email, setEmail, token, setToken, password, setPassword, confirmation, setConfirmation,
    error, busy: busy || auth.operationLoading, resendSeconds, send, verifyCode, savePassword, exit, changeEmail };
}
