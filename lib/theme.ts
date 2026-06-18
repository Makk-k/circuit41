// Circuit 41 — shared mobile design system.
// Warm, neutral, calm. Accent (#CD643D) is used SPARINGLY: selected states, primary CTAs,
// small badges/highlights. Keep surfaces neutral; never flood the app with accent.

export const colors = {
  // Surfaces
  bg:           '#F5F9F6',   // warm neutral app background
  surface:      '#FFFFFF',   // cards / sheets
  surfaceAlt:   '#F1EFE9',   // subtle fills (chips, inset rows)
  // Lines
  border:       '#E8E6DF',   // soft hairline
  borderStrong: '#D9D7D0',
  // Text
  text:          '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted:     '#A0A0A0',

  // ── Design-system action colours ──────────────────────────────────────────
  // primary  → black: the dominant action colour for Continue / Submit / Save /
  //            Pay / Create / Next / Confirm (white text).
  // accent   → orange (#CD643D): used SPARINGLY for selected states, small
  //            indicators, active nav, status highlights, progress, links.
  // danger   → red: reserved for errors, destructive/delete/cancel, warnings ONLY.
  // The old Circuit red (#C10F1D) is fully retired and must not be reintroduced.
  primary:       '#1A1712',   // black primary-action background
  primaryText:   '#FFFFFF',
  danger:        '#DC2626',   // destructive / error red
  // C41 accent (use sparingly)
  accent:           '#CD643D',
  accentText:       '#9A3B1C',
  accentSoftBg:     'rgba(205,100,61,0.10)',
  accentSoftBorder: 'rgba(205,100,61,0.30)',
  accentOnDark:     '#E0875F',   // orange tuned for legibility on near-black

  // Premium dark surface — the ONE emphasis treatment (selected service, bank transfer,
  // warehouse card, hero). Solid near-black, never blue, never a loud gradient.
  dark:        '#1A1712',
  darkElevated:'#231F19',
  onDark:      '#FFFFFF',
  onDarkMuted: '#A39C8F',

  // Frosted nav (translucency over a BlurView)
  navFrost:    'rgba(247,246,240,0.72)',
  navPill:     'rgba(255,255,255,0.78)',
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
    shadowColor: '#28384F',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  dark: {
    shadowColor: '#140F08',
    shadowOpacity: 0.30,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
} as const;

// The ONE approved gradient — the dark premium hero/main card (no blue, restrained).
export const gradients = {
  heroDark: ['#2C2820', '#1A1712', '#100E0A'] as const,
} as const;

export const theme = { colors, radius, space, font, shadow } as const;
export default theme;
