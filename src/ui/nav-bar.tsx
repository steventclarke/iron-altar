import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { PixelText } from '@/ui/text';
import { Border, Palette, Radius, Spacing } from '@/constants/theme';
import { setPendingReportContext } from '@/lib/report-draft';
import { captureReportScreenshot } from '@/lib/screenshot';

type NavLink = {
  label: string;
  href: string;
};

const NAV_LINKS: NavLink[] = [
  { label: 'SESSION', href: '/' },
  { label: 'HISTORY', href: '/history' },
  { label: 'PROGRESS', href: '/progress' },
  { label: 'PROFILE', href: '/profile' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/session/') || pathname === '/rest-timer';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Persistent top navigation, rendered as a fixed `Screen` header on every
 * screen (refinement #7). Uses `navigate` so tapping a tab focuses it instead
 * of stacking duplicate screens.
 */
export function NavBar({ links = NAV_LINKS }: { links?: NavLink[] }) {
  const pathname = usePathname();

  const openReport = async () => {
    let screenshot = null;
    try {
      screenshot = await captureReportScreenshot();
    } catch {
      screenshot = null;
    }
    setPendingReportContext({ screenshot, route: pathname });
    router.push('/report' as never);
  };

  return (
    <View style={styles.bar}>
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Pressable
            key={link.href}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => router.navigate(link.href as never)}
            style={({ pressed }) => [
              styles.item,
              active && styles.activeItem,
              pressed && styles.pressed,
            ]}
          >
            <PixelText variant="label" color={active ? Palette.gold : Palette.textSecondary}>
              {link.label}
            </PixelText>
          </Pressable>
        );
      })}
      {pathname !== '/report' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Report an issue"
          onPress={() => void openReport()}
          style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}
        >
          <PixelText variant="label" color={Palette.crimson}>
            !
          </PixelText>
        </Pressable>
      ) : null}
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
  activeItem: {
    backgroundColor: Palette.surfaceRaised,
    borderBottomWidth: Border.thick,
    borderBottomColor: Palette.gold,
  },
  pressed: {
    backgroundColor: Palette.surfacePressed,
  },
  reportButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    borderWidth: Border.thick,
    borderColor: Palette.crimsonDim,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.one,
  },
});
