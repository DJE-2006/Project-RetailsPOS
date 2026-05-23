// ─── Responsive layout helpers ──────────────────────────────────────────────
// Centralizes breakpoints and grid/column logic so every screen adapts
// consistently across small phones, large phones, tablets and the desktop
// browser (react-native-web).
//
// Always prefer the `useResponsive()` hook over Dimensions.get() — it is
// backed by useWindowDimensions(), so it re-renders on rotation and on
// browser-window resize.
import { useWindowDimensions } from 'react-native';

// ── Breakpoints (logical pixels) ────────────────────────────
// phone   : < 600   — small + large phones
// tablet  : 600–1023 — tablets, split-view
// desktop : >= 1024  — wide desktop browser windows
export const BREAKPOINTS = {
  tablet: 600,
  desktop: 1024,
} as const;

// Maximum width for centered, width-capped content (forms, dashboards,
// the POS layout). Beyond this the content is centered with side gutters
// instead of stretching edge to edge.
export const CONTENT_MAX_WIDTH = 1100;

// Narrower cap for single-column content like auth forms and modals.
export const FORM_MAX_WIDTH = 460;
export const MODAL_MAX_WIDTH = 520;

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export interface Responsive {
  width: number;
  height: number;
  device: DeviceClass;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  /** Product-grid column count, tuned per breakpoint. */
  columns: number;
  /** Generic card-grid column count (stat cards, lists). */
  gridColumns: number;
  /** Max content width the screen should cap to (centered beyond it). */
  contentMaxWidth: number;
}

const classify = (width: number): DeviceClass => {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
};

// Product grid: 2 cols on phone, 3-4 on tablet, 4-5 on wide desktop.
const productColumns = (width: number): number => {
  if (width >= 1500) return 5;
  if (width >= BREAKPOINTS.desktop) return 4;
  if (width >= 860) return 4;
  if (width >= BREAKPOINTS.tablet) return 3;
  return 2;
};

// Card grid (stat cards etc.): 2 on phone, 3 on tablet, 4 on desktop.
const cardColumns = (width: number): number => {
  if (width >= BREAKPOINTS.desktop) return 4;
  if (width >= BREAKPOINTS.tablet) return 3;
  return 2;
};

/**
 * Reactive responsive descriptor. Re-evaluates on resize / rotation.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const device = classify(width);
  return {
    width,
    height,
    device,
    isPhone: device === 'phone',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
    isLandscape: width > height,
    columns: productColumns(width),
    gridColumns: cardColumns(width),
    contentMaxWidth: CONTENT_MAX_WIDTH,
  };
}

/**
 * Compute a grid item width given the available container width, a column
 * count and the horizontal gap between items. Returns a pixel width that
 * makes `columns` items fit per row with even gaps.
 */
export function gridItemWidth(
  containerWidth: number,
  columns: number,
  gap: number,
): number {
  if (columns <= 1) return containerWidth;
  return Math.floor((containerWidth - gap * (columns - 1)) / columns);
}
