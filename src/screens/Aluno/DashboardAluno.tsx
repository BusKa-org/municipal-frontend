import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { alunoService } from '../../services';
import { getNotificacoes } from '../../services/notificacaoService';
import { useAuth } from '../../contexts/AuthContext';
import { borderRadius, colors, shadows, spacing, textStyles } from '../../theme';
import { Icon, IconNames, LoadingSpinner, TripAlertBanner } from '../../components';
import type { TripAlert } from '../../components/TripAlertBanner';
import { unwrapItems } from '../../types';
import type { ViagemAgendaUI } from '../../services/alunoService';

type RootParamList = Record<string, object | undefined>;
type Props = { navigation: NativeStackNavigationProp<RootParamList> };

const TODAY_ISO = new Date().toISOString().split('T')[0];

/** Returns today's most relevant trip (EM_ANDAMENTO > AGENDADA > CANCELADA) */
function pickTodayTrip(viagens: ViagemAgendaUI[]): ViagemAgendaUI | null {
  const todayTrips = viagens.filter((v) => v.data === TODAY_ISO);
  if (todayTrips.length === 0) return null;
  const priority = ['EM_ANDAMENTO', 'AGENDADA', 'CANCELADA', 'FINALIZADA'];
  return (
    todayTrips.sort(
      (a, b) =>
        priority.indexOf(a.status_viagem ?? '') -
        priority.indexOf(b.status_viagem ?? ''),
    )[0] ?? null
  );
}

const CAPACITY_WARN = 0.85;

