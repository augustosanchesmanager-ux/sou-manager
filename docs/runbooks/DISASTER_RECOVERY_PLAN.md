# Plano de Recuperação de Desastres (Disaster Recovery Plan — DRP)

> **Documento Oficial de Governança e Operação**
> **Subfase:** 6.11 Disaster Recovery — Fase 6: Production Readiness
> **Sistema:** SMG Platform (Produto Ativo: SMG Barber)
> **Classificação:** Operacional / Segurança / Resiliência
> **Última Atualização:** 2026-10-24
> **Autoridade:** Augusto Sanchez (Product Owner)

---

## 1. Visão Geral e Princípios

Este documento estabelece o **Plano Oficial de Recuperação de Desastres (DRP)** da plataforma SMG (SMG Barber). Seu objetivo é assegurar a continuidade dos negócios, a proteção estrita dos dados dos tenants (isolamento multi-tenant) e a minimização do tempo de inatividade em eventos de falha catastrófica, corrupção de dados ou regressões críticas em produção.

### Princípios Invioláveis
1. **Segurança de Dados em Primeiro Lugar:** A integridade dos dados dos clientes e registros financeiros (comissões, recebíveis e fechamentos) tem precedência sobre a velocidade de restabelecimento.
2. **Isolamento Multi-tenant Preservado:** Qualquer ação de restauração jamais pode violar o isolamento de `tenant_id` ou expor dados entre barbearias distintas.
3. **Decisão Humana Obrigatória:** Operações destrutivas, restores de banco e acionamento de contingência em nova infraestrutura exigem aprovação explícita do **Product Owner (Augusto)**.
4. **Merge ≠ Deploy (ADR-026):** Deploys e restaurações em produção são eventos desacoplados do repositório Git, exigindo validação independente de pós-restauração.

---

## 2. Métricas Oficiais de Resiliência (RPO / RTO)

| Métrica | Escopo | Meta Oficial | Mecanismo de Garantia |
|---|---|:---:|---|
| **RPO (Recovery Point Objective)** | **Janela de Deploy / Migrations** | **0 minutos** | Snapshot/Dump lógico obrigatório gerado imediatamente antes da migração (`scripts/ops/backup-prod.ps1`). |
| **RPO (Recovery Point Objective)** | **Operação Contínua de Rotina** | **≤ 24 horas** | Rotina automatizada de backups diários e WAL archives da infraestrutura Supabase (retenção mínima de 7 dias). |
| **RTO (Recovery Time Objective)** | **Frontend (Vercel SPA)** | **< 5 minutos** | Mecanismo de *Instant Rollback* (*Promote to Production*) no painel da Vercel. |
| **RTO (Recovery Time Objective)** | **Banco de Dados (Corrupção/Rollback)** | **< 60 minutos** | Restauração de dump lógico pré-deploy via Supabase CLI / `psql` ou execução de script de rollback DDL. |
| **RTO (Recovery Time Objective)** | **Falha Catastrófica de Provedor** | **< 4 horas** | Provisionamento de novo cluster Supabase, reidratação do schema e restauração do último dump offsite. |

---

## 3. Matriz de Cenários de Desastre

### Cenário 1: Falha Crítica ou Regressão no Frontend (SPA)
* **Sintomas:** Tela branca em produção (quando erro ocorre antes ou fora do ErrorBoundary), quebra de rotas críticas (`/#/schedule`, `/#/checkout`, `/#/agendar/:slug`), erro de carregamento de chunk JavaScript ou regressão visual severa.
* **Severidade:** **ALTA** (impacto na operação de caixa e agendamento dos tenants).
* **Fluxo de Recuperação:**
  1. **Contenção:** O Incident Commander confirma a anomalia via log de observabilidade ou reporte direto da equipe Sanchez Barber.
  2. **Rollback Imediato (Vercel):**
     - Acessar o painel da **Vercel** (`smg-barber` / `prj_M3cJ2cZosLONAt9IzumF2LwJZTSj`).
     - Navegar até a aba **Deployments**.
     - Identificar o último deployment estável anterior ao incidente.
     - Clicar nos três pontos (`...`) e selecionar **Promote to Production** (Instant Rollback).
  3. **Tempo Estimado:** **1 a 3 minutos**.
  4. **Pós-Validação:** Acessar `https://barber.soumanager.com` em modo anônimo, verificar carregamento da tela de login, painel e vitrine de agendamento online.

