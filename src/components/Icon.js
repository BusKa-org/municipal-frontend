/**
 * BusKá Icon Component
 * 
 * Cross-platform icon component using Material Icons
 * - Web: Uses Material Icons font loaded via Google Fonts
 * - Mobile: Uses react-native-vector-icons
 * 
 * Usage:
 *   import Icon from '../components/Icon';
 *   <Icon name="directions-bus" size="md" color={colors.primary.main} />
 */

import React from 'react';
import { Platform, Text, StyleSheet } from 'react-native';
import { colors, iconSize as themeSizes } from '../theme';

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
  // Material Icons font uses underscores, not hyphens
  return name.replace(/-/g, '_');
};

/**
 * Icon component with Material Icons
 *
 * @param {object} props
 * @param {string} props.name
 * @param {string | number} [props.size]
 * @param {string} [props.color]
 * @param {import('react-native').StyleProp<import('react-native').TextStyle>} [props.style]
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

  // For web, use the Material Icons font directly
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[
          styles.materialIcon,
          {
            fontSize: resolvedSize,
            color: color,
            width: resolvedSize,
            height: resolvedSize,
            lineHeight: resolvedSize,
          },
          style,
        ]}
        {...props}
      >
        {normalizeIconName(name)}
      </Text>
    );
  }

  // For mobile, try to use react-native-vector-icons
  let MaterialIcons;
  try {
    MaterialIcons = require('react-native-vector-icons/MaterialIcons').default;
  } catch (e) {
    MaterialIcons = null;
  }

  if (MaterialIcons) {
    return (
      <MaterialIcons
        name={name}
        size={resolvedSize}
        color={color}
        style={style}
        {...props}
      />
    );
  }

  // Ultimate fallback
  return (
    <Text 
      style={[
        styles.fallback, 
        { fontSize: resolvedSize, color },
        style,
      ]}
      {...props}
    >
      ●
    </Text>
  );
};

// Named exports for common icon sets
export const IconNames = {
  // Navigation
  home: 'home',
  back: 'arrow-back',
  forward: 'arrow-forward',
  menu: 'menu',
  close: 'close',
  
  // Transport
  bus: 'directions-bus',
  route: 'route',
  location: 'location-on',
  myLocation: 'my-location',
  map: 'map',
  
  // Users
  person: 'person',
  group: 'group',
  badge: 'badge',
  
  // Actions
  add: 'add',
  edit: 'edit',
  delete: 'delete',
  search: 'search',
  refresh: 'refresh',
  settings: 'settings',
  
  // Status
  checkCircle: 'check-circle',
  warning: 'warning',
  error: 'error',
  info: 'info',
  
  // Communication
  notifications: 'notifications',
  notificationsOff: 'notifications-off',
  chat: 'chat',
  
  // Time/Schedule
  schedule: 'schedule',
  calendarToday: 'calendar-today',
  
  // Trip controls
  play: 'play-arrow',
  stop: 'stop',
  pause: 'pause',
  
  // Forms / Auth
  email: 'email',
  lock: 'lock',
  check: 'check',
  phone: 'phone',
  school: 'school',

  // Security / Data
  shield: 'shield',
  chart: 'bar-chart',

  // Misc
  visibility: 'visibility',
  visibilityOff: 'visibility-off',
  chevronRight: 'chevron-right',
  chevronLeft: 'chevron-left',
  expandMore: 'expand-more',
  expandLess: 'expand-less',
  moreVert: 'more-vert',
  moreHoriz: 'more-horiz',
  logout: 'logout',
  login: 'login',
  send: 'send',
  flag: 'flag',
  circle: 'circle',
};

const styles = StyleSheet.create({
  materialIcon: {
    fontFamily: 'Material Icons',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'center',
    // These are needed for the icon font to render correctly
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    textAlign: 'center',
  },
});

export default Icon;
