import { api } from '../api/client';
import type { InstituicaoResponse } from '../types';

type InstituicaoListPayload = {
  items?: InstituicaoResponse[];
  total?: number;
};

export const instituicaoService = {
  async listar(): Promise<InstituicaoResponse[]> {
    const response = await api.get<InstituicaoListPayload>('/instituicoes/');
    return response.data?.items ?? [];
  },
};

export default instituicaoService;
