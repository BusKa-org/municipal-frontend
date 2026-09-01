import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { borderRadius, colors, shadows, spacing, textStyles } from '../theme';
import Icon, { IconNames } from './Icon';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface TripAlert {
  id: string;
  titulo: string;
  mensagem?: string;
  variant?: AlertVariant;
  onPress?: () => void;
}

interface TripAlertBannerProps {
  alert: TripAlert | null;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Default: 4000 */
  autoDismissMs?: number;
}

const VARIANT_CONFIG: Record<
  AlertVariant,
  { bg: string; border: string; text: string; icon: string }
> = {
  info: {
    bg: colors.primary.lighter,
    border: colors.primary.main,
    text: colors.primary.dark,
    icon: IconNames.info,
  },
  success: {
    bg: colors.success.light,
    border: colors.success.main,
    text: colors.success.dark,
    icon: IconNames.checkCircle,
  },
  warning: {
    bg: colors.warning.light,
    border: colors.warning.main,
    text: colors.warning.dark,
    icon: IconNames.warning,
  },
  error: {
    bg: colors.error.light,
    border: colors.error.main,
    text: colors.error.dark,
    icon: IconNames.error,
  },
};

const TripAlertBanner: React.FC<TripAlertBannerProps> = ({
  alert,
  onDismiss,
  autoDismissMs = 4000,
}) => {
  const translateY = useRef(new Animated.Value(-80)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest onDismiss in a ref. Callers usually pass an inline arrow
  // (e.g. `onDismiss={() => setAlert(null)}`), which changes identity on every
  // render. Depending on it directly would re-run the effect below on each
  // render, clearing and restarting the auto-dismiss timer forever, so the
  // banner would never dismiss and would keep covering the screen (zIndex 999).
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const slideOut = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -80,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismissRef.current?.());
  }, [translateY]);

  useEffect(() => {
    if (!alert) return;

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(slideOut, autoDismissMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alert?.id, autoDismissMs, slideOut, translateY]);

  if (!alert) return null;

  const variant = alert.variant ?? 'info';
  const cfg = VARIANT_CONFIG[variant];

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${alert.titulo}${alert.mensagem ? ': ' + alert.mensagem : ''}`}>
      <TouchableOpacity
        style={[styles.inner, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}
        onPress={() => {
          alert.onPress?.();
          slideOut();
        }}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityHint="Toque para ver detalhes ou dispensar">
        <Icon
          name={cfg.icon}
          size="md"
          color={cfg.border}
          accessibilityElementsHidden
        />
        <View style={styles.textWrap}>
          <Text style={[styles.titulo, { color: cfg.text }]} numberOfLines={1}>
            {alert.titulo}
          </Text>
          {!!alert.mensagem && (
            <Text style={[styles.mensagem, { color: cfg.text }]} numberOfLines={2}>
              {alert.mensagem}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={slideOut}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Dispensar aviso">
          <Icon name={IconNames.close} size="sm" color={cfg.text} accessibilityElementsHidden />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    ...shadows.lg,
  },
  textWrap: {
    flex: 1,
  },
  titulo: {
    ...textStyles.h5,
    fontWeight: '700',
  },
  mensagem: {
    ...textStyles.bodySmall,
    marginTop: spacing.xxs,
  },
  closeBtn: {
    padding: spacing.xs,
  },
});

export default TripAlertBanner;
