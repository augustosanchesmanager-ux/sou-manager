# Test Conventions — SMG Barber

> Padrões e convenções para toda a suíte de testes. Qualquer contribuição deve seguir estas regras.

---

## Regras

- **Um comportamento por teste.**
- **Não reutilizar asserts entre testes.**
- **Preferir builders** em vez de objetos literais.
- **Mockar apenas dependências externas.**
- **Nunca mockar funções puras do Domain.**
- **Testes devem validar comportamento, não implementação.**

---

## Estrutura

```
tests/
├── README.md                          ← Este arquivo
├── builders/                          ← Builder pattern para entidades de domínio
│   ├── checkout.builder.ts            ← FinishRequest, CheckoutCartItem, CheckoutParticipant
│   ├── comanda.builder.ts             ← Comanda, ComandaItem
│   ├── participant.builder.ts         ← ServiceExecutionParticipant
│   ├── transaction.builder.ts         ← Transaction
│   ├── receivable.builder.ts          ← CustomerSubscriptionReceivable
│   └── appointment.builder.ts         ← Appointment
├── factories/                         ← Mock factories centralizadas
│   ├── mockDatabaseClient.ts          ← Chain builder para queries Supabase
│   ├── mockRepositories.ts            ← Mock repositories e clientes
│   └── serviceFactory.ts             ← Factory para criar services com deps mockadas
└── helpers/                           ← Utilitários de asserção
    ├── expectRollback.ts             ← Asserções de rollback
    ├── expectRepositoryCall.ts       ← Asserções de chamadas a repository
    └── expectNoSideEffects.ts        ← Asserções de ausência de side effects
```

Testes de application/domain ficam **co-localizados** com o código testado:

```
application/**/*.test.ts     ← Service tests (cenários, mocks)
domain/**/*.test.ts          ← Unit tests (funções puras, sem mocks)
components/**/*.test.ts      ← Pure utility tests
```

---

## Convenções de Nome

### Formato

```
should_<resultado>_when_<condição>()
```

### Exemplos

```typescript
// ✅ Bom
it('should_return_empty_array_when_cart_is_empty', () => { ... });
it('should_throw_CheckoutError_when_comanda_is_not_open', () => { ... });
it('should_skip_settlement_when_payment_is_pending', () => { ... });
it('should_call_rollback_when_insert_fails', () => { ... });

// ❌ Ruim
it('test empty cart', () => { ... });
it('works', () => { ... });
it('should handle error case 1', () => { ... });
```

### Regras

- **snake_case** em todos os nomes de teste
- **should_** como prefixo obrigatório
- **Um cenário por teste** — nunca agrupar asserts de cenários diferentes
- **Sem negação no nome quando possível** — preferir `should_skip_X` a `should_not_X`

---

## Arrange / Act / Assert (AAA)

Todo teste segue estritamente AAA:

```typescript
it('should_set_status_to_paid_when_settlement_succeeds', async () => {
  // Arrange
  const req = makePaidRequest(50);
  mockSettleCheckoutComanda.mockResolvedValue({ success: true });

  // Act
  const result = await service.finish(req, 'idem-key-1');

  // Assert
  expect(result.comandaId).toBe('comanda-1');
  expect(result.paymentStatus).toBe('paid');
});
```

### Regras

- **Arrange**: criar dados com builders, configurar mocks
- **Act**: chamar **uma única** função/fluxo
- **Assert**: verificar resultado(s)
- Comentários `// Arrange`, `// Act`, `// Assert` são **obrigatórios** para cenários > 5 linhas
- **Nunca** fazer assert dentro do Arrange

---

## Builders

Usar builders do `tests/builders/` em vez de criar objetos inline:

```typescript
import { makeFinishRequest, makeCartItem, makePaidRequest } from '../../../tests/builders/checkout.builder';
import { makeComanda, makeOpenComanda } from '../../../tests/builders/comanda.builder';
import { makePrimaryParticipant } from '../../../tests/builders/participant.builder';
```

### Regras

- **Sempre importar** de `tests/builders/` quando disponível
- **Partial<T> + spread** para overrides
- **Defaults realistas** — valores que refletem uso real
- **Resetar seq** em `beforeEach` quando usar IDs sequenciais

---

## Mocks

### Princípio

> **Mockar apenas o necessário. Nunca mockar funções puras.**

### O que mockar

| Tipo | Mockar? | Exemplo |
|------|---------|---------|
| Repository (Supabase) | ✅ Sim | `comandaRepository.update()` |
| RPC / External service | ✅ Sim | `settleCheckoutComanda()` |
| Supabase client direto | ✅ Sim | `supabase.from().insert()` |
| Domain functions puras | ❌ Não | `calculateParticipantPayout()` |
| Utility functions puras | ❌ Não | `formatCurrency()` |
| `vi.mock()` | ✅ Para módulos importados no topo |

### Como mockar

```typescript
// 1. Mockar módulos NO TOPO do arquivo (antes de imports)
vi.mock('../../domain/comanda/repository', () => ({
  comandaRepository: {
    list: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
  },
}));

// 2. Importar depois dos mocks
import { comandaRepository } from '../../domain/comanda/repository';
import { checkoutApplicationService } from '../checkout';

// 3. Configurar cenários nos testes
beforeEach(() => {
  vi.clearAllMocks();
});
```

### Regras

