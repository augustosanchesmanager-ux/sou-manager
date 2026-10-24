# Runbook — Rotação de Segredos & Credenciais

> Referência: Subfase 6.8 (Documentação Operacional) — Fase 6: Production Readiness  
> Aplicação: SMG Barber  
> Última Atualização: 2026-10-24

---

## 1. Inventário de Segredos & Chaves

| Nome do Segredo | Onde é Armazenado | Escopo / Uso | Sensibilidade |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Vercel, GitHub Actions, `.env.local` | Endpoint público da instância Supabase. | Pública / Baixa |
| `VITE_SUPABASE_ANON_KEY` | Vercel, GitHub Actions, `.env.local` | Chave anônima para queries RLS e Auth do client. | Pública / Média |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions (Secrets), Backend/Admin | Chave com privilégios de bypass RLS para provisioning e E2E. | **Crítica / Confidencial** |
| `EDGE_JWT_SECRET` | Supabase Dashboard (Custom Secrets) | Segredo HMAC para assinatura do worker dispatcher D8. | **Crítica / Confidencial** |
| `VITE_GEMINI_API_KEY` | Vercel, `.env.local` | Chave de integração com Google Generative AI. | Média / Confidencial |
| `VERCEL_TOKEN` | GitHub Actions (Secrets) | Token de API para deploy e promoção automatizada. | **Crítica / Confidencial** |

---

## 2. Procedimento de Rotação: Supabase Keys (Anon & Service Role)

A rotação de chaves no Supabase é recomendada semestralmente ou em caso de suspeita de vazamento de credenciais.

### Passo a Passo:
1. Acesse o **Supabase Dashboard** > Projeto (`ushsnmlbeurfvlkieiln` em Produção ou `tjcvuhynckocmvtqykxp` em Staging).
2. Navegue até **Project Settings** > **API**.
3. Na seção **Project API Keys**, localize **JWT Secret** ou as chaves individuais.
4. **Regerar Chaves:**
   - Clique em **Generate new secret / Roll keys**.
   - *Atenção:* Chaves antigas continuarão funcionando temporariamente durante a janela de transição se configurado graceful rotation.
5. **Atualizar Repositório e CI/CD:**
   - Acesse GitHub > **Settings** > **Secrets and variables** > **Actions**.
   - Atualize os secrets no ambiente correspondente (`Production` ou `Staging`):
     - `VITE_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
6. **Atualizar Variáveis no Vercel:**
   - Acesse Vercel > **Settings** > **Environment Variables**.
   - Atualize `VITE_SUPABASE_ANON_KEY` para os ambientes `Production` e `Preview`.
   - Dispare um redeploy sem cache para que os novos valores sejam embutidos no build Vite.

---

## 3. Rotação do Secret do Edge Runtime (`EDGE_JWT_SECRET`)

O worker D8 utiliza autenticação HMAC para garantir que apenas o dispatcher agendado invoque as RPCs financeiras.

> ⚠️ **Regra da Plataforma Supabase:** Nunca crie segredos customizados com o prefixo `SUPABASE_` (o dashboard rejeitará a operação).

### Procedimento:
1. Gere um novo hash aleatório de alta entropia (ex: `openssl rand -hex 32`).
2. Acesse o **Supabase Dashboard** > **Edge Functions** > **Manage Secrets**.
3. Atualize o secret `EDGE_JWT_SECRET` com o novo valor gerado.
4. Caso o cron job do pg_cron envie o token em cabeçalho, atualize a procedure agendada no banco via SQL timestampado.
5. Verifique a saúde do dispatcher invocando a verificação de equivalência:
   ```bash
   npm run d8:verify
   ```

---

## 4. Rotação do Token do Vercel (`VERCEL_TOKEN`)

1. Acesse a conta de equipe do Vercel > **Account Settings** > **Tokens**.
2. Crie um novo token com permissões de deploy no escopo da organização SMG.
3. Atualize o secret `VERCEL_TOKEN` no repositório GitHub.
4. Revogue o token antigo no painel do Vercel após o teste com sucesso da pipeline.
