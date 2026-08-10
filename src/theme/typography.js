/**
 * BusKá Typography System
 * 
 * Design Direction: Clean, Professional, Modern
 * 
 * Font Family: Inter (recommended) or System fonts
 * - Inter: Modern, highly readable, professional
 * - Fallback to system fonts for performance
 * 
 * To use custom fonts:
 * 1. npm install expo-font (if using Expo)
 * 2. Or link fonts manually for bare React Native
 */

import { Platform } from 'react-native';

// ===========================================
// FONT FAMILIES
// ===========================================

// System fonts for best performance
const systemFonts = Platform.select({
  ios: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
  android: {
    regular: 'Roboto',
    medium: 'Roboto-Medium',
    semiBold: 'Roboto-Medium',
    bold: 'Roboto-Bold',
  },
  web: {
    // Web uses CSS font-family stack
    regular: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    medium: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    semiBold: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    bold: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  default: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
});

// Custom fonts (when installed and loaded)
const customFonts = Platform.select({
  web: {
    // On web, use Inter with fallback stack (requires Inter to be loaded via CSS)
    regular: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    medium: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    semiBold: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    bold: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  default: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
});

// Toggle this when you install custom fonts
// Set to true since Inter fonts are now installed in assets/fonts/
const USE_CUSTOM_FONTS = true;

export const fontFamily = USE_CUSTOM_FONTS ? customFonts : systemFonts;

// ===========================================
// FONT SIZES
// ===========================================
export const fontSize = {
  // Display sizes (for splash, onboarding)
  display1: 48,
  display2: 40,
  
  // Headings
  h1: 28,
  h2: 24,
  h3: 20,
  h4: 18,
  h5: 16,
  h6: 14,
  
  // Body text
  bodyLarge: 18,
  body: 16,
  bodySmall: 14,
  
  // Utility sizes
  caption: 12,
  overline: 10,
  button: 16,
  buttonSmall: 14,
  
  // Input fields
  input: 16,
  inputLabel: 14,
  inputHelper: 12,
};

// ===========================================
// FONT WEIGHTS
// ===========================================
export const fontWeight = /** @type {const} */ ({
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
});

// ===========================================
// LINE HEIGHTS
// ===========================================
export const lineHeight = {
  tight: 1.2,      // Headings
  normal: 1.5,     // Body text
  relaxed: 1.75,   // Reading text
};

// ===========================================
// LETTER SPACING
// ===========================================
export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
  widest: 2,       // For overlines, labels
};

// ===========================================
// PRE-BUILT TEXT STYLES
// ===========================================
export const textStyles = {
  // Display
  display1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display1,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.display1 * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  display2: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.display2,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.display2 * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },

  // Headings
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.h1 * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.h2 * lineHeight.tight,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h3,
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.h3 * lineHeight.tight,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.h4,
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.h4 * lineHeight.normal,
  },
  h5: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.h5,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.h5 * lineHeight.normal,
  },
  h6: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.h6,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.h6 * lineHeight.normal,
  },

  // Body
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodyLarge,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.bodyLarge * lineHeight.normal,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.body * lineHeight.normal,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.bodySmall,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.bodySmall * lineHeight.normal,
  },

  // Utility
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.caption * lineHeight.normal,
  },
  overline: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.overline,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.overline * lineHeight.normal,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
  },

  // Buttons
  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.button,
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.button * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  },
  buttonSmall: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.buttonSmall,
    fontWeight: fontWeight.semiBold,
    lineHeight: fontSize.buttonSmall * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  },

  // Forms
  inputLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.inputLabel,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.inputLabel * lineHeight.normal,
  },
  inputText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.input,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.input * lineHeight.normal,
  },
  inputHelper: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.inputHelper,
    fontWeight: fontWeight.regular,
    lineHeight: fontSize.inputHelper * lineHeight.normal,
  },

  // Links
  link: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.body * lineHeight.normal,
  },
};

export default {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  textStyles,
};
