import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  StatusBar,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import Icon, { IconNames } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { api } from '../../api/client';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');
const CARD_TOP = Math.max(SCREEN_H * 0.40, 220);

const isWeb = Platform.OS === 'web';

// The e-mail link opens this screen on web as /redefinir-senha?token=...
const readToken = (route) => {
  if (route?.params?.token) {
    return route.params.token;
  }
  if (isWeb && typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('token') || '';
  }
  return '';
};

// The backend reports a bad token as a 400 whose message mentions the link or token.
const isInvalidLinkError = (err) => {
  if (err?.field === 'token') {
    return true;
  }
  return /link|token/i.test(err?.message || '');
};

const RedefinirSenha = ({navigation, route}) => {
  const toast = useToast();
  const [token] = useState(() => readToken(route));
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [linkInvalido, setLinkInvalido] = useState(!token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {toValue: 1, duration: 600, delay: 150, useNativeDriver: true}),
      Animated.timing(cardTranslateY, {toValue: 0, duration: 480, delay: 150, useNativeDriver: true}),
    ]).start();
  }, [cardOpacity, cardTranslateY]);

  // Drop the token from the address bar so a reload does not reopen this screen.
  const sairPara = (routeName) => {
    if (isWeb && typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
    }
    navigation.navigate(routeName);
  };

  const handleRedefinirSenha = async () => {
    if (!novaSenha || !confirmarSenha) {
      setError('Preencha a nova senha e a confirmação');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: novaSenha,
        confirm_password: confirmarSenha,
      });
      toast.success('Senha redefinida com sucesso. Faça login com a nova senha.');
      sairPara('Login');
    } catch (err) {
      if (isInvalidLinkError(err)) {
        setLinkInvalido(true);
      } else {
        setError(err?.message || 'Não foi possível redefinir a senha. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Invalid or expired link ────────────────────────
  if (linkInvalido) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <ImageBackground
          source={require('../../../assets/login-background.png')}
          style={styles.background}
          resizeMode="cover"
        />

        <View style={[styles.successCard, {marginTop: CARD_TOP}]}>
          <View style={styles.successContent}>
            <Text style={styles.successTitle}>Link inválido ou expirado</Text>
            <Text style={styles.successHint}>
              Este link de redefinição não é mais válido. Solicite um novo link para criar sua senha.
            </Text>
          </View>

          <View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => sairPara('RecuperarSenha')}
              activeOpacity={0.88}
            >
              <Icon name="send" size="md" color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Solicitar Novo Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => sairPara('Login')}
              activeOpacity={0.8}
            >
              <Icon name={IconNames.back} size="sm" color="#0347D0" />
              <Text style={styles.backLinkText}>Voltar ao Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ───────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ImageBackground
        source={require('../../../assets/login-background.png')}
        style={styles.background}
        resizeMode="cover"
      />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[styles.card, {marginTop: CARD_TOP, opacity: cardOpacity, transform: [{translateY: cardTranslateY}]}]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.lockBadge}>
                <Icon name="lock-reset" size="md" color="#0347D0" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Criar nova senha</Text>
                <Text style={styles.cardSubtitle}>
                  Digite a nova senha e repita para confirmar.
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Nova senha</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'nova' && styles.inputWrapperFocused,
              error ? styles.inputWrapperError : null,
            ]}>
              <Icon
                name="lock"
                size="md"
                color={focusedField === 'nova' ? '#0347D0' : colors.neutral[400]}
              />
              <TextInput
                style={styles.input}
                placeholder="Nova senha"
                placeholderTextColor={colors.neutral[400]}
                value={novaSenha}
                onChangeText={(text) => { setNovaSenha(text); setError(''); }}
                onFocus={() => setFocusedField('nova')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <Text style={styles.label}>Confirmar nova senha</Text>
            <View style={[
              styles.inputWrapper,
              focusedField === 'confirmar' && styles.inputWrapperFocused,
              error ? styles.inputWrapperError : null,
            ]}>
              <Icon
                name="lock"
                size="md"
                color={focusedField === 'confirmar' ? '#0347D0' : colors.neutral[400]}
              />
              <TextInput
                style={styles.input}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.neutral[400]}
                value={confirmarSenha}
                onChangeText={(text) => { setConfirmarSenha(text); setError(''); }}
                onFocus={() => setFocusedField('confirmar')}
                onBlur={() => setFocusedField(null)}
                onSubmitEditing={handleRedefinirSenha}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Icon name={IconNames.warning} size="sm" color={colors.error.main} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleRedefinirSenha}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="check" size="md" color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Redefinir Senha</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => sairPara('Login')}
              activeOpacity={0.8}
            >
              <Icon name={IconNames.back} size="sm" color="#0347D0" />
              <Text style={styles.backLinkText}>Voltar ao Login</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EEF3FB',
  },

  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },

  kav: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },

  // ── Card ──────────────────────────────────────────
  card: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    ...shadows.xl,
    minHeight: '100%',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },

  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(3,71,208,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  cardHeaderText: {
    flex: 1,
  },

  cardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    lineHeight: 26,
  },

  cardSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // ── Field ─────────────────────────────────────────
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    marginBottom: spacing.base,
  },

  inputWrapperFocused: {
    borderColor: '#0347D0',
    backgroundColor: colors.background.paper,
  },

  inputWrapperError: {
    borderColor: colors.error.main,
  },

  input: {
    flex: 1,
    height: '100%',
    color: colors.text.primary,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    paddingVertical: 0,
  },

  // ── Error ─────────────────────────────────────────
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.base,
  },

  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: colors.error.dark,
    flex: 1,
  },

  // ── Primary button ────────────────────────────────
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: '#0347D0',
    marginTop: spacing.xs,
    ...shadows.sm,
  },

  primaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  primaryButtonDisabled: {
    opacity: 0.65,
  },

  // ── Back link ─────────────────────────────────────
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },

  backLinkText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#0347D0',
    fontWeight: '500',
  },

  // ── Success card ──────────────────────────────────
  successCard: {
    flex: 1,
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
    ...shadows.xl,
  },

  successContent: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },

  successTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.base,
  },

  successBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  successHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: colors.text.disabled,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default RedefinirSenha;
