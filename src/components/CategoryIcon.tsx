// ─── CategoryIcon ───────────────────────────────────────────────────
// Renders a product's category illustration as a flat duotone SVG glyph
// on a tinted rounded tile. Used as the primary product visual across
// the POS grid, the products list, and the product editor. Falls back
// to a neutral cube glyph for products with no / unknown category.
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../utils/theme';
import BeveragesIcon from '../assets/icons/category-beverages.svg';
import SnacksIcon from '../assets/icons/category-snacks.svg';
import GroceryIcon from '../assets/icons/category-grocery.svg';
import HouseholdIcon from '../assets/icons/category-household.svg';
import PersonalIcon from '../assets/icons/category-personal.svg';

type Entry = { Icon: React.FC<any>; glyph: string; tile: string };

// Keyed by the fixed category names from seedData.ts.
const REGISTRY: Record<string, Entry> = {
  'Beverages':     { Icon: BeveragesIcon, glyph: COLORS.info,        tile: COLORS.info + '14' },
  'Snacks':        { Icon: SnacksIcon,    glyph: COLORS.accentDark,  tile: COLORS.accentLight },
  'Grocery':       { Icon: GroceryIcon,   glyph: COLORS.primary,     tile: COLORS.primarySoft },
  'Household':     { Icon: HouseholdIcon, glyph: COLORS.roleManager, tile: COLORS.roleManager + '14' },
  'Personal Care': { Icon: PersonalIcon,  glyph: COLORS.success,     tile: COLORS.success + '14' },
};

// True when an icon exists for this category — lets callers branch.
export function hasCategoryIcon(category?: string | null): boolean {
  return !!category && category in REGISTRY;
}

type Props = {
  category?: string | null;
  size?: number;                 // tile width/height in px
  radius?: number;               // tile corner radius
  style?: StyleProp<ViewStyle>;
};

export default function CategoryIcon({ category, size = 96, radius = RADIUS.md, style }: Props) {
  const entry = category ? REGISTRY[category] : undefined;
  const glyphSize = Math.round(size * 0.58);

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius, backgroundColor: entry ? entry.tile : COLORS.surfaceAlt },
        style,
      ]}
    >
      {entry
        ? <entry.Icon width={glyphSize} height={glyphSize} color={entry.glyph} />
        : <Ionicons name="cube-outline" size={Math.round(glyphSize * 0.78)} color={COLORS.textLight} />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
