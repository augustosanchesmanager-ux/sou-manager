import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

// Tipagens do Contrato de Validação
type CheckStatus = 'PASS' | 'BLOCKED' | 'PENDING';

interface CheckResult {
  name: string;
  status: CheckStatus;
  required: boolean;
  error_log?: string;
}

interface ValidationReport {
  task_id: string;
  timestamp: string;
  decision: CheckStatus;
  next_action: string;
  checks: CheckResult[];
}

// Configuração dos comandos baseados no seu ecossistema
const VALIDATION_TASKS = [
  { name: 'biome', command: 'npx', args: ['@biomejs/biome', 'check', '.'] },
  { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { name: 'unit-tests', command: 'npm', args: ['run', 'test', '--', '--run'] }, // --run para evitar watch mode no Vitest
  { name: 'e2e-smoke', command: 'npm', args: ['run', 'test:e2e:smoke'] },
];

/**
 * Executa um comando no terminal e retorna o exit code e o log
 */
const runCommand = (command: string, args: string[]): Promise<{ code: number; log: string }> => {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { shell: true, stdio: 'pipe' });
    let log = '';

    proc.stdout.on('data', (data) => { log += data.toString(); });
    proc.stderr.on('data', (data) => { log += data.toString(); });

    proc.on('close', (code) => {
      resolve({ code: code ?? 1, log: log.trim() });
    });
  });
};

async function main() {
  console.log('🚀 Iniciando Runner de Validação SMG...\n');
  
  const checks: CheckResult[] = [];
  let isBlocked = false;

  for (const task of VALIDATION_TASKS) {
    console.log(`⏳ Executando: ${task.name}...`);
    
    try {
      const { code, log } = await runCommand(task.command, task.args);
      
      const passed = code === 0;
      if (!passed) isBlocked = true;

      checks.push({
        name: task.name,
        status: passed ? 'PASS' : 'BLOCKED',
        required: true,
        // Guarda as últimas 5 linhas do erro para o Agente ler, não o log inteiro
        error_log: passed ? undefined : log.split('\n').slice(-5).join('\n'),
      });

      console.log(`   Resultado: ${passed ? '✅ PASS' : '❌ BLOCKED'}`);
    } catch (error) {
      isBlocked = true;
      checks.push({
        name: task.name,
        status: 'BLOCKED',
        required: true,
        error_log: String(error),
      });
      console.log(`   Resultado: ❌ ERRO DE EXECUÇÃO`);
    }
  }

  // Consolida o relatório
  const decision: CheckStatus = isBlocked ? 'BLOCKED' : 'PASS';
  const report: ValidationReport = {
    task_id: process.env.TASK_ID || 'SMG-LOCAL-RUN',
    timestamp: new Date().toISOString(),
    decision,
    checks,
    next_action: isBlocked 
      ? 'Fix errors and re-run validation.' 
      : 'All checks passed. Ready for independent review or PR preparation.',
  };

  // Escreve o JSON no disco (este arquivo será lido pelo Orquestrador/Agente)
  const reportPath = 'validation-report.json';
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n📄 Relatório gerado em: ${reportPath}`);
  console.log(`⚖️  Decisão Final: ${decision}`);

  // Retorna exit 1 se falhou (bloqueia CI ou avisa o orquestrador Node que houve erro)
  process.exit(isBlocked ? 1 : 0);
}

main().catch((error) => {
  console.error('Erro fatal no Runner:', error);
  process.exit(1);
});