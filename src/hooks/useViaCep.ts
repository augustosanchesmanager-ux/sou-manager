/**
 * [SMG][HOOK] useViaCep — autofill de endereço via ViaCEP.
 *
 * Núcleo puro (`fetchViaCepAddress`) + hook que gerencia loading/mensagem,
 * deduplica um CEP já buscado com sucesso nesta instância e descarta respostas
 * obsoletas quando uma nova consulta a substitui. O hook devolve o endereço
 * cru; o consumidor decide como aplicá-lo ao formulário (preenchimento apenas
 * de campos vazios). Não há validação de tamanho no núcleo — o chamador faz o
 * gate de 8 dígitos.
 */

import { useCallback, useRef, useState } from 'react';

export interface ViaCepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type ViaCepResult =
  | { ok: true; address: ViaCepAddress }
  | { ok: false; error: 'not_found' | 'network' };

const VIACEP_MESSAGES = {
  success: 'Endereço preenchido automaticamente pelo CEP.',
  not_found: 'CEP não encontrado. Preencha o endereço manualmente.',
  network: 'Não foi possível consultar o CEP agora. Continue com preenchimento manual.',
} as const;

/** Mensagem pt-BR correspondente ao resultado da consulta. */
export function resolveViaCepMessage(result: ViaCepResult): string {
  if ('error' in result) {
    return VIACEP_MESSAGES[result.error];
  }
  return VIACEP_MESSAGES.success;
}

/** Dedupe: pular a consulta quando o CEP já foi buscado com sucesso. */
export function shouldSkipViaCepFetch(lastFetchedCep: string | null, cepDigits: string): boolean {
  return lastFetchedCep !== null && lastFetchedCep === cepDigits;
}

/** Resposta obsoleta: uma consulta mais nova já foi disparada. */
export function isStaleViaCepRequest(requestId: number, latestRequestId: number): boolean {
  return requestId !== latestRequestId;
}

export async function fetchViaCepAddress(cepDigits: string): Promise<ViaCepResult> {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const data = await response.json();

    if (!response.ok || data?.erro) {
      return { ok: false, error: 'not_found' };
    }

    return {
      ok: true,
      address: {
        street: String(data.logradouro ?? '').trim(),
        neighborhood: String(data.bairro ?? '').trim(),
        city: String(data.localidade ?? '').trim(),
        state: String(data.uf ?? '').trim(),
      },
    };
  } catch {
    return { ok: false, error: 'network' };
  }
}

export function useViaCep(): {
  loading: boolean;
  message: string | null;
  fetchAddress: (cepDigits: string) => Promise<ViaCepAddress | null>;
} {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastFetchedCepRef = useRef<string | null>(null);
  const lastAddressRef = useRef<ViaCepAddress | null>(null);
  const latestRequestIdRef = useRef(0);

  const fetchAddress = useCallback(async (cepDigits: string): Promise<ViaCepAddress | null> => {
    if (shouldSkipViaCepFetch(lastFetchedCepRef.current, cepDigits)) {
      return lastAddressRef.current;
    }

    latestRequestIdRef.current += 1;
    const requestId = latestRequestIdRef.current;

    setLoading(true);
    setMessage(null);

    const result = await fetchViaCepAddress(cepDigits);

    if (isStaleViaCepRequest(requestId, latestRequestIdRef.current)) {
      return null;
    }

    setLoading(false);
    setMessage(resolveViaCepMessage(result));

    if (!result.ok) {
      return null;
    }

    lastFetchedCepRef.current = cepDigits;
    lastAddressRef.current = result.address;
    return result.address;
  }, []);

  return { loading, message, fetchAddress };
}
