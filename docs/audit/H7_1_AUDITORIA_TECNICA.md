# H-7.1 — Auditoria Técnica Formal do Ciclo H7-1 (Investigação Read-Only)

> **Status:** ⏳ INVESTIGAÇÃO CONCLUÍDA — SEM CAUSA RAIZ CONFIRMADA PARA O INCIDENTE ORIGINAL — **OPERAÇÃO PARADA — NENHUMA CORREÇÃO APLICADA**.
> **Referência:** `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` (D-HOM-27) · `docs/audit/H7_BASELINE_READONLY.md` (2026-08-16) · `docs/BUSINESS_DECISIONS.md` (D-HOM-26, D-HOM-27)
> **Data da auditoria:** 2026-08-16 · **Responsável:** OpenCode · **PO:** Augusto
> **Método:** consultas **read-only** (`supabase db query --linked -o json`) + leitura de código. **Nenhuma escrita, DDL, DML ou mutação remota.**

---

# Análise SaaS / Auditoria Técnica

# Relatório Formal de Auditoria — H7-1

**Projeto:** SMG — Sou.Manager
**Tenant:** Sanchez Barber
**Tenant ID:** `b716e290`
**Banco auditado:** `ushsnmlbeurfvlkieiln`
**Ciclo:** H7-1
**Natureza:** investigação read-only
**Status operacional:** **PARADO — nenhuma correção aplicada**

## 1. Objetivo

Consolidar as evidências técnicas obtidas durante a investigação do ciclo H7-1, respondendo aos questionamentos relacionados a:

1. resolução de tenant;
2. comportamento da tela de Comissões;
3. existência ou ausência de comissão;
4. integridade financeira do ciclo;
5. identidade do usuário que efetivamente operou o fluxo;
6. infraestrutura de eventos;
7. idempotência;
8. integridade dos registros de appointment/comanda;
9. segurança/RLS/RPC;
10. necessidade de intervenção corretiva.

A investigação foi realizada **sem alterações no banco ou na aplicação**.

---

## 2. Diagnóstico rápido

A investigação não encontrou evidência de corrupção financeira no H7-1.

O fluxo financeiro analisado está consistente:

**Comanda → pagamento → transaction**

com:

- valor da comanda: **R$ 35,00**;
- transaction: **R$ 35,00**;
- `paid_amount`: **R$ 35,00**;
- `amount_difference`: **R$ 0,00**;
- uma única transaction;
- um único participante;
- participante principal com 100%.

A comissão também **não deveria existir** nesse ciclo.

O profissional associado ao atendimento era:

> `36f1705b` — **Conta Homologacao v1.5**

com perfil de **manager** e:

> `commission_rate = 0`

A regra `isCommissionEligible` considera apenas **barber/seller** elegíveis para comissão. Portanto:

**nenhuma comissão é o comportamento esperado.**

---

## 3. Identidade real da operação

Este é um dos achados mais importantes da investigação.

O ciclo H7-1 **não foi operado pelo usuário homolog `189053ab`**.

As evidências apontam para:

> **Owner `828175b0` — `adm.sanchezbarber@gmail.com`**

### Evidências

`audit_logs.changed_by`:

- INSERT do appointment → `828175b0`;
- UPDATE do appointment/comanda → `828175b0`.

`transactions.user_id`:

- `828175b0`.

Metadata da transaction:

- `settled_by_user_id = 828175b0`.

Além disso, o `updated_at` do owner demonstra atividade posterior compatível com a sessão utilizada durante o ciclo.

### Conclusão

O H7-1 deve ser considerado um ciclo executado pelo **owner**, e não pelo usuário homolog.

Isso é fundamental para qualquer tentativa de reprodução do problema.

---

## 4. Investigação do TenantContext

Foram analisados os dois usuários relevantes:

| Usuário | Perfil | Tenant atual |
|---|---|---|
| `828175b0` | Owner/Manager | `b716e290` |
| `189053ab` | Homolog | `b716e290` |

Ambos apresentam atualmente:

- profile ativo;
- vínculo em `user_tenants`;
- tenant primário;
- tenant ativo;
- plano `pro`;
- permissões compatíveis;
- grants `EXECUTE` nas quatro RPCs avaliadas;
- policies presentes.

### Resultado

O erro:

> `[TenantContext] Failed to resolve tenant context`

**não é reproduzível no estado atual para nenhum dos dois usuários.**

### Classificação

**Não reproduzido.**

### Hipóteses mantidas

A evidência atual permite considerar, sem confirmar:

- condição transitória;
- contexto de sessão diferente;
- deployment diferente;
- ambiente legado;
- configuração antiga relacionada a `MULTI_SCHEMA=true`;
- estado anterior do banco/permissões.

Não há evidência suficiente para afirmar qual dessas hipóteses é a causa histórica.

---

## 5. Investigação da tela de Comissões

A investigação de banco não encontrou uma causa que explique uma falha estrutural da tela.

