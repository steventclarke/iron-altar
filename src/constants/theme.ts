/**
 * Iron Altar design tokens.
 *
 * Palette: a SNES "Chrono Trigger"-inspired set pushed darker / goth.
 * The app is intentionally dark-first (dungeon aesthetic), but tokens are
 * structured so additional themes can be layered on later.
 */

import { Platform } from 'react-native';

export const Palette = {
  // Fills
  void: '#0C0A12',
  background: '#14111F',
  surface: '#1E1A2E',
  surfaceRaised: '#292338',
  surfacePressed: '#332B45',

  // Lines & chrome
  border: '#3B3357',
  borderBright: '#574B7E',

  // Brand
  gold: '#C9A24B',
  goldDim: '#8A6E2F',
  crimson: '#B03A48',
  crimsonDim: '#7A2733',
  arcane: '#4E8D8A',

  // Text
  text: '#EDE6D6',
  textSecondary: '#A79FC0',
  textMuted: '#6B6484',

  // Status
  success: '#6FBF73',
  danger: '#D9534F',
  xpUp: '#7BD88F',
  xpDown: '#E06C75',
} as const;

export const Colors = {
  dark: {
    text: Palette.text,
    textSecondary: Palette.textSecondary,
    textMuted: Palette.textMuted,
    background: Palette.background,
    backgroundElement: Palette.surface,
    backgroundSelected: Palette.surfaceRaised,
    border: Palette.border,
    primary: Palette.gold,
    accent: Palette.crimson,
  },
} as const;

export type ThemeColor = keyof (typeof Colors)['dark'];

export const Fonts = {
  /** Pixel display face — headings, short labels. */
  display: 'PressStart2P_400Regular',
  /** Readable pixel face — body copy, numbers. */
  body: 'VT323_400Regular',
  mono: Platform.select({ web: 'var(--font-mono)', default: 'monospace' }) ?? 'monospace',
} as const;

export const FontSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 26,
  xl: 32,
  xxl: 44,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
} as const;

/** Hard-edged border widths keep the 8-bit look (no soft shadows). */
export const Border = {
  hairline: 1,
  thick: 3,
} as const;

export const MaxContentWidth = 800;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
