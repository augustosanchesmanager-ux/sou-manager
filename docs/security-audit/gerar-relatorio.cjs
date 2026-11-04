/**
 * Gerador do Relatório de Auditoria de Segurança (HTML -> PDF via Playwright/Chromium).
 *
 * Execução (raiz do projeto):
 *   node docs/security-audit/gerar-relatorio.cjs
 *
 * Gera: docs/security-audit/relatorio-auditoria-seguranca.pdf
 * Salva também: docs/security-audit/assets/relatorio.html
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;
const OUT_PDF = path.join(OUT_DIR, 'relatorio-auditoria-seguranca.pdf');
const OUT_HTML = path.join(OUT_DIR, 'assets', 'relatorio.html');

/* ------------------------------------------------------------------ *
 * PALETA OFICIAL EXIGIDA
 * ------------------------------------------------------------------ */
const PALETA = {
  critica: '#B91C1C',
  alta: '#EA580C',
  media: '#D97706',
  baixa: '#2563EB',
  forte: '#059669',
};

// Contagem rigorosa por severidade
const severidade = { critica: 1, alta: 1, media: 3, baixa: 3, informativa: 2 };
const totalAchados = Object.values(severidade).reduce((a, b) => a + b, 0);

// Contagem por categoria: 1=Tranca, 2=Permissão, 3=IDOR, 4=Chaves, 5=XSS
const porCategoria = {
  '1. Banco sem tranca': 3,
  '2. Permissão navegador': 1,
  '3. IDOR': 1,
  '4. Chaves expostas': 4,
  '5. Inputs (XSS)': 1,
};

/* ------------------------------------------------------------------ *
 * GRÁFICOS SVG
 * ------------------------------------------------------------------ */
