// Clean, bright arcade palette. Stone types are told apart by shape/markings as well as colour,
// and colourblind mode swaps to an Okabe-Ito based set.

import type { StoneType } from '../config/gameConfig';

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

export const UI = {
  skyTop: 0x3a7bd5,
  skyBottom: 0x9fd8f5,
  ground: 0x4a3f63,
  groundTop: 0x6c5f8d,
  ink: 0x1f2340,
  inkCss: '#1f2340',
  white: 0xffffff,
  panel: 0x1f2340,
  primary: 0xffb627, // Play buttons
  primaryDark: 0xd98c00,
  secondary: 0x5ec2b7,
  secondaryDark: 0x3a9a8f,
  muted: 0x8f93b8,
  danger: 0xff6b6b,
  heart: 0xff5d73,
  coin: 0xffcf3f,
  bullet: 0xfff4c2,
};

export interface StoneColors {
  base: number;
  shade: number;
  light: number;
}

// Plain and armored stones are coloured by size, so colour tells you what splits into what:
// titan rock (red) -> mountain (blue) -> boulder (lime) -> big (purple) -> medium (teal) -> small (orange).
const BY_SIZE: StoneColors[] = [
  { base: 0xe5484d, shade: 0xa3262b, light: 0xff9a9d },
  { base: 0x3b82f6, shade: 0x1d4fb8, light: 0x9cc3ff },
  { base: 0x84cc16, shade: 0x55870b, light: 0xc6f07a },
  { base: 0x8b5cf6, shade: 0x5b34c4, light: 0xc9b6ff },
  { base: 0x14b8a6, shade: 0x0b7f74, light: 0x86eadc },
  { base: 0xff8a3d, shade: 0xd35f12, light: 0xffc495 },
];

const SPECIAL: Partial<Record<StoneType, StoneColors>> = {
  golden: { base: 0xf5c242, shade: 0xc98f12, light: 0xffe796 },
  bouncy: { base: 0xff4fa3, shade: 0xc22875, light: 0xffa8d2 },
  bomb: { base: 0x4b4458, shade: 0x2e2938, light: 0x6f6680 },
};

// Okabe-Ito based: stays distinct for the common colour vision types.
const BY_SIZE_CB: StoneColors[] = [
  { base: 0xd55e00, shade: 0x8f3f00, light: 0xf59a55 },
  { base: 0x56b4e9, shade: 0x2c86b8, light: 0x9ad4f5 },
  { base: 0x6b6b78, shade: 0x404048, light: 0xa5a5b2 },
  { base: 0x0072b2, shade: 0x004c78, light: 0x5aa9d6 },
  { base: 0x009e73, shade: 0x006a4d, light: 0x5fcca9 },
  { base: 0xe69f00, shade: 0xa87300, light: 0xffcb5c },
];

const SPECIAL_CB: Partial<Record<StoneType, StoneColors>> = {
  golden: { base: 0xf0e442, shade: 0xb8ad1c, light: 0xfff68f },
  bouncy: { base: 0xcc79a7, shade: 0x96507a, light: 0xe8b4d1 },
  bomb: { base: 0x4b4458, shade: 0x2e2938, light: 0x6f6680 },
};

export function stoneColors(type: StoneType, tier: number, colorblind: boolean): StoneColors {
  const special = (colorblind ? SPECIAL_CB : SPECIAL)[type];
  return special ?? (colorblind ? BY_SIZE_CB : BY_SIZE)[tier];
}

export function armorColor(colorblind: boolean): number {
  return colorblind ? 0xffffff : 0x3d8bff;
}

export function bombGlow(colorblind: boolean): number {
  return colorblind ? 0xd55e00 : 0xff5a36;
}

export const POWER_COLORS = {
  spread: 0xff9f1c,
  rapid: 0xff5d73,
  pierce: 0x9b5de5,
  shield: 0x3d8bff,
  freeze: 0x4cc9f0,
  magnet: 0x2ec4b6,
} as const;

export const POWER_LABELS = {
  spread: 'Spread',
  rapid: 'Rapid',
  pierce: 'Pierce',
  shield: 'Shield',
  freeze: 'Freeze',
  magnet: 'Magnet',
} as const;

/** Cannon body / trim colours per cannon on the ladder. */
export const CANNON_COLORS: Record<string, { body: number; light: number; trim: number }> = {
  classic: { body: 0x2b3a67, light: 0x4f6fd0, trim: 0xffb627 },
  blaster: { body: 0x7a1f2b, light: 0xe5484d, trim: 0xffd166 },
  twin: { body: 0x0f5c4c, light: 0x20b38f, trim: 0xfff1a8 },
  storm: { body: 0x3b1f7a, light: 0x8b5cf6, trim: 0x67e8f9 },
  titan: { body: 0x1c1c28, light: 0x4a4a63, trim: 0xffcf3f },
};

/** Bullet colour per in-run level (1..3). */
export const LEVEL_COLORS = [0xfff4c2, 0x8ff3ff, 0xff9cf5];
