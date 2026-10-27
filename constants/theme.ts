// Caddeden: one smooth, layered stage across discovery, profiles and panels.
import { Platform } from 'react-native';

export type ThemeMode = 'auto' | 'mustard' | 'light' | 'dark' | 'pink' | 'system';
export type ResolvedThemeMode = Exclude<ThemeMode, 'auto' | 'system'>;

export const darkColors = {
  background: '#07090A', surface: '#111416', surfaceAlt: '#15191C', surfaceTint: '#1C2023',
  primary: '#F1C77F', primaryDark: '#F5D396', primarySoft: '#30271B', onPrimary: '#21190E', brand: '#F1C77F',
  text: '#F6F6F5', textSubtle: '#ADB0BC', textFaint: '#949AA5',
  border: '#272C30', borderStrong: '#41474C',
  success: '#46D18A', successSoft: '#133624', warning: '#F1C77F', warningSoft: '#30271B',
  danger: '#FF7C85', dangerSoft: '#3C1D20', info: '#91BAF3',
  overlay: 'rgba(0,0,0,0.6)', overlayStrong: 'rgba(0,0,0,0.86)', white: '#FFFFFF', black: '#000000',
};
export type ThemeColors = typeof darkColors;

export const lightColors: ThemeColors = {
  background: '#F7F3EB', surface: '#FFFCF6', surfaceAlt: '#F0E9DE', surfaceTint: '#E9DFD0',
  primary: '#78521C', primaryDark: '#684418', primarySoft: '#EEE0C7', onPrimary: '#FFFFFF', brand: '#C59A51',
  text: '#252019', textSubtle: '#685D50', textFaint: '#776B5D',
  border: '#DED3C2', borderStrong: '#B5A58C',
  success: '#246444', successSoft: '#E0EEE4', warning: '#78521C', warningSoft: '#EEE0C7',
  danger: '#AF3443', dangerSoft: '#F7E1E3', info: '#345F92',
  overlay: 'rgba(24,20,16,0.6)', overlayStrong: 'rgba(24,20,16,0.85)', white: '#FFFFFF', black: '#000000',
};

// Reference pink is the brand surface; darker rose keeps text and CTAs legible.
export const pinkColors: ThemeColors = {
  background: '#FCE7EC', surface: '#FFF5F7', surfaceAlt: '#F8D4DD', surfaceTint: '#F4C1CF',
  primary: '#A32D4A', primaryDark: '#89233D', primarySoft: '#F5BCCB', onPrimary: '#FFFFFF', brand: '#FA718A',
  text: '#3B1723', textSubtle: '#754354', textFaint: '#805061',
  border: '#E4ABB9', borderStrong: '#BD788D',
  success: '#226140', successSoft: '#DDEBE2', warning: '#7C531F', warningSoft: '#F4E2C7',
  danger: '#A72C40', dangerSoft: '#F5CCD5', info: '#3A588C',
  overlay: 'rgba(48,16,28,0.6)', overlayStrong: 'rgba(48,16,28,0.86)', white: '#FFFFFF', black: '#000000',
};

// Shared bright orange + mustard identity for guests and every account type.
// Luminous golden surfaces and vivid orange accents; darker action/text tokens preserve contrast.
export const mustardColors: ThemeColors = {
  background: '#FFDF70', surface: '#FFF4BE', surfaceAlt: '#FFD64F', surfaceTint: '#FFCA36',
  primary: '#B34006', primaryDark: '#8B3005', primarySoft: '#FFD34C', onPrimary: '#FFFFFF', brand: '#FF850A',
  text: '#38230F', textSubtle: '#67441D', textFaint: '#6B4B22',
  border: '#E7B43D', borderStrong: '#AD751B',
  success: '#246044', successSoft: '#E1EBD0', warning: '#725018', warningSoft: '#FFD34C',
  danger: '#A52E28', dangerSoft: '#F8D9CB', info: '#34516F',
  overlay: 'rgba(56,35,15,0.6)', overlayStrong: 'rgba(56,35,15,0.86)', white: '#FFFFFF', black: '#000000',
};

// Static exports are fallback tokens only. Rendered UI must consume useTheme.
export const colors = lightColors;
export const businessProfileColors = lightColors;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, xxl: 28, pill: 999 };
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, xxxl: 34 };
export const fontWeight = { regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const };
export const shadow = {
  sm: Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 }, default: {} }),
  md: Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 5 }, default: {} }),
  lg: Platform.select({ ios: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }, android: { elevation: 9 }, default: {} }),
};
export const businessProfileLayout = { maxWidth: 960, coverRatio: 2.06, menuCoverRatio: 2.22, actionHeight: 60, menuButtonHeight: 48, campaignHeight: 60, menuRowHeight: 80, menuImageSize: 68, logoSize: 60, tabHeight: 52 };
export const theme = { colors, spacing, radius, fontSize, fontWeight, shadow };
export type Theme = typeof theme;
