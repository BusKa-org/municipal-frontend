export {
  STATUS_VIAGEM,
  STATUS_VIAGEM_VALUES,
  STATUS_PRIORIDADE,
  TONE_DESCONHECIDO,
  normalizeStatusViagem,
  getStatusViagem,
  getStatusLabel,
  getStatusTone,
  getStatusColor,
  podeIniciar,
  podeFinalizar,
  podeCancelar,
  isEmAndamento,
  isTerminal,
  compararPorPrioridade,
} from './status';

export type { StatusViagem, PublicoStatus, StatusTone } from './status';
