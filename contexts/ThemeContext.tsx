import React, { createContext, useCallback, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { Appearance } from 'react-native';
import { darkColors, lightColors, mustardColors, pinkColors, ResolvedThemeMode, ThemeColors, ThemeMode } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { readThemePreference, resolveTheme, saveThemePreference } from '@/services/themePreferenceService';
export type { ThemeMode } from '@/constants/theme';

export interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  ready: boolean;
  preferenceError: string;
  setMode: (mode: ThemeMode) => void;
}
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { authUser, loading } = useAuth();
  const scope = authUser?.id ?? 'guest';
  const [preference, setPreference] = useState<{ scope: string; mode: ThemeMode } | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const writes = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(() => {
    const update = () => setSystemDark(Appearance.getColorScheme() === 'dark');
    update();
    const subscription = Appearance.addChangeListener(update);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (loading) return;
    let active = true;
    const version = ++generation.current;
    setPreferenceError('');
    void writes.current.then(() => readThemePreference(scope)).then(mode => {
      if (active && generation.current === version) setPreference({ scope, mode });
    }).catch(() => {
      if (active && generation.current === version) {
        setPreference({ scope, mode: 'auto' });
        setPreferenceError('Kayıtlı tema okunamadı. Varsayılan tema kullanılıyor.');
      }
    });
    return () => { active = false; };
  }, [scope, loading]);
  const mode = preference?.scope === scope ? preference.mode : 'auto';
  const resolvedMode = resolveTheme(mode, authUser?.gender, systemDark);
  const isDark = resolvedMode === 'dark';
  const colors = resolvedMode === 'mustard' ? mustardColors : isDark ? darkColors : resolvedMode === 'pink' ? pinkColors : lightColors;
  const ready = !loading && preference?.scope === scope;
  const setMode = useCallback((next: ThemeMode) => {
    ++generation.current;
    setPreference({ scope, mode: next });
    setPreferenceError('');
    writes.current = writes.current.catch(() => {}).then(() => saveThemePreference(scope, next)).catch(() => {
      if (currentScope.current === scope) setPreferenceError('Tema bu oturumda değişti ancak cihaza kaydedilemedi. Yeniden seçerek deneyin.');
    });
  }, [scope]);
  const value = useMemo(() => ({ mode, resolvedMode, isDark, colors, ready, preferenceError, setMode }), [mode, resolvedMode, isDark, colors, ready, preferenceError, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
