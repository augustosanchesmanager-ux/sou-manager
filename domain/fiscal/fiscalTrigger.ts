/**
 * [SMG][DOMAIN][FISCAL] fiscalTrigger
 *
 * Disparo desacoplado da emissão de NFS-e após fechamento da comanda.
 * Execução 100% não bloqueante: nunca trava o operador nem gera espera no balcão/cadeira.
 */

import { fiscalService } from './fiscalService';

export interface TriggerFiscalEmissionInput {
  tenantId: string;
  comandaId: string;
  valorTotal: number;
  clientName?: string;
  clientDocument?: string | null;
}

export const triggerAsyncFiscalEmission = async (
  input: TriggerFiscalEmissionInput,
): Promise<void> => {
  const { tenantId, comandaId, valorTotal, clientName, clientDocument } = input;

  if (!tenantId || !comandaId || valorTotal <= 0) {
    return;
  }

  // Execução desacoplada assíncrona
  (async () => {
    try {
      const settings = await fiscalService.getSettings(tenantId);
      if (!settings || !settings.auto_issue_on_close) {
        return;
      }

      await fiscalService.issueNfse({
        tenantId,
        comandaId,
        valorServicos: valorTotal,
        clientName: clientName || 'Consumidor Final',
        clientDocument: clientDocument || null,
      });
    } catch (err) {
      console.warn('[SMG_FISCAL] Aviso ao processar emissão fiscal assíncrona:', err);
    }
  })();
};
