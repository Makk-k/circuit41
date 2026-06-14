// Circuit 41 — shared mobile design system.
// Warm, neutral, calm. Accent (#CD643D) is used SPARINGLY: selected states, primary CTAs,
// small badges/highlights. Keep surfaces neutral; never flood the app with accent.

export const colors = {
  // Surfaces
  bg:           '#F7F6F0',   // warm neutral app background
  surface:      '#FFFFFF',   // cards / sheets
  surfaceAlt:   '#F1EFE9',   // subtle fills (chips, inset rows)
  // Lines
  border:       '#E8E6DF',   // soft hairline
  borderStrong: '#D9D7D0',
  // Text
  text:          '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',
  // C41 accent (use sparingly)
  accent:           '#CD643D',
  accentText:       '#9A3B1C',
  accentSoftBg:     'rgba(205,100,61,0.10)',
  accentSoftBorder: 'rgba(205,100,61,0.30)',
  // Status (kept for shipment statuses)
  successText: '#15803D',
  successBg:   '#DCFCE7',
  warnText:    '#92400E',
  warnBg:      '#FEF3C7',
  infoText:    '#1E40AF',
  infoBg:      '#DBEAFE',
  // Bottom nav
  navSurface:  '#FFFFFF',
  navActive:   '#CD643D',
  navInactive: '#9A968D',
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

export const font = {
  regular:  'PlusJakartaSans_400Regular',
  medium:   'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold:     'PlusJakartaSans_700Bold',
} as const;

// Soft, premium shadows (iOS shadow* + Android elevation).
export const shadow = {
  card: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  nav: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
} as const;

export const theme = { colors, radius, space, font, shadow } as const;
export default theme;
