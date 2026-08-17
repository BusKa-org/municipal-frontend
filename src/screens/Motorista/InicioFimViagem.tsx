/**
 * InicioFimViagem — Driver trip control + live navigation screen.
 *
 * Driver-safety principles:
 *  - During active trip: map fills the screen; controls float at edges
 *  - All action buttons are very large (min-height 72-88 dp)
 *  - Back button is disabled while driving
 *  - "Avisar alunos" opens a modal with pre-defined templates (one tap = done)
 *  - "Reportar problema" uses ReportSheet with category chips (no mandatory typing)
 *  - Finalizar requires confirmation dialog to prevent accidental taps
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  shadows,
  spacing,
  textStyles,
} from '../../theme';
import Icon, { IconNames } from '../../components/Icon';
import { ReportSheet } from '../../components';
import { RouteMap, StaticRouteMap } from '../../features/map/index';
import { motoristaService } from '../../services/motoristaService';
import { createNotificacao } from '../../services/notificacaoService';
import { useToast } from '../../components/Toast';
import { unwrapItems } from '../../types';
import type { PontoFlatResponse } from '../../types';

type RootParamList = Record<string, object | undefined>;
type Props = {
  navigation: NativeStackNavigationProp<RootParamList>;
  route: RouteProp<{ InicioFimViagem: { viagem: Record<string, unknown> } }, 'InicioFimViagem'>;
};

let Geolocation: typeof navigator.geolocation | null = null;
try {
  Geolocation = require('@react-native-community/geolocation').default;
} catch {
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    Geolocation = navigator.geolocation;
  }
}

const GPS_SEND_INTERVAL_MS = 20_000;

const BROADCAST_TEMPLATES = [
  { id: 'saindo', label: 'Saindo agora', icon: IconNames.play, msg: 'O ônibus está saindo agora. Dirija-se ao ponto!' },
  { id: 'atrasado', label: 'Estou atrasado', icon: IconNames.schedule, msg: 'O ônibus está atrasado. Aguarde no ponto.' },
  { id: 'chegando', label: 'Chegando ao ponto', icon: IconNames.bus, msg: 'O ônibus está chegando ao seu ponto.' },
  { id: 'cancelado', label: 'Viagem cancelada', icon: IconNames.close, msg: 'Atenção: a viagem de hoje foi cancelada. Procure outra forma de transporte.' },
];

const InicioFimViagem: React.FC<Props> = ({ navigation, route }) => {
  const viagemParam = route?.params?.viagem as Record<string, unknown> | undefined;
  const toast = useToast();

  const [viagem, setViagem] = useState(viagemParam);
  const [viagemIniciada, setViagemIniciada] = useState(viagemParam?.status === 'EM_ANDAMENTO');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [pontosRota, setPontosRota] = useState<PontoFlatResponse[]>([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentViagem = (viagem ?? viagemParam) as Record<string, unknown>;
  const viagemId = (currentViagem?.id ?? viagemParam?.id) as string | undefined;
  const rotaId = currentViagem?.rota_id as string | undefined;

  // Load fresh trip status and route points
  useEffect(() => {
    const init = async () => {
      if (!viagemParam?.id) {
        setLoadingStatus(false);
        return;
      }
      try {
        setLoadingStatus(true);

        // Fetch fresh trip state
        const viagens = await motoristaService.listarViagens().then(unwrapItems);
        const viagemAtual = (viagens as Record<string, unknown>[]).find(
          (v) => v.id === viagemParam.id,
        );
        if (viagemAtual) {
          setViagem(viagemAtual);
          const emAndamento = viagemAtual.status === 'EM_ANDAMENTO';
          setViagemIniciada(emAndamento);
          if (emAndamento && viagemAtual.inicio_real) {
            const inicioDate = new Date(viagemAtual.inicio_real as string);
            setTempoDecorrido(Math.max(0, Math.floor((Date.now() - inicioDate.getTime()) / 1000)));
          }
        }

        // Fetch route points for map
        const rid = (viagemAtual?.rota_id ?? viagemParam?.rota_id) as string | undefined;
        if (rid) {
          const pontosResp = await motoristaService.listarPontosRota(rid);
          const items = unwrapItems(pontosResp) as PontoFlatResponse[];
          setPontosRota(items);
        }
      } catch {
        setViagemIniciada(viagemParam?.status === 'EM_ANDAMENTO');
      } finally {
        setLoadingStatus(false);
      }
    };
    init();
  }, [viagemParam?.id]);

  // Elapsed timer
  useEffect(() => {
    if (viagemIniciada) {
      intervalRef.current = setInterval(() => setTempoDecorrido((p) => p + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [viagemIniciada]);

  // GPS broadcast to backend
  const viagemIdRef = useRef<string | undefined>(viagemId);
  viagemIdRef.current = viagemId;

  useEffect(() => {
    if (!viagemIniciada || !viagemIdRef.current || !Geolocation) return;

    const sendPos = () => {
      Geolocation!.getCurrentPosition(
        (pos) => {
          motoristaService
            .enviarLocalizacao(viagemIdRef.current!, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            })
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    };

    sendPos();
    const gpsInterval = setInterval(sendPos, GPS_SEND_INTERVAL_MS);
    return () => clearInterval(gpsInterval);
  }, [viagemIniciada]);

  const formatarTempo = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  const handleIniciarViagem = async () => {
    if (!viagemId) return;
    try {
      setLoading(true);
      await motoristaService.iniciarViagem(viagemId);
      setViagemIniciada(true);
      setTempoDecorrido(0);

      // Fetch points if not loaded yet
      if (pontosRota.length === 0 && rotaId) {
        const pontosResp = await motoristaService.listarPontosRota(rotaId);
        setPontosRota(unwrapItems(pontosResp) as PontoFlatResponse[]);
      }

      AccessibilityInfo.announceForAccessibility('Viagem iniciada com sucesso');
      toast.success('Viagem iniciada!');
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Erro ao iniciar viagem');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizarViagem = () => {
    Alert.alert(
      'Finalizar viagem',
      'Confirma o encerramento desta viagem?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await motoristaService.finalizarViagem(viagemId!);
              AccessibilityInfo.announceForAccessibility('Viagem finalizada');
              toast.success('Viagem finalizada!');
              navigation.goBack();
            } catch (err: unknown) {
              toast.error((err as Error)?.message || 'Erro ao finalizar viagem');
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleBroadcast = async (template: (typeof BROADCAST_TEMPLATES)[number]) => {
    if (!viagemId) return;
    setSendingBroadcast(true);
    try {
      await createNotificacao({
        titulo: template.label,
        mensagem: template.msg,
        viagem_id: viagemId,
      } as Parameters<typeof createNotificacao>[0]);
      toast.success('Aviso enviado aos alunos!');
      AccessibilityInfo.announceForAccessibility('Aviso enviado com sucesso');
    } catch {
      toast.error('Não foi possível enviar o aviso.');
    } finally {
      setSendingBroadcast(false);
      setBroadcastVisible(false);
    }
  };

  // ── Empty / loading guards ─────────────────────────────────────────────────

  if (!viagemParam) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}
            accessibilityRole="button" accessibilityLabel="Voltar">
            <Icon name={IconNames.back} size="md" color={colors.primary.contrast} />
          </TouchableOpacity>
          <Text style={styles.title}>Iniciar Viagem</Text>
        </View>
        <View style={styles.centered}>
          <Icon name={IconNames.warning} size="xxl" color={colors.warning.main} />
          <Text style={styles.emptyText}>Dados da viagem não disponíveis</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}
            accessibilityRole="button" accessibilityLabel="Voltar">
            <Icon name={IconNames.back} size="md" color={colors.primary.contrast} />
          </TouchableOpacity>
          <Text style={styles.title}>Carregando…</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.dark} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Active trip — map fills the screen with floating panels ──────────────

  if (viagemIniciada) {
    return (
      <View style={styles.mapScreen}>
        {/* Full-screen live map */}
        <RouteMap
          fill
          pontosRota={pontosRota}
          onPontoChegado={() => {
            // advance through stops as driver arrives
            setPontosRota((prev) => prev.slice(1));
          }}
        />

        {/* Floating top: info + timer */}
        <SafeAreaView style={styles.floatingTop} pointerEvents="box-none">
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <TouchableOpacity
                style={styles.backButtonDisabled}
                disabled
                accessibilityRole="button"
                accessibilityLabel="Voltar (desabilitado durante viagem)"
                accessibilityState={{ disabled: true }}>
                <Icon name={IconNames.back} size="md" color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.topBarTitle} numberOfLines={1}>
                  {currentViagem.tipo as string} · {currentViagem.horario as string}
                </Text>
                <Text style={styles.topBarSub} numberOfLines={1}>
                  {pontosRota.length > 0
                    ? `Próximo: ${pontosRota[0]?.apelido ?? '—'}`
                    : 'Em andamento'}
                </Text>
              </View>
            </View>
            <View style={styles.timerChip}>
              <Icon name={IconNames.schedule} size="sm" color={colors.success.contrast} />
              <Text
                style={styles.timerText}
                accessibilityLabel={`Tempo decorrido: ${formatarTempo(tempoDecorrido)}`}>
                {formatarTempo(tempoDecorrido)}
              </Text>
            </View>
          </View>
        </SafeAreaView>

        {/* Floating bottom: secondary actions + finalizar */}
        <View style={styles.floatingBottom}>
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setBroadcastVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Avisar alunos"
              accessibilityHint="Abre opções de mensagem rápida">
              <Icon name={IconNames.notifications} size="base" color={colors.primary.dark} />
              <Text style={styles.secondaryBtnText}>Avisar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                navigation.navigate('ListaAlunosConfirmados', { viagem: currentViagem })
              }
              accessibilityRole="button"
              accessibilityLabel="Ver alunos confirmados">
              <Icon name={IconNames.group} size="base" color={colors.primary.dark} />
              <Text style={styles.secondaryBtnText}>Alunos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, styles.secondaryBtnReport]}
              onPress={() => setReportVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Reportar problema">
              <Icon name={IconNames.warning} size="base" color={colors.warning.dark} />
              <Text style={[styles.secondaryBtnText, { color: colors.warning.dark }]}>Problema</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.finalizarButton, loading && styles.buttonDisabled]}
            onPress={handleFinalizarViagem}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Finalizar viagem"
            accessibilityState={{ disabled: loading }}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.text.inverse} />
            ) : (
              <>
                <Icon name={IconNames.stop} size="xl" color={colors.text.inverse} />
                <Text style={styles.finalizarButtonText}>Finalizar Viagem</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Broadcast Modal */}
        <Modal
          visible={broadcastVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setBroadcastVisible(false)}
          accessibilityViewIsModal>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              onPress={() => setBroadcastVisible(false)}
              activeOpacity={1}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} accessibilityElementsHidden />
              <Text style={styles.modalTitle} accessibilityRole="header">Avisar Alunos</Text>
              <Text style={styles.modalSubtitle}>
                Escolha uma mensagem rápida para enviar a todos os alunos desta viagem.
              </Text>
              {BROADCAST_TEMPLATES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.templateBtn}
                  onPress={() => handleBroadcast(t)}
                  disabled={sendingBroadcast}
                  accessibilityRole="button"
                  accessibilityLabel={t.label}
                  accessibilityHint={t.msg}>
                  {sendingBroadcast ? (
                    <ActivityIndicator color={colors.primary.main} />
                  ) : (
                    <>
                      <Icon name={t.icon} size="lg" color={colors.primary.main} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.templateBtnLabel}>{t.label}</Text>
                        <Text style={styles.templateBtnMsg} numberOfLines={1}>{t.msg}</Text>
                      </View>
                      <Icon name={IconNames.send} size="md" color={colors.primary.main} />
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <ReportSheet
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          viagemId={viagemId}
        />
      </View>
    );
  }

  // ── Pre-trip — summary + static map preview + iniciar ────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, styles.headerPre]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Voltar">
          <Icon name={IconNames.back} size="md" color={colors.primary.contrast} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.title} accessibilityRole="header">Iniciar Viagem</Text>
          <Text style={styles.headerSubtitle}>
            {currentViagem.tipo as string} · {currentViagem.horario as string}
          </Text>
        </View>
        <View style={styles.headerIcon}>
          <Icon name={IconNames.schedule} size="lg" color={colors.primary.contrast} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.preContent} showsVerticalScrollIndicator={false}>
        {/* Route summary card */}
        <View style={styles.card}>
          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: colors.success.main }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Origem</Text>
                <Text style={styles.routeName}>{(currentViagem.origem as string) || '—'}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: colors.error.main }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Destino</Text>
                <Text style={styles.routeName}>{(currentViagem.destino as string) || '—'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Icon name={IconNames.group} size="sm" color={colors.primary.dark} />
              <Text style={styles.infoValue}>
                {(currentViagem.alunos_confirmados_count as number) ?? 0}
                {' / '}
                {(currentViagem.total_alunos as number) ?? 0}
              </Text>
              <Text style={styles.infoLabel}>alunos</Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name={IconNames.location} size="sm" color={colors.primary.dark} />
              <Text style={styles.infoValue}>{pontosRota.length}</Text>
              <Text style={styles.infoLabel}>paradas</Text>
            </View>
          </View>
        </View>

        {/* Static map preview */}
        {pontosRota.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rota</Text>
            <StaticRouteMap pontosRota={pontosRota} />
          </View>
        )}

        {/* Stops list */}
        {pontosRota.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Paradas ({pontosRota.length})</Text>
            {pontosRota.map((ponto, index) => (
              <View key={ponto.id ?? index} style={styles.stopItem}>
                <View
                  style={[
                    styles.stopDot,
                    index === 0 && { backgroundColor: colors.success.main },
                    index === pontosRota.length - 1 && { backgroundColor: colors.error.main },
                  ]}
                >
                  <Text style={styles.stopDotText}>{index + 1}</Text>
                </View>
                {index < pontosRota.length - 1 && <View style={styles.stopLine} />}
                <View style={styles.stopInfo}>
                  <Text style={styles.stopName}>{ponto.apelido ?? `Ponto ${index + 1}`}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Iniciar button */}
        <TouchableOpacity
          style={[styles.iniciarButton, loading && styles.buttonDisabled]}
          onPress={handleIniciarViagem}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Iniciar viagem"
          accessibilityState={{ disabled: loading }}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.text.inverse} />
          ) : (
            <>
              <Icon name={IconNames.play} size="xl" color={colors.text.inverse} />
              <Text style={styles.iniciarButtonText}>Iniciar Viagem</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Broadcast Modal */}
      <Modal
        visible={broadcastVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBroadcastVisible(false)}
        accessibilityViewIsModal>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setBroadcastVisible(false)}
            activeOpacity={1}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} accessibilityElementsHidden />
            <Text style={styles.modalTitle} accessibilityRole="header">Avisar Alunos</Text>
            <Text style={styles.modalSubtitle}>
              Escolha uma mensagem rápida para enviar a todos os alunos desta viagem.
            </Text>
            {BROADCAST_TEMPLATES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.templateBtn}
                onPress={() => handleBroadcast(t)}
                disabled={sendingBroadcast}
                accessibilityRole="button"
                accessibilityLabel={t.label}>
                {sendingBroadcast ? (
                  <ActivityIndicator color={colors.primary.main} />
                ) : (
                  <>
                    <Icon name={t.icon} size="lg" color={colors.primary.main} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateBtnLabel}>{t.label}</Text>
                      <Text style={styles.templateBtnMsg} numberOfLines={1}>{t.msg}</Text>
                    </View>
                    <Icon name={IconNames.send} size="md" color={colors.primary.main} />
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <ReportSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        viagemId={viagemId}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },

  // ── Map (active trip) layout ───────────────────────────────────────────
  mapScreen: { flex: 1, backgroundColor: '#000' },

  floatingTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(3, 71, 208, 0.92)',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    ...shadows.lg,
  },
  topBarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  backButtonDisabled: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: { ...textStyles.body, color: '#fff', fontWeight: '700' as const },
  topBarSub: { ...textStyles.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success.main,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  timerText: { ...textStyles.body, color: '#fff', fontWeight: '700' as const, fontFamily: 'monospace' },

  floatingBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    ...shadows.xl,
  },
  secondaryRow: { flexDirection: 'row', gap: spacing.md },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.default,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    minHeight: 60,
  },
  secondaryBtnReport: { borderColor: colors.warning.main },
  secondaryBtnText: {
    ...textStyles.caption,
    color: colors.primary.dark,
    fontWeight: '600' as const,
  },

  // ── Pre-trip header ───────────────────────────────────────────────────
  header: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPre: { flexDirection: 'row', alignItems: 'center' },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { ...textStyles.h3, color: colors.primary.contrast },
  headerSubtitle: { ...textStyles.bodySmall, color: 'rgba(255,255,255,0.75)', marginTop: spacing.xs },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { ...textStyles.h4, color: colors.text.secondary },

  preContent: { padding: spacing.base, paddingBottom: spacing.xxxl },

  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  cardTitle: { ...textStyles.h4, color: colors.text.primary, marginBottom: spacing.md },

  // Route summary
  routeRow: { gap: spacing.sm },
  routePoint: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  routeDot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  routeLine: { width: 2, height: 20, backgroundColor: colors.border.light, marginLeft: 6 },
  routeLabel: { ...textStyles.caption, color: colors.text.secondary },
  routeName: { ...textStyles.body, color: colors.text.primary, fontWeight: '600' as const },

  divider: { height: 1, backgroundColor: colors.border.light, marginVertical: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around' },
  infoItem: { alignItems: 'center', gap: spacing.xs },
  infoValue: { ...textStyles.h4, color: colors.primary.dark },
  infoLabel: { ...textStyles.caption, color: colors.text.secondary },

  // Stops list
  stopItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  stopDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stopDotText: { ...textStyles.caption, color: '#fff', fontWeight: '700' as const },
  stopLine: {
    position: 'absolute',
    left: 13,
    top: 28,
    width: 2,
    height: spacing.xxl,
    backgroundColor: colors.border.light,
  },
  stopInfo: { flex: 1, marginLeft: spacing.md, paddingBottom: spacing.xl },
  stopName: { ...textStyles.body, color: colors.text.primary, paddingTop: spacing.xs },

  // Action buttons
  iniciarButton: {
    backgroundColor: colors.success.main,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 88,
    marginTop: spacing.sm,
    ...shadows.xl,
  },
  iniciarButtonText: {
    ...textStyles.button,
    color: colors.text.inverse,
    fontSize: fontSize.h3,
    fontWeight: '700' as const,
  },
  finalizarButton: {
    backgroundColor: colors.error.main,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 88,
    ...shadows.xl,
  },
  finalizarButtonText: {
    ...textStyles.button,
    color: colors.text.inverse,
    fontSize: fontSize.h3,
    fontWeight: '700' as const,
  },
  buttonDisabled: { opacity: 0.6 },

  // Broadcast modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: { ...textStyles.h3, color: colors.text.primary },
  modalSubtitle: { ...textStyles.bodySmall, color: colors.text.secondary },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
    backgroundColor: colors.primary.lighter,
    borderRadius: borderRadius.lg,
    minHeight: 64,
  },
  templateBtnLabel: { ...textStyles.h5, color: colors.primary.dark, fontWeight: '700' as const },
  templateBtnMsg: { ...textStyles.bodySmall, color: colors.text.secondary },
});

export default InicioFimViagem;
