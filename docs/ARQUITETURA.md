# Arquitetura do Sistema: SOU MANA.GER

O **SOU MANA.GER** é uma plataforma moderna de gestão para barbearias e centros de estética, construída com uma arquitetura focada em performance, escalabilidade e experiência do usuário (UX).

## Stack Tecnológica

O sistema utiliza as tecnologias mais recentes do ecossistema web:

- **Frontend**: [React 19](https://react.dev/) com [Vite](https://vitejs.dev/) para um desenvolvimento ultra-rápido.
- **Linguagem**: [TypeScript](https://www.typescriptlang.org/) para maior segurança de código.
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/) para interfaces modernas e responsivas.
- **Backend/Banco de Dados**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Realtime).
- **Inteligência Artificial**: [Google Gemini AI](https://ai.google.dev/) para geração de insights e relatórios inteligentes.
- **Roteamento**: `react-router-dom` (HashRouter para compatibilidade).
- **Gráficos**: [Recharts](https://recharts.org/) para visualização de dados financeiros e de performance.

## Estrutura do Projeto

```text
sou-mana.ger/
├── components/          # Componentes React reutilizáveis
│   ├── ui/              # Componentes básicos de interface
│   └── Layout.tsx       # Estrutura principal com Sidebar e Cabeçalho
├── context/             # Provedores de estado global (Auth, Tema)
├── docs/                # Documentação detalhada do sistema
├── pages/               # Páginas e views principais da aplicação
│   └── onboarding/      # Fluxos de boas-vindas e configuração inicial
├── services/            # Integrações com APIs externas (Supabase, Gemini)
├── types.ts             # Definições de tipos TypeScript globais
├── App.tsx              # Configuração de rotas e provedores
└── index.tsx            # Ponto de entrada da aplicação
```

## Gerenciamento de Estado

- **Autenticação**: Gerida pelo `AuthContext` integrado com Supabase Auth. Suporta diferentes níveis de acesso (Admin, Gerente, Barbeiro, Recepcionista).
- **Tema**: `ThemeContext` que controla a alternância entre modo claro e escuro, persistido localmente.

## Segurança e Acesso (RBAC)

O sistema implementa um Controle de Acesso Baseado em Funções (Role-Based Access Control):

- **Super Admin**: Acesso total ao sistema.
- **Gerente**: Gestão financeira, equipe e configurações da unidade.
- **Barbeiro/Profissional**: Acesso à agenda e comandas próprias.
- **Recepcionista**: Gestão de agendamentos e atendimento ao cliente.