Foram verificadas as estruturas necessárias relacionadas a:

- colunas;
- grants;
- policies;
- acesso ao tenant;
- dados de staff;
- relacionamento com appointment/comanda.

Não foi encontrada evidência de:

- coluna ausente;
- grant insuficiente;
- RLS bloqueando indevidamente o acesso;
- ausência do tenant;
- erro estrutural no banco que explique isoladamente a tela vazia.

### Conclusão

A investigação de banco **não encontrou causa DB reproduzível para a tela de Comissões**.

Isso não significa que o frontend esteja necessariamente correto.

Significa apenas que:

> **não existe evidência suficiente, nesta rodada, para atribuir o problema ao banco.**

---

## 6. Investigação da comissão

Este ponto está **fechado com alta confiança**.

O atendimento do ciclo H7-1 está associado ao staff:

> `36f1705b` — Conta Homologacao v1.5

Características:

- role: `manager`;
- `commission_rate = 0`;
- não elegível pela regra `isCommissionEligible`.

A regra considera elegíveis:

- `barber`;
- `seller`.

Portanto:

> **manager não gera comissão nesse fluxo.**

### Resultado

**Comissão esperada: R$ 0,00.**

A ausência de uma linha de comissão **não constitui bug financeiro**.

---

## 7. Integridade financeira

Foi identificado:

### Comanda

`18ccc171`

- valor: **R$ 35,00**
- status: `paid`
- `closure_mode`: `standard`
- `financial_effect`: `true`
- `hidden_from_financial`: `false`

### Transaction

`9a55f575`

- tipo: `income`;
- valor: **R$ 35,00**;
- status: `paid`;
- source: `checkout`;
- `comanda_id` compatível;
- `paid_amount`: **R$ 35,00**;
- `amount_difference`: **R$ 0,00**.

### Participação

- 1 participante;
- participante principal;
- 100%.

### Conclusão

**Integridade financeira do H7-1: OK.**

Não foi encontrada duplicidade de lançamento.

---

## 8. Event Store — achado arquitetural

Foi encontrado um ponto importante:

> `event_store` do tenant está vazio.

Resultado:

> **0 eventos persistidos.**

Isso significa que o checkout analisado **não deixou um `CheckoutCompleted` persistido no Event Store de produção/legado**.

### Importante

Isso **não invalida o lançamento financeiro encontrado**.

A transaction existe e está financeiramente consistente.

Portanto, o achado deve ser classificado como:

> **Gap de infraestrutura/event-driven / persistência de eventos**

e não como:

> **corrupção financeira do H7-1.**

### Impacto potencial

Esse gap pode afetar futuramente:

- auditoria de eventos;
- replay;
- reconstrução histórica;
- subscribers;
- observabilidade;
- rastreabilidade de operações;
- mecanismos dependentes do Event Store.

Esse ponto merece investigação própria, mas **não deve ser corrigido dentro da investigação H7-1 sem autorização explícita**.

---

## 9. Discrepância de idempotência

Foi encontrada uma inconsistência na transaction:

`idempotency_key`:

> `finance-settle-18ccc171-…-comanda-3e749943-52b4-…`

O UUID final:

> `3e749943...`

não corresponde ao UUID da comanda:

> `18ccc171`.

### Classificação

**Anomalia de rastreabilidade/idempotência.**

### O que NÃO foi comprovado

Não foi comprovado:

- duplicidade financeira;
- reutilização indevida da chave;
- colisão de idempotência;
- perda financeira.

Portanto, não devemos declarar isso como bug confirmado.

### Recomendação

Registrar como **achado secundário para investigação específica da geração da `idempotency_key`**.

---

## 10. Appointment de homologação

O appointment criado às aproximadamente 20:32 apresenta `start_time` retrocedido para:

- 10:00;
- 10:30.

Isso foi interpretado como:

> **artefato de teste/homologação.**

O horário está dentro do range default apresentado pela tela.

### Conclusão

Não há evidência suficiente para classificar isso como corrupção de agenda.

Deve permanecer registrado como comportamento de teste.

---

## 11. Multi-schema / PGRST204

Também foi verificado o cenário envolvendo views `barber.*`.

As views apresentam:

> `security_invoker = true`

e colunas espelhadas.

Com isso:

> **não foi encontrada evidência de que o roteamento MULTI_SCHEMA seja responsável por um PGRST204 neste caso.**

Portanto, essa hipótese deve ser considerada **não confirmada**.

---

## 12. Matriz final dos achados