- **Nunca** usar `vi.spyOn` em módulos já mockados com `vi.mock`
- **Sempre** limpar mocks em `beforeEach` (nunca em `afterEach`)
- **Um mock por cenário** — não reutilizar configuração de mock entre testes
- **Retornos explícitos** — sempre definir `mockResolvedValue` / `mockReturnValue`

---

## DatabaseClient Mock Factory

Usar `createMockDatabaseClient()` do `tests/factories/mockDatabaseClient.ts` para mocks de queries Supabase:

```typescript
import { createMockDatabaseClient, makeDefaultItemsSequence } from '../../../tests/factories/mockDatabaseClient';

const mockDb = createMockDatabaseClient();

// Configurar comanda chain para cenário específico
mockDb._nextComandaChain({
  insertResult: { data: { id: 'comanda-1' }, error: null },
});

// Configurar items sequence para happy path
mockDb._setItemsSequence(makeDefaultItemsSequence());
```

### Chain builders disponíveis

| Builder | Uso |
|---------|-----|
| `createSimpleChain(result)` | Queries genéricas (select, delete, etc.) |
| `createComandaChain(opts, fromCallIndex)` | Comandas com suporte a insert/verify/lookup |
| `createItemsCallSequence(results)` | Sequência de 4 calls para syncItemsWithCompensation |
| `makeDefaultItemsSequence()` | Sequência padrão para happy paths |

---

## Helpers de Asserção

Usar helpers do `tests/helpers/` para assertions complexas:

```typescript
import { expectRollbackAttempted, expectNoRollback } from '../../../tests/helpers/expectRollback';
import { expectTableCalled, expectRpcCalled } from '../../../tests/helpers/expectRepositoryCall';
import { expectNoSideEffects } from '../../../tests/helpers/expectNoSideEffects';
```

---

## Estrutura de Arquivo

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────
vi.mock('../path/to/dependency', () => ({ ... }));

// ─── Imports (depois dos mocks) ───────────────────────
import { serviceUnderTest } from '../path/to/service';
import { makeFinishRequest } from '../../tests/builders/checkout.builder';

// ─── Tests ────────────────────────────────────────────
describe('ServiceName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should_return_x_when_y', () => { ... });
    it('should_throw_when_z', () => { ... });
  });
});
```

---

## KPIs de Qualidade

| Indicador | Meta |
|-----------|------|
| Domain regressions | **0** |
| Service regressions | **0** |
| Bugs financeiros em produção | **0** |
| Bugs encontrados pelos testes antes do merge | **crescente** |
| Testes novos por PR | **mínimo 1 cenário novo** |

### Métricas por camada

| Camada | Meta cobertura | Estratégia |
|--------|---------------|------------|
| Domain | 100% | Unit tests, funções puras |
| Application Services | 90–95% | Scenario tests com mocks |
| Repositories | 85–90% | Contract tests (mock DB) |
| UI | Apenas fluxos críticos | E2E (Playwright) |

### Inventário de Testes (412 total)

| Camada | Arquivo | Testes | Status |
|--------|---------|--------|--------|
| Domain | `domain/commission/calculate.test.ts` | 27 | ✅ |
| Domain | `domain/commission/participants.test.ts` | 23 | ✅ |
| Domain | `domain/commission/format.test.ts` | 12 | ✅ |
| Domain | `domain/chefClub/credits.test.ts` | 30 | ✅ |
| Domain | `domain/chefClub/cycle.test.ts` | 19 | ✅ |
| Domain | `domain/chefClub/validation.test.ts` | 24 | ✅ |
| Domain | `application/cashClosing/summary.test.ts` | 8 | ✅ |
| Domain | `components/financial/cashCloseUtils.test.ts` | 25 | ✅ |
| Application | `application/checkout/finish.test.ts` | 45 | ✅ |
| Application | `application/cashClosing/cashClosing.test.ts` | 38 | ✅ |
| Application | `application/appointment/appointment.test.ts` | 51 | ✅ |
| Application | `application/commission.test.ts` | 30 | ✅ |
| Application | `application/chefClub/chefClub.test.ts` | 54 | ✅ |
| E2E | `e2e/smoke/core.spec.ts` | 10 | ✅ |
| E2E | `e2e/flows/flow1-*.spec.ts` | 2 | ✅ |
| E2E | `e2e/flows/flow2-*.spec.ts` | 2 | ✅ |
| E2E | `e2e/flows/flow3-*.spec.ts` | 2 | ✅ |
| E2E | `e2e/flows/flow4-*.spec.ts` | 2 | ✅ |
| E2E | `e2e/flows/flow5-*.spec.ts` | 2 | ✅ |
| E2E | `e2e/regression/admin-crud.spec.ts` | 6 | ✅ |

---

## Anti-Padrões (Proibidos)

1. **Testes que dependem de ordem** — cada teste deve ser independente
2. **Mocks globais** — mocks devem ser por arquivo, não compartilhados
3. **`any` em asserts** — sempre tipar o retorno esperado
4. **Testes > 50 linhas** — dividir em cenários menores
5. **`expect.assertions(N)`** — usar em vez de contagem manual
6. **Acessar DOM em testes de service** — services não devem ter DOM
7. **Testar implementation details** — testar comportamento, não internals
8. **Comentários óbvios** — comentar *por quê*, não *o quê*
9. **Objetos literais grandes** — usar builders em vez de `{ ... }` extensos
