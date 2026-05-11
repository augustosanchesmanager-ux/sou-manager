BEGIN;

-- ============================================================
-- Clube do Chefe: normaliza assinaturas abertas duplicadas
-- ============================================================
--
-- Mantem uma assinatura aberta por tenant/cliente e cancela as demais.
-- A assinatura mantida prioriza status active, depois past_due, depois paused,
-- usando a mais recente como criterio de desempate.

WITH ranked_open_subscriptions AS (
  SELECT
    cs.id,
    ROW_NUMBER() OVER (
      PARTITION BY cs.tenant_id, cs.client_id
      ORDER BY
        CASE cs.status
          WHEN 'active' THEN 0
          WHEN 'past_due' THEN 1
          WHEN 'paused' THEN 2
          ELSE 3
        END,
        cs.updated_at DESC,
        cs.created_at DESC,
        cs.id DESC
    ) AS row_number
  FROM public.customer_subscriptions cs
  WHERE cs.status IN ('active', 'past_due', 'paused')
),
subscriptions_to_cancel AS (
  UPDATE public.customer_subscriptions cs
  SET
    status = 'canceled',
    canceled_at = COALESCE(cs.canceled_at, now()),
    updated_at = now()
  FROM ranked_open_subscriptions ranked
  WHERE cs.id = ranked.id
    AND ranked.row_number > 1
  RETURNING cs.id
)
UPDATE public.customer_subscription_receivables receivable
SET
  status = 'cancelled',
  updated_at = now()
WHERE receivable.subscription_id IN (
  SELECT id FROM subscriptions_to_cancel
)
  AND receivable.status IN ('pending', 'overdue');

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_subscriptions_one_open_per_client
  ON public.customer_subscriptions(tenant_id, client_id)
  WHERE status IN ('active', 'past_due', 'paused');

NOTIFY pgrst, 'reload schema';

COMMIT;
