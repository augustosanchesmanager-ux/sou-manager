import type { PermissionDefinition, PermissionModule } from './types';

export const MODULE_LABELS: Record<PermissionModule, string> = {
  schedule: 'Agenda e Agendamento',
  clients: 'Clientes',
  services: 'Servicos e Produtos',
  financial: 'Financeiro e Caixa',
  team: 'Equipe e Interno',
  reports: 'Relatorios e Consultas',
  communication: 'Comunicacao e Notificacoes',
};

export const MODULE_ICONS: Record<PermissionModule, string> = {
  schedule: 'calendar_month',
  clients: 'group',
  services: 'content_cut',
  financial: 'payments',
  team: 'badge',
  reports: 'summarize',
  communication: 'chat',
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // ── AGENDA ──
  { key: 'schedule.view_general_schedule', label: 'Visualizacao da agenda geral', description: 'Visualiza a agenda completa da barbearia, incluindo todos os profissionais.', module: 'schedule' },
  { key: 'schedule.view_own_schedule', label: 'Visualizacao da propria agenda', description: 'Visualiza apenas a propria agenda de atendimentos.', module: 'schedule' },
  { key: 'schedule.create_appointments', label: 'Criar novos agendamentos', description: 'Cria novos agendamentos para clientes na agenda da barbearia.', module: 'schedule' },
  { key: 'schedule.edit_appointments', label: 'Editar agendamentos', description: 'Altera horarios, servicos ou detalhes de agendamentos existentes.', module: 'schedule' },
  { key: 'schedule.cancel_appointments', label: 'Cancelar agendamentos', description: 'Cancela agendamentos existentes na agenda.', module: 'schedule' },
  { key: 'schedule.block_times', label: 'Bloquear horarios', description: 'Bloqueia horarios para almoço, folga ou manutencao.', module: 'schedule', forbidden: ['Barber', 'Receptionist'] },
  { key: 'schedule.view_available_times', label: 'Ver horarios disponiveis', description: 'Visualiza horarios livres para agendamento.', module: 'schedule' },
  { key: 'schedule.manage_waitlist', label: 'Gerenciar fila de espera', description: 'Gerencia a fila de espera parahorarios lotados.', module: 'schedule' },
  { key: 'schedule.confirm_arrival', label: 'Confirmar chegada do cliente', description: 'Registra a chegada do cliente ao estabelecimento.', module: 'schedule' },

  // ── CLIENTES ──
  { key: 'clients.create', label: 'Cadastrar novos clientes', description: 'Cadastra novos clientes no sistema com dados basicos.', module: 'clients' },
  { key: 'clients.view_basic', label: 'Dados basicos do cliente', description: 'Visualiza nome, telefone e contato do cliente.', module: 'clients' },
  { key: 'clients.view_full_history', label: 'Historico completo de servicos', description: 'Visualiza todo o historico de servicos do cliente.', module: 'clients' },
  { key: 'clients.view_own_history', label: 'Historico proprio (servicos realizados)', description: 'Visualiza apenas os servicos que o barbeiro realizou para o cliente.', module: 'clients', forbidden: ['Receptionist'] },
  { key: 'clients.edit', label: 'Editar dados cadastrais', description: 'Altera informacoes cadastrais do cliente.', module: 'clients' },
  { key: 'clients.add_notes', label: 'Anotacoes sobre o cliente', description: 'Adiciona observacoes e notas sobre o cliente.', module: 'clients' },
  { key: 'clients.view_preferences', label: 'Preferencias do cliente', description: 'Visualiza preferencias e historico de escolhas do cliente.', module: 'clients' },
  { key: 'clients.block_clients', label: 'Bloquear/restringir clientes', description: 'Bloqueia ou restringe acesso de clientes problemáticos.', module: 'clients', forbidden: ['Barber', 'Receptionist'] },
  { key: 'clients.view_documents', label: 'Documentos do cliente', description: 'Acessa termos, consentimentos e documentos do cliente.', module: 'clients' },
  { key: 'clients.view_payment_history', label: 'Historico de pagamentos', description: 'Visualiza pagamentos anteriores do cliente.', module: 'clients' },

  // ── SERVICOS E PRODUTOS ──
  { key: 'services.view_catalog', label: 'Visualizar catalogo de servicos', description: 'Visualiza a lista completa de servicos oferecidos.', module: 'services' },
  { key: 'services.view_prices', label: 'Visualizar precos e duracao', description: 'Visualiza precos e duracao dos servicos.', module: 'services' },
  { key: 'services.sell_services', label: 'Vender servicos (em comanda)', description: 'Registra vendas de servicos em comandas.', module: 'services' },
  { key: 'services.view_stock', label: 'Visualizar estoque de produtos', description: 'Visualiza estoque atual de produtos para revenda.', module: 'services' },
  { key: 'services.sell_products', label: 'Vender produtos', description: 'Registra vendas de produtos integrados ao PDV.', module: 'services', dependencies: ['services.view_stock'] },
  { key: 'services.apply_discounts', label: 'Aplicar descontos', description: 'Aplica descontos ou promocoes em servicos e produtos.', module: 'services' },
  { key: 'services.register_additions', label: 'Registrar acrescimos', description: 'Registra servicos adicionais ou acrescimos na comanda.', module: 'services' },
  { key: 'services.manage_catalog', label: 'Gerenciar catalogo', description: 'Adiciona, edita ou remove servicos do catalogo.', module: 'services', forbidden: ['Barber', 'Receptionist'] },

  // ── FINANCEIRO ──
  { key: 'financial.open_close_cash', label: 'Abertura e fechamento de caixa', description: 'Realiza abertura e fechamento do caixa do dia.', module: 'financial' },
  { key: 'financial.register_payments', label: 'Registrar recebimentos', description: 'Registra pagamentos em dinheiro, cartao ou PIX.', module: 'financial' },
  { key: 'financial.register_basic_expenses', label: 'Registrar gastos basicos', description: 'Registra despesas basicas do dia (se permitido).', module: 'financial' },
  { key: 'financial.issue_receipts', label: 'Emitir recibos', description: 'Emite recibos simples para clientes.', module: 'financial' },
  { key: 'financial.view_daily_movement', label: 'Movimento de caixa do dia', description: 'Visualiza o movimento financeiro do dia em andamento.', module: 'financial' },
  { key: 'financial.view_reports', label: 'Relatorios financeiros detalhados', description: 'Acessa relatorios financeiros completos e consolidados.', module: 'financial', forbidden: ['Barber', 'Receptionist'] },
  { key: 'financial.process_refunds', label: 'Processar reembolsos', description: 'Processa reembolsos ou estornos de pagamentos.', module: 'financial', forbidden: ['Barber', 'Receptionist'] },
  { key: 'financial.reconciliation', label: 'Conciliacao de pagamentos', description: 'Realiza conciliacao entre pagamentos recebidos e registrados.', module: 'financial', forbidden: ['Barber', 'Receptionist'] },

  // ── EQUIPE ──
  { key: 'team.view_own_schedule', label: 'Propria agenda de trabalho', description: 'Visualiza a propria escala e agenda de trabalho.', module: 'team' },
  { key: 'team.request_time_off', label: 'Solicitar folgas', description: 'Solicita folgas ou ajustes de horario via sistema.', module: 'team' },
  { key: 'team.view_team_schedules', label: 'Escalas da equipe', description: 'Visualiza as escalas de trabalho da equipe (somente visualizacao).', module: 'team' },
  { key: 'team.internal_communication', label: 'Comunicacao interna', description: 'Acessa canal de comunicacao com outros membros da equipe.', module: 'team' },
  { key: 'team.view_training', label: 'Treinamentos e materiais', description: 'Acessa materiais de treinamento e capacitacao interna.', module: 'team' },
  { key: 'team.view_own_performance', label: 'Desempenho pessoal', description: 'Visualiza proprias metas e indicadores de desempenho.', module: 'team' },
  { key: 'team.edit_own_profile', label: 'Editar proprio perfil', description: 'Atualiza foto, especialidades, bio e dados profissionais.', module: 'team' },
  { key: 'team.change_own_password', label: 'Alterar senha pessoal', description: 'Altera a propria senha de acesso ao sistema.', module: 'team' },
  { key: 'team.view_own_commission', label: 'Proprias comissoes', description: 'Visualiza comissoes e ganhos pessoais.', module: 'team' },
  { key: 'team.view_own_goals', label: 'Proprias metas', description: 'Visualiza metas pessoais de produtividade.', module: 'team' },

  // ── RELATORIOS ──
  { key: 'reports.view_daily_attendance', label: 'Atendimentos do dia', description: 'Visualiza numero e detalhes dos atendimentos realizados no dia.', module: 'reports' },
  { key: 'reports.view_schedule_overview', label: 'Agenda do dia/semana', description: 'Visualiza visao geral da agenda do dia ou semana.', module: 'reports' },
  { key: 'reports.view_busy_free_times', label: 'Horarios ocupados/livres', description: 'Consulta horarios ocupados e disponiveis.', module: 'reports' },
  { key: 'reports.view_personal_productivity', label: 'Produtividade pessoal', description: 'Acessa indicadores de produtividade individual.', module: 'reports' },
  { key: 'reports.view_managerial', label: 'Relatorios gerenciais', description: 'Acessa relatorios gerenciais consolidados da barbearia.', module: 'reports', forbidden: ['Barber', 'Receptionist'] },
  { key: 'reports.view_team_metrics', label: 'Metricas de desempenho da equipe', description: 'Visualiza metricas comparativas de desempenho da equipe.', module: 'reports', forbidden: ['Barber', 'Receptionist'] },
  { key: 'reports.view_service_revenue', label: 'Faturamento por servico', description: 'Visualiza faturamento por tipo de servico (limitado ou agregado).', module: 'reports' },

  // ── COMUNICACAO ──
  { key: 'communication.send_reminders', label: 'Enviar lembretes', description: 'Envia lembretes de agendamento para clientes via sistema.', module: 'communication' },
  { key: 'communication.view_notifications', label: 'Notificacoes do sistema', description: 'Visualiza notificacoes e alertas do sistema.', module: 'communication' },
  { key: 'communication.respond_to_messages', label: 'Responder mensagens', description: 'Responde a mensagens de clientes (se integrado).', module: 'communication' },
  { key: 'communication.send_followup', label: 'Mensagens de follow-up', description: 'Envia mensagens de acompanhamento pos-atendimento.', module: 'communication' },
  { key: 'communication.manage_templates', label: 'Gerenciar modelos de mensagem', description: 'Cria e edita modelos/predefinidos de mensagens.', module: 'communication', forbidden: ['Barber', 'Receptionist'] },
  { key: 'communication.view_communication_history', label: 'Historico de comunicacoes', description: 'Visualiza historico de comunicacoes com clientes.', module: 'communication' },
];

export const getPermissionsByModule = (module: PermissionModule): PermissionDefinition[] =>
  PERMISSION_DEFINITIONS.filter((p) => p.module === module);

export const getPermissionByKey = (key: string): PermissionDefinition | undefined =>
  PERMISSION_DEFINITIONS.find((p) => p.key === key);

export const getModulePermissionsCount = (module: PermissionModule, enabledKeys: Record<string, boolean>): { total: number; active: number } => {
  const modulePerms = getPermissionsByModule(module);
  const total = modulePerms.length;
  const active = modulePerms.filter((p) => enabledKeys[p.key]).length;
  return { total, active };
};
