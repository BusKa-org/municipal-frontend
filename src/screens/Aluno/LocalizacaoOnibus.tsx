import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { borderRadius, colors, shadows, spacing, textStyles } from '../../theme';
import Icon, { IconNames } from '../../components/Icon';
import { motoristaService } from '../../services/motoristaService';
import { alunoService } from '../../services';
import { LocationMap } from '../../features/map/index';
import { requestLocationPermission } from '../../features/map/hooks/useLocationPermission';
import { unwrapItems } from '../../types';
import type { PontoFlatResponse } from '../../types';

type RootParamList = Record<string, object | undefined>;
type Props = {
  navigation: NativeStackNavigationProp<RootParamList>;
  route: RouteProp<
    {
      LocalizacaoOnibus: {
        rota: Record<string, unknown>;
        viagem: Record<string, unknown>;
      };
    },
    'LocalizacaoOnibus'
  >;
};

interface LatLng {
  latitude: number;
  longitude: number;
}

let Geolocation: typeof navigator.geolocation | null = null;
try {
  Geolocation = require('@react-native-community/geolocation').default;
} catch {
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    Geolocation = navigator.geolocation;
  }
}

type EstadoOnibus = 'movimento' | 'parado' | 'semSinal';

// Distância mínima entre duas leituras para o ônibus contar como andando. Abaixo
// disso é ruído de GPS: a viagem da demonstração anda uns 16 m entre leituras.
const PARADO_M = 5;
const SEM_SINAL_S = 60;

export function estadoPorLeitura(
  anterior: LatLng | null,
  atual: LatLng,
  atrasoS: number,
): EstadoOnibus {
  if (atrasoS > SEM_SINAL_S) return 'semSinal';
  if (!anterior) return 'movimento';
  const andou = haversineMetros(
    anterior.latitude,
    anterior.longitude,
    atual.latitude,
    atual.longitude,
  );
  return andou < PARADO_M ? 'parado' : 'movimento';
}

const ESTADOS: Record<EstadoOnibus, { texto: string; cor: string }> = {
  movimento: { texto: 'Em movimento', cor: colors.success.main },
  parado: { texto: 'Ônibus parado', cor: colors.warning.main },
  semSinal: { texto: 'Sem sinal do ônibus', cor: colors.text.disabled },
};

function haversineMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutos(distanciaMetros: number): number {
  const km = distanciaMetros / 1000;
  return Math.max(1, Math.round((km / 25) * 60));
}

