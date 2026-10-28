import { Platform } from 'react-native';
import { spacing, fontSize } from './theme';

// A night-time street stage with warm orange/mustard lights; personal themes follow unchanged.
export const caddedenIntroColors = {
  background: '#08121F',
  text: '#FFF2D8',
  textSubtle: '#EACD9B',
  accent: '#FFB33C',
  transparent: '#08121F00',
  softOverlay: '#08121FCC',
};
export const caddedenIntroMotion = {
  // Web'de açılış, 1,7 sn'lik gece caddesi videosuna göre kısa tutulur.
  totalMs: Platform.OS === 'web' ? 2600 : 4200,
  exitMs: 280,
  titleDelayMs: 250,
  titleMs: 280,
  streetMs: Platform.OS === 'web' ? 2100 : 3700,
  streetStartScale: 1.01,
  streetEndScale: 1.18,
  streetTravel: spacing.lg,
  titleTravel: spacing.lg,
};
export const caddedenIntroLayout = {
  titleSize: fontSize.xxxl + spacing.lg,
  compactTitleSize: fontSize.xxxl,
  wordmarkMaxWidth: 440,
  landscapeWordmarkWidth: 320,
};
