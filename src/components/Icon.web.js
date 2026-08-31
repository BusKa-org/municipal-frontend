/**
 * BusKá Icon Component - Web Version
 * 
 * Uses Material Icons font loaded via Google Fonts in index.html
 * This file is automatically used by webpack for web builds
 */

import React from 'react';
import { colors, iconSize as themeSizes } from '../theme';

export { IconNames } from './iconNames';

// Size presets mapping to theme
const sizeMap = {
  xs: themeSizes.xs,    // 12
  sm: themeSizes.sm,    // 16
  md: themeSizes.md,    // 20
  base: themeSizes.base, // 24 (default)
  lg: themeSizes.lg,    // 28
  xl: themeSizes.xl,    // 32
  xxl: themeSizes.xxl,  // 40
  huge: themeSizes.huge, // 48
};

// Map icon names from kebab-case to snake_case for Material Icons font
const normalizeIconName = (name) => {
  if (!name) return 'help_outline'; // fallback icon
  return name.replace(/-/g, '_');
};

/**
 * Web Icon component using Material Icons font
 *
 * @param {object} props
 * @param {string} props.name
 * @param {string | number} [props.size]
 * @param {string} [props.color]
 * @param {object} [props.style]
 */
const Icon = ({
  name,
  size = 'base',
  color = colors.text.primary,
  style = undefined,
  ...props
}) => {
  // Resolve size
  const resolvedSize = typeof size === 'string' 
    ? (sizeMap[size] || themeSizes.base) 
    : size;

  const iconStyle = {
    fontFamily: 'Material Icons',
    fontWeight: 'normal',
    fontStyle: 'normal',
    fontSize: resolvedSize,
    lineHeight: 1,
    letterSpacing: 'normal',
    textTransform: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    wordWrap: 'normal',
    direction: 'ltr',
    WebkitFontFeatureSettings: 'liga',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    color: color,
    width: resolvedSize,
    height: resolvedSize,
    ...style,
  };

  return (
    <span style={iconStyle} {...props}>
      {normalizeIconName(name)}
    </span>
  );
};

export default Icon;
