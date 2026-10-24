# Runbook — Gestão de Incidentes & Rollback em Produção

> Referência: Subfase 6.8 (Documentação Operacional) — Fase 6: Production Readiness  
> Aplicação: SMG Barber (`https://barber.soumanager.com`)  
> Última Atualização: 2026-10-24

---

## 1. Classificação de Severidade

| Nível | Definição | Exemplo | SLA de Resposta | Responsável |
|---|---|---|---|---|
| **P0 — Crítico** | Indisponibilidade total do SaaS, falha de autenticação geral, corrupção financeira ou quebra de isolamento multi-tenant (vazamento de dados). | Login inacessível para todos os tenants; erro 500 no checkout; dados de um tenant visíveis para outro. | Imediato (< 15 min) | Engenharia + PO |
| **P1 — Alto** | Funcionalidade crítica degradada sem workaround evidente. | Falha no fechamento de caixa; cálculo incorreto de comissões; agendamento público offline. | < 1 hora | Engenharia |
| **P2 — Médio** | Problema operacional com workaround disponível; lentidão pontual. | Falha na exportação de relatórios; lentidão na busca de clientes. | < 4 horas | Engenharia |
| **P3 — Baixo** | Inconsistência cosmética de UI, erro de texto ou problema não impeditivo. | Ícone desalinhado; erro de digitação em modal de ajuda. | Próxima sprint | Engenharia |

---

## 2. Procedimento de Rollback Imediato (Vercel)

Quando um deploy em produção introduzir regressão impeditiva (P0/P1), o rollback do frontend deve ser executado imediatamente.

### Passo 1: Executar Rollback pelo Dashboard do Vercel
1. Acesse o painel do projeto: [https://vercel.com/augustosanchesmanager-uxs-projects/smg-barber](https://vercel.com/augustosanchesmanager-uxs-projects/smg-barber).
2. Clique na aba **Deployments**.
3. Localize o deployment imediatamente anterior homologado (status `Ready`).
4. Clique no menu de três pontos (`...`) ao lado do deployment estável e selecione **Instant Rollback** (ou **Promote to Production**).
5. Confirme a operação. O tráfego do domínio canônico `barber.soumanager.com` será revertido em menos de 10 segundos.

### Passo 2: Executar Rollback via Vercel CLI (Alternativa por Terminal)
```bash
# Listar os últimos deployments de produção
vercel deployment list --prod

# Promover deployment específico para produção
vercel promote <DEPLOYMENT_ID_ANTERIOR> --yes
```

---

## 3. Gestão de Incidentes de Banco de Dados & RLS

Se o incidente envolver falha de integridade no Supabase:

1. **Avaliação da Causa Raiz:**
   - Verificar logs remotos no Supabase Dashboard em **Logs** > **Postgres Logs** / **API Edge Logs**.
   - Analisar o volume de chamadas RPC e bloqueios de tabela (`pg_stat_activity`).
2. **Mitigação RLS / Permissões:**
   - Nunca desabilitar o RLS de uma tabela em produção (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY` é expressamente proibido).
   - Em caso de política defeituosa, aplicar script de rollback timestampado com aprovação do PO.
3. **Contenção de Dados:**
   - Caso haja falha em transações financeiras, consultar os logs de auditoria (`audit_logs`) e outbox (`domain_events`) para reconciliação determinística.

---

## 4. Post-Mortem & Registro de Incidente

Todo incidente P0 ou P1 exige a confecção de um relatório de post-mortem em até 24 horas após a estabilização, arquivado em `docs/audit/INCIDENTS/`:

- **Identificação:** Data, duração, autor e severidade.
- **Linha do Tempo:** Minuto a minuto da detecção à resolução.
- **Causa Raiz:** Explicação técnica fundamentada (sem suposições).
- **Ações Corretivas:** Medidas preventivas de código, testes ou infraestrutura para evitar reincidência.
