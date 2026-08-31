import React, { useRef, useEffect, useState } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { Icon, IconNames } from '../../components';
import { colors } from '../../theme';
import { Storage, STORAGE_KEYS } from '../../utils/storage';

// Physical screen size — never changes, immune to keyboard resize on Android
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');
const CARD_TOP = Math.max(SCREEN_H * 0.40, 220);

type LoginProps = {
  navigation: {
    navigate: (screen: string) => void;
  };
};

const Login: React.FC<LoginProps> = ({ navigation }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [senhaFocused, setSenhaFocused] = useState(false);
  const [lembrarMe, setLembrarMe] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(26)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateAnim]);

  useEffect(() => {
    let ativo = true;

    Storage.getItem(STORAGE_KEYS.REMEMBERED_EMAIL).then((salvo) => {
      if (!ativo || !salvo) return;
      setEmail(salvo);
      setLembrarMe(true);
    });

    return () => {
      ativo = false;
    };
  }, []);

  const handleLogin = async () => {
    setErro('');

    if (!email.trim() || !senha.trim()) {
      setErro('Preencha e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      const emailLimpo = email.trim();
      const result = await login({ email: emailLimpo, password: senha });

      if (result?.success) {
        if (lembrarMe) {
          await Storage.setItem(STORAGE_KEYS.REMEMBERED_EMAIL, emailLimpo);
        } else {
          await Storage.removeItem(STORAGE_KEYS.REMEMBERED_EMAIL);
        }
      } else {
        setErro(result?.error || 'Credenciais inválidas. Verifique seus dados.');
      }
    } catch (error: any) {
      setErro(error?.message || 'Não foi possível entrar agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    if (erro) setErro('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary.dark} />

      {/* Background uses explicit screen dimensions so keyboard resize on Android never affects it */}
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
            style={[
              styles.content,
              {
                marginTop: CARD_TOP,
                opacity: fadeAnim,
                transform: [{ translateY: translateAnim }],
              },
            ]}
          >

            <View style={styles.card}>
              <Text style={styles.title}>Bem-vindo de volta! 👋</Text>
              <Text style={styles.subtitle}>Faça login para acessar sua conta</Text>

              <View style={styles.form}>
                <Text style={styles.label}>E-mail</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    emailFocused && styles.inputWrapperFocused,
                    !!erro && styles.inputWrapperError,
                  ]}
                >
                  <View style={styles.inputIconBox}>
                    <Icon
                      name={IconNames.email}
                      size="md"
                      color={emailFocused ? colors.primary.main : '#94A3B8'}
                      style={undefined}
                    />
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="seu@email.com"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      clearError();
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    testID="email-input"
                  />
                </View>

                <Text style={[styles.label, styles.passwordLabel]}>Senha</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    senhaFocused && styles.inputWrapperFocused,
                    !!erro && styles.inputWrapperError,
                  ]}
                >
                  <View style={styles.inputIconBox}>
                    <Icon
                      name={IconNames.lock}
                      size="md"
                      color={senhaFocused ? colors.primary.main : '#94A3B8'}
                      style={undefined}
                    />
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    value={senha}
                    onChangeText={(text) => {
                      setSenha(text);
                      clearError();
                    }}
                    secureTextEntry={!mostrarSenha}
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    onFocus={() => setSenhaFocused(true)}
                    onBlur={() => setSenhaFocused(false)}
                    testID="password-input"
                  />

                  <TouchableOpacity
                    onPress={() => setMostrarSenha((prev) => !prev)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon
                      name={mostrarSenha ? IconNames.visibilityOff : IconNames.visibility}
                      size="md"
                      color="#94A3B8"
                      style={undefined}
                    />
                  </TouchableOpacity>
                </View>

                {erro ? (
                  <View style={styles.errorBox}>
                    <Icon
                      name={IconNames.warning}
                      size="sm"
                      color="#DC2626"
                      style={undefined}
                    />
                    <Text style={styles.errorText}>{erro}</Text>
                  </View>
                ) : null}

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.rememberRow}
                    activeOpacity={0.8}
                    onPress={() => setLembrarMe((prev) => !prev)}
                  >
                    <View style={[styles.checkBox, lembrarMe && styles.checkBoxActive]}>
                      {lembrarMe ? (
                        <Icon
                          name={IconNames.check}
                          size="sm"
                          color="#FFFFFF"
                          style={undefined}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.rememberText}>Lembrar-me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => navigation.navigate('RecuperarSenha')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.9}
                  testID="login-button"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.loginButtonContent}>
                      <Text style={styles.loginArrow}>→</Text>
                      <Text style={styles.loginButtonText}>Entrar</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.footerCard}>
                <Text style={styles.footerText}>
                  Ainda não tem uma conta?{' '}
                  <Text
                    style={styles.footerLink}
                    onPress={() => navigation.navigate('CriarConta')}
                  >
                    Cadastre-se
                  </Text>
                </Text>
              </View>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.default,
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
  yellowWave: {
    position: 'absolute',
    top: 250,
    left: -40,
    right: -40,
    height: 90,
    backgroundColor: '#F4B400',
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    transform: [{ rotate: '-4deg' }],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  content: {
    alignItems: 'center',
  },

  logoContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  logoImage: {
    width: 310,
    height: 245,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 0,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 7,
    overflow: 'hidden',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary.dark,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  form: {
    marginTop: 26,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  passwordLabel: {
    marginTop: 18,
  },
  inputWrapper: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#D9E2EF',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: colors.primary.main,
    backgroundColor: '#FFFFFF',
  },
  inputWrapperError: {
    borderColor: '#FCA5A5',
  },
  inputIconBox: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#0F172A',
    fontSize: 16,
  },
  errorBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    marginLeft: 8,
    color: '#B91C1C',
    fontSize: 14,
    flex: 1,
  },
  actionsRow: {
    marginTop: 16,
    marginBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkBoxActive: {
    backgroundColor: colors.accent.main,
    borderColor: colors.accent.main,
  },
  rememberText: {
    fontSize: 15,
    color: '#475569',
  },
  forgotText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary.main,
  },
  loginButton: {
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.main,
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.75,
  },
  loginButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginArrow: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginRight: 10,
    marginTop: -2,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  footerCard: {
    marginTop: 24,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginHorizontal: -20,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  footerText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 16,
  },
  footerLink: {
    color: colors.primary.main,
    fontWeight: '800',
  },
  featuresCard: {
    width: '100%',
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 4,
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  featureDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  featureIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 10,
  },
  featureTextWrap: {
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  featureSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 17,
  },
});

export default Login;