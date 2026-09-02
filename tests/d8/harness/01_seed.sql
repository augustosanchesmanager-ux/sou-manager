-- D8 concurrency harness — DETERMINISTIC ISOLATED SEED
-- Test tenant only. NOT 63742efa / production. All IDs fixed for reproducibility.
BEGIN;

INSERT INTO public.tenants (id) VALUES ('11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id) VALUES ('22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- Staff (tenant 1)
INSERT INTO public.staff (id, tenant_id, name, role, commission_rate) VALUES
  ('aaaaaaa1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Barber A', 'barber', 0.50),
  ('aaaaaaa1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Barber B', 'barber', 0.50),
  ('aaaaaaa1-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Seller', 'seller', 0.50)
ON CONFLICT (id) DO NOTHING;

-- Staff (tenant 2) — isolation check
INSERT INTO public.staff (id, tenant_id, name, role, commission_rate) VALUES
  ('bbbbbbb1-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Other Barber', 'barber', 0.50)
ON CONFLICT (id) DO NOTHING;

-- Comandas (tenant 1): A and B, same total/discount
INSERT INTO public.comandas (id, tenant_id, client_id, staff_id, status, total, discount) VALUES
  ('cccccccc-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', NULL, 'aaaaaaa1-0000-0000-0000-000000000001', 'paid', 100.00, 0),
  ('cccccccc-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', NULL, 'aaaaaaa1-0000-0000-0000-000000000001', 'paid', 200.00, 0)
ON CONFLICT (id) DO NOTHING;

-- Comanda items (1 item each)
INSERT INTO public.comanda_items (id, comanda_id, tenant_id, service_id, staff_id, quantity, unit_price) VALUES
  ('dddddddd-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', NULL, 'aaaaaaa1-0000-0000-0000-000000000001', 1, 100.00),
  ('dddddddd-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', NULL, 'aaaaaaa1-0000-0000-0000-000000000001', 1, 200.00)
ON CONFLICT (id) DO NOTHING;

-- Participants: solo 100% for barber A on each item
INSERT INTO public.service_execution_participants (id, comanda_item_id, tenant_id, staff_id, role, payout_type, payout_value, affects_commission) VALUES
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'dddddddd-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'aaaaaaa1-0000-0000-0000-000000000001', 'barber', 'percentage', 100.00, true),
  ('eeeeeeee-0000-0000-0000-0000000000b1', 'dddddddd-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'aaaaaaa1-0000-0000-0000-000000000001', 'barber', 'percentage', 100.00, true)
ON CONFLICT (id) DO NOTHING;

-- 2 pending outbox items, production payload shape
INSERT INTO public.outbox_items (id, event_id, event_type, tenant_id, targets, status, payload, metadata) VALUES
  ('f0000000-0000-0000-0000-0000000000a1', 'evt_test_A_0001', 'CheckoutCompleted', '11111111-1111-1111-1111-111111111111', '[{"provider":"finance","config":{}}]', 'pending',
   '{"operationType":"create_commission_record","operationData":{"tenantId":"11111111-1111-1111-1111-111111111111","comandaId":"cccccccc-0000-0000-0000-00000000000a","clientId":null,"staffId":"aaaaaaa1-0000-0000-0000-000000000001","receivedValue":100,"paymentMethod":"card","hasClubCredit":false},"sourceEvent":"CheckoutCompleted","idempotencyKey":"evt_test_A_0001_create_commission_record"}',
   '{"tenantId":"11111111-1111-1111-1111-111111111111","source":"CheckoutApplicationService"}'),
  ('f0000000-0000-0000-0000-0000000000b1', 'evt_test_B_0002', 'CheckoutCompleted', '11111111-1111-1111-1111-111111111111', '[{"provider":"finance","config":{}}]', 'pending',
   '{"operationType":"create_commission_record","operationData":{"tenantId":"11111111-1111-1111-1111-111111111111","comandaId":"cccccccc-0000-0000-0000-00000000000b","clientId":null,"staffId":"aaaaaaa1-0000-0000-0000-000000000001","receivedValue":200,"paymentMethod":"card","hasClubCredit":false},"sourceEvent":"CheckoutCompleted","idempotencyKey":"evt_test_B_0002_create_commission_record"}',
   '{"tenantId":"11111111-1111-1111-1111-111111111111","source":"CheckoutApplicationService"}')
ON CONFLICT (event_id) DO NOTHING;

COMMIT;
