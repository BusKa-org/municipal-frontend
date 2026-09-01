import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
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

  const [posicaoMotorista, setPosicaoMotorista] = useState<LatLng | null>(null);
  const [posicaoAluno, setPosicaoAluno] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [distanciaMetros, setDistanciaMetros] = useState<number | null>(null);
  const [pontosRota, setPontosRota] = useState<PontoFlatResponse[]>([]);
  const [proximoPonto, setProximoPonto] = useState<PontoFlatResponse | null>(null);

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
      setPosicaoMotorista({
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      obterMinhaPosicao();
    } catch {
      // keep showing last known position
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

  const pontosRotaMapa = posicaoMotorista
    ? [{ latitude: posicaoMotorista.latitude, longitude: posicaoMotorista.longitude }]
    : [];

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
      {/* Header */}
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

      {/* Próximo ponto ETA chip (above map) */}
      {proximoPonto && etaParaProximoPonto != null && (
        <View
          style={styles.etaChip}
          accessible
          accessibilityLabel={`Próximo ponto: ${(proximoPonto as Record<string, unknown>).apelido as string}, estimativa de ${etaParaProximoPonto} minutos`}>
          <Icon name={IconNames.schedule} size="sm" color={colors.primary.dark} />
          <Text style={styles.etaChipText}>
            Próximo:{' '}
            <Text style={styles.etaChipBold}>
              {(proximoPonto as Record<string, unknown>).apelido as string}
            </Text>
            {'  '}~{etaParaProximoPonto} min
          </Text>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapaContainer}>
        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text style={styles.mapLoadingText}>Buscando localização do ônibus...</Text>
          </View>
        ) : (
          <LocationMap pontosRota={pontosRotaMapa} />
        )}
      </View>

      {/* Info Panel */}
      <View style={styles.infoPanel}>
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

        {/* Next stops list (compact) */}
        {pontosRota.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stopsScroll}
            accessibilityLabel="Lista de pontos da rota">
            {pontosRota.map((ponto, idx) => {
              const pp = ponto as Record<string, unknown>;
              const isNext =
                proximoPonto &&
                (proximoPonto as Record<string, unknown>).id === pp.id;
              return (
                <View
                  key={pp.id as string}
                  style={[styles.stopChip, isNext && styles.stopChipNext]}
                  accessible
                  accessibilityLabel={`Ponto ${idx + 1}: ${pp.apelido as string}${isNext ? ', próximo ponto' : ''}`}>
                  <Text style={[styles.stopChipIdx, isNext && styles.stopChipIdxNext]}>
                    {idx + 1}
                  </Text>
                  <Text
                    style={[styles.stopChipLabel, isNext && styles.stopChipLabelNext]}
                    numberOfLines={1}>
                    {pp.apelido as string}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Status badge */}
        <View style={styles.statusContainer}>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Em movimento</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },

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

  etaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
    backgroundColor: colors.primary.lighter,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    zIndex: 10,
  },
  etaChipText: { ...textStyles.bodySmall, color: colors.primary.dark },
  etaChipBold: { fontWeight: '700' },

  mapaContainer: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
  },
  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  mapLoadingText: { ...textStyles.body, color: colors.text.secondary },

  infoPanel: {
    backgroundColor: colors.background.paper,
    padding: spacing.lg,
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

  // Next stops strip
  stopsScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  stopChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.default,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    maxWidth: 140,
  },
  stopChipNext: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  stopChipIdx: {
    ...textStyles.caption,
    color: colors.text.secondary,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  stopChipIdxNext: { color: colors.text.inverse },
  stopChipLabel: { ...textStyles.caption, color: colors.text.secondary, flex: 1 },
  stopChipLabelNext: { color: colors.text.inverse, fontWeight: '600' },

  statusContainer: { alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success.light,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success.main,
    marginRight: spacing.sm,
  },
  statusText: { ...textStyles.bodySmall, color: colors.success.dark, fontWeight: '600' },

  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.base,
  },
  emptyText: { ...textStyles.body, color: colors.text.secondary },
});

export default LocalizacaoOnibus;