const CapacityBar: React.FC<{
  confirmed: number;
  total: number;
}> = ({ confirmed, total }) => {
  if (total === 0) return null;
  const pct = Math.min(1, confirmed / total);
  const quaseLotado = pct >= CAPACITY_WARN;
  return (
    <View
      style={styles.capacityWrap}
      accessible
      accessibilityLabel={`${confirmed} de ${total} vagas confirmadas${quaseLotado ? ', quase lotado' : ''}`}>
      <View style={styles.capacityRow}>
        <Text style={styles.capacityText}>
          {confirmed}/{total} vagas
        </Text>
        {quaseLotado && (
          <View style={styles.quaseLotadoBadge}>
            <Text style={styles.quaseLotadoText}>Quase lotado</Text>
          </View>
        )}
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${pct * 100}%` as `${number}%`,
              backgroundColor: quaseLotado ? colors.warning.main : colors.success.main,
            },
          ]}
        />
      </View>
    </View>
  );
};

const DashboardAluno: React.FC<Props> = ({ navigation }) => {
  const [rotasCadastradas, setRotasCadastradas] = useState<ViagemAgendaUI[]>([]);
  const [proximaViagem, setProximaViagem] = useState<
    (ViagemAgendaUI & { horario: string; status: string }) | null
  >(null);
  const [todayTrip, setTodayTrip] = useState<ViagemAgendaUI | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState<TripAlert | null>(null);
  const prevUnreadRef = useRef(0);
  const { user, logout } = useAuth();

  const userRecord = user as Record<string, unknown>;
  const userStatus = userRecord?.status as string | undefined;
  const isPendingApproval = userStatus === 'PENDING_APPROVAL';
  const isAwaitingGuardian =
    userStatus === 'PENDING_SIGNUP' &&
    !!userRecord?.email_responsavel &&
    !userRecord?.guardian_consented_at;

  const loadNotifBadge = useCallback(async () => {
    try {
      const notifs = await getNotificacoes();
      const count = notifs.filter((n) => !n.enviada).length;
      if (count > prevUnreadRef.current && prevUnreadRef.current > 0) {
        const newest = notifs.find((n) => !n.enviada);
        if (newest) {
          const isUrgent = ['Iniciada', 'Cancelada', 'Aviso'].some((kw) =>
            newest.titulo.includes(kw),
          );
          if (isUrgent) {
            setAlert({
              id: newest.id,
              titulo: newest.titulo,
              mensagem: newest.mensagem,
              variant: newest.titulo.includes('Cancelada') ? 'error' : 'info',
              onPress: () => navigation.navigate('Notificacoes'),
            });
          }
        }
      }
      prevUnreadRef.current = count;
      setUnreadCount(count);
    } catch {
      // non-critical — badge just won't update
    }
  }, [navigation]);

  const getRoleLabel = (role?: string) => {
    const map: Record<string, string> = {
      aluno: 'Aluno',
      motorista: 'Motorista',
      gestor: 'Gestor',
    };
    return map[role ?? ''] ?? role ?? '';
  };

  const getUserInfo = () => {
    const roleLabel = getRoleLabel(user?.role);
    const mun = (user as Record<string, unknown>)?.municipio as
      | { nome: string; uf?: string }
      | undefined;
    const municipioInfo = mun ? `${mun.nome}${mun.uf ? ` - ${mun.uf}` : ''}` : '';
    return municipioInfo ? `${roleLabel} • ${municipioInfo}` : roleLabel;
  };

  const loadData = useCallback(async () => {
    try {
      const rotas = await alunoService.listarMinhasRotas().then(unwrapItems);
      setRotasCadastradas(rotas as ViagemAgendaUI[]);

      const todasViagens = await alunoService.listarViagens();

      if (todasViagens.length > 0) {
        const now = new Date();
        const upcoming = todasViagens
          .filter((v) => {
            try {
              const dt = v.horario_inicio
                ? new Date(`${v.data}T${v.horario_inicio}`)
                : new Date(v.data ?? '');
              return dt >= now;
            } catch {
              return false;
            }
          })
          .sort((a, b) => {
            try {
              return (
                new Date(`${a.data}T${a.horario_inicio ?? '00:00'}`).getTime() -
                new Date(`${b.data}T${b.horario_inicio ?? '00:00'}`).getTime()
              );
            } catch {
              return 0;
            }
          });

        const next = upcoming[0] ?? null;
        setProximaViagem(
          next
            ? {
                ...next,
                horario: (next.horario_inicio ?? '--:--').substring(0, 5),
                status: next.status_confirmacao ? 'Confirmado' : 'Não confirmado',
              }
            : null,
        );

        setTodayTrip(pickTodayTrip(todasViagens));
      } else {
        setProximaViagem(null);
        setTodayTrip(null);
      }
    } catch {
      setProximaViagem(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadNotifBadge();
    const interval = setInterval(loadNotifBadge, 60_000);
    return () => clearInterval(interval);
  }, [loadData, loadNotifBadge]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    loadNotifBadge();
  };

  const todayBannerConfig = (() => {
    if (!todayTrip) return null;
    switch (todayTrip.status_viagem) {
      case 'EM_ANDAMENTO':
        return {
          bg: colors.success.light,
          border: colors.success.main,
          text: colors.success.dark,
          icon: IconNames.bus,
          label: 'Ônibus em trânsito',
          sub: 'Toque para ver localização',
          onPress: () => {
            const rota = (rotasCadastradas as unknown[]).find(
              (r: unknown) => (r as Record<string, unknown>).id === todayTrip.rota_id,
            );
            if (rota)
              navigation.navigate('LocalizacaoOnibus', {
                rota,
                viagem: todayTrip,
              });
          },
        };
      case 'CANCELADA':
        return {
          bg: colors.error.light,
          border: colors.error.main,
          text: colors.error.dark,
          icon: IconNames.close,
          label: 'Viagem de hoje cancelada',
          sub: 'Entre em contato com o gestor',
          onPress: undefined,
        };
      case 'AGENDADA':
        return {
          bg: colors.primary.lighter,
          border: colors.primary.main,
          text: colors.primary.dark,
          icon: IconNames.schedule,
          label: `Viagem agendada para hoje`,
          sub: todayTrip.horario_inicio
            ? `Saída às ${(todayTrip.horario_inicio).substring(0, 5)}`
            : 'Confira os detalhes',
          onPress: undefined,
        };
      default:
        return null;
    }
  })();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner
          fullScreen
          message="Carregando suas informações..."
          color={colors.secondary.main}
          accessibilityLabel="Carregando painel do aluno"
        />
      </SafeAreaView>
    );
  }

  if (isAwaitingGuardian || isPendingApproval) {
    const isGuardian = isAwaitingGuardian;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.blockedRoot}>
          <View style={styles.blockedIconWrap}>
            <Icon
              name={isGuardian ? 'mail-outline' : IconNames.schedule}
              size="xl"
              color={isGuardian ? colors.warning.dark : colors.primary.main}
              style={undefined}
            />
          </View>

          <Text style={styles.blockedTitle}>
            {isGuardian ? 'Aguardando responsável' : 'Cadastro em análise'}
          </Text>

          <Text style={styles.blockedBody}>
            {isGuardian
              ? `Um e-mail de autorização foi enviado para ${userRecord?.email_responsavel as string}. O responsável precisa confirmar antes de você continuar.`
              : 'Seu responsável já autorizou o cadastro. O gestor municipal está analisando sua solicitação e você será avisado quando for aprovado.'}
          </Text>

          {isGuardian && (
            <View style={styles.blockedHint}>
              <Icon name="info-outline" size="sm" color={colors.text.hint} style={undefined} />
              <Text style={styles.blockedHintText}>
                Não recebeu? Peça ao responsável para verificar a caixa de spam.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.blockedLogoutBtn}
            onPress={() => void logout()}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta">
            <Icon name="logout" size="sm" color={colors.text.secondary} style={undefined} />
            <Text style={styles.blockedLogoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TripAlertBanner alert={alert} onDismiss={() => setAlert(null)} />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.greeting} accessibilityRole="header">
                Olá, {user?.nome || 'Aluno'}!
              </Text>
              <Text style={styles.subtitle}>{getUserInfo()}</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => navigation.navigate('Notificacoes')}
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0
                  ? `Notificações, ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
                  : 'Notificações'
              }>
              <Icon name={IconNames.notifications} size="xl" color={colors.primary.contrast} />
              {unreadCount > 0 && (
                <View style={styles.badge} accessibilityElementsHidden>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Trip Banner */}
        {todayBannerConfig && (
          <TouchableOpacity
            style={[
              styles.todayBanner,
              {
                backgroundColor: todayBannerConfig.bg,
                borderColor: todayBannerConfig.border,
              },
            ]}
            onPress={todayBannerConfig.onPress}
            disabled={!todayBannerConfig.onPress}
            activeOpacity={0.8}
            accessible
            accessibilityRole={todayBannerConfig.onPress ? 'button' : 'text'}
            accessibilityLabel={`${todayBannerConfig.label}. ${todayBannerConfig.sub}`}>
            <View
              style={[
                styles.todayBannerIcon,
                { backgroundColor: todayBannerConfig.border + '20' },
              ]}>
              <Icon
                name={todayBannerConfig.icon}
                size="lg"
                color={todayBannerConfig.border}
                accessibilityElementsHidden
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.todayBannerLabel, { color: todayBannerConfig.text }]}>
                {todayBannerConfig.label}
              </Text>
              <Text style={[styles.todayBannerSub, { color: todayBannerConfig.text }]}>
                {todayBannerConfig.sub}
              </Text>
            </View>
            {todayBannerConfig.onPress && (
              <Icon
                name={IconNames.chevronRight}
                size="md"
                color={todayBannerConfig.border}
                accessibilityElementsHidden
              />
            )}
          </TouchableOpacity>
        )}

        {/* Próxima Viagem Destacada */}
        {proximaViagem && (
          <View
            style={[
              styles.proximaViagemCard,
              todayBannerConfig ? styles.proximaViagemCardBelowBanner : null,
            ]}
            accessible
            accessibilityLabel={`Próxima viagem às ${proximaViagem.horario}, status ${proximaViagem.status}`}>
            <View style={styles.cardHeader}>
              <Icon
                name={IconNames.schedule}
                size="md"
                color={colors.secondary.light}
                accessibilityElementsHidden
              />
              <Text style={styles.cardTitle}>Próxima Viagem</Text>
            </View>
            <View style={styles.viagemInfo}>
              <View style={styles.viagemHeader}>
                <Text style={styles.viagemHorario}>{proximaViagem.horario}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    proximaViagem.status === 'Confirmado'
                      ? styles.statusConfirmado
                      : styles.statusNaoConfirmado,
                  ]}>
                  <Icon
                    name={
                      proximaViagem.status === 'Confirmado'
                        ? IconNames.checkCircle
                        : IconNames.warning
                    }
                    size="xs"
                    color={colors.text.inverse}
                    accessibilityElementsHidden
                  />
                  <Text style={styles.statusText}>{proximaViagem.status}</Text>
                </View>
              </View>
              <Text style={styles.viagemRota}>{proximaViagem.rota_nome ?? 'Rota'}</Text>
              <Text style={styles.viagemTipo}>{proximaViagem.tipo}</Text>

              {/* Capacity bar */}
              <CapacityBar
                confirmed={proximaViagem.alunos_confirmados_count}
                total={proximaViagem.total_alunos}
              />
            </View>
            <TouchableOpacity
              style={styles.verDetalhesButton}
              onPress={() => {
                const rota = (rotasCadastradas as unknown[]).find(
                  (r: unknown) =>
                    (r as Record<string, unknown>).id === proximaViagem.rota_id,
                );
                if (rota)
                  navigation.navigate('DetalheViagem', {
                    rota,
                    viagem: proximaViagem,
                  });
              }}
              accessibilityRole="button"
              accessibilityLabel="Ver detalhes da próxima viagem">
              <Text style={styles.verDetalhesText}>Ver Detalhes</Text>
              <Icon
                name={IconNames.chevronRight}
                size="md"
                color={colors.primary.main}
                accessibilityElementsHidden
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.botoesRapidos} accessibilityRole="toolbar">
          <TouchableOpacity
            style={styles.botaoRapido}
            onPress={() => navigation.navigate('RotaAluno')}
            accessibilityRole="button"
            accessibilityLabel="Minhas Viagens">
            <View style={[styles.botaoIconContainer, { backgroundColor: colors.secondary.lighter }]}>
              <Icon name={IconNames.bus} size="lg" color={colors.secondary.dark} accessibilityElementsHidden />
            </View>
            <Text style={styles.botaoRapidoText}>Minhas Viagens</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.botaoRapido, !proximaViagem && styles.botaoRapidoDisabled]}
            disabled={!proximaViagem}
            onPress={() => {
              if (proximaViagem) {
                const rota = (rotasCadastradas as unknown[]).find(
                  (r: unknown) =>
                    (r as Record<string, unknown>).id === proximaViagem.rota_id,
                );
                if (rota)
                  navigation.navigate('LocalizacaoOnibus', {
                    rota,
                    viagem: proximaViagem,
                  });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Localização do ônibus"
            accessibilityState={{ disabled: !proximaViagem }}>
            <View style={[styles.botaoIconContainer, { backgroundColor: colors.success.light }]}>
              <Icon name={IconNames.location} size="lg" color={colors.success.dark} accessibilityElementsHidden />
            </View>
            <Text style={styles.botaoRapidoText}>Localização</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoRapido}
            onPress={() => navigation.navigate('Notificacoes')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'
            }>
            <View style={[styles.botaoIconContainer, { backgroundColor: colors.accent.light }]}>
              <Icon name={IconNames.notifications} size="lg" color={colors.accent.dark} accessibilityElementsHidden />
              {unreadCount > 0 && (
                <View style={styles.badgeSmall} accessibilityElementsHidden>
                  <Text style={styles.badgeSmallText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.botaoRapidoText}>Notificações</Text>
          </TouchableOpacity>
        </View>

        {/* Enrolled Routes */}
        <View style={styles.rotasSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Rotas Cadastradas
            </Text>
            <TouchableOpacity
              style={styles.verTodasButton}
              onPress={() => navigation.navigate('SelecaoRotas')}
              accessibilityRole="button"
              accessibilityLabel="Ver todas as rotas">
              <Text style={styles.verTodasText}>Ver todas</Text>
              <Icon name={IconNames.chevronRight} size="sm" color={colors.secondary.main} accessibilityElementsHidden />
            </TouchableOpacity>
          </View>

          {rotasCadastradas.length > 0 ? (
            (rotasCadastradas as unknown[]).map((rota: unknown) => {
              const r = rota as Record<string, unknown>;
              return (
                <TouchableOpacity
                  key={r.id as string}
                  style={styles.rotaCard}
                  onPress={() => navigation.navigate('RotaAluno', { rota })}
                  accessibilityRole="button"
                  accessibilityLabel={`Rota ${r.nome as string}`}>
                  <View style={styles.rotaIconContainer}>
                    <Icon name={IconNames.route} size="lg" color={colors.primary.main} accessibilityElementsHidden />
                  </View>
                  <View style={styles.rotaInfo}>
                    <Text style={styles.rotaNome}>{r.nome as string}</Text>
                    <Text style={styles.rotaBairro}>
                      {r.municipio_nome
                        ? `${r.municipio_nome as string}${r.municipio_uf ? ` - ${r.municipio_uf as string}` : ''}`
                        : 'Município não informado'}
                    </Text>
                  </View>
                  <View style={styles.rotaStatus}>
                    <View style={styles.enrolledBadge}>
                      <Icon name={IconNames.checkCircle} size="xs" color={colors.success.main} accessibilityElementsHidden />
                      <Text style={styles.rotaStatusText}>Cadastrado</Text>
                    </View>
                    <Icon name={IconNames.chevronRight} size="md" color={colors.neutral[400]} accessibilityElementsHidden />
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Icon name={IconNames.route} size="huge" color={colors.neutral[300]} accessibilityElementsHidden />
              </View>
              <Text style={styles.emptyStateTitle}>Nenhuma rota cadastrada</Text>
              <Text style={styles.emptyStateText}>
                Você ainda não está inscrito em nenhuma rota de transporte escolar
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={() => navigation.navigate('SelecaoRotas')}
                accessibilityRole="button"
                accessibilityLabel="Ver rotas disponíveis">
                <Icon name={IconNames.add} size="md" color={colors.primary.contrast} accessibilityElementsHidden />
                <Text style={styles.emptyStateButtonText}>Ver rotas disponíveis</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Settings */}
        <TouchableOpacity
          style={styles.configButton}
          onPress={() => navigation.navigate('ConfigNotificacoesAluno')}
          accessibilityRole="button"
          accessibilityLabel="Configurações de notificações">
          <Icon name={IconNames.settings} size="base" color={colors.text.secondary} accessibilityElementsHidden />
          <Text style={styles.configButtonText}>Configurações</Text>
          <Icon name={IconNames.chevronRight} size="md" color={colors.neutral[400]} accessibilityElementsHidden />
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollView: { flex: 1 },

  // Header
  header: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  greeting: {
    ...textStyles.h2,
    color: colors.primary.contrast,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...textStyles.bodySmall,
    color: colors.secondary.light,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error.main,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.primary.light,
  },
  badgeText: {
    color: colors.text.inverse,
    fontSize: 10,
    fontWeight: '700',
  },
  badgeSmall: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error.main,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeSmallText: {
    color: colors.text.inverse,
    fontSize: 9,
    fontWeight: '700',
  },

  // Today Banner
  todayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    padding: spacing.base,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  todayBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBannerLabel: {
    ...textStyles.h5,
    fontWeight: '700',
  },
  todayBannerSub: {
    ...textStyles.bodySmall,
    marginTop: spacing.xxs,
  },

  // Próxima Viagem Card
  proximaViagemCard: {
    margin: spacing.base,
    marginTop: -spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.primary.lighter,
    borderRadius: borderRadius.xl,
    ...shadows.lg,
  },
  proximaViagemCardBelowBanner: {
    marginTop: spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...textStyles.caption,
    color: colors.secondary.light,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viagemInfo: { marginBottom: spacing.base },
  viagemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  viagemHorario: {
    ...textStyles.display2,
    color: colors.primary.contrast,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusConfirmado: { backgroundColor: colors.success.main },
  statusNaoConfirmado: { backgroundColor: colors.warning.main },
  statusText: {
    ...textStyles.caption,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  viagemRota: {
    ...textStyles.h4,
    color: colors.primary.contrast,
    marginBottom: spacing.xs,
  },
  viagemTipo: {
    ...textStyles.bodySmall,
    color: colors.secondary.lighter,
    marginBottom: spacing.sm,
  },
  verDetalhesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  verDetalhesText: {
    ...textStyles.button,
    color: colors.primary.main,
  },

  // Capacity
  capacityWrap: {
    marginTop: spacing.sm,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  capacityText: {
    ...textStyles.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  quaseLotadoBadge: {
    backgroundColor: colors.warning.main,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  quaseLotadoText: {
    ...textStyles.caption,
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 10,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },

  // Quick Actions
  botoesRapidos: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  botaoRapido: {
    flex: 1,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
    ...shadows.sm,
  },
  botaoRapidoDisabled: { opacity: 0.5 },
  botaoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  botaoRapidoText: {
    ...textStyles.caption,
    color: colors.text.primary,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Routes
  rotasSection: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
  },
  verTodasButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  verTodasText: {
    ...textStyles.bodySmall,
    color: colors.secondary.main,
    fontWeight: '600',
  },
  rotaCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
    minHeight: 64,
  },
  rotaIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rotaInfo: { flex: 1 },
  rotaNome: {
    ...textStyles.h5,
    color: colors.text.primary,
    marginBottom: spacing.xxs,
  },
  rotaBairro: {
    ...textStyles.bodySmall,
    color: colors.text.secondary,
  },
  rotaStatus: { alignItems: 'flex-end', gap: spacing.xs },
  enrolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  rotaStatusText: {
    ...textStyles.caption,
    color: colors.success.main,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyIconContainer: { marginBottom: spacing.base },
  emptyStateTitle: {
    ...textStyles.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...textStyles.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
    minHeight: 48,
  },
  emptyStateButtonText: {
    ...textStyles.button,
    color: colors.primary.contrast,
  },

  // Blocked state (PENDING_SIGNUP guardian / PENDING_APPROVAL)
  blockedRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  blockedIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.warning.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  blockedTitle: {
    ...textStyles.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  blockedBody: {
    ...textStyles.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  blockedHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  blockedHintText: {
    ...textStyles.bodySmall,
    color: colors.text.hint,
    flex: 1,
    lineHeight: 18,
  },
  blockedLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[300],
  },
  blockedLogoutText: {
    ...textStyles.body,
    color: colors.text.secondary,
  },

  // Config
  configButton: {
    marginHorizontal: spacing.base,
    padding: spacing.base,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.xs,
    minHeight: 56,
  },
  configButtonText: {
    ...textStyles.body,
    color: colors.text.secondary,
    flex: 1,
  },
});

export default DashboardAluno;