| Item | Resultado | Classificação |
|---|---|---|
| TenantContext | Não reproduzido | Investigação histórica necessária |
| Usuário que executou H7-1 | Owner `828175b0` | Confirmado |
| Usuário homolog | Não operou o ciclo | Confirmado |
| Tela Comissões / DB | Nenhuma causa encontrada | Não reproduzido |
| Comissão | Não deveria existir | Comportamento correto |
| Integridade da comanda | OK | Confirmado |
| Transaction | OK | Confirmado |
| Duplicidade financeira | Não encontrada | Confirmado |
| Event Store | 0 eventos | Gap arquitetural |
| `CheckoutCompleted` | Não persistido | Gap arquitetural |
| Idempotency key | UUID divergente | Anomalia a investigar |
| Appointment | Horário retrocedido | Artefato de homologação |
| MULTI_SCHEMA / PGRST204 | Não confirmado | Hipótese descartada nesta rodada |

---

## 13. Conclusão executiva

## Pergunta 1 — O problema era TenantContext?

**Não foi possível confirmar.**

O erro não é reproduzível no estado atual para os dois usuários investigados.

---

## Pergunta 2 — O banco está impedindo a tela de Comissões?

**Não foi encontrada evidência disso.**

Colunas, grants, policies e relacionamento de tenant analisados estão compatíveis.

---

## Pergunta 3 — Por que não apareceu comissão?

Porque **não deveria aparecer**.

O atendimento pertence a um `manager` com:

> `commission_rate = 0`

e a regra de elegibilidade não considera managers elegíveis.

---

## Pergunta 4 — O financeiro do H7-1 está correto?

**Sim.**

Foi encontrado:

> R$ 35,00 de comanda → R$ 35,00 de transaction → sem duplicidade.

---

## Pergunta 5 — Quem executou o ciclo?

**Owner `828175b0`.**

Não foi o usuário homolog `189053ab`.

---

## Pergunta 6 — O Event Store funcionou?

**Não há evidência de persistência do evento.**

O `event_store` está vazio.

Isso é um achado arquitetural separado do problema financeiro.

---

## Pergunta 7 — Existe problema de idempotência?

Existe uma **anomalia na chave**, mas não foi demonstrado impacto financeiro.

Deve ser investigada separadamente.

---

## Pergunta 8 — O appointment está corrompido?

Não há evidência de corrupção.

O horário retrocedido é compatível com artefato de homologação.

---

## Pergunta 9 — MULTI_SCHEMA explica o problema?

**Não foi confirmado.**

As views analisadas não sustentam essa hipótese como causa do PGRST204.

---

## Pergunta 10 — Devemos corrigir alguma coisa agora?

**Não.**

A operação deve permanecer parada até que o PO aprove o próximo passo.

---

## 14. Decisão recomendada

### NÃO executar agora

- migrations;
- alteração de RLS;
- alteração de RPC;
- alteração de cálculo de comissão;
- alteração de checkout;
- alteração de transaction;
- alteração do Event Store;
- alteração de idempotência;
- alteração de MULTI_SCHEMA;
- alteração de dados históricos.

A investigação já demonstrou que **não existe uma falha financeira confirmada que justifique uma intervenção emergencial no banco**.

---

## 15. Próximo passo seguro

Dividir a continuação em **duas investigações independentes**:

### Trilha A — Reprodução do problema original

Descobrir por que, no contexto original, ocorreu:

> `[TenantContext] Failed to resolve tenant context`

e por que a tela de Comissões aparentemente apresentou comportamento inesperado.

Para isso, precisamos reproduzir utilizando **o mesmo usuário, deployment, configuração e fluxo operacional do incidente original**, na medida em que isso ainda seja possível.

### Trilha B — Auditoria arquitetural

Separadamente investigar:

1. por que `event_store` está vazio;
2. por que `CheckoutCompleted` não foi persistido;
3. como a `idempotency_key` é construída;
4. por que existe divergência entre o identificador da comanda e o UUID presente na chave.

Essa segunda trilha **não deve ser misturada com a correção do incidente H7-1**.

---

## 16. Veredito da auditoria

**Status do H7-1: INVESTIGAÇÃO CONCLUÍDA — SEM CAUSA RAIZ CONFIRMADA PARA O INCIDENTE ORIGINAL.**

**Financeiro:** ✅ íntegro
**Comissão:** ✅ comportamento esperado
**Tenant atual:** ✅ funcional
**RLS/grants/RPC:** ✅ sem bloqueio identificado
**Duplicidade:** ✅ não encontrada
**Event Store:** ⚠️ gap identificado
**Idempotência:** ⚠️ anomalia identificada
**Causa original:** ❓ não reproduzida

### Recomendação

> **Manter operação parada para correção e não alterar produção até que a causa do incidente original seja reproduzida ou exista evidência suficiente para uma correção direcionada.**

Essa postura está alinhada com o padrão definido para o SMG: **primeiro evidência, depois mudança**. O próprio documento de atuação do projeto determina que alterações envolvendo banco, RLS, migrations, dados financeiros ou produção não sejam feitas sem validação e autorização.

**Não corrigir nada ainda.** Primeiro fechar esse relatório como evidência de auditoria e, só depois, abrir uma investigação específica para reprodução do incidente.
