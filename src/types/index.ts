import type { components, operations } from './openapi';

type Schemas = components['schemas'];
type ListAllViagens = operations['list_all_viagens'];

// Generic shape for all paginated list responses from this backend.
// If the backend ever changes a response to a plain array or a different
// envelope, regenerating openapi.ts will cause a type error here,
// pointing you to exactly what broke.
export type ListResponse<T> = {
  items?: T[];
  total?: number;
};

// Safely extracts the items array from any paginated response or plain array.
export const unwrapItems = <T>(response: ListResponse<T> | T[]): T[] => {
  if (Array.isArray(response)) {
    return response;
  }
  return response.items ?? [];
};

// Auth
export type LoginRequest = Schemas['LoginRequest'];
export type TokenResponse = Schemas['TokenResponse'];
export type UserInfo = Schemas['UserInfo'];
export type ForgotPasswordRequest = Schemas['ForgotPasswordRequest'];
export type ChangePasswordRequest = Schemas['ChangePasswordRequest'];
export type ChangePasswordResponse = Schemas['ChangePasswordResponse'];

// Users
export type UserResponse = Schemas['UserResponse'];
export type UserListResponse = Schemas['UserListResponse'];

// Alunos
export type AlunoResponse = Schemas['AlunoResponse'] & {
  // Guardian consent fields (added after openapi was generated)
  data_nascimento?: string | null;
  is_minor?: boolean;
  email_responsavel?: string | null;
  nome_responsavel?: string | null;
  cpf_responsavel?: string | null;
  guardian_consented_at?: string | null;
};
export type AlunoListResponse = Schemas['AlunoListResponse'];
export type AlunoSelfSignupRequest = Schemas['AlunoSelfSignupRequest'] & {
  data_nascimento: string;
  email_responsavel?: string;
};
export type AlunoMeUpdateRequest = Schemas['AlunoMeUpdateRequest'];
export type AlunoProvisionAccountRequest = Schemas['AlunoProvisionAccountRequest'];

// Motoristas
export type MotoristaCreateRequest = Schemas['MotoristaCreateRequest'];

// Onibus
export type OnibusResponse = Schemas['OnibusResponse'];
export type OnibusListResponse = Schemas['OnibusListResponse'];
export type OnibusCreateRequest = Schemas['OnibusCreateRequest'];

// Rotas
export type RotaResponse = Schemas['RotaResponse'];
export type RotaListResponse = Schemas['RotaListResponse'];
export type RotaDetailResponse = Schemas['RotaDetailResponse'];
export type RotaCreateRequest = Schemas['RotaCreateRequest'];
export type RotaUpdateRequest = Schemas['RotaUpdateRequest'];
export type RotaPontoAddRequest = Schemas['RotaPontoAddRequest'];
export type RotaPontosAddRequest = Schemas['RotaPontosAddRequest'];
export type RotaInscricaoRequest = Schemas['RotaInscricaoRequest'];
export type RotaHorarioResponse = Schemas['RotaHorarioResponse'];
export type RotaHorarioListResponse = Schemas['RotaHorarioListResponse'];
export type RotaHorarioCreateRequest = Schemas['RotaHorarioCreateRequest'];

// Pontos
export type PontoResponse = Schemas['PontoResponse'];
export type PontoListResponse = Schemas['PontoListResponse'];
export type PontoFlatResponse = Schemas['PontoFlatResponse'];
export type PontoFlatListResponse = Schemas['PontoFlatListResponse'];
export type PontoCreateRequest = Schemas['PontoCreateRequest'];
export type PontoUpdateRequest = Schemas['PontoUpdateRequest'];
export type PontoProgresso = Schemas['PontoProgresso'];
export type PontoTelemetria = Schemas['PontoTelemetria'];

// Viagens
export type ViagemResponse = Schemas['ViagemResponse'];
export type ViagemListResponse = Schemas['ViagemListResponse'];
export type ViagemCreateRequest = Schemas['ViagemCreateRequest'];
export type ViagemLoteRequest = Schemas['ViagemLoteRequest'];
export type ViagemLoteResponse = Schemas['ViagemLoteResponse'];
export type ViagemAcaoRequest = Schemas['ViagemAcaoRequest'];
export type ViagemConfirmacaoRequest = Schemas['ViagemConfirmacaoRequest'];
export type ViagemAlunoConfirmacaoResponse = Schemas['ViagemAlunoConfirmacaoResponse'];
export type ViagemAgendaAlunoResponse = Schemas['ViagemAgendaAlunoResponse'];
export type ViagemAgendaAlunoListResponse = Schemas['ViagemAgendaAlunoListResponse'];
export type ViagemListQueryParams = ListAllViagens['parameters']['query'];

// Instituicoes
export type InstituicaoResponse = Schemas['InstituicaoResponse'] & {
  latitude?: number | null;
  longitude?: number | null;
};
export type InstituicaoListResponse = Schemas['InstituicaoListResponse'];
export type InstituicaoCreateRequest = Schemas['InstituicaoCreateRequest'];
export type InstituicaoEnderecoInput = Schemas['InstituicaoEnderecoInput'];

// Shared
export type EnderecoInput = Schemas['EnderecoInput'];
export type LocalizacaoRequest = Schemas['LocalizacaoRequest'];
export type NotificacaoInput = Schemas['NotificacaoInput'];
export type FcmTokenRequest = Schemas['FcmTokenRequest'];
export type RelatorioEstatisticas = Schemas['RelatorioEstatisticas'];

// Notificacao (runtime inbox shape — not in openapi)
export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  enviada: boolean;
  data_envio: string | null;
}

// Ocorrencia — issue reporting (new endpoint /v1/ocorrencias)
export type TipoOcorrencia =
  | 'ATRASO'
  | 'SUPERLOTACAO'
  | 'COMPORTAMENTO'
  | 'CANCELAMENTO'
  | 'OUTRO';

export type StatusOcorrencia = 'ABERTA' | 'RESOLVIDA';

export interface OcorrenciaCreateRequest {
  tipo: TipoOcorrencia;
  descricao?: string;
  viagem_id?: string;
}

export interface OcorrenciaResponse {
  id: string;
  autor_id: string;
  autor_nome: string;
  viagem_id: string | null;
  tipo: TipoOcorrencia;
  descricao: string | null;
  status: StatusOcorrencia;
  created_at: string;
}

// Minor approval — PENDING_APPROVAL extension on aluno status
export type AlunoApprovalStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'PENDING_SIGNUP' | 'DISABLED';

// Capacity info derived from ViagemResponse fields
export interface CapacidadeInfo {
  alunosConfirmados: number;
  capacidadeTotal: number;
  percentual: number;
  quaseLotado: boolean;
}
