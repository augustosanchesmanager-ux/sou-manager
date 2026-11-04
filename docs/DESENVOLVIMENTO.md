# Guia de Desenvolvimento & Onboarding — SOU MANA.GER
## Manual Prático de Engenharia ("Do Zero ao Primeiro PR em < 1 semana")

> **SMG Barber — SOU MANA.GER (SMG Platform)**<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** CANÔNICO E OBRIGATÓRIO<br />
> **Responsável Formal:** Augusto (PO)<br />
> **Governança:** Precedência `AGENTS.md` · SMG Change Control Protocol

---

## 1. Visão Geral e Pré-requisitos

Bem-vindo ao time de engenharia do **SOU MANA.GER**! Este guia foi projetado para capacitar qualquer desenvolvedor a configurar o ambiente de desenvolvimento local e submeter seu primeiro Pull Request em menos de uma semana, com segurança e alinhamento total aos padrões de qualidade.

### Pré-requisitos Técnicos
- **Node.js:** Versão 18.x, 20.x ou superior (LTS recomendada).
- **npm:** Versão 9.x ou 10.x.
- **Git:** Instalado e configurado com chave SSH / credenciais GitHub.
- **Terminal:** PowerShell (Windows) ou Bash/Zsh (Linux/macOS).
- **Editor:** VS Code ou Antigravity / Cursor com extensões recomendadas (TypeScript, Tailwind CSS, Biome).

---

## 2. Configuração Rápida do Ambiente Local (Quickstart)

### 2.1 Clonagem e Instalação
```bash
git clone https://github.com/augustosanchesmanager-ux/sou-manager.git
cd sou-manager
npm install
```

### 2.2 Configuração de Variáveis de Ambiente
Crie o arquivo `.env.local` na raiz do projeto (este arquivo é ignorado pelo Git e nunca deve ser commitado):

```env
# Conexão com Supabase (Ambiente de Staging / Desenvolvimento)
VITE_SUPABASE_URL=https://sua-instancia.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-jwt

# Google Gemini AI (Assistente Inteligente & Insights)
VITE_GEMINI_API_KEY=sua-chave-api-google-ai-studio

# Configurações Opcionais
VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false
```

### 2.3 Execução do Servidor de Desenvolvimento
```bash
npm run dev
```

O Vite iniciará na porta **3000** com host exposto `0.0.0.0`:
👉 Acesse no navegador: `http://localhost:3000`

---

## 3. Local Demo Mode (Crítico para Diagnóstico)

Se você iniciar o projeto **sem preencher as variáveis do Supabase no `.env.local`** e o host for `localhost` ou `127.0.0.1`, o aplicativo ativará automaticamente o **Modo Demo Local**:

- **Comportamento:** Uma sessão de autenticação falsa é injetada em `soumanager.local.demo.session`, e os dados de clientes, serviços e agendamentos são emulados diretamente na memória do navegador via `soumanager.local.demo.db`.
- **Credenciais Padrão:**
  - **E-mail:** `teste@soumanager.local`
  - **Senha:** `12345678`
- **Implicação Forense para Desenvolvedores:** Se você encontrar comportamentos anômalos de login ou dados estáticos ao rodar em `localhost`, verifique se o modo demo está ativo (`hasSupabaseEnv` em `src/lib/supabase/client.ts`) antes de diagnosticar problemas de RLS ou RPC no Supabase remoto.

---

## 4. Bateria de Comandos de Engenharia & Gates

Antes de solicitar a revisão de qualquer alteração, todos os comandos abaixo devem retornar sucesso:

| Comando | O que faz | Critério de Aceite |
|---|---|---|
| `npm run dev` | Inicia o servidor Vite local | Servidor rodando na porta 3000 |
| `npm run typecheck` | Executa o compilador TypeScript (`tsc --noEmit`) | **0 erros de compilação** |
| `npm run test` | Executa todos os testes unitários via Vitest | **100% dos testes verdes** |
| `npx vitest run <caminho>` | Roda apenas um arquivo de teste específico | Útil durante desenvolvimento focado |
| `npm run architecture:ci` | Executa o guardião de arquitetura e imports | **Baseline mantida** (222 violações max, 0 circulares) |
| `npm run smg:verify` | **Runner Mestre de 6 Verificações** | **Exit code 0** (todos os checks bloqueadores PASS) |
| `npm run build` | Compila o bundle final de produção para `dist/` | Build limpo em < 15 segundos |
| `git diff --check` | Verifica resíduos de conflito e espaços em branco | **Zero alertas** |

---

## 5. Padrões de Código e Boas Práticas

### 5.1 Clean Code & Pragmatismo
- **Simplicidade:** Código direto e conciso beats abstrações prematuras. Não crie Repositories ou Services desnecessários sem aprovação arquitetural prévia.
- **Topologia de Imports:** O alias `@/` aponta para a raiz do repositório (`@/components/...`, `@/domain/...`). Verifique se um módulo já existe antes de criá-lo.
- **Cliente Supabase:** Nunca instancie `createClient` cru em componentes. Importe sempre de `@/services/supabaseClient` ou `src/lib/supabase/client`.

### 5.2 Convenções de Testes Automatizados (Vitest)
A documentação completa de testes está em `tests/README.md`:
- **Nomenclatura Canônica:** Use o padrão `should_<resultado>_when_<cenário>()`.
- **Padrão AAA:** Estruture o teste claramente com comentários:
  ```typescript
  // Arrange
  const appointment = buildAppointment({ status: 'pending' });
  // Act
  const result = confirmAppointment(appointment);
  // Assert
  expect(result.status).toBe('confirmed');
  ```
- **Builders:** Utilize sempre os builders de `tests/builders/` em vez de construir objetos literais gigantes manualmente.
- **Funções Puras:** **Nunca** faça mock de funções de domínio puras (`calculateCommission`, validadores, conversores). Mocke apenas dependências externas de I/O ou chamadas de API.
- **Isolamento:** Sempre inclua `vi.clearAllMocks()` no bloco `beforeEach`.

### 5.3 Estilização e Design System (Tailwind CSS v4)
- **CSS-First:** Todas as classes e tokens residem no `@theme` de `index.css`. Não existe `tailwind.config`.
- **Leis Rígidas de UI:**
  - **Purple Ban:** É proibido o uso de tons de roxo/violeta/índigo (`purple-*`, `violet-*`, `indigo-*`).
  - **Blue Ban:** Não utilize azul genérico de SaaS. Toda ênfase é dourada (`primary`) ou neutra.
  - **Contraste de CTA:** Todo botão primário dourado (`bg-primary`) deve conter texto escuro (`text-night font-bold`). Texto branco sobre dourado é terminantemente proibido.
  - **Componentes Padronizados:** Utilize sempre os componentes de `components/ui/` (`Button`, `Modal`, `StatusBadge`, `MetricCard`).

---

## 6. Fluxo de Contribuição e Submissão de PR

Todo desenvolvedor segue o protocolo de transição do **SMG Change Control Protocol**:

1. **Branch Feature:** Crie uma branch nomeada semanticamente a partir da `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/nome-da-sua-feature
   ```
2. **Implementação & Testes:** Escreva a funcionalidade e os testes unitários correspondentes.
3. **Validação Obrigatória:** Execute localmente a bateria completa (`npm run smg:verify` e `npm run build`).
4. **Commit Semântico:** Faça commits estruturados seguindo o padrão Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`).
5. **Abertura do Pull Request:** Abra o PR apontando para `main`, incluindo obrigatoriamente o bloco de **Authorization Record** no corpo da descrição:
   ```yaml
   authorization_record:
     ticket: "SEU-TICKET"
     authorized_by: "Augusto (PO)"
     date: "YYYY-MM-DD"
     target_env: "local"
     merge_approved: false
     deploy_approved: false
   ```
6. **Revisão e CI:** Aguarde a aprovação dos gates de CI no GitHub Actions (`validate` SUCCESS) para solicitação de merge ao PO.
