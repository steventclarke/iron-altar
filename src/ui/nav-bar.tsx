import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PixelText } from '@/ui/text';
import { Border, Palette, Radius, Spacing } from '@/constants/theme';

type NavLink = {
  label: string;
  href: string;
};

const SESSION_LINKS: NavLink[] = [
  { label: 'GYM', href: '/' },
  { label: 'HISTORY', href: '/history' },
  { label: 'PROGRESS', href: '/progress' },
  { label: 'PROFILE', href: '/profile' },
];

/**
 * Compact navigation bar for screens that sit outside the tab navigator (e.g.
 * the Session Log), so the user can jump back to the gym or history to
 * reference past sessions (refinement #9).
 */
export function NavBar({ links = SESSION_LINKS }: { links?: NavLink[] }) {
  return (
    <View style={styles.bar}>
      {links.map((link) => (
        <Pressable
          key={link.href}
          onPress={() => router.push(link.href as never)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <PixelText variant="label" color={Palette.textSecondary}>
            {link.label}
          </PixelText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    backgroundColor: Palette.surface,
    borderWidth: Border.thick,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.two,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  pressed: {
    backgroundColor: Palette.surfacePressed,
  },
});
