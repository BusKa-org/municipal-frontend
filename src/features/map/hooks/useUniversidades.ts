import { useEffect, useState } from 'react';
import { instituicaoService } from '../../../services/instituicaoService';
import type { InstituicaoResponse } from '../../../types';
import { errorLogger } from '../../../utils/errors';

export type Universidade = {
  id: string;
  nome: string;
  sigla: string;
  latitude: number;
  longitude: number;
};

const TIPOS_SUPERIORES = new Set([
  'universidade publica',
  'universidade pública',
  'universidade privada',
  'instituto federal',
]);

export function isEnsinoSuperior(tipo: unknown): boolean {
  if (typeof tipo !== 'string') return false;
  return TIPOS_SUPERIORES.has(tipo.trim().toLowerCase().replace(/_/g, ' '));
}

function extrairSigla(inst: InstituicaoResponse): string {
  if (inst.sigla) return inst.sigla;
  const nome = inst.nome ?? '';
  const entreParenteses = nome.match(/\(([^)]{2,12})\)/);
  if (entreParenteses) return entreParenteses[1];
  return nome || 'Instituição';
}

export function toUniversidade(inst: InstituicaoResponse): Universidade | null {
  const lat = Number(inst.latitude);
  const lng = Number(inst.longitude);
  if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) return null;
  return {
    id: String(inst.id ?? `${lat},${lng}`),
    nome: inst.nome ?? 'Instituição',
    sigla: extrairSigla(inst),
    latitude: lat,
    longitude: lng,
  };
}

export function useUniversidades(enabled = true) {
  const [universidades, setUniversidades] = useState<Universidade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let ativo = true;
    setLoading(true);

    instituicaoService
      .listar()
      .then((lista) => {
        if (!ativo) return;
        setUniversidades(
          lista
            .filter((i) => isEnsinoSuperior(i.tipo))
            .map(toUniversidade)
            .filter((u): u is Universidade => u !== null),
        );
      })
      .catch((error) => {
        errorLogger.debug('Nao foi possivel carregar instituicoes', { error });
        if (ativo) setUniversidades([]);
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, [enabled]);

  return { universidades, loading };
}