---

### Cenário 2: Corrupção Lógica de Dados ou Falha de Migração (Supabase)
* **Sintomas:** Inconsistência de saldos, quebra de integridade referencial, bloqueio de comandas, erro 500 persistente em RPCs críticas (`get_auth_access_context`, `bulk_close_comandas_with_credits`), ou regressão de RLS com risco de vazamento de dados.
* **Severidade:** **CRÍTICA**.
* **Fluxo de Recuperação:**
  1. **Contenção e Freeze:**
     - Congelar imediatamente qualquer novo deploy ou migração.
     - Se o risco for de contaminação cruzada ou escrita corrompida, acionar tela de manutenção ou suspender rotas de escrita.
  2. **Diagnóstico da Causa Raiz:**
     - Verificar se a corrupção foi introduzida por migração recente de DDL ou operação DML em lote.
  3. **Restauração Seletiva (Caminho A — Rollback DDL):**
     - Se o erro for restrito à estrutura de tabelas/policies/RPCs e houver script de rollback testado em `scripts/ops/rollback/`, aplicar o script reverso no SQL Editor do Supabase Produção (`ushsnmlbeurfvlkieiln`).
  4. **Restauração Integral (Caminho B — Restore de Backup Pré-Deploy):**
     - Se houver corrupção física ou perda de dados irreparável, utilizar o dump gerado antes da operação:
       ```powershell
       # Exemplo de restauração lógica via Supabase CLI
       supabase db push --dry-run
       # Ou restaurar o arquivo SQL gerado pelo backup pré-deploy
       psql -h db.ushsnmlbeurfvlkieiln.supabase.co -U postgres -d postgres -f .backups/backup_ushsnmlbeurfvlkieiln_full_YYYYMMDD_HHMMSS.sql
       ```
  5. **Tempo Estimado:** **15 a 45 minutos**.
  6. **Pós-Validação:**
     - Conferência do hash SHA256 do arquivo de backup.
     - Execução de queries de sanidade (integridade de `tenant_id`, contagem de comandas abertas/fechadas, saldo de comissões).

---

### Cenário 3: Indisponibilidade Severa ou Falha Catastrófica do Provedor (Outage)
* **Sintomas:** Queda generalizada do datacenter Supabase (Postgres e Edge Functions inacessíveis) ou da infraestrutura de CDN/Edge da Vercel por tempo prolongado (> 30 minutos sem previsão de retorno).
* **Severidade:** **CATASTRÓFICA**.
* **Fluxo de Recuperação:**
  1. **Comunicação Imediata:**
     - Notificar os tenants através de canal alternativo (WhatsApp / Status Page) informando a instabilidade geral do provedor.
  2. **Avaliação de SLA:**
     - Monitorar os canais oficiais de status do provedor (`status.supabase.com` / `www.vercel-status.com`).
     - Se o incidente for temporário com previsão de resolução < 60 min: manter contenção e aguardar restabelecimento do provedor.
  3. **Plano de Contingência Offsite (Cold Standby Recovery):**
     - Se o desastre regional for permanente ou sem previsão de retorno:
       a. Provisionar um novo projeto no Supabase em região alternativa (ex: `us-east-1` ou `sa-east-1`).
       b. Clonar o schema canônico a partir do repositório (`main`):
          ```bash
          supabase link --project-ref <NOVO_PROJECT_REF>
          supabase db push
          ```
       c. Importar a massa de dados do último backup seguro (`.backups/` ou snapshot externo).
       d. Atualizar as variáveis de ambiente de produção no painel da Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, secrets de Edge Functions).
       e. Promover novo build e redirecionar tráfego.
  4. **Tempo Estimado:** **2 a 4 horas**.

