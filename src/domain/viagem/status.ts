import { colors } from '../../theme';

export const STATUS_VIAGEM = {
  AGENDADA: 'AGENDADA',
  EM_ANDAMENTO: 'EM_ANDAMENTO',
  FINALIZADA: 'FINALIZADA',
  CANCELADA: 'CANCELADA',
} as const;

export type StatusViagem = (typeof STATUS_VIAGEM)[keyof typeof STATUS_VIAGEM];

export const STATUS_VIAGEM_VALUES: StatusViagem[] = [
  STATUS_VIAGEM.AGENDADA,
  STATUS_VIAGEM.EM_ANDAMENTO,
  STATUS_VIAGEM.FINALIZADA,
  STATUS_VIAGEM.CANCELADA,
];

const STATUS_PADRAO: StatusViagem = STATUS_VIAGEM.AGENDADA;

function isStatusViagem(value: unknown): value is StatusViagem {
  return typeof value === 'string' && value in STATUS_VIAGEM;
}

export function normalizeStatusViagem(raw: unknown): StatusViagem {
  return isStatusViagem(raw) ? raw : STATUS_PADRAO;
}

export function getStatusViagem(viagem: unknown): StatusViagem {
  if (!viagem || typeof viagem !== 'object') return STATUS_PADRAO;
  const registro = viagem as Record<string, unknown>;
  return normalizeStatusViagem(registro.status_viagem ?? registro.status);
}

export type PublicoStatus = 'padrao' | 'motorista';

const LABELS: Record<PublicoStatus, Record<StatusViagem, string>> = {
  padrao: {
    AGENDADA: 'Agendada',
    EM_ANDAMENTO: 'Em andamento',
    FINALIZADA: 'Finalizada',
    CANCELADA: 'Cancelada',
  },
  motorista: {
    AGENDADA: 'A iniciar',
    EM_ANDAMENTO: 'Em andamento',
    FINALIZADA: 'Finalizada',
    CANCELADA: 'Cancelada',
  },
};

export function getStatusLabel(
  status: unknown,
  publico: PublicoStatus = 'padrao',
): string {
  return LABELS[publico][normalizeStatusViagem(status)];
}

export type StatusTone = { fg: string; bg: string };

const TONES: Record<StatusViagem, StatusTone> = {
  AGENDADA: { fg: colors.warning.main, bg: colors.warning.light },
  EM_ANDAMENTO: { fg: colors.info.main, bg: colors.info.light },
  FINALIZADA: { fg: colors.success.main, bg: colors.success.light },
  CANCELADA: { fg: colors.error.main, bg: colors.error.light },
};

export const TONE_DESCONHECIDO: StatusTone = {
  fg: colors.text.hint,
  bg: colors.neutral[100],
};

export function getStatusTone(status: unknown): StatusTone {
  return TONES[normalizeStatusViagem(status)];
}

export function getStatusColor(status: unknown): string {
  return getStatusTone(status).fg;
}

export function podeIniciar(status: unknown): boolean {
  return normalizeStatusViagem(status) === STATUS_VIAGEM.AGENDADA;
}

export function podeFinalizar(status: unknown): boolean {
  return normalizeStatusViagem(status) === STATUS_VIAGEM.EM_ANDAMENTO;
}

export function podeCancelar(status: unknown): boolean {
  return normalizeStatusViagem(status) === STATUS_VIAGEM.AGENDADA;
}

export function isEmAndamento(status: unknown): boolean {
  return normalizeStatusViagem(status) === STATUS_VIAGEM.EM_ANDAMENTO;
}

export function isTerminal(status: unknown): boolean {
  const s = normalizeStatusViagem(status);
  return s === STATUS_VIAGEM.FINALIZADA || s === STATUS_VIAGEM.CANCELADA;
}

export const STATUS_PRIORIDADE: StatusViagem[] = [
  STATUS_VIAGEM.EM_ANDAMENTO,
  STATUS_VIAGEM.AGENDADA,
  STATUS_VIAGEM.CANCELADA,
  STATUS_VIAGEM.FINALIZADA,
];

export function compararPorPrioridade(a: unknown, b: unknown): number {
  return (
    STATUS_PRIORIDADE.indexOf(normalizeStatusViagem(a)) -
    STATUS_PRIORIDADE.indexOf(normalizeStatusViagem(b))
  );
}
