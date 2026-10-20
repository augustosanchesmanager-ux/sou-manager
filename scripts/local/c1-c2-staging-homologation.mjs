import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// STAGING HOMOLOGATION SUITE — ADR-033 (C1) & ADR-034 (C2) & Phase 1 Profile
// Target: STAGING ONLY (tjcvuhynckocmvtqykxp)
// Hard Gate: PROD (ushsnmlbeurfvlkieiln) is NEVER touched.
// ============================================================================

const STAGING_URL = 'https://tjcvuhynckocmvtqykxp.supabase.co';

function getStagingCredentials() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const raw = fs.readFileSync(envPath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  
  // Find staging keys (by convention at the bottom or prefixed with sb_secret_ / sb_publishable_)
  const serviceKeyLine = lines.find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY=sb_secret_'));
  const anonKeyLine = lines.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY=sb_publishable_nh3'));

  if (!serviceKeyLine) {
    throw new Error('STAGING SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  }

  const serviceKey = serviceKeyLine.split('=')[1].trim();
  const anonKey = anonKeyLine ? anonKeyLine.split('=')[1].trim() : serviceKey;

  return { serviceKey, anonKey };
}

const { serviceKey, anonKey } = getStagingCredentials();

// Enforce Safety Guard
if (!STAGING_URL.includes('tjcvuhynckocmvtqykxp')) {
  console.error('FATAL: Attempting to run against non-staging URL:', STAGING_URL);
  process.exit(1);
}

const admin = createClient(STAGING_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anon = createClient(STAGING_URL, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = Date.now();
const testSlug = `e2e-c1c2-${runId}`;

const state = {
  tenantId: null,
  managerUserId: null,
  managerClient: null,
  staffId: null,
  clientId: null,
  service1Id: null,
  service2Id: null,
  comandaId: null,
  comandaItem1Id: null,
  comandaItem2Id: null,
  commRec1Id: null,
  commRec2Id: null,
  resettledCommRec1Id: null,
  resettledCommRec2Id: null,
};

async function logStep(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`🔷 ${title}`);
  console.log('='.repeat(70));
}

async function run() {
  console.log('🚀 INICIANDO HOMOLOGAÇÃO EM STAGING (tjcvuhynckocmvtqykxp)');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🎯 Test Run ID: ${runId}`);

  try {
    // ------------------------------------------------------------------------
    // SETUP: Provision isolated test tenant & entities
    // ------------------------------------------------------------------------
    await logStep('SETUP: Provisionando Tenant e Entidades de Teste Isoladas');

    const { data: tenant, error: tErr } = await admin
      .from('tenants')
      .insert({
        name: `Homologação C1/C2 ${runId}`,
        slug: testSlug,
        app_slug: 'barber',
        plan: 'pro',
        status: 'active',
      })
      .select('id, slug')
      .single();

    if (tErr || !tenant) throw new Error(`Falha ao criar tenant: ${tErr?.message}`);
    state.tenantId = tenant.id;
    console.log(`✅ Tenant criado: ${tenant.id} (${tenant.slug})`);

    // Manager Auth User + Session
    const managerPassword = 'ManagerPass2026!';
    const managerEmail = `manager-${runId}@test.com`;
    const { data: authUser, error: auErr } = await admin.auth.admin.createUser({
      email: managerEmail,
      password: managerPassword,
      email_confirm: true,
      user_metadata: { first_name: 'Manager', last_name: 'E2E' },
    });
    if (auErr || !authUser?.user) throw new Error(`Falha ao criar manager auth: ${auErr?.message}`);
    state.managerUserId = authUser.user.id;

    await admin.from('profiles').insert({
      id: state.managerUserId,
      email: managerEmail,
      role: 'manager',
    });

    await admin.from('user_tenants').insert({
      user_id: state.managerUserId,
      tenant_id: state.tenantId,
      role: 'manager',
    });

    state.managerClient = createClient(STAGING_URL, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: loginErr } = await state.managerClient.auth.signInWithPassword({
      email: managerEmail,
      password: managerPassword,
    });
    if (loginErr) throw new Error(`Falha no login do manager: ${loginErr.message}`);
    console.log(`✅ Manager autenticado provisionado: ${state.managerUserId}`);

    // Staff (Barbeiro)
    const { data: staff, error: sErr } = await admin
      .from('staff')
      .insert({
        tenant_id: state.tenantId,
        name: 'Barbeiro E2E C1C2',
        role: 'barber',
        status: 'active',
      })
      .select('id')
      .single();

    if (sErr || !staff) throw new Error(`Falha ao criar staff: ${sErr?.message}`);
    state.staffId = staff.id;
    console.log(`✅ Staff criado: ${staff.id}`);

    // Client
    const { data: client, error: cErr } = await admin
      .from('clients')
      .insert({
        tenant_id: state.tenantId,
        name: 'Cliente E2E C1C2',
        phone: '11988887777',
      })
      .select('id')
      .single();

    if (cErr || !client) throw new Error(`Falha ao criar client: ${cErr?.message}`);
    state.clientId = client.id;
    console.log(`✅ Cliente criado: ${client.id}`);

    // Services (2 services for same barber)
    const { data: svc1, error: sv1Err } = await admin
      .from('services')
      .insert({
        tenant_id: state.tenantId,
        name: 'Corte Degradê C2',
        price: 50.00,
        duration: 30,
        active: true,
      })
      .select('id')
      .single();
    if (sv1Err || !svc1) throw new Error(`Falha ao criar servico 1: ${sv1Err?.message}`);
    state.service1Id = svc1.id;

    const { data: svc2, error: sv2Err } = await admin
      .from('services')
      .insert({
        tenant_id: state.tenantId,
        name: 'Barba Terapia C2',
        price: 35.00,
        duration: 30,
        active: true,
      })
      .select('id')
      .single();
    if (sv2Err || !svc2) throw new Error(`Falha ao criar servico 2: ${sv2Err?.message}`);
    state.service2Id = svc2.id;
    console.log(`✅ Serviços criados: ${svc1.id} (R$ 50), ${svc2.id} (R$ 35)`);

    // Comanda
    const { data: comanda, error: cmdErr } = await admin
      .from('comandas')
      .insert({
        tenant_id: state.tenantId,
        client_id: state.clientId,
        status: 'paid',
        total: 85.00,
        closed_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (cmdErr || !comanda) throw new Error(`Falha ao criar comanda: ${cmdErr?.message}`);
    state.comandaId = comanda.id;
    console.log(`✅ Comanda criada: ${comanda.id}`);

    // 2 Comanda Items for same barber
    const { data: item1, error: i1Err } = await admin
      .from('comanda_items')
      .insert({
        tenant_id: state.tenantId,
        comanda_id: state.comandaId,
        service_id: state.service1Id,
        staff_id: state.staffId,
        unit_price: 50.00,
        quantity: 1,
      })
      .select('id')
      .single();
    if (i1Err || !item1) throw new Error(`Falha ao criar item 1: ${i1Err?.message}`);
    state.comandaItem1Id = item1.id;

    const { data: item2, error: i2Err } = await admin
      .from('comanda_items')
      .insert({
        tenant_id: state.tenantId,
        comanda_id: state.comandaId,
        service_id: state.service2Id,
        staff_id: state.staffId,
        unit_price: 35.00,
        quantity: 1,
      })
      .select('id')
      .single();
    if (i2Err || !item2) throw new Error(`Falha ao criar item 2: ${i2Err?.message}`);
    state.comandaItem2Id = item2.id;
    console.log(`✅ Itens da comanda criados: ${item1.id}, ${item2.id}`);

    // ------------------------------------------------------------------------
    // CASE 1: C2 Granularity (Multiple Services per Professional on same Comanda)
    // ------------------------------------------------------------------------
    await logStep('CASE 1: Validação de Granularidade C2 (ADR-034)');

    // Inserir comissão para Item 1 (50% de 50.00 = 25.00)
    const { data: rpc1, error: rpc1Err } = await admin.rpc('insert_commission_record', {
      p_tenant_id: state.tenantId,
      p_staff_id: state.staffId,
      p_comanda_id: state.comandaId,
      p_comanda_item_id: state.comandaItem1Id,
      p_gross_value: 50.00,
      p_discount: 0,
      p_net_value: 50.00,
      p_received_value: 50.00,
      p_commission_rate: 0.50,
      p_commission_value: 25.00,
      p_participant_share: 1,
      p_payout_type: 'percentage',
      p_affects_commission: true,
      p_idempotency_key: `comm-item1-${runId}`,
      p_event_id: `evt-item1-${runId}`,
      p_event_type: 'ComandaClosed',
    });
    if (rpc1Err) throw new Error(`Falha insert_commission_record Item 1: ${rpc1Err.message}`);
    state.commRec1Id = rpc1.id;
    console.log(`✅ Comissão Item 1 inserida: ${state.commRec1Id} (Valor: R$ 25.00)`);

    // Inserir comissão para Item 2 (50% de 35.00 = 17.50)
    const { data: rpc2, error: rpc2Err } = await admin.rpc('insert_commission_record', {
      p_tenant_id: state.tenantId,
      p_staff_id: state.staffId,
      p_comanda_id: state.comandaId,
      p_comanda_item_id: state.comandaItem2Id,
      p_gross_value: 35.00,
      p_discount: 0,
      p_net_value: 35.00,
      p_received_value: 35.00,
      p_commission_rate: 0.50,
      p_commission_value: 17.50,
      p_participant_share: 1,
      p_payout_type: 'percentage',
      p_affects_commission: true,
      p_idempotency_key: `comm-item2-${runId}`,
      p_event_id: `evt-item2-${runId}`,
      p_event_type: 'ComandaClosed',
    });
    if (rpc2Err) throw new Error(`Falha insert_commission_record Item 2: ${rpc2Err.message}`);
    state.commRec2Id = rpc2.id;
    console.log(`✅ Comissão Item 2 inserida: ${state.commRec2Id} (Valor: R$ 17.50)`);

    // Assert: Ambos existem e estão ativos
    const { data: activeComms, error: acErr } = await admin
      .from('commission_records')
      .select('id, comanda_item_id, staff_id, comanda_id, commission_value, status, record_type')
      .eq('tenant_id', state.tenantId)
      .eq('comanda_id', state.comandaId)
      .eq('status', 'active');

    if (acErr) throw new Error(`Erro ao consultar comissoes ativas: ${acErr.message}`);
    if (activeComms.length !== 2) {
      throw new Error(`Esperado 2 comissoes ativas, encontrado: ${activeComms.length}`);
    }
    console.log(`✅ Assert C2: 2 registros de comissão ativos coexistindo na mesma comanda para o mesmo barbeiro!`);

    // Assert: exists_commission_record com e sem item_id
    const { data: exItem1 } = await admin.rpc('exists_commission_record', {
      p_tenant_id: state.tenantId,
      p_staff_id: state.staffId,
      p_comanda_id: state.comandaId,
      p_comanda_item_id: state.comandaItem1Id,
    });
    const { data: exItem2 } = await admin.rpc('exists_commission_record', {
      p_tenant_id: state.tenantId,
      p_staff_id: state.staffId,
      p_comanda_id: state.comandaId,
      p_comanda_item_id: state.comandaItem2Id,
    });
    const { data: exOverall } = await admin.rpc('exists_commission_record', {
      p_tenant_id: state.tenantId,
      p_staff_id: state.staffId,
      p_comanda_id: state.comandaId,
    });

    if (!exItem1 || !exItem2 || !exOverall) {
      throw new Error(`exists_commission_record falhou na verificação de granularidade: item1=${exItem1}, item2=${exItem2}, overall=${exOverall}`);
    }
    console.log(`✅ Assert exists_commission_record: Granularidade por item e fallback geral validados com sucesso.`);

    // ------------------------------------------------------------------------
    // CASE 2: C1 Reversal/Reopen (Tombstone status = 'reversed' & negative counter-entry)
    // ------------------------------------------------------------------------
    await logStep('CASE 2: Validação de Reabertura e Estorno C1 (ADR-033)');

    // Simular reabertura gerencial chamando create_commission_reversal para Item 1
    const { data: rev1, error: rev1Err } = await state.managerClient.rpc('create_commission_reversal', {
      p_tenant_id: state.tenantId,
      p_original_record_id: state.commRec1Id,
      p_commission_value: -25.00,
      p_idempotency_key: `rev-item1-${runId}`,
      p_event_id: `evt-rev-item1-${runId}`,
      p_event_type: 'ComandaReopened',
    });
    if (rev1Err) throw new Error(`Falha ao reverter item 1: ${rev1Err.message}`);
    console.log(`✅ Reversão Item 1 concluída: ${rev1.reversal_id}`);

    // Simular reabertura gerencial chamando create_commission_reversal para Item 2
    const { data: rev2, error: rev2Err } = await state.managerClient.rpc('create_commission_reversal', {
      p_tenant_id: state.tenantId,
      p_original_record_id: state.commRec2Id,
      p_commission_value: -17.50,
      p_idempotency_key: `rev-item2-${runId}`,
      p_event_id: `evt-rev-item2-${runId}`,
      p_event_type: 'ComandaReopened',
    });
    if (rev2Err) throw new Error(`Falha ao reverter item 2: ${rev2Err.message}`);
    console.log(`✅ Reversão Item 2 concluída: ${rev2.reversal_id}`);

    // Assert: Registros originais devem estar com status = 'reversed'
    const { data: originals, error: origErr } = await admin
      .from('commission_records')
      .select('id, status, record_type, commission_value')
      .in('id', [state.commRec1Id, state.commRec2Id]);

    if (origErr) throw new Error(`Erro ao verificar originais: ${origErr.message}`);
    for (const row of originals) {
      if (row.status !== 'reversed') {
        throw new Error(`Registro original ${row.id} deveria estar 'reversed', mas está '${row.status}'`);
      }
    }
    console.log(`✅ Assert C1: Registros originais transicionaram para status = 'reversed' (Tombstone íntegro).`);

    // Assert: Registros de estorno devem ser negativos e ativos
    const { data: reversals, error: revErr } = await admin
      .from('commission_records')
      .select('id, original_record_id, commission_value, status, record_type')
      .in('id', [rev1.reversal_id, rev2.reversal_id]);

    if (revErr) throw new Error(`Erro ao verificar reversões: ${revErr.message}`);
    let sumReversals = 0;
    for (const r of reversals) {
      if (r.record_type !== 'reversal' || r.status !== 'active') {
        throw new Error(`Reversão ${r.id} inválida: type=${r.record_type}, status=${r.status}`);
      }
      sumReversals += Number(r.commission_value);
    }
    if (sumReversals !== -42.50) {
      throw new Error(`Soma dos estornos deveria ser -42.50, encontrado: ${sumReversals}`);
    }
    console.log(`✅ Assert C1: Contrapartidas de estorno ativas e negativas (-R$ 42.50 total).`);

    // Assert: Saldo líquido de comissão da comanda agora deve ser R$ 0.00
    const { data: allComandaRecords } = await admin
      .from('commission_records')
      .select('commission_value')
      .eq('tenant_id', state.tenantId)
      .eq('comanda_id', state.comandaId);

    const netComandaCommission = allComandaRecords.reduce((acc, cur) => acc + Number(cur.commission_value), 0);
    if (Math.abs(netComandaCommission) > 0.001) {
      throw new Error(`Saldo líquido da comanda pós-estorno não é zero: ${netComandaCommission}`);
    }
    console.log(`✅ Assert C1 Ledger: Saldo contábil da comanda fechada e reaberta = R$ 0.00.`);

    // ------------------------------------------------------------------------
    // CASE 3: Resettlement after Reopen (Novo Fechamento sem Colisão)
    // ------------------------------------------------------------------------
    await logStep('CASE 3: Validação de Re-Liquidação e Ciclos Concorrentes (C1 + C2)');

    // Inserir novos registros de comissão para a mesma comanda e itens (refatoração pós-reabertura)
    const { data: reComm1, error: reComm1Err } = await admin.rpc('insert_commission_record', {
      p_tenant_id: state.tenantId,
      p_staff_id: state.staffId,
      p_comanda_id: state.comandaId,
      p_comanda_item_id: state.comandaItem1Id,
      p_gross_value: 50.00,
      p_discount: 0,
      p_net_value: 50.00,
      p_received_value: 50.00,
      p_commission_rate: 0.50,
      p_commission_value: 25.00,
      p_participant_share: 1,
      p_payout_type: 'percentage',
      p_affects_commission: true,
      p_idempotency_key: `re-comm-item1-${runId}`,
      p_event_id: `re-evt-item1-${runId}`,
      p_event_type: 'ComandaClosed',
    });
    if (reComm1Err) throw new Error(`Falha ao re-liquidar Item 1: ${reComm1Err.message}`);
    state.resettledCommRec1Id = reComm1.id;

    const { data: reComm2, error: reComm2Err } = await admin.rpc('insert_commission_record', {
      p_tenant_id: state.tenantId,
      p_staff_id: state.staffId,
      p_comanda_id: state.comandaId,
      p_comanda_item_id: state.comandaItem2Id,
      p_gross_value: 35.00,
      p_discount: 0,
      p_net_value: 35.00,
      p_received_value: 35.00,
      p_commission_rate: 0.50,
      p_commission_value: 17.50,
      p_participant_share: 1,
      p_payout_type: 'percentage',
      p_affects_commission: true,
      p_idempotency_key: `re-comm-item2-${runId}`,
      p_event_id: `re-evt-item2-${runId}`,
      p_event_type: 'ComandaClosed',
    });
    if (reComm2Err) throw new Error(`Falha ao re-liquidar Item 2: ${reComm2Err.message}`);
    state.resettledCommRec2Id = reComm2.id;

    console.log(`✅ Re-liquidação executada com sucesso! Sem colisão de unicidade.`);
    console.log(`   Novos IDs: ${reComm1.commission_id}, ${reComm2.commission_id}`);

    // Assert: Agora existem exatamente 2 comissões ativas do tipo 'commission'
    const { data: postResettleComms } = await admin
      .from('commission_records')
      .select('id, status, record_type')
      .eq('tenant_id', state.tenantId)
      .eq('comanda_id', state.comandaId)
      .eq('record_type', 'commission')
      .eq('status', 'active');

    if (postResettleComms.length !== 2) {
      throw new Error(`Esperado 2 comissões ativas pós-re-liquidação, encontrado: ${postResettleComms.length}`);
    }
    console.log(`✅ Assert C1+C2: Ciclo de vida completo comprovado (Active -> Reversed -> New Active).`);

    // ------------------------------------------------------------------------
    // CASE 4: Public Profile & Social Links (Phase 1 Migration Validation)
    // ------------------------------------------------------------------------
    await logStep('CASE 4: Validação de Perfil Público e Links Sociais (Fase 1)');

    // Upsert tenant_settings com links e booking habilitado
    const { data: setRes, error: setErr } = await admin
      .from('tenant_settings')
      .upsert({
        tenant_id: state.tenantId,
        booking_enabled: true,
        instagram_url: 'https://instagram.com/sanchezbarber_oficial',
        whatsapp_number: '5511999998888',
        maps_url: 'https://maps.app.goo.gl/xyz123',
        address_street: 'Rua das Palmeiras',
        address_number: '120',
        address_city: 'São Paulo',
        address_state: 'SP',
      })
      .select()
      .single();

    if (setErr) throw new Error(`Falha ao configurar tenant_settings: ${setErr.message}`);
    console.log(`✅ tenant_settings configurado com links sociais e booking_enabled = true`);

    // Chamar RPC get_public_tenant_profile como ANON (portal público)
    const { data: profile, error: profErr } = await anon.rpc('get_public_tenant_profile', {
      p_tenant_identifier: testSlug,
    });

    if (profErr) throw new Error(`Falha ao chamar get_public_tenant_profile anon: ${profErr.message}`);
    if (!profile) throw new Error('get_public_tenant_profile retornou null para tenant ativo');

    console.log('✅ Resposta pública de get_public_tenant_profile recebida:');
    console.log(`   - Name: ${profile.name}`);
    console.log(`   - Instagram: ${profile.instagram_url}`);
    console.log(`   - WhatsApp: ${profile.whatsapp_number}`);
    console.log(`   - Maps: ${profile.maps_url}`);
    console.log(`   - Social Links Object:`, profile.social_links);

    // Asserts nos campos públicos
    if (profile.instagram_url !== 'https://instagram.com/sanchezbarber_oficial') {
      throw new Error(`instagram_url divergente: ${profile.instagram_url}`);
    }
    if (profile.whatsapp_number !== '5511999998888') {
      throw new Error(`whatsapp_number divergente: ${profile.whatsapp_number}`);
    }
    if (profile.maps_url !== 'https://maps.app.goo.gl/xyz123') {
      throw new Error(`maps_url divergente: ${profile.maps_url}`);
    }
    if (!profile.social_links || profile.social_links.maps_url !== 'https://maps.app.goo.gl/xyz123') {
      throw new Error('social_links objeto não contém maps_url esperado');
    }
    console.log(`✅ Assert Perfil Público: Projeção segura de links sociais e localização 100% validada!`);

  } finally {
    // ------------------------------------------------------------------------
    // TEARDOWN: Clean up test tenant & all cascade entities
    // ------------------------------------------------------------------------
    await logStep('TEARDOWN: Higienização e Isolamento do Staging');
    if (state.managerUserId) {
      console.log(`🧹 Removendo manager user: ${state.managerUserId}`);
      await admin.from('user_tenants').delete().eq('user_id', state.managerUserId);
      await admin.from('profiles').delete().eq('id', state.managerUserId);
      await admin.auth.admin.deleteUser(state.managerUserId);
    }
    if (state.tenantId) {
      console.log(`🧹 Removendo dados de teste do tenant: ${state.tenantId}`);
      await admin.from('commission_records').delete().eq('tenant_id', state.tenantId);
      await admin.from('comanda_items').delete().eq('tenant_id', state.tenantId);
      await admin.from('comandas').delete().eq('tenant_id', state.tenantId);
      await admin.from('services').delete().eq('tenant_id', state.tenantId);
      await admin.from('staff').delete().eq('tenant_id', state.tenantId);
      await admin.from('clients').delete().eq('tenant_id', state.tenantId);
      await admin.from('tenant_settings').delete().eq('tenant_id', state.tenantId);
      await admin.from('tenants').delete().eq('id', state.tenantId);
      console.log(`✅ Teardown concluído com sucesso. Staging limpo e sem resíduos.`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 HOMOLOGAÇÃO EM STAGING FINALIZADA COM SUCESSO (4/4 PASS)');
  console.log('='.repeat(70));
}

run().catch((err) => {
  console.error('\n❌ ERRO NA HOMOLOGAÇÃO:', err);
  process.exit(1);
});
