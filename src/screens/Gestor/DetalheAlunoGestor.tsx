import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../../api/client';
import Icon from '../../components/Icon';
import { LoadingView, ErrorView } from '../../components/LoadingState';
import { useToast } from '../../components/Toast';
import { useFetch } from '../../hooks';
import { borderRadius, colors, shadows, spacing, textStyles } from '../../theme';
import type { AlunoResponse } from '../../types';

// ─── Component ────────────────────────────────────────────────────────────────

const DetalheAlunoGestor = ({ route, navigation }: any) => {
  const { alunoId } = route.params as { alunoId: string };
  const toast = useToast();
  const [aprovando, setAprovando] = useState(false);

  const fetchAluno = useCallback(
    () => api.get<AlunoResponse>(`/alunos/${alunoId}`).then(r => r.data),
    [alunoId],
  );

  const { data: aluno, isLoading, isError, error, refetch } = useFetch<AlunoResponse>(
    fetchAluno,
    [alunoId],
    { showErrorToast: true },
  );

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleAprovar = () => {
    Alert.alert(
      'Aprovar cadastro',
      `Deseja aprovar o cadastro de ${aluno?.nome}? O aluno será notificado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: async () => {
            setAprovando(true);
            try {
              await api.post(`/alunos/${alunoId}/aprovar`);
              toast.success('Aluno aprovado!');
              await refetch();
            } catch (e: any) {
              toast.error(e?.message ?? 'Não foi possível aprovar o aluno.');
            } finally {
              setAprovando(false);
            }
          },
        },
      ],
    );
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  };

  const fmtDatetime = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    return (
      `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}` +
      `/${d.getFullYear()} às ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    );
  };

  const calcAge = (iso: string | null | undefined): number | null => {
    if (!iso) return null;
    const birth = new Date(iso);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) age--;
    return age;
  };

  const statusLabel: Record<string, string> = {
    ACTIVE: 'Ativo',
    PENDING_APPROVAL: 'Aguardando aprovação',
    PENDING_SIGNUP: 'Cadastro incompleto',
    DISABLED: 'Desativado',
  };

  const statusColor: Record<string, string> = {
    ACTIVE: colors.success?.main ?? '#22c55e',
    PENDING_APPROVAL: colors.warning.dark,
    PENDING_SIGNUP: colors.text.secondary,
    DISABLED: colors.error.main,
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingView message="Carregando..." />;
  if (isError || !aluno) {
    return (
      <SafeAreaView style={styles.root}>
        <ErrorView message={error?.message ?? 'Erro ao carregar aluno'} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const age = calcAge(aluno.data_nascimento);
  const consentedAt = fmtDatetime(aluno.guardian_consented_at);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size="md" color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{aluno.nome}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor[aluno.status ?? ''] ?? colors.text.disabled }]} />
            <Text style={styles.statusText}>{statusLabel[aluno.status ?? ''] ?? aluno.status}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Section: Minor info */}
        <SectionCard title="Dados do Estudante" icon="person">
          <InfoRow label="Nome completo" value={aluno.nome} />
          <InfoRow label="E-mail" value={aluno.email} />
          <InfoRow label="CPF" value={aluno.cpf} />
          <InfoRow label="Telefone" value={aluno.telefone} />
          <InfoRow
            label="Data de nascimento"
            value={aluno.data_nascimento ? `${fmtDate(aluno.data_nascimento)}${age !== null ? ` (${age} anos)` : ''}` : undefined}
          />
          <InfoRow label="Matrícula" value={aluno.matricula} />
          <InfoRow label="Instituição" value={aluno.escola} />
        </SectionCard>

        {/* Section: Guardian info (minor only) */}
        {aluno.is_minor && (
          <SectionCard title="Dados do Responsável Legal" icon="family-restroom">
            <InfoRow label="E-mail do responsável" value={aluno.email_responsavel} />
            <InfoRow label="Nome do responsável" value={aluno.nome_responsavel} />
            <InfoRow label="CPF do responsável" value={aluno.cpf_responsavel} />
            <View style={styles.consentRow}>
              {aluno.guardian_consented_at ? (
                <>
                  <Icon name="verified-user" size="sm" color={colors.success?.main ?? '#22c55e'} />
                  <Text style={[styles.consentText, { color: colors.success?.main ?? '#22c55e' }]}>
                    Consentimento registrado em {consentedAt}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="schedule" size="sm" color={colors.warning.dark} />
                  <Text style={[styles.consentText, { color: colors.warning.dark }]}>
                    Aguardando consentimento do responsável
                  </Text>
                </>
              )}
            </View>
          </SectionCard>
        )}

        {/* Approve button */}
        {aluno.status === 'PENDING_APPROVAL' && (
          <TouchableOpacity
            style={[styles.approveBtn, aprovando && styles.approveBtnDisabled]}
            onPress={handleAprovar}
            disabled={aprovando}
            accessibilityRole="button"
            accessibilityLabel="Aprovar cadastro">
            {aprovando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size="md" color="#fff" />
                <Text style={styles.approveBtnText}>Aprovar cadastro</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Section card ─────────────────────────────────────────────────────────────

const SectionCard = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconBadge}>
        <Icon name={icon} size="sm" color={colors.roles?.gestor ?? '#2563eb'} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

// ─── Info row ─────────────────────────────────────────────────────────────────

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value ?? '—'}</Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.roles?.gestor ?? '#2563eb',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: borderRadius.xxl ?? 24,
    borderBottomRightRadius: borderRadius.xxl ?? 24,
    gap: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    ...textStyles.h2,
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...textStyles.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${colors.roles?.gestor ?? '#2563eb'}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    ...textStyles.body,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  sectionBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  infoLabel: {
    ...textStyles.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  infoValue: {
    ...textStyles.caption,
    color: colors.text.primary,
    fontWeight: '600' as const,
    flex: 1,
    textAlign: 'right',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  consentText: {
    ...textStyles.caption,
    flex: 1,
    fontWeight: '600' as const,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success?.main ?? '#22c55e',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.base,
    marginTop: spacing.sm,
    ...shadows.sm,
  },
  approveBtnDisabled: {
    opacity: 0.6,
  },
  approveBtnText: {
    ...textStyles.button,
    color: '#fff',
    fontWeight: '700' as const,
  },
});

export default DetalheAlunoGestor;