function donutSvg() {
  const total = totalAchados;
  const radius = 62, cx = 80, cy = 80, stroke = 26;
  const C = 2 * Math.PI * radius;
  const segs = [
    { key: 'critica', label: 'Críticas', color: PALETA.critica, value: severidade.critica },
    { key: 'alta', label: 'Alta', color: PALETA.alta, value: severidade.alta },
    { key: 'media', label: 'Média', color: PALETA.media, value: severidade.media },
    { key: 'baixa', label: 'Baixa', color: PALETA.baixa, value: severidade.baixa },
    { key: 'informativa', label: 'Informativa', color: '#94a3b8', value: severidade.informativa },
  ];
  let offset = 0;
  let circles = '';
  for (const s of segs) {
    if (s.value <= 0) continue;
    const frac = s.value / total;
    const dash = frac * C;
    circles += `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${s.color}"
      stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}"
      stroke-dashoffset="${(-offset * C).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += frac;
  }
  return `<svg viewBox="0 0 160 160" width="190" height="190" role="img" aria-label="Distribuição por severidade">
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="${stroke}"/>
    ${circles}
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="26" font-weight="700" fill="#0f172a">${total}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="#64748b">achados</text>
  </svg>`;
}

function barSvg() {
  const bars = Object.entries(porCategoria);
  const max = Math.max(...bars.map(([, v]) => v));
  const W = 500, H = 200, padL = 30, padB = 40, padT = 20;
  const plotW = W - padL - 10;
  const slot = plotW / bars.length;
  const bw = Math.min(48, slot * 0.55);
  let g = '';
  bars.forEach(([label, v], i) => {
    const bh = (v / max) * (H - padT - padB - 20);
    const x = padL + i * slot + (slot - bw) / 2;
    const y = H - padB - bh;
    const color = i === 3 ? PALETA.critica : i === 1 ? PALETA.media : i === 0 ? PALETA.media : PALETA.forte;
    g += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${color}"/>`;
    g += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="14" font-weight="700" fill="#0f172a">${v}</text>`;
    g += `<text x="${x + bw / 2}" y="${H - padB + 16}" text-anchor="middle" font-size="9" fill="#475569">${label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Achados por categoria">
    ${g}
    <line x1="${padL - 10}" y1="${padT}" x2="${padL - 10}" y2="${H - padB}" stroke="#cbd5e1"/>
    <line x1="${padL - 10}" y1="${H - padB}" x2="${W}" y2="${H - padB}" stroke="#cbd5e1"/>
  </svg>`;
}

/* ------------------------------------------------------------------ *
 * DADOS DOS ACHADOS VERIFICADOS (ARQUIVO POR ARQUIVO, LINHA POR LINHA)
 * ------------------------------------------------------------------ */
const achados = [
  // CATEGORIA 4
  {
    cat: '4. Chaves expostas', n: 'F4.1', sev: 'critica',
    file: 'git commit 46e21ce (.vercel-temp.env no histórico do repositório)',
    linhas: 'git show 46e21ce:.vercel-temp.env (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, POSTGRES_PASSWORD, VERCEL_OIDC_TOKEN)',
    desc: 'Exposição de segredos de produção no histórico Git: o arquivo .vercel-temp.env foi commitado com credenciais administrativas completas. Embora tenha sido desindexado no commit c1711da e adicionado ao .gitignore, qualquer clone/fork mantém acesso aos segredos em texto plano.',
    porquê: 'A chave service_role e o POSTGRES_PASSWORD concedem bypass irrestrito de RLS e acesso direto ao banco PostgreSQL. Se as chaves não foram revogadas e rotacionadas nas plataformas Supabase e Vercel, o banco de dados de produção permanece comprometido.',
    impacto: 'Comprometimento total da confidencialidade e integridade dos dados multi-tenant, bypass de RLS e risco na cadeia de deploy.',
    severidade: 'Crítica',
  },
  {
    cat: '4. Chaves expostas', n: 'F4.2', sev: 'alta',
    file: 'vite.config.ts / services/geminiService.ts',
    linhas: 'vite.config.ts:18-20 ("process.env.GEMINI_API_KEY": JSON.stringify(env.VITE_GEMINI_API_KEY)) e geminiService.ts:3-10',
    desc: 'Chave de API do Google Gemini injetada diretamente no bundle estático do frontend entregue ao navegador do cliente.',
    porquê: 'Qualquer usuário ou agente malicioso inspecionando o código-fonte JS ou o tráfego de rede no navegador pode extrair a API Key e utilizá-la em scripts externos, gerando exaustão de cotas de IA ou custos na conta de faturamento do Google Cloud.',
    impacto: 'Esgotamento de cota da API de IA, negação de serviço funcional no assistente inteligente e custos financeiros imprevistos.',
    severidade: 'Alta',
  },
  {
    cat: '4. Chaves expostas', n: 'F4.3', sev: 'media',
    file: 'secrets.env.txt / env.local.bak_bom.txt (raiz do projeto)',
    linhas: 'secrets.env.txt:1-12 e env.local.bak_bom.txt:1-15 (arquivos locais não cobertos pelo .gitignore)',
    desc: 'Arquivos contendo segredos reais e backups de configuração na raiz do repositório desprotegidos contra comandos "git add .".',
    porquê: 'O arquivo .gitignore possui regras para "*.bak_bom", mas não para "*.bak_bom.txt" nem para "secrets.env.txt". O comando git check-ignore confirma que esses arquivos estão desprotegidos.',
    impacto: 'Risco iminente de novo vazamento de segredos em commits rotineiros de desenvolvedores.',
    severidade: 'Média',
  },
  {
    cat: '4. Chaves expostas', n: 'F4.4', sev: 'informativa',
    file: 'src/lib/supabase/client.ts',
    linhas: '18-21 (LOCAL_DEMO_EMAIL = "teste@soumanager.local", LOCAL_DEMO_PASSWORD = "12345678")',
    desc: 'Credenciais de teste locais embutidas no código-fonte.',
    porquê: 'Ativadas somente quando NÃO existem variáveis de ambiente Supabase configuradas e o host é localhost/127.0.0.1. Não explorável em produção, mas a string de senha consta no bundle compilado.',
    impacto: 'Higiene de código; baixo risco em ambiente de produção.',
    severidade: 'Informativa',
  },

  // CATEGORIA 2
  {
    cat: '2. Permissão navegador', n: 'F2.1', sev: 'media',
    file: 'supabase/migrations/20260212000000_initial_schema.sql (políticas RLS de tabelas mestres)',
    linhas: 'Ex.: policies em services, products, categories (USING / WITH CHECK tenant_id = current_tenant_id_from_auth_uid())',
    desc: 'Mutações diretas via Supabase REST API em tabelas de catálogo/configuração permitidas a qualquer funcionário autenticado do mesmo tenant.',
    porquê: 'O frontend oculta a UI de configurações de catálogo para barbeiros e recepcionistas via ManagerRoute/SuperAdminRoute. Contudo, as políticas de RLS no PostgreSQL verificam apenas o tenant_id, permitindo que um usuário não-gerente envie requisições HTTP REST diretas (PATCH/DELETE) para alterar preços ou excluir serviços.',
    impacto: 'Quebra de controle de acesso intra-tenant (um profissional pode alterar preços ou deletar produtos via cURL/Postman).',
    severidade: 'Média',
  },

  // CATEGORIA 1
  {
    cat: '1. Banco sem tranca', n: 'F1.1', sev: 'media',
    file: 'supabase/migrations/20260418100000_add_service_execution_participants.sql',
    linhas: '109: GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_execution_participants TO anon;',
    desc: 'Concessão excessiva de permissões a nível de tabela para o papel "anon".',
    porquê: 'A migration 20260715010000 revogou apenas o INSERT para anon. Como a RLS está ativa e não há policies concedendo acesso para anon, o PostgreSQL bloqueia o acesso na prática. No entanto, o GRANT base viola a defesa em profundidade e o princípio do menor privilégio.',
    impacto: 'Risco de exposição acidental caso uma política de RLS permissiva venha a ser criada no futuro.',
    severidade: 'Média',
  },
  {
    cat: '1. Banco sem tranca', n: 'F1.2', sev: 'baixa',
    file: 'supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql',
    linhas: '80: GRANT INSERT, UPDATE, DELETE ON TABLE public.feature_flags TO authenticated;',
    desc: 'Grant DML irrestrito a todos os usuários autenticados em tabela protegida por policy exclusiva de superadmin.',
    porquê: 'A tabela possui RLS ativa com acesso restrito a superadmin, mas o grant na tabela sugere permissões inexistentes, violando a integridade das auditorias automatizadas de permissão de banco.',
    impacto: 'Inconsistência de privilégios de banco de dados e violação de menor privilégio.',
    severidade: 'Baixa',
  },
  {
    cat: '1. Banco sem tranca', n: 'F1.3', sev: 'informativa',
    file: 'supabase/migrations/20260806090000_phase_6_0_5_2_plans_catalog.sql',
    linhas: 'Catálogos públicos (plans, features, plan_features): USING(true) + GRANT SELECT TO authenticated',
    desc: 'Tabelas de catálogo de planos com leitura global intencional.',
    porquê: 'Por design de negócio, planos e funcionalidades são de leitura pública entre os tenants. Toda escrita é restrita à service_role.',
    impacto: 'Nenhum impacto de segurança (comportamento intencional e verificado).',
    severidade: 'Informativa',
  },

  // CATEGORIA 3
  {
    cat: '3. IDOR', n: 'F3.1', sev: 'baixa',
    file: 'supabase/migrations/20260212000000_initial_schema.sql (funções financeiras pay_account_payable)',
    linhas: 'RPC pay_account_payable / cancel_account_payable (validação restrita a tenant_id)',
    desc: 'RPCs financeiras pontuais que recebem ID de título a pagar e não validam papel gerencial do autorizador.',
    porquê: 'Embora a função verifique que o título pertença ao tenant do chamador (evitando IDOR entre diferentes barbearias), qualquer funcionário autenticado do mesmo tenant que descubra o UUID pode solicitar a liquidação ou cancelamento.',
    impacto: 'Operação financeira realizada por usuário sem atribuição formal de gestão de caixa dentro da mesma organização.',
    severidade: 'Baixa',
  },

  // CATEGORIA 5
  {
    cat: '5. Inputs (XSS)', n: 'F5.1', sev: 'baixa',
    file: 'pages/CashClosingPage.tsx:261 e pages/Comandas.tsx:1249',
    linhas: 'CashClosingPage.tsx:261 e Comandas.tsx:1249 (printWindow.document.write)',
    desc: 'Uso residual do método legado document.write para montagem de layouts de impressão em janela about:blank.',
    porquê: 'Ambos os fluxos já aplicam escapeHtml() e desvinculam o opener (printWindow.opener = null), eliminando o risco ativo de XSS. No entanto, o uso de document.write é uma prática legada suscetível a erros futuros caso novos campos sejam incluídos sem o escape apropriado.',
    impacto: 'Risco de manutenção futura; ausência de risco imediato no código atual.',
    severidade: 'Baixa',
  },
];

/* ------------------------------------------------------------------ *
 * PONTOS FORTES VERIFICADOS NO CÓDIGO REAL (COM EVIDÊNCIAS)
 * ------------------------------------------------------------------ */
const fortes = [
  'RLS ativa em 100% das tabelas do banco de dados (70+ tabelas verificadas nas 159 migrations; nenhuma tabela com RLS desligada).',
  'Isolamento multi-tenant canônico rigorosamente aplicado via current_tenant_id_from_auth_uid() em mais de 240 políticas de segurança.',
  'Correção crítica de bulk_close_comandas_admin (20260831120000): exige auth.uid(), valida permissão de gerente (owner/admin/manager), rejeita tenant nulo e valida a posse de cada comanda individualmente no lote.',
  'Guarda rígida em batch_unblock_comandas (20260910160000): valida auth.uid(), bloqueia cruzamento de tenants (cross-tenant check) e exige papel gerencial.',
  'Hardening de approve_access_request (20260914120000): corpo da RPC em SECURITY DEFINER valida explicitamente auth.uid() e exige superadmin (current_is_super_admin_from_auth_uid).',
  'Proteção em provision_new_tenant (20260805000000): bloqueia auth.uid() nulo e assegura que p_user_id coincida com o usuário autenticado.',
  'Desativação completa da RPC legada close_order (20260813130200): revogada para anon, authenticated e PUBLIC, restrita exclusivamente à service_role.',
  'Hierarquia estrita de criação de usuários em admin-create-user (linhas 135-141): função canAssignStaffRole() bloqueia manager de conceder privilégio admin.',
  'Autenticação e autorização em supabase-usage-monitor (linhas 62-75): exige cabeçalho Authorization Bearer com JWT válido e valida papel de superadmin antes de aceitar ingestão de métricas.',
  'Assinatura criptográfica segura em site-sanchez-appointments (linhas 59-101): validação de webhook via HMAC-SHA256 comparada através de timingSafeEqual (proteção contra timing attacks).',
  'Propagação de JWT em invite-team-member (linhas 41-48): a Edge Function delega a autorização e o papel para a RPC invite_team_member com o token do chamador.',
  'Tratamento preventivo de XSS em fluxos de impressão: CashClosingPage.tsx:260-264 e Comandas.tsx:1247-1252 utilizam escapeHtml() e anulam o opener (printWindow.opener = null). Testes automatizados em tests/security/f5_1_f5_2_xss_print_escape.test.ts.',
  'Sanitização estrita de URLs em agendamento público: funções buildSafeInstagramUrl, buildSafeWhatsAppUrl e buildSafeHttpsUrl (BookingHeader.tsx / PublicBookingPage.tsx) rejeitam esquemas perigosos (javascript:).',
  'Ausência total de sinks perigosos de injeção no frontend: nenhum uso de dangerouslySetInnerHTML, eval() ou new Function() em toda a árvore de código da aplicação.',
];

/* ------------------------------------------------------------------ *
 * RECOMENDAÇÕES PRIORIZADAS
 * ------------------------------------------------------------------ */
const recomendacoes = [
  { p: 'P1', titulo: 'Rotacionar credenciais vazadas no histórico Git e purgar histórico', texto: 'Rotacionar imediatamente no dashboard do Supabase e da Vercel: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, POSTGRES_PASSWORD e VERCEL_OIDC_TOKEN. Executar git filter-repo para expurgar o commit 46e21ce de forks e clones.' },
  { p: 'P1', titulo: 'Isolar a chave Google Gemini através de Edge Function backend', texto: 'Remover VITE_GEMINI_API_KEY do vite.config.ts e criar a Edge Function supabase/functions/gemini-assistant. O frontend passa a chamar a Edge Function com o JWT autenticado do usuário, mantendo a API Key como secret seguro no backend.' },
  { p: 'P2', titulo: 'Proteger arquivos de segredos locais no .gitignore', texto: 'Adicionar "secrets.env.txt", "*.bak_bom.txt" e "*.env.txt" no arquivo .gitignore para prevenir commits acidentais de credenciais da máquina de desenvolvimento.' },
  { p: 'P2', titulo: 'Endurecer RLS em tabelas mestres contra mutações diretas por REST', texto: 'Atualizar as políticas de INSERT, UPDATE e DELETE de tabelas mestres (services, products, categories) para exigir papel de gerente através de "current_is_tenant_manager_from_auth_uid(tenant_id)".' },
  { p: 'P3', titulo: 'Alinhar permissões residuais de tabela (revogar grants excessivos)', texto: 'Executar migration revogando "SELECT, UPDATE, DELETE ON service_execution_participants FROM anon" e "INSERT, UPDATE, DELETE ON feature_flags FROM authenticated".' },
  { p: 'P3', titulo: 'Substituir document.write por estilos de impressão CSS (@media print)', texto: 'Refatorar os componentes de Fechamento de Caixa e Comandas para renderizar o layout de impressão diretamente no DOM via React com classes Tailwind @media print e window.print(), eliminando popups about:blank.' },
];

/* ------------------------------------------------------------------ *
 * ISSUES PARA O GITHUB (MARKDOWN COMPLETO)
 * ------------------------------------------------------------------ */
const issues = [
  {
    n: 1,
    titulo: '[Segurança] Segredos reais de produção expostos no histórico Git (.vercel-temp.env no commit 46e21ce)',
    labels: 'security, severidade-crítica',
    corpo: `## Descrição do Problema
O arquivo \`.vercel-temp.env\` foi commitado no histórico do repositório no commit \`46e21ce\` contendo credenciais administrativas de produção em texto plano:
- \`SUPABASE_SERVICE_ROLE_KEY\`
- \`SUPABASE_JWT_SECRET\`
- \`POSTGRES_PASSWORD\`
- \`VERCEL_OIDC_TOKEN\`

Embora o commit \`c1711da\` tenha desindexado o arquivo do rastreamento ativo e adicionado regra ao \`.gitignore\`, os segredos permanecem intactos e acessíveis no histórico de qualquer clone ou fork do repositório.

## Por que é explorável
A chave \`service_role\` e as credenciais de banco de dados ignoram completamente as políticas de Row Level Security (RLS) do Supabase. Qualquer pessoa que clone o repositório ou acesse um fork tem capacidade de consultar, alterar ou excluir dados de todos os tenants em produção. O token OIDC da Vercel permite acionar ou modificar deploys na nuvem.

## Evidência
\`\`\`bash
git show 46e21ce:.vercel-temp.env
# Exibe SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, POSTGRES_PASSWORD e VERCEL_OIDC_TOKEN
\`\`\`

## Impacto
Comprometimento total da segurança, confidencialidade e integridade dos dados multi-tenant, além da cadeia de deploy de produção.

## Sugestão de Correção
1. Acessar o painel do Supabase e rotacionar imediatamente a \`service_role key\`, o \`JWT Secret\` e alterar a \`database password\`.
2. Acessar o painel da Vercel e revogar o \`VERCEL_OIDC_TOKEN\`.
3. Executar o utilitário \`git-filter-repo\` ou \`BFG Repo-Cleaner\` para purgar o arquivo \`.vercel-temp.env\` do histórico Git do repositório remoto.

## Critérios de Aceite
- [ ] Novas chaves \`service_role\` e \`POSTGRES_PASSWORD\` geradas no Supabase
- [ ] Token Vercel revogado e reconfigurado nas variáveis de CI/CD
- [ ] Execução de \`git log -S "SUPABASE_SERVICE_ROLE_KEY"\` não retorna o segredo antigo
- [ ] Auditoria de segurança de segredos (gitleaks) concluída sem alertas`,
  },
  {
    n: 2,
    titulo: '[Segurança] Chave Google Gemini exposta no bundle estático do frontend (VITE_GEMINI_API_KEY)',
    labels: 'security, severidade-alta',
    corpo: `## Descrição do Problema
No arquivo \`vite.config.ts\` (linhas 18-20), a variável de ambiente \`VITE_GEMINI_API_KEY\` é embutida globalmente no objeto \`process.env.GEMINI_API_KEY\` e consumida diretamente pelo navegador em \`services/geminiService.ts\`:
\`\`\`typescript
// vite.config.ts:18-20
'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '')
\`\`\`

## Por que é explorável
O Vite substitui as referências a \`process.env.GEMINI_API_KEY\` pelo valor literal da string durante o build de produção. A chave fica disponível em texto plano no arquivo \`dist/assets/index-*.js\`. Qualquer usuário da aplicação pode extrair a credencial da aba Rede ou Console das Ferramentas de Desenvolvedor e utilizá-la em scripts próprios.

## Evidência
- \`vite.config.ts:18-20\`
- \`services/geminiService.ts:3-10\`
- Presença da chave em chamadas diretas client-side para \`https://generativelanguage.googleapis.com\`.

## Impacto
Esgotamento de cotas de IA, interrupção das funcionalidades de inteligência artificial para usuários legítimos e possíveis cobranças não autorizadas na conta de faturamento do Google Cloud.

## Sugestão de Correção
1. Criar uma Edge Function no Supabase (ex.: \`supabase/functions/gemini-assistant\`).
2. Configurar o secret \`GEMINI_API_KEY\` exclusivamente no ambiente do Supabase CLI / Edge Functions.
3. Fazer o frontend chamar a Edge Function enviando o Bearer Token JWT do usuário autenticado.
4. Remover a injeção da chave em \`vite.config.ts\`.

## Critérios de Aceite
- [ ] Nenhuma chamada direta do navegador para a API do Google Gemini
- [ ] Chave \`VITE_GEMINI_API_KEY\` ausente do arquivo de bundle compilado (\`dist/\`)
- [ ] Edge Function valida o JWT do chamador antes de repassar a consulta ao modelo de IA`,
  },
  {
    n: 3,
    titulo: '[Segurança] Mutações diretas via Supabase REST API em tabelas mestres sem validação de papel gerencial',
    labels: 'security, severidade-média',
    corpo: `## Descrição do Problema
Em tabelas como \`services\`, \`products\` e \`categories\` (criadas em \`20260212000000_initial_schema.sql\`), as políticas de RLS de escrita (\`INSERT\`, \`UPDATE\`, \`DELETE\`) validam apenas a cláusula:
\`\`\`sql
USING (tenant_id = current_tenant_id_from_auth_uid())
WITH CHECK (tenant_id = current_tenant_id_from_auth_uid())
\`\`\`

## Por que é explorável
O frontend esconde as telas de gestão de catálogo para usuários de cargos operacionais (\`barber\` e \`receptionist\`) via componentes de rota (\`ManagerRoute\`). No entanto, a API REST do Supabase não possui esse gate no banco de dados. Um barbeiro autenticado pode emitir requisições HTTP REST com seu token JWT para alterar o preço de serviços ou excluir itens do catálogo.

## Evidência
- Políticas de RLS em \`services\` e \`products\` checam apenas \`tenant_id = current_tenant_id_from_auth_uid()\`.
- Ausência da verificação \`current_is_tenant_manager_from_auth_uid(tenant_id)\` nas operações de escrita.

## Impacto
Violação de controle de acesso baseado em papel (RBAC), permitindo sabotagem operacional ou alteração indevida de valores financeiros de serviços.

## Sugestão de Correção
Adicionar migration atualizando as políticas de \`INSERT\`, \`UPDATE\` e \`DELETE\` das tabelas mestres:
\`\`\`sql
CREATE POLICY "services_manager_write" ON public.services
  FOR ALL TO authenticated
  USING (
    tenant_id = current_tenant_id_from_auth_uid()
    AND current_is_tenant_manager_from_auth_uid(tenant_id)
  );
\`\`\`

## Critérios de Aceite
- [ ] Barbeiro recebe erro 403 / RLS policy violation ao tentar mutação via REST em \`services\`
- [ ] Gerente / admin consegue alterar preços e cadastrar itens normalmente
- [ ] Teste automatizado de mutação REST validando negação para papel \`barber\``,
  },
  {
    n: 4,
    titulo: '[Segurança] Arquivos de segredos locais desprotegidos contra commit no .gitignore (secrets.env.txt e *.bak_bom.txt)',
    labels: 'security, severidade-média',
    corpo: `## Descrição do Problema
Existem arquivos locais na raiz do projeto contendo variáveis de ambiente e backups com chaves ativas (\`secrets.env.txt\` e \`env.local.bak_bom.txt\`). A verificação com \`git check-ignore\` confirmou que o \`.gitignore\` atual não cobre essas extensões.

## Por que é explorável
Em fluxos de trabalho locais, desenvolvedores executam rotineiramente comandos como \`git add .\` ou \`git add -A\`. A ausência de regras explícitas no \`.gitignore\` fatalmente levará à inclusão acidental desses arquivos no índice do Git.

## Evidência
\`\`\`bash
git check-ignore secrets.env.txt env.local.bak_bom.txt
# Retorna código 1 (arquivos não estão ignorados pelo Git)
\`\`\`

## Impacto
Risco iminente de novo vazamento de credenciais ativas para o histórico do repositório remoto.

## Sugestão de Correção
Incluir no arquivo \`.gitignore\`:
\`\`\`gitignore
# Credenciais e backups locais
secrets.env.txt
*.bak_bom.txt
*.env.txt
\`\`\`

## Critérios de Aceite
- [ ] \`git check-ignore secrets.env.txt env.local.bak_bom.txt\` retorna código 0
- [ ] Comandos \`git status\` não mostram arquivos de credenciais como untracked`,
  },
  {
    n: 5,
    titulo: '[Segurança] Alinhar permissões residuais de tabela com as policies de RLS (menor privilégio)',
    labels: 'security, severidade-baixa',
    corpo: `## Descrição do Problema
Identificadas concessões de permissões SQL a nível de tabela que excedem as políticas de RLS ativas:
1. \`service_execution_participants\`: GRANT SELECT, UPDATE, DELETE para o papel \`anon\` (\`20260418100000:109\`).
2. \`feature_flags\`: GRANT INSERT, UPDATE, DELETE para o papel \`authenticated\` (\`20260807000000:80\`), onde apenas \`superadmin\` tem política de RLS.

## Por que é explorável
A Row Level Security (RLS) protege as tabelas no estado atual porque o PostgreSQL bloqueia requisições sem policy correspondente. Contudo, manter grants excessivos quebra o princípio da defesa em profundidade: caso uma policy permissiva seja adicionada no futuro, o papel \`anon\` terá imediatamente permissão de tabela concedida.

## Evidência
- \`supabase/migrations/20260418100000_add_service_execution_participants.sql:109\`
- \`supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql:80\`

## Impacto
Débito técnico de segurança e falhas em ferramentas de auditoria estática de banco de dados.

## Sugestão de Correção
Criar migration de limpeza de privilégios:
\`\`\`sql
REVOKE SELECT, UPDATE, DELETE ON public.service_execution_participants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.feature_flags FROM authenticated;
\`\`\`

## Critérios de Aceite
- [ ] Inspeção de \`information_schema.role_table_grants\` sem privilégios excessivos
- [ ] Testes de regressão funcionais aprovados sem impactos em fluxos legítimos`,
  },
  {
    n: 6,
    titulo: '[Segurança] Refatorar fluxos de impressão para eliminar uso residual de document.write',
    labels: 'security, severidade-baixa',
    corpo: `## Descrição do Problema
Os componentes de impressão \`CashClosingPage.tsx\` (linha 261) e \`Comandas.tsx\` (linha 1249) abrem janelas \`about:blank\` e injetam HTML via \`printWindow.document.write()\`.

## Por que é explorável
Ambos os fluxos já contam com tratamento preventivo através de \`escapeHtml()\` e anulação de contexto (\`printWindow.opener = null\`), neutralizando a vulnerabilidade de XSS. No entanto, o método \`document.write\` é desaconselhado pelos padrões modernos de desenvolvimento web e apresenta risco de regressão caso outros desenvolvedores introduzam novos dados dinâmicos sem a função de escape.

## Evidência
- \`pages/CashClosingPage.tsx:261\`
- \`pages/Comandas.tsx:1249\`

## Impacto
Risco potencial de regressão futura em manutenções no frontend.

## Sugestão de Correção
Adotar uma folha de estilos dedicada para impressão (@media print) ou componentes modais em tela com acionamento nativo de \`window.print()\`, evitando a criação de contextos \`about:blank\`.

## Critérios de Aceite
- [ ] Remoção de chamadas a \`document.write()\` no frontend
- [ ] Impressão de comanda e fechamento de caixa operando via estilos CSS de impressão nativos`,
  },
];

/* ------------------------------------------------------------------ *
 * RENDERIZAÇÃO DO HTML PARA CONVERSÃO EM PDF
 * ------------------------------------------------------------------ */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const chipClass = (sev) => {
  const map = { critica: 'c-critica', alta: 'c-alta', media: 'c-media', baixa: 'c-baixa', informativa: 'c-info' };
  return map[sev] || 'c-info';
};

const achadosRows = achados.map(a => `
  <tr>
    <td class="sev"><span class="chip ${chipClass(a.sev)}">${a.sev}</span></td>
    <td class="file"><code>${esc(a.file)}</code><div class="linhas">${esc(a.linhas)}</div></td>
    <td class="desc"><strong>${a.n}</strong> — ${esc(a.desc)}</td>
  </tr>`).join('');

const detalheCards = achados.map(a => `
  <div class="card">
    <div class="card-head">
      <span class="chip ${chipClass(a.sev)}">${a.sev.toUpperCase()}</span>
      <span class="ref">${a.cat} · ${a.n}</span>
      <span class="file-tag"><code>${esc(a.file)}</code></span>
    </div>
    <h4>${esc(a.desc)}</h4>
    <p class="linhas"><strong>Localização:</strong> ${esc(a.linhas)}</p>
    <p><strong>Por que é explorável:</strong> ${esc(a.porquê)}</p>
    <p><strong>Impacto:</strong> ${esc(a.impacto)}</p>
  </div>`).join('');

const fortesLis = fortes.map(f => `<li>${esc(f)}</li>`).join('');
const recosLis = recomendacoes.map(r => `
  <div class="reco">
    <span class="p ${'p-' + r.p.toLowerCase()}">${r.p}</span>
    <strong>${esc(r.titulo)}</strong>
    <div>${esc(r.texto)}</div>
  </div>`).join('');

const issuesBlocks = issues.map(iss => `
  <div class="issue-block">
    <div class="issue-title">ISSUE ${iss.n} — ${esc(iss.titulo)}</div>
    <pre class="issue-md">--- ISSUE ${iss.n} ---
Título: ${iss.titulo}
Labels: ${iss.labels}

${iss.corpo}
--- FIM ISSUE ${iss.n} ---</pre>
  </div>`).join('');

const metaData = new Date().toLocaleDateString('pt-BR');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Relatório de Auditoria de Segurança — SOU MANA.GER (SMG Barber)</title>
<style>
  :root {
    --critica: ${PALETA.critica};
    --alta: ${PALETA.alta};
    --media: ${PALETA.media};
    --baixa: ${PALETA.baixa};
    --forte: ${PALETA.forte};
    --ink: #0f172a;
    --mut: #64748b;
    --line: #e2e8f0;
  }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: var(--ink); line-height: 1.5; margin: 0; padding: 0; }
  .page { max-width: 840px; margin: 0 auto; padding: 18px 6px; }
  h1, h2, h3 { color: var(--ink); }
  h2 { font-size: 19px; margin-top: 26px; padding-bottom: 6px; border-bottom: 2px solid var(--line); }
  h4 { margin: 8px 0 4px; font-size: 13px; font-weight: 700; }
  code { background: #f1f5f9; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; font-size: 11px; }
  .muted { color: var(--mut); }
  .banner { display: flex; align-items: center; gap: 14px; padding: 10px 0 4px; }
  .logo { font-size: 12px; letter-spacing: 2px; color: #fff; background: linear-gradient(135deg, #0f766e, #134e4a); padding: 5px 10px; border-radius: 6px; font-weight: 700; }
  .cover { border: 1px solid var(--line); border-radius: 14px; padding: 30px 26px; margin-top: 8px; background: linear-gradient(160deg, #f8fafc, #f1f5f9); }
  .cover h1 { font-size: 24px; margin: 6px 0 8px; line-height: 1.2; }
  .cover .sub { font-size: 13px; color: var(--mut); font-weight: 600; }
  .cover .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-top: 14px; font-size: 12px; }
  .cover .meta b { color: var(--ink); }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
  .stat { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px; text-align: center; }
  .stat .n { font-size: 24px; font-weight: 800; }
  .stat .l { font-size: 11px; color: var(--mut); }
  .charts { display: grid; grid-template-columns: 1fr 1.4fr; gap: 14px; align-items: center; margin-top: 14px; }
  .chart-box { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px; text-align: center; }
  .chart-box .t { font-size: 11.5px; font-weight: 700; color: var(--mut); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px; }
  .legend { display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 6px; font-size: 11px; text-align: left; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
  th { background: #f1f5f9; text-align: left; padding: 7px 8px; border: 1px solid var(--line); font-weight: 700; }
  td { border: 1px solid var(--line); padding: 7px 8px; vertical-align: top; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .c-critica { background: var(--critica); } .c-alta { background: var(--alta); } .c-media { background: var(--media); }
  .c-baixa { background: var(--baixa); } .c-info { background: #8b919e; }
  .linhas { color: var(--mut); font-size: 10px; margin-top: 2px; }
  ul.pts { padding-left: 20px; font-size: 11.5px; }
  ul.pts li { margin-bottom: 6px; }
  .reco { border: 1px solid var(--line); border-left: 4px solid var(--forte); border-radius: 8px; padding: 9px 12px; margin: 8px 0; font-size: 11.5px; }
  .reco .p { display: inline-block; font-weight: 800; font-size: 10px; color: #fff; border-radius: 4px; padding: 1px 6px; margin-right: 6px; }
  .p-p1 { background: var(--critica); } .p-p2 { background: var(--alta); } .p-p3 { background: var(--media); }
  .card { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin: 10px 0; font-size: 11.5px; page-break-inside: avoid; }
  .card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .file-tag { color: var(--mut); font-size: 10.5px; }
  .issue-block { border: 1px solid var(--line); border-radius: 10px; margin: 14px 0; overflow: hidden; page-break-inside: avoid; }
  .issue-title { background: #f8fafc; padding: 8px 12px; font-weight: 700; font-size: 12px; border-bottom: 1px solid var(--line); }
  pre.issue-md { background: #0f172a; color: #e2e8f0; padding: 12px; font-size: 10px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; margin: 0; font-family: Consolas, monospace; }
  .strength { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 16px; margin: 10px 0; }
  .cover .foot { margin-top: 14px; font-size: 11px; color: var(--mut); line-height: 1.45; }
</style>
</head>
<body>
<div class="page">

  <!-- CAPA -->
  <div class="cover">
    <div class="banner"><span class="logo">SMG · CYBERSECURITY</span></div>
    <h1>Relatório de Auditoria de Segurança</h1>
    <div class="sub">SOU MANA.GER — SMG Barber (sou-manager)</div>
    <div class="meta">
      <div><b>Data da Auditoria:</b> ${metaData}</div>
      <div><b>Ambiente:</b> Produção (Vercel) + Supabase PostgreSQL</div>
      <div><b>Escopo Auditado:</b> Banco de Dados (RLS/RPC), Edge Functions, Frontend, Segredos e Histórico Git</div>
      <div><b>Total de Achados:</b> ${totalAchados} (1 crítico · 1 alto · 3 médios · 3 baixos · 2 informativos)</div>
    </div>
    <div class="foot">
      <b>Nota Metodológica:</b> A auditoria cobriu as cinco categorias essenciais mapeadas para a stack real do projeto (React 19 + TypeScript + Supabase + PostgreSQL 16 + Deno Edge Functions):
      <br/>(1) <b>Banco sem tranca</b> → Mapeado para Row Level Security (RLS) no PostgreSQL e checagem de tenant_id via Supabase Auth;
      <br/>(2) <b>Permissão no navegador</b> → Cruzamento entre gates de UI (ManagerRoute / SuperAdminRoute) e validações no servidor (RPCs, Edge Functions e API REST);
      <br/>(3) <b>IDOR</b> → Verificação sistemática de endpoints e funções PL/pgSQL que recebem identificadores de objetos para assegurar validação de posse;
      <br/>(4) <b>Chaves expostas</b> → Varredura de código-fonte, bundles de frontend compilados, histórico Git e arquivos locais desprotegidos;
      <br/>(5) <b>Inputs sem tratamento (XSS)</b> → Análise de sinks no DOM (document.write, innerHTML) e fluxos de impressão/exportação.
    </div>
  </div>

  <!-- RESUMO EXECUTIVO -->
  <h2>1. Resumo Executivo</h2>
  <div class="cards">
    <div class="stat"><div class="n" style="color:var(--critica)">${severidade.critica}</div><div class="l">Crítica</div></div>
    <div class="stat"><div class="n" style="color:var(--alta)">${severidade.alta}</div><div class="l">Alta</div></div>
    <div class="stat"><div class="n" style="color:var(--media)">${severidade.media}</div><div class="l">Média</div></div>
    <div class="stat"><div class="n" style="color:var(--baixa)">${severidade.baixa}</div><div class="l">Baixa / <span style="color:#8b919e">Info ${severidade.informativa}</span></div></div>
  </div>
  <div class="charts">
    <div class="chart-box">
      ${donutSvg()}
      <div class="t">Distribuição por Severidade</div>
      <div class="legend">
        <div><i style="background:var(--critica)"></i>Crítica (${severidade.critica})</div>
        <div><i style="background:var(--alta)"></i>Alta (${severidade.alta})</div>
        <div><i style="background:var(--media)"></i>Média (${severidade.media})</div>
        <div><i style="background:var(--baixa)"></i>Baixa (${severidade.baixa})</div>
        <div><i style="background:#94a3b8"></i>Informativa (${severidade.informativa})</div>
      </div>
    </div>
    <div class="chart-box">
      ${barSvg()}
      <div class="t">Achados por Categoria</div>
    </div>
  </div>

  <!-- PONTOS FORTES E FRACOS -->
  <h2>2. Pontos Fortes e Riscos Centrais</h2>
  <div class="strength">
    <b style="color:var(--forte)">Pontos Fortes Verificados no Código:</b>
    <ul class="pts">${fortesLis}</ul>
  </div>
  <div>
    <b style="color:var(--critica)">Pontos Fracos e Riscos Centrais:</b>
    <ul class="pts">
      <li><b>Exposição de segredos de produção no histórico Git:</b> O commit 46e21ce incluiu a chave <code>service_role</code> e credenciais de banco, exigindo rotação completa de segredos.</li>
      <li><b>Chave de IA exposta no bundle do cliente:</b> A <code>VITE_GEMINI_API_KEY</code> é embutida estaticamente no JavaScript público entregue ao navegador.</li>
      <li><b>Divergência de privilégios entre UI e REST:</b> Usuários operacionais sem permissão visual conseguem alterar serviços/preços se chamarem a API REST do Supabase diretamente.</li>
      <li><b>Higiene de arquivos locais:</b> Arquivos de segredos como <code>secrets.env.txt</code> não estão cobertos pelo <code>.gitignore</code>.</li>
    </ul>
  </div>

  <!-- TABELA DE ACHADOS -->
  <h2>3. Tabela de Achados Detalhados</h2>
  <table>
    <tr>
      <th style="width:75px">Severidade</th>
      <th style="width:40%">Arquivo e Linha</th>
      <th>Descrição</th>
    </tr>
    ${achadosRows}
  </table>

  <!-- DETALHES -->
  <h2>4. Detalhamento dos Achados</h2>
  ${detalheCards}

  <!-- RECOMENDAÇÕES -->
  <h2>5. Recomendações Priorizadas</h2>
  ${recosLis}

  <!-- ISSUES GITHUB -->
  <h2>6. Issues para o GitHub</h2>
  <p class="muted">Os blocos abaixo contêm o conteúdo integral pronto para ser copiado e colado na criação de issues no GitHub.</p>
  ${issuesBlocks}

  <div class="muted" style="margin:24px 0 6px; font-size:10.5px; text-align:center;">
    Relatório emitido em conformidade com o protocolo SMG Security Control · ${metaData} · Formato A4
  </div>
</div>
</body>
</html>`;

fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
fs.writeFileSync(OUT_HTML, html, 'utf8');

/* ------------------------------------------------------------------ *
 * GERAÇÃO DE PDF VIA PLAYWRIGHT
 * ------------------------------------------------------------------ */
async function gerar() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  await page.goto('file://' + OUT_HTML.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.addStyleTag({ content: `@page { size: A4; margin: 18mm 16mm 16mm 16mm; }` });
  await page.pdf({
    path: OUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '16mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate:
      '<div style="font-size:8px;color:#64748b;width:100%;padding:0 14mm;display:flex;justify-content:space-between;">' +
      '<span>Relatório de Auditoria de Segurança — SOU MANA.GER (SMG Barber)</span></div>',
    footerTemplate:
      '<div style="font-size:8px;color:#64748b;width:100%;padding:0 14mm;display:flex;justify-content:space-between;">' +
      '<span>Confidencial — Uso Interno</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
  });
  await browser.close();
  console.log('PDF gerado com sucesso em:', OUT_PDF);
}

gerar().catch((e) => {
  console.error('Erro na geração do PDF:', e);
  process.exit(1);
});
