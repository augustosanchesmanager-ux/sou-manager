# Documentação de Funcionalidades — SOU MANA.GER (SMG Barber)

> Documento oficial de status e capacidades funcionais do produto comercial **SMG Barber**, consolidado conforme o código real e o banco de dados.
> **Última atualização:** 04/11/2026 (Auditoria de Regras de Negócio — Fase 7.2)
> **Produto Comercial Ativo:** SMG Barber
> **Arquitetura Base:** SMG Platform (Multi-tenant)

---

## 1. Funções e Módulos Ativos em Produção

### 1.1 Acesso, Segurança e Multi-tenancy
- **Autenticação & RBAC:** Login via Supabase Auth com resolução automática de tenant pela RPC `get_auth_access_context`. Papéis estritos: `owner`, `admin`, `manager`, `barber`, `receptionist`.
- **Guarda de Status:** Usuários pendentes ou suspensos são interceptados pelo `ProtectedRoute` e direcionados a `/pending-approval`.
- **Isolamento de Dados (RLS):** 100% das tabelas blindadas por Row Level Security via `current_tenant_id_from_auth_uid()`.
- **Proteção de Tabelas Mestres:** Mutações diretas (INSERT, UPDATE, DELETE) em serviços, produtos, fornecedores e terminais restritas a gestores (`current_is_manager_from_auth_uid`).
- **Segurança de IA:** Integração com Google Gemini isolada em Edge Function autenticada (`supabase/functions/gemini-assistant`), sem chaves expostas no bundle frontend.

### 1.2 Agenda e Atendimento Operacional
- **Agenda Inteligente (`/schedule`):** Grade dinâmica com detecção de sobreposição em tempo real e advisory locks contra race conditions.
- **Duração Flexível de Serviços:** Presets rápidos (15m a 3h), cálculo multi-serviços com buffer operacional e preservação de tempo no drag-and-drop.
- **Bloqueios Rápidos:** Pausas (15m/30m), almoço (1h) e folga instantânea.
- **Sincronização Atômica Agenda ↔ Comanda:** Alterações de horário, profissional ou serviço na agenda sincronizam automaticamente a comanda aberta correspondente (`sync_comanda_from_appointment`), bloqueando alterações caso a comanda já possua pagamentos.
- **Cadeira Cativa & Preferências:** Preenchimento automático do barbeiro de preferência do cliente ao abrir novo agendamento.

### 1.3 Comandas e Checkout PDV
- **Comandas (`/comandas`):** Abertura rápida (atalho 'N'), suporte a "Consumidor Final / Balcão", detecção preventiva de comanda duplicada no mesmo dia e bloqueio de comanda para datas futuras (`status: blocked`).
- **Combos Inteligentes:** Serviços compostos com desconto automático (fixo ou percentual) e rateio transparente no checkout.
- **Checkout Expresso (`/checkout`):** Validação server-side de totais, itens e quantidades; calculadora de troco com bloqueio de valor insuficiente; seleção rápida de cédulas BRL.
- **Pagamentos Parciais & Múltiplos:** Registro seguro em `comanda_payments` com lock pessimista (`FOR UPDATE`) impedindo que a soma exceda o total da comanda.
- **Estorno Atômico:** Reversão auditada de pagamentos com justificativa obrigatória e proteção contra estorno duplo.
- **Vouchers de Uso Único:** Aplicação de cupons e vouchers promocionais com trava física de unicidade por tenant (`idx_comandas_single_voucher_usage`).

### 1.4 Clientes, Fidelização e Retenção
- **Perfil 360° do Cliente (`/clients`):** Gaveta lateral com histórico acumulado de visitas, total gasto, ticket médio, observações técnicas e preferências de atendimento.
- **Filtro de Inatividade & Churn Preventivo:** Segmentação instantânea por faixas de ausência:
  - *Ativo:* até 30 dias da última visita
  - *Ausente:* 31 a 60 dias
  - *Crítico:* 61 a 90 dias
  - *Inativo:* mais de 90 dias ou nunca compareceu
- **Reengajamento via WhatsApp:** Disparo direto para `wa.me` com número sanitizado (DDI 55), templates personalizáveis e link dinâmico da página de agendamento online.

### 1.5 Financeiro, Comissões e Caixa
- **Separação Canônica (ADR-001):**
  - `domain/commission/`: Cálculo puro e imutável da comissão teórica individual.
  - `application/cashClosing/`: Rateio contábil efetivo do fechamento de caixa diário.
- **Fechamento de Caixa Cego:** Conferência de saldo pelo gestor com registro de suprimentos, sangrias e conciliação de maquininhas.
- **Extrato Instantâneo do Barbeiro:** Modal de produtividade para consulta em tempo real das comissões do profissional por comanda.
- **Folha de Pagamento & Payouts (ADR-030):** Ciclos formais de apuração (semanal/quinzenal/mensal), abatimento de vales/adiantamentos e quitação atômica.
- **Contas a Pagar (`/expenses`):** Gestão de despesas operacionais e recorrentes com chave de idempotência.
- **Recibos (`/receipts`):** Emissão e impressão segura via DOM APIs nativas, com eliminação de `document.write`.

### 1.6 Club dos Chefes (Módulo de Assinaturas)
- **Planos Recorrentes (`/chef-club-plans`):** Configuração de mensalidades, periodicidade e catálogo de serviços cobertos.
- **Gestão de Assinaturas (`/chef-club-subscriptions`):** Ciclos de cobrança, faturamento recorrente e conciliação de recebíveis.
- **Créditos de Serviços:** Abatimento automático de corte/barba na comanda de clientes com assinatura ativa e adimplente.
- **Cancelamento Atômico:** Estorno seguro de parcelas futuras em aberto ao cancelar a assinatura, com preservação das parcelas liquidadas.

### 1.7 Agendamento Online Público
- **Página Pública (`/#/agendamento/:tenantSlug`):** Catálogo de serviços com fotos, seleção de barbeiro, escolha de horários livres em tempo real e confirmação rápida por telefone com validação de formato.

### 1.8 Arquitetura de Eventos & Observabilidade
- **Transactional Outbox:** Garantia de entrega de eventos financeiros via fila transacional com retry backoff exponencial e dead-letter queue.
- **Idempotência de API:** Middleware com chave de idempotência e hash SHA-256 para prevenir cobranças ou pedidos em duplicidade.
- **Painel de Observabilidade (`/#/observability`):** Monitoramento de saúde de eventos, consumers ativos e replays.

---

## 2. Status de Funcionalidades Previamente "Em Ajuste"

Todas as pendências históricas registradas na auditoria de março/2026 foram **completamente saneadas e certificadas**:
1. **Onboarding Inicial:** 100% implementado e integrado com persistência no banco via RPC `provision_new_tenant` e `onboarding_completed: true` em `profiles`.
2. **Performance da Unidade:** Cards de KPIs operacionais e financeiros conectados às RPCs de métricas reais (`p1_3_get_dashboard_kpis`).
3. **Vales e Adiantamentos da Folha:** Totalmente arquitetados e validados pelo ADR-030 e módulo `domain/payout/`.
4. **Detalhes de Pedidos / Compras:** Sincronizado com fornecedores e movimentação de estoque.
