import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

// Mock de uma chamada para a IA (substitua pelo SDK da OpenAI/Gemini/Anthropic que preferir)
async function callAI(prompt: string, context: string) {
  // Aqui entraria a chamada real para a API do modelo de linguagem.
  // O modelo deve ser instruído a retornar apenas Markdown formatado.
  return `
### 📋 Classificação
- **Tipo:** Correção de Bug / Regra de Negócio
- **Risco Inicial:** Médio (Envolve consistência de banco de dados no Supabase)

### 🔍 Arquivos Potencialmente Afetados
Baseado na busca, os seguintes arquivos devem ser o alvo da implementação:
- \`src/features/agenda/hooks/useUpdateAppointment.ts\`
- \`src/features/comandas/services/syncComanda.ts\`

### ⚠️ Riscos e Efeitos Colaterais
- Alterar o horário do agendamento pode causar dessincronização se a comanda já estiver com status "Paga".
- **Isolamento de Tenant:** Garantir que o RLS do Supabase não seja violado na query de update.

### ✅ Critérios de Aceitação
1. Alterar o horário do agendamento deve refletir imediatamente na comanda vinculada.
2. A operação não deve criar itens duplicados na comanda.
3. Testes E2E aplicáveis devem passar sem regressão.

### 🛑 Próximo Passo
Aguardando autorização (LGTM) para iniciar a modificação dos arquivos citados.
  `;
}

async function main() {
  const issueTitle = process.env.ISSUE_TITLE || '';
  const issueBody = process.env.ISSUE_BODY || '';

  // 1. Dica tática: Fazer um "grep" ou "glob" rápido baseado em palavras-chave da issue
  // para injetar apenas o nome dos arquivos relevantes no prompt da IA, economizando tokens.
  const allFiles = globSync('src/**/*.{ts,tsx}').join('\n');

  const systemPrompt = `
    Você é o Agente de Contexto do SMG. Sua função é analisar a demanda e gerar um Plano de Execução.
    Você não escreve código. Você apenas aponta onde a alteração deve ocorrer, avalia riscos (focando em isolamento de tenants e Supabase) e gera critérios de aceitação.
    
    Arquivos disponíveis no projeto:
    ${allFiles}
  `;

  const userPrompt = `Título da Issue: ${issueTitle}\nDescrição: ${issueBody}`;

  // 2. Chama a IA
  const plan = await callAI(systemPrompt, userPrompt);

  // 3. Imprime o resultado (o GitHub Actions vai capturar isso via `> plan.md`)
  console.log(plan.trim());
}

main().catch(console.error);