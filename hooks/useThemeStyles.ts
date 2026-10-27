import { useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { ThemeColors } from '@/constants/theme';
export function useThemeStyles<T>(factory: (colors: ThemeColors) => T) {
  const theme = useTheme();
  const styles = useMemo(() => factory(theme.colors), [factory, theme.colors]);
  return { ...theme, styles };
}
