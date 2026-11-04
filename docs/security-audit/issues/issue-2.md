## Descrição do Problema
No arquivo `vite.config.ts` (linhas 18-20), a variável de ambiente `VITE_GEMINI_API_KEY` é embutida globalmente no objeto `process.env.GEMINI_API_KEY` e consumida diretamente pelo navegador em `services/geminiService.ts`:
```typescript
// vite.config.ts:18-20
'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '')
```

## Por que é explorável
O Vite substitui as referências a `process.env.GEMINI_API_KEY` pelo valor literal da string durante o build de produção. A chave fica disponível em texto plano no arquivo `dist/assets/index-*.js`. Qualquer usuário da aplicação pode extrair a credencial da aba Rede ou Console das Ferramentas de Desenvolvedor e utilizá-la em scripts próprios.

## Evidência
- `vite.config.ts:18-20`
- `services/geminiService.ts:3-10`
- Presença da chave em chamadas diretas client-side para `https://generativelanguage.googleapis.com`.

## Impacto
Esgotamento de cotas de IA, interrupção das funcionalidades de inteligência artificial para usuários legítimos e possíveis cobranças não autorizadas na conta de faturamento do Google Cloud.

## Sugestão de Correção
1. Criar uma Edge Function no Supabase (ex.: `supabase/functions/gemini-assistant`).
2. Configurar o secret `GEMINI_API_KEY` exclusivamente no ambiente do Supabase CLI / Edge Functions.
3. Fazer o frontend chamar a Edge Function enviando o Bearer Token JWT do usuário autenticado.
4. Remover a injeção da chave em `vite.config.ts`.

## Critérios de Aceite
- [ ] Nenhuma chamada direta do navegador para a API do Google Gemini
- [ ] Chave `VITE_GEMINI_API_KEY` ausente do arquivo de bundle compilado (`dist/`)
- [ ] Edge Function valida o JWT do chamador antes de repassar a consulta ao modelo de IA
