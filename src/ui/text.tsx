import { Text, type TextProps, type TextStyle } from 'react-native';

import { Fonts, FontSizes, Palette } from '@/constants/theme';

type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption';

const VARIANTS: Record<Variant, TextStyle> = {
  title: { fontFamily: Fonts.display, fontSize: FontSizes.lg, lineHeight: 40 },
  heading: { fontFamily: Fonts.display, fontSize: FontSizes.sm, lineHeight: 26 },
  subheading: { fontFamily: Fonts.body, fontSize: FontSizes.lg, lineHeight: 26 },
  body: { fontFamily: Fonts.body, fontSize: FontSizes.md, lineHeight: 24 },
  label: { fontFamily: Fonts.display, fontSize: FontSizes.xs, lineHeight: 20, letterSpacing: 1 },
  caption: { fontFamily: Fonts.body, fontSize: FontSizes.sm, lineHeight: 18 },
};

export type PixelTextProps = TextProps & {
  variant?: Variant;
  color?: string;
};

export function PixelText({
  variant = 'body',
  color = Palette.text,
  style,
  ...rest
}: PixelTextProps) {
  return <Text style={[VARIANTS[variant], { color }, style]} {...rest} />;
}
