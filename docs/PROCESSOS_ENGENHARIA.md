# Processos de Engenharia & Governança — SOU MANA.GER
## Ciclo de Vida de Software, Gates de Qualidade e Governança de Produção

> **SMG Barber — SOU MANA.GER (SMG Platform)**<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** CANÔNICO E OBRIGATÓRIO<br />
> **Responsável Formal:** Augusto (PO)<br />
> **Precedência Normativa:** `AGENTS.md` (Fonte Única da Verdade) · SMG Change Control Protocol<br />
> **Invariantes Permanentes:** `MERGE ≠ DEPLOY PROD` (ADR-026) · Separação Canônica (ADR-001)

---

## 1. Princípios de Governança

A integridade do **SOU MANA.GER Barber** é mantida por meio de um protocolo de engenharia rigoroso que protege o ambiente de produção contra regressões funcionais, vazamentos de dados ou quebras de isolamento multi-tenant:

1. **Fonte Única da Verdade:** O arquivo `AGENTS.md` na raiz do repositório é o contrato normativo supremo de governança, vinculando qualquer agente ou desenvolvedor que atue no projeto.
2. **Isolamento de Infraestrutura (`MERGE ≠ DEPLOY PROD`):** O merge autorizado de um Pull Request na branch `main` **não autoriza nem executa o deploy em produção** (ADR-026). O deploy de produção é uma decisão comercial e operacional exclusiva do PO, governada por workflow próprio (`deploy-production.yml`) com aprovação manual protegida no GitHub Actions.
3. **Imutabilidade do Roadmap:** O roadmap do projeto está **congelado desde 2026-07-24** (`ROADMAP.md`). Nenhuma nova fase ou alteração estrutural pode ser criada sem a deliberação formal de uma Architecture Decision Record (ADR).

---

## 2. A Máquina de Estados do SMG Change Control Protocol

Toda alteração de software no ecossistema SMG deve percorrer estritamente a sequência de estados:

```
INTAKE ➔ AUDIT ➔ CLASSIFY ➔ [STOP/GATE] ➔ ISOLATE ➔ IMPLEMENT ➔ VALIDATE ➔ [STOP/GATE]
  ➔ COMMIT AUTHORIZATION ➔ COMMIT ➔ [STOP/GATE] ➔ PUSH AUTHORIZATION ➔ PUSH ➔ PULL REQUEST
  ➔ CI/E2E ➔ [STOP/GATE] ➔ MERGE AUTHORIZATION ➔ MERGE ➔ POST-MERGE
  ➔ [STOP/GATE] ➔ DEPLOY AUTHORIZATION ➔ DEPLOY ➔ POST-DEPLOY ➔ CLOSE
```

### 2.1 Descrição das Fases Operacionais
- **INTAKE & AUDIT:** Recepção da demanda, leitura forense do estado atual do repositório e verificação de arquivos afetados sem aplicar alterações.
- **CLASSIFY & STOP/GATE:** Classificação da mudança (bugfix mínimo, subfase de roadmap, refactor autorizado) e apresentação do plano de execução ao PO para autorização prévia.
- **ISOLATE & IMPLEMENT:** Criação de branch isolada (`feat/...`, `fix/...`) e implementação das modificações estritamente dentro do escopo autorizado.
- **VALIDATE & STOP/GATE:** Execução local da bateria completa de engenharia (`typecheck`, `unit tests`, `architecture:ci`, `smg:verify`, `build`). Nenhuma alteração é commitada sem validação verde.
- **COMMIT & PUSH AUTHORIZATION:** Autorização formal do PO para registrar o commit semântico e enviar a branch para o repositório remoto.
- **CI / E2E & MERGE AUTHORIZATION:** Abertura do Pull Request, validação automática na esteira de CI do GitHub Actions e aprovação explícita do PO antes da integração (`squash-merge`) em `main`.

---

## 3. Authorization Record (Token Estruturado de Autorização)

Todo Pull Request e toda solicitação formal de promoção de versão deve conter obrigatoriamente, no topo de sua descrição, um bloco YAML estruturado de **Authorization Record**:

```yaml
authorization_record:
  ticket: "FASE-X.Y-NOME-DA-TAREFA" # Identificador da frente ou ticket
  authorized_by: "Augusto (PO)"      # Responsável formal pela deliberação
  date: "YYYY-MM-DD"                 # Data da autorização formal
  target_env: "local"                # "local" | "staging" | "prod"
  merge_approved: false              # Aprovado para merge em main?
  deploy_approved: false             # Aprovado para deploy em produção? (MERGE ≠ DEPLOY)
```

Nenhum merge na branch `main` é aceito pela equipe ou pelos agentes sem a presença e conformidade desse registro.

---

## 4. Matriz de Gates de Integração Contínua (CI)

A esteira de integração contínua (`.github/workflows/ci.yml`, ADR-022) atua como barreira técnica automatizada:

### 4.1 Gates Bloqueadores (Blocking Failures)
O job agregador `validate` falha e bloqueia a integração se qualquer um dos checks abaixo reprovar:
- **`typecheck`:** Checagem estática de tipos via `tsc --noEmit`. 0 erros tolerados.
- **`build`:** Compilação do bundle de produção via `vite build`. Deve compilar sem avisos críticos.
- **`unit`:** Suíte completa de testes unitários e de integração via `vitest run`. 100% de testes verdes.
- **`architecture:ci`:** Guarda de arquitetura que verifica dependências circulares (0 toleradas), imports proibidos (0 tolerados) e limite histórico de violações de repositório (máximo 222).

### 4.2 Gates Informativos (Advisory)
- **`lint` (Biome):** Verifica conformidade de estilo e formatação na pasta `src/`. Possui `continue-on-error: true`.
- **`e2e-smoke` (Playwright):** Executa o roteiro básico de fumaça da aplicação contra o ambiente de staging.

---

## 5. Política de Banco de Dados e Migrações (Supabase)

O banco de dados relacional (PostgreSQL) abriga os dados de produção das barbearias e exige extrema cautela:

1. **Arquivos Timestampados:** Toda alteração de schema, funções, triggers ou políticas de RLS deve residir em um arquivo timestampado em `supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`.
2. **Proibição de Aplicação Não Autorizada:** **Nunca** aplique uma migration no banco de produção sem autorização explícita e documentada do PO. Não há runner automático de banco no deploy do frontend.
3. **Auditoria de RLS Permanente:**
   - Toda nova tabela deve possuir `ENABLE ROW LEVEL SECURITY`.
   - Políticas de `SELECT`, `INSERT`, `UPDATE` e `DELETE` devem verificar obrigatoriamente `tenant_id = public.current_tenant_id_from_auth_uid()`.
   - O runner `npm run smg:verify` inspeciona automaticamente todas as migrações contra regressões de RLS.

---

## 6. Matriz de Papéis e Responsabilidades (RACI)

| Atividade | Antigravity / Engenharia | Augusto (PO) |
|---|:---:|:---:|
| Arquitetura, código e refatoração de baixo impacto | **Executa** | Informado |
| Testes unitários, E2E e automação de CI | **Executa** | Informado |
| Documentação técnica interna e relatórios de auditoria | **Executa** | Aprova |
| Decisões de regras de negócio e precificação | Consulta | **Delibera** |
| Criação de novas ADRs estruturais | Propõe | **Aprova** |
| Autorização de Commit e Push de branches | Solicita | **Autoriza** |
| Autorização de Merge na branch `main` | Solicita | **Autoriza** |
| Autorização de Deploy em Produção | Bloqueado | **Autoriza e Despacha** |
