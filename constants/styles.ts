// Powered by OnSpace.AI
import { StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSize, fontWeight, ThemeColors } from './theme';

export const createCommonStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex1: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSubtle,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: fontSize.md * 1.6,
  },
  pad: {
    padding: spacing.lg,
  },
});

// Fallback for non-rendering legacy references; UI uses createCommonStyles via useThemeStyles.
export const commonStyles = createCommonStyles(colors);