---

## 4. Procedimento Padronizado de Backup Pré-Deploy

Conforme a política de **RPO = 0 minutos** para releases, **nenhuma migração DDL/DML ou atualização crítica em Produção pode ser executada sem a geração prévia de um dump lógico validado**.

### Passo a Passo Operacional
1. Abra o terminal na raiz do projeto com o Supabase CLI configurado.
2. Defina a variável de ambiente segura (sem gravar em arquivos ou logs):
   ```powershell
   $env:SUPABASE_DB_PASSWORD = "SuaSenhaSeguraDeProducao"
   ```
3. Execute o script oficial de backup:
   ```powershell
   .\scripts\ops\backup-prod.ps1
   ```
4. O script executará as seguintes validações:
   - Checagem do Supabase CLI e conexão com o projeto `ushsnmlbeurfvlkieiln`.
   - Extração dos dados e schemas (`public,barber`).
   - Armazenamento em `.backups/backup_ushsnmlbeurfvlkieiln_full_<timestamp>.sql`.
   - Cálculo e exibição do hash **SHA256** e tamanho do dump.
5. Limpe a variável do terminal após a conclusão:
   ```powershell
   Remove-Item Env:SUPABASE_DB_PASSWORD
   ```
6. O hash SHA256 deve ser registrado no diário de deploy antes da liberação do gate.

---

## 5. Matriz de Contatos e Funções de Emergência

| Papel | Responsável | Escopo de Decisão | Contato Principal |
|---|---|---|---|
| **Incident Commander / Product Owner** | Augusto Sanchez | Decisão final de rollback, restore de banco, contingência externa e comunicação aos tenants | Gestão Executiva / PO |
| **Engenharia & Arquitetura** | Time SMG (OpenCode / Antigravity) | Diagnóstico técnico, execução de scripts, validação de integridade e telemetria | Engenharia SMG |
| **Operação Barbearia (Piloto)** | Rubens Sanchez (Sanchez Barber) | Validação operacional in-loco (recepção, atendimento, comanda e caixa) | Gerência Sanchez Barber |

---

## 6. Checklist de Verificação e Certificação Pós-Restore

Após qualquer procedimento de recuperação de desastres, o sistema **NÃO pode ser reaberto aos usuários** sem o cumprimento estrito do seguinte checklist de validação:

- [ ] **1. Conectividade e Auth:** Login de administrador e barbeiro executados com sucesso em `barber.soumanager.com`.
- [ ] **2. Integridade Multi-tenant (RLS):** Garantir que a RPC `get_auth_access_context` resolve o tenant correto sem expor dados cruzados.
- [ ] **3. Painel de Comandas & Checkout:** Acessar `/#/comandas`, validar exibição de comandas recentes e conferir fechamento de caixa do dia.
- [ ] **4. Agenda e Vitrine Online:** Carregar `/#/schedule` e a vitrine pública de agendamento (`/#/agendar/:slug`), confirmando disponibilidade de slots e consistência de barbeiros.
- [ ] **5. Outbox & Eventos:** Conferir tabela `outbox_items` para assegurar que nenhum evento de repasse ou comissão ficou travado ou gerou duplicidade financeira.
- [ ] **6. Status de Observabilidade:** Acessar o dashboard interno (`/#/observability`) e confirmar ausência de alertas vermelhos (`alerts.check()`).

---

## 7. Post-Mortem e Aprendizado Contínuo

Todo evento de acionamento do DRP exige a realização de um **Post-Mortem sem culpados (Blameless Post-Mortem)** em até **48 horas úteis** após a resolução:
1. Linha do tempo exata (detecção, contenção, restauração e liberação).
2. RPO e RTO reais observados vs. metas oficiais.
3. Causa raiz primária (5 Porquês).
4. Plano de ação preventivo com issues técnicas vinculadas no backlog para evitar reincidência.
5. Arquivamento do relatório em `docs/audit/incident-reports/`.