const LocalizacaoOnibus: React.FC<Props> = ({ navigation, route }) => {
  const { rota, viagem } = route?.params || {};
  const [alturaCabecalho, setAlturaCabecalho] = useState(0);
  const [alturaPainel, setAlturaPainel] = useState(0);

  const [posicaoMotorista, setPosicaoMotorista] = useState<LatLng | null>(null);
  const [posicaoAluno, setPosicaoAluno] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [distanciaMetros, setDistanciaMetros] = useState<number | null>(null);
  const [pontosRota, setPontosRota] = useState<PontoFlatResponse[]>([]);
  const [proximoPonto, setProximoPonto] = useState<PontoFlatResponse | null>(null);
  const [estadoOnibus, setEstadoOnibus] = useState<EstadoOnibus>('semSinal');
  const [mostrarEstado, setMostrarEstado] = useState(false);
  const posicaoAnterior = useRef<LatLng | null>(null);

  const viagemId = (viagem?.id ?? viagem?.viagem_id) as string | undefined;
  const rotaId = rota?.id as string | undefined;

  // Load route stops
  useEffect(() => {
    if (!rotaId) return;
    alunoService
      .listarPontosRota(rotaId)
      .then(unwrapItems)
      .then((pontos) => setPontosRota(pontos as PontoFlatResponse[]))
      .catch(() => setPontosRota([]));
  }, [rotaId]);

  // Derive next stop from bus position
  useEffect(() => {
    if (!posicaoMotorista || pontosRota.length === 0) {
      setProximoPonto(null);
      return;
    }
    const withDist = pontosRota
      .map((p) => {
        const pp = p as Record<string, unknown>;
        const lat = pp.latitude as number | undefined;
        const lon = pp.longitude as number | undefined;
        if (lat == null || lon == null) return null;
        return {
          ponto: p,
          dist: haversineMetros(posicaoMotorista.latitude, posicaoMotorista.longitude, lat, lon),
        };
      })
      .filter(Boolean) as { ponto: PontoFlatResponse; dist: number }[];

    if (withDist.length === 0) return;
    const nearest = withDist.reduce((a, b) => (a.dist < b.dist ? a : b));
    setProximoPonto(nearest.ponto);
  }, [posicaoMotorista, pontosRota]);

  const localizacaoPermitida = useRef(false);

  useEffect(() => {
    requestLocationPermission().then((ok) => {
      localizacaoPermitida.current = ok;
    });
  }, []);

  const obterMinhaPosicao = useCallback(() => {
    if (!Geolocation || !localizacaoPermitida.current) return;
    const guardar = (pos: { coords: { latitude: number; longitude: number } }) => {
      setPosicaoAluno({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    };
    Geolocation.getCurrentPosition(
      guardar,
      // Alta precisão depende do GPS, que não fixa dentro de prédio. A rede
      // responde nesse caso, com precisão menor.
      () =>
        Geolocation!.getCurrentPosition(guardar, () => {}, {
          enableHighAccuracy: false,
          timeout: 15_000,
          maximumAge: 60_000,
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );
  }, []);

  const buscarLocalizacao = useCallback(async () => {
    if (!viagemId) return;
    try {
      const dados = await motoristaService.obterLocalizacao(viagemId);
      const loc = dados as unknown as Record<string, number>;
      const nova = { latitude: loc.latitude, longitude: loc.longitude };
      const enviadoEm = (dados as unknown as Record<string, string>).atualizado_em;
      const atrasoS = enviadoEm ? (Date.now() - new Date(enviadoEm).getTime()) / 1000 : 0;
      const anterior = posicaoAnterior.current;
      posicaoAnterior.current = nova;
      setPosicaoMotorista(nova);
      setEstadoOnibus(estadoPorLeitura(anterior, nova, atrasoS));
      obterMinhaPosicao();
    } catch {
      // Mantém a última posição na tela, mas o selo passa a dizer que não há sinal.
      setEstadoOnibus('semSinal');
    } finally {
      setLoading(false);
    }
  }, [viagemId, obterMinhaPosicao]);

  useEffect(() => {
    buscarLocalizacao();
    const interval = setInterval(buscarLocalizacao, 5_000);
    return () => clearInterval(interval);
  }, [buscarLocalizacao]);

  useEffect(() => {
    if (!posicaoMotorista || !posicaoAluno) return;
    const metros = haversineMetros(
      posicaoAluno.latitude,
      posicaoAluno.longitude,
      posicaoMotorista.latitude,
      posicaoMotorista.longitude,
    );
    setDistanciaMetros(metros);
  }, [posicaoMotorista, posicaoAluno]);

  if (!rota || !viagem) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Voltar">
              <Icon name={IconNames.back} size="md" color={colors.primary.contrast} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Localização do Ônibus</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyContent}>
          <Icon name={IconNames.warning} size="xxl" color={colors.warning.main} />
          <Text style={styles.emptyText}>Dados da rota não disponíveis</Text>
        </View>
      </SafeAreaView>
    );
  }

  const etaParaOnibus =
    distanciaMetros != null ? etaMinutos(distanciaMetros) : null;
  const etaParaProximoPonto =
    posicaoMotorista && proximoPonto
      ? (() => {
          const pp = proximoPonto as Record<string, unknown>;
          const lat = pp.latitude as number | undefined;
          const lon = pp.longitude as number | undefined;
          if (lat == null || lon == null) return null;
          const d = haversineMetros(posicaoMotorista.latitude, posicaoMotorista.longitude, lat, lon);
          return etaMinutos(d);
        })()
      : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Mapa de fundo, ocupando a tela inteira */}
      <View style={styles.mapaFundo}>
        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={styles.mapLoadingText}>Buscando localização do ônibus...</Text>
          </View>
        ) : (
          <LocationMap
            pontosRota={pontosRota}
            posicaoOnibus={posicaoMotorista}
            proximaParadaId={
              proximoPonto ? ((proximoPonto as Record<string, unknown>).id as string) : null
            }
            posicaoAluno={posicaoAluno}
            margemSuperior={alturaCabecalho}
            margemInferior={alturaPainel}
          />
        )}
      </View>

      {/* Estado do ônibus, sobre o mapa */}
      <TouchableOpacity
        style={[styles.bolhaEstado, { top: alturaCabecalho + 12 }]}
        onPress={() => setMostrarEstado((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`Estado: ${ESTADOS[estadoOnibus].texto}`}>
        <View style={[styles.bolhaPonto, { backgroundColor: ESTADOS[estadoOnibus].cor }]} />
        {mostrarEstado && <Text style={styles.bolhaTexto}>{ESTADOS[estadoOnibus].texto}</Text>}
      </TouchableOpacity>

      {/* Header */}
      <View
        style={styles.header}
        onLayout={(e) => setAlturaCabecalho(e.nativeEvent.layout.height)}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Voltar">
            <Icon name={IconNames.back} size="md" color={colors.primary.contrast} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Localização
            </Text>
            <Text style={styles.headerSubtitle}>{rota.nome as string}</Text>
          </View>
          <View style={styles.headerIcon}>
            <Icon name={IconNames.bus} size="lg" color={colors.primary.contrast} />
          </View>
        </View>
      </View>

      {/* Info Panel */}
      <View
        style={styles.infoPanel}
        onLayout={(e) => setAlturaPainel(e.nativeEvent.layout.height)}>
        {/* Próxima parada, cabeçalho do painel */}
        {proximoPonto && etaParaProximoPonto != null && (
          <>
            <View
              style={styles.proximaParada}
              accessible
              accessibilityLabel={`Próxima parada: ${(proximoPonto as Record<string, unknown>).apelido as string}, estimativa de ${etaParaProximoPonto} minutos`}>
              <View style={styles.proximaIcone}>
                <Icon name={IconNames.location} size="md" color={colors.primary.main} />
              </View>
              <View style={styles.proximaTextos}>
                <Text style={styles.proximaRotulo}>PRÓXIMA PARADA</Text>
                <Text style={styles.proximaNome} numberOfLines={2}>
                  {(proximoPonto as Record<string, unknown>).apelido as string}
                </Text>
              </View>
              <Text style={styles.proximaEta}>~{etaParaProximoPonto} min</Text>
            </View>
            <View style={styles.divisorPainel} />
          </>
        )}

        {/* Distance & ETA to the bus */}
        <View style={styles.infoRow}>
          <View
            style={styles.infoItem}
            accessible
            accessibilityLabel={
              distanciaMetros == null
                ? 'Distância até você: indisponível'
                : distanciaMetros >= 1000
                ? `Distância até você: ${(distanciaMetros / 1000).toFixed(1)} quilômetros`
                : `Distância até você: ${Math.round(distanciaMetros)} metros`
            }>
            <View style={styles.infoIconContainer}>
              <Icon name="straighten" size="md" color={colors.primary.main} />
            </View>
            <Text style={styles.infoLabel}>Distância até você</Text>
            <Text style={styles.infoValue}>
              {distanciaMetros == null
                ? '—'
                : distanciaMetros >= 1000
                ? `${(distanciaMetros / 1000).toFixed(1)} km`
                : `${Math.round(distanciaMetros)} m`}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View
            style={styles.infoItem}
            accessible
            accessibilityLabel={
              etaParaOnibus == null
                ? 'Tempo estimado: indisponível'
                : `Tempo estimado até o ônibus: ${etaParaOnibus} minutos`
            }>
            <View style={styles.infoIconContainer}>
              <Icon name={IconNames.schedule} size="md" color={colors.primary.main} />
            </View>
            <Text style={styles.infoLabel}>Tempo estimado</Text>
            <Text style={styles.infoValue}>
              {etaParaOnibus == null ? '—' : `${etaParaOnibus} min`}
            </Text>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // flex para o celular, height para o navegador: no web o container pai é
  // display:block e o flex fica inerte, deixando a tela sem altura.
  container: { flex: 1, height: '100%', backgroundColor: colors.background.default },

  header: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius.xxl,
    borderBottomRightRadius: borderRadius.xxl,
    zIndex: 100,
    elevation: 10,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: { flex: 1, marginLeft: spacing.md },
  headerTitle: { ...textStyles.h3, color: colors.primary.contrast },
  headerSubtitle: {
    ...textStyles.bodySmall,
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.xs,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },

  proximaParada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  proximaIcone: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Sem flex aqui o nome longo empurra o tempo para fora da tela.
  proximaTextos: { flex: 1 },
  proximaRotulo: {
    ...textStyles.caption,
    color: colors.text.secondary,
    letterSpacing: 0.6,
    marginBottom: spacing.xxs,
  },
  proximaNome: { ...textStyles.body, color: colors.text.primary, fontWeight: '600' },
  proximaEta: { ...textStyles.h3, color: colors.primary.main },
  divisorPainel: {
    height: 1,
    backgroundColor: colors.border.light,
    marginBottom: spacing.base,
  },

  mapaFundo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.neutral[100],
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  mapLoadingText: { ...textStyles.body, color: colors.text.secondary },

  infoPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // O padding de baixo é maior de propósito: em telefone a barra de navegação
    // do sistema come uns pixels da borda, e sem folga o selo de status some.
    backgroundColor: colors.background.paper,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    ...shadows.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  infoItem: { alignItems: 'center', flex: 1 },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.lighter,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: { ...textStyles.caption, color: colors.text.secondary, marginBottom: spacing.xxs },
  infoValue: { ...textStyles.h3, color: colors.primary.main },
  infoDivider: { width: 1, backgroundColor: colors.border.light, marginHorizontal: spacing.base },

  bolhaEstado: {
    position: 'absolute',
    left: spacing.base,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...shadows.md,
  },
  bolhaPonto: { width: 12, height: 12, borderRadius: 6 },
  bolhaTexto: { ...textStyles.caption, color: colors.text.secondary },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
  },
  emptyText: { ...textStyles.body, color: colors.text.secondary },
});

export default LocalizacaoOnibus;
