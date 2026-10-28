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
  totalMs: 4200,
  exitMs: 280,
  titleDelayMs: 250,
  titleMs: 280,
  streetMs: 3700,
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
