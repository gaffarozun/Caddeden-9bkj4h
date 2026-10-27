import { createBusinessStyles } from '@/constants/businessProfileStyles';
import { useThemeStyles } from '@/hooks/useThemeStyles';
export function useBusinessTheme() {
  return useThemeStyles(createBusinessStyles);
}
