# ADR-035: Sincronização de Agendamento com Comanda Aberta e Trava Pós-Checkout

**Status:** Accepted  
**Date:** 2026-10-20  
**Deciders:** PO (Augusto) + OpenCode  
**References:** ADR-001 (Commission vs Settlement), ADR-033 (Ciclos de Comissão em Comandas Reabertas), ADR-034 (Granularidade por Item no Ledger de Comissões), Frente C3

---

## Context

Após a conclusão das frentes C1 (ADR-033) e C2 (ADR-034), identificou-se um desalinhamento operacional na interface da Agenda (`pages/Schedule.tsx`):
1. **Desalinhamento Cadastral em Agendamento:** Ao editar um agendamento existente na Agenda (troca de barbeiro ou de serviço), a atualização alterava apenas o registro na tabela `appointments`. A comanda vinculada (`comandas` e `comanda_items`) permanecia com o `staff_id` e `service_id` antigos, fazendo com que no checkout a comissão fosse atribuída ao profissional anterior.
2. **Ausência de Trava na UI da Agenda para Comandas Liquidadas:** Quando a comanda vinculada ao agendamento já estava finalizada (`'paid'`, `'closed'` ou `'billed'`), o modal da Agenda ainda permitia a seleção e tentativa de alteração de serviço e profissional. Ao salvar, a camada de aplicação bloqueava a ação, mas a interface não deixava clara a existência da trava contábil prévia.
3. **Inconsistência Terminológica:** Na barra lateral de comanda (`components/ComandaSidebar.tsx`), o botão de ação exibia o texto truncado e informal `"reabri edição"` sem comunicar que se tratava de um processo restrito a gestores para estorno contábil.

---

## Decision

Fica aprovada a implementação do contrato de sincronização e trava contábil na Frente C3:

### 1. Propagação de Profissional e Serviço em Comanda Aberta (`'open'`)
- Quando a comanda vinculada estiver com status `'open'` (ou `'blocked'`, no caso de agendamentos futuros):
  - A troca de `staff_id` é propagada para `comandas.staff_id` e sincronizada em todos os itens de serviço vinculados (`comanda_items.staff_id`), identificados pela condição `service_id !== null && service_id !== undefined`.
  - **Invariante:** Itens de produto (itens de balcão ou vendas adicionais com `service_id === null`) são estritamente preservados e mantêm seu `staff_id` original intacto.
  - A troca de serviço propaga `service_id`, `product_name` e `unit_price` para o item correspondente e recalcula o total da comanda (`comandas.total`).

### 2. Trava de Integridade Contábil Pós-Checkout
- Definição canônica de status finalizados: `['paid', 'closed', 'billed']`.
- Na Agenda (`pages/Schedule.tsx`):
  - Ao abrir o modal de edição de um agendamento, o status da comanda vinculada é carregado via `comandaRepository.findLatestByAppointment`.
  - Caso o status seja finalizado (`isComandaLocked = true`):
    - Um banner explicativo de trava contábil é exibido no topo do modal.
    - Os campos de seleção de serviço (busca e botões de procedimento) e o seletor de profissional são desabilitados (`disabled={isComandaLocked}`).
    - A função `handleSave` bloqueia proativamente qualquer alteração de profissional ou serviço com mensagem de erro orientando que a alteração exige estorno/reabertura prévia da comanda no módulo de Comandas/Caixa.
  - Na camada de aplicação (`application/appointment/lifecycle.ts` e `application/appointment/comandaSync.ts`), as validações de trava bloqueiam alterações críticas (`status: 'blocked_closed'`) antes de persistir alterações em agendamentos cujas comandas já estejam liquidadas.

### 3. Padronização de Interface no Sidebar
- Em `components/ComandaSidebar.tsx`, o botão foi padronizado para `"Reabrir Comanda"`, com mensagem de orientação: *"Apenas gestores podem estornar a baixa financeira para reabrir a comanda."*

---

## Consequences

- **Positivas:**
  - Elimina a divergência de comissão entre o agendamento editado na Agenda e o checkout executado.
  - Protege a integridade contábil de fechamentos e comissões já registradas em comandas liquidadas.
  - Garante clareza na UX com feedback visual explícito de trava e botão formal padronizado.
  - Não exige migração de banco de dados (zero schema changes).
- **Negativas / Cuidados:**
  - Para alterar serviço ou profissional de um atendimento já finalizado, o gestor deve obrigatoriamente estornar a comanda antes de realizar a alteração.
