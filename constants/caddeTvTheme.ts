import { darkColors } from '@/constants/theme';
import { universityColors } from '@/constants/universityTheme';

// Students discover local businesses in the user-provided neon lounge.
// Stage metaphor: the reference TV cabinet, clipped glass and a multicolor LED subtitle.
export const caddeTvColors = {
  room: darkColors.onPrimary, screen: darkColors.black, amber: darkColors.primaryDark,
  white: darkColors.white, muted: darkColors.textSubtle, glass: darkColors.overlayStrong,
  profileGlass: 'rgba(0,0,0,0.16)', profileBorder: 'rgba(255,255,255,0.18)', textShadow: darkColors.black,
  writeAccent: universityColors.cyan,
  remote: darkColors.surface, trim: darkColors.borderStrong, live: darkColors.success,
  transparent: 'transparent', roomGlow: 'rgba(53,234,255,0.10)', warmGlow: 'rgba(255,227,107,0.12)',
  staticLight: 'rgba(255,255,255,0.70)', staticDim: 'rgba(255,255,255,0.24)',
  staticDark: 'rgba(0,0,0,0.78)',
};
// Room, cabinet, screen and subtitle share the same uncropped 941 × 1672 canvas.
export const caddeTvLayout = {
  canvasWidth: 941, canvasHeight: 1672,
  screen: { left: 137 / 941, top: 432 / 1672, width: 660 / 941, height: 376 / 1672 },
  // The live subtitle joins the glass directly and shares its exact width.
  subtitle: { left: 137 / 941, top: 808 / 1672, width: 660 / 941, height: 63 / 1672 },
  // Mask the reference image's printed sample text, including its outer edges.
  printedSubtitle: { left: 56 / 941, top: 817 / 1672, width: 848 / 941, height: 63 / 1672 },
  screenCorner: 0.040, remoteWidth: 208, remoteTop: 0.784,
  infoTop: 0.664, maxStageWidth: 960,
};
// Overlay only the TV region, at exactly the same scale as the full local room image.
export const caddeTvStage = {
  sourceCropTop: 386, cabinetHeight: 510, heightRatio: 1672 / 941,
  tvScale: 1.34, tvTop: 0.22, subtitleSourceTop: 808, subtitleSourceHeight: 63,
  transitionMs: 240, autoAdvanceMs: 7000, pollMs: 10000,
};
export const caddeTvCreative = {
  id: 'cadde-tv', label: 'Cadde TV ekranı',
  // Preserve the existing upload contract; contain fits legacy creatives to the new glass.
  value: (0.846 * 941) / (0.303 * 1672),
  recommendedWidth: 1584, recommendedHeight: 1008,
};
export const caddeTvCropRatios = [caddeTvCreative];
