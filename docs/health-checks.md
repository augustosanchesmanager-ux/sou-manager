# Health Checks — SMG Barber

Sonda padronizada de disponibilidade do backend (Supabase), implementada na subfase **6.9** da Fase 6 (Production Readiness).

## Objetivo

Responder de forma barata e idempotente à pergunta: *o backend responde, e com qual latência?*

O resultado alimenta diagnóstico operacional e monitoramento. A sonda é **fail-open**: qualquer falha dela nunca interrompe fluxo de usuário, renderização ou operação de negócio.

## Contrato

```ts
import { checkHealth } from '@/lib/health/healthCheck';

const health = await checkHealth();
// { status: 'healthy' | 'degraded' | 'down', latencyMs: number, timestamp: string }
```

| Campo | Tipo | Descrição |
|---|---|---|
| `status` | `'healthy' \| 'degraded' \| 'down'` | Classificação da disponibilidade. |
| `latencyMs` | `number` | Latência medida em milissegundos, arredondada e nunca negativa. |
| `timestamp` | `string` | Momento da medição em ISO 8601 (`new Date().toISOString()`). |

O retorno contém **apenas** esses três campos. Mensagens de erro, códigos internos, stack traces, tokens e payloads do Supabase não são expostos.

## Classificação

| Condição | `status` | `latencyMs` |
|---|---|---|
| Resposta sem erro e latência ≤ `HEALTH_HEALTHY_MAX_MS` (1000 ms) | `healthy` | medido |
| Resposta sem erro e latência > 1000 ms | `degraded` | medido |
| Sem backend configurado (modo demo/local) | `degraded` | medido (sem chamada de rede) |
| Erro retornado pelo Supabase (inclusive RLS/permissão) | `down` | medido até a falha |
| Rejeição da chamada (rede, DNS, TLS) | `down` | medido até a falha |
| Sem resposta dentro de `HEALTH_TIMEOUT_MS` (3000 ms) | `down` | medido até o timeout |

Constantes exportadas: `HEALTH_TIMEOUT_MS`, `HEALTH_HEALTHY_MAX_MS`.

`degraded` em modo demo é intencional: sem backend configurado não há como provar conectividade, e reportar `healthy` seria falso-positivo.

## Como a sonda funciona

- Executa uma leitura **HEAD** mínima e idempotente: `tenants.select('id', { head: true })` via `getSharedClient()`.
- HEAD não devolve linhas nem dados de tenant; apenas prova que o PostgREST/Postgres responderam.
- A política RLS de `tenants` (anon: `active`/`trial`) continua valendo. Se a política filtrar tudo, a resposta ainda é HTTP 200 sem erro — conectividade comprovada, sem exposição de dados.
- Um `error` no payload do Supabase (que resolve a promise em vez de rejeitá-la) é tratado como falha.
- Timeout é aplicado com `Promise.race` e o timer é sempre limpo.
- O `resultado` é construído fora do caminho de exceção: erros viram `down`, nunca throw.

## Multi-tenant e segurança

- A sonda é **agnóstica de tenant**: não recebe `tenant_id`, não filtra por tenant e não retorna nenhum registro.
- Não usa `service_role`, chaves administrativas ou tokens.
- Não cria RPC, migration, tabela, schema ou Edge Function.
- Falhas são registradas via `logSupabaseError('health_probe', error)`, que aplica `redact.ts` (fail-open) — o mesmo padrão da subfase 6.2.
- Se o próprio logger falhar, a exceção é capturada e descartada; a sonda continua fail-open.

## Uso e opções

```ts
await checkHealth();

await checkHealth({
  timeoutMs: 1500,              // default: HEALTH_TIMEOUT_MS
  isDemo: false,                // default: !hasSupabaseEnv
  probe: () => fetch('/ping'),  // default: HEAD em `tenants`
  now: () => performance.now(), // injetável para teste
  onFailure: (error) => { /* substitui logSupabaseError */ },
});
```

As opções existem para teste e para diagnostico controlado; o uso normal é `checkHealth()` sem argumentos.

## Como interpretar

| Sintoma | Leitura provável |
|---|---|
| `healthy` consistente | Backend e rede OK. |
| `degraded` com latência alta | Backend respondendo, mas lento (pool, região, cold start). |
| `down` com `latencyMs` baixo | Rejeição imediata: DNS, TLS, URL/chave inválida, CORS. |
| `down` com `latencyMs` ≈ 3000 | Timeout: backend indisponível ou rede bloqueada. |
| `degraded` em localhost | Esperado: modo demo, sem backend configurado. |

## Não-objetivos

- Não é endpoint HTTP público (`/health`) — é módulo de biblioteca consumível pela aplicação.
- Não mede throughput, saturação de pool, filas, outbox ou jobs.
- Não substitui observabilidade de eventos (`mirrorQuantum`) nem o painel `/#/observability`.
- Não faz retry nem backoff: uma chamada por invocação.

## Testes

```bash
npx vitest run src/lib/health/healthCheck.test.ts
```

Cobrem: sucesso rápido, lentidão (`degraded`), erro no payload, rejeição, throw síncrono, timeout, modo demo sem chamada de rede, shape sanitizado do retorno, logger que lança, arredondamento de latência e timestamp ISO.
