// ─── RetailPOS Design Tokens (Modern POS · Deep Teal + Amber) ───────────────
export const COLORS = {
  // Brand
  primary:       '#0F766E',   // Deep Teal
  primaryDark:   '#115E59',
  primaryLight:  '#CCFBF1',
  primarySoft:   '#E6FFFA',

  // Accent
  accent:        '#F59E0B',   // Amber – CTAs, highlights
  accentDark:    '#B45309',
  accentLight:   '#FEF3C7',

  // Status
  secondary:     '#10B981',   // Success / cash green
  success:       '#10B981',
  danger:        '#EF4444',
  warning:       '#F59E0B',
  info:          '#0EA5E9',

  // Neutrals (slate)
  white:         '#FFFFFF',
  background:    '#F1F5F9',   // slate-100
  surface:       '#FFFFFF',
  surfaceAlt:    '#F8FAFC',
  border:        '#E2E8F0',   // slate-200
  divider:       '#EEF2F6',

  // Text
  text:          '#0F172A',   // slate-900
  textSecond:    '#475569',   // slate-600
  textLight:     '#94A3B8',   // slate-400
  textOnPrimary: '#FFFFFF',
  textOnAccent:  '#1F2937',

  // Roles
  roleAdmin:     '#0F766E',
  roleManager:   '#7C3AED',
  roleCashier:   '#10B981',

  // Payment methods
  cashColor:     '#10B981',
  gcashColor:    '#2563EB',
  cardColor:     '#7C3AED',
};

export const FONTS = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
  sizes: {
    xs:   11,
    sm:   13,
    md:   15,
    lg:   17,
    xl:   20,
    xxl:  24,
    xxxl: 30,
  },
};

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
};

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  full: 999,
};

export const SHADOW = {
  small: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  large: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
};
