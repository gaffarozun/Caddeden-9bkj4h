import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ResolvedThemeMode, ThemeMode } from '@/constants/theme';

const prefix = 'caddeden-appearance-v2';
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'mustard' || value === 'light' || value === 'dark' || value === 'pink' || value === 'system';
}
// Keep the existing API, but gender no longer changes the default appearance.
export function defaultThemeForGender(_gender?: string | null): 'light' {
  return 'light';
}
export function resolveTheme(mode: ThemeMode, gender: string | null | undefined, systemDark: boolean): ResolvedThemeMode {
  if (mode === 'auto') return defaultThemeForGender(gender);
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  return mode;
}
export async function readThemePreference(scope: string): Promise<ThemeMode> {
  const stored = await AsyncStorage.getItem(`${prefix}:${scope}`);
  if (isThemeMode(stored)) return stored;
  // A former device-wide selection must not overwrite a new account default.
  if (scope === 'guest') {
    const legacy = await AsyncStorage.getItem('caddeden-theme-mode');
    if (isThemeMode(legacy)) return legacy;
  }
  return 'auto';
}
export async function saveThemePreference(scope: string, mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(`${prefix}:${scope}`, mode);
}
