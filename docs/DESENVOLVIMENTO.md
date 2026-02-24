# Guia de Desenvolvimento: SOU MANA.GER

Este guia contém as instruções necessárias para configurar o ambiente de desenvolvimento e começar a contribuir com o projeto.

## Pré-requisitos

Antes de iniciar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior recomendada)
- **npm** ou **pnpm**
- Conta no **Supabase**
- Chave de API do **Google Gemini** (AI Studio)

## Configuração do Ambiente

1. **Clone o repositório**:

   ```bash
   git clone <url-do-repositorio>
   cd SOU-MANA-GER/sou-mana.ger
   ```

2. **Instale as dependências**:

   ```bash
   npm install
   ```

3. **Configuração de Variáveis de Ambiente**:
   Crie um arquivo `.env.local` na raiz da pasta `sou-mana.ger` com as seguintes chaves:

   ```env
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
   VITE_GEMINI_API_KEY=sua_chave_api_do_gemini
   ```

4. **Inicie o servidor de desenvolvimento**:

   ```bash
   npm run dev
   ```

   O sistema estará disponível em `http://localhost:5173` (ou a porta indicada no terminal).

## Estrutura de Código e Padrões

- **Componentes**: Utilize componentes funcionais com hooks.
- **Estilização**: Use classes do Tailwind CSS sempre que possível. Evite CSS inline.
- **Tipagem**: Sempre defina interfaces ou tipos para novas entidades no arquivo `types.ts`.
- **Commits**: Utilize mensagens descritivas para facilitar o histórico.

## Scripts Disponíveis

- `npm run dev`: Inicia o Vite em modo de desenvolvimento.
- `npm run build`: Gera a versão otimizada para produção.
- `npm run preview`: Visualiza o build de produção localmente.
