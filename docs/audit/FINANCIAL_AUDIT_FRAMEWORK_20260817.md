# Framework de Auditoria Financeira — SMG Barber

> Data: 2026-08-17 | Atualizado: 2026-08-18
> Status: ATIVO
> Decisão do PO: 2026-08-17 / 2026-08-18

## Visão Geral

Duas trilhas paralelas:

1. **Auditoria Financeira** (AUD-001–004) — read-only, mapeamento da fonte de verdade
2. **Hardening Financeiro** (DEV-001, FIX-001–002, SAN-001–002) — definição + correção + saneamento

```text
              ┌── AUD-001 ──→ SAN-001 ──→ SAN-002
              │   Comandas      Classificar   Saneamento
              │
Fonte de      ├── AUD-002 ──→ DEV-001 ──→ FIX-001
verdade  ─────┤   Comissões      Regra        Correção
financeira    │                  oficial      comissão
              ├── AUD-003 ──→ FIX-002
              │   Cancelamento   Leak fix
              │
              └── AUD-004
                  Pagamentos
```

## Trilha 1: Auditoria (READ-ONLY)

| ID | Nome | Prioridade | Status | Achado Principal |
|----|------|------------|--------|------------------|
| AUD-001 | Comandas históricas abertas | 🔴 P0 | ✅ Concluída | 444 comandas stale, R$23.130 travados |
| AUD-002 | Cálculo de comissões | 🔴 **P0** | ✅ Concluída | Comissão sobre valor bruto, sem splits no settlement |
| AUD-003 | Agendamento × Comanda | 🔴 P0 | ✅ Concluída | 20 comandas open em agendamentos cancelled (leak) |
| AUD-004 | Cadeia de pagamentos | 🔴 P0 | ✅ Concluída | subtotal=0 sempre, desconto embutido no total |

## Trilha 2: Hardening Financeiro

| ID | Nome | Prioridade | Bloqueado Por | Status |
|----|------|------------|---------------|--------|
| DEV-001 | Regra financeira oficial | 🔴 **P0** | AUD-001–004 (concluídas) | ⏳ Próximo |
| FIX-002 | Cancelamento leak | 🔴 P0 | AUD-003 (concluída) | ⏳ Pode iniciar |
| FIX-001 | Corrigir comissão | 🟠 P1 | DEV-001 | ⏸️ Bloqueado |
| SAN-001 | Classificar 444 comandas | 🟠 P1 | AUD-001 (concluída) | ⏳ Pode iniciar |
| SAN-002 | Saneamento histórico | 🟡 P2 | SAN-001 + PO approval | ⏸️ Bloqueado |

## Trilha 3: Bugs Operacionais

| ID | Nome | Prioridade | Status |
|----|------|------------|--------|
| H7 | Fechamento global | 🟢 | ✅ Concluído |
| BUG-02A | Status barbeiro DB→UI | 🟠 P1 | ✅ Merge concluído, deploy pendente |
| BUG-02B | Elegibilidade operacional | 🟠 P1 | ⏸️ Aguardando definição |

## Trilha 4: Treinamento (Fase 7)

| ID | Nome | Prioridade | Status |
|----|------|------------|--------|
| Fase 7 | Sistema de Treinamento | 🟡 | ⏳ Documentação em paralelo |

**Regra:** Tudo que depende de DEV-001 fica marcado como "em validação" no treinamento.

## Regras

1. **AUD-001–004 são read-only** — zero alterações
2. **DEV-001 é prerequisito** para FIX-001 (comissão)
3. **Nada é corrigido antes de DEV-001** — primeiro evidência, depois contrato, depois teste
4. **SAN-001 classifica antes de SAN-002** — nunca mass-update sem classificação
5. **Branch por trabalho** — cada fix/feature nasce de `main` atualizado
6. **Treinamento documenta como "em validação"** o que ainda está sendo investigado

## Fluxo Completo

```text
AUD-001 + AUD-002 + AUD-003 + AUD-004 (concluídas)
        ↓
DEV-001 — Regra financeira oficial (P0)
        ↓
    ┌───┴───┐
    ↓       ↓
FIX-001  FIX-002
Comissão  Cancelamento
    ↓
Auditoria pós-correção
        ↓
SAN-001 — Classificar 444 comandas
        ↓
SAN-002 — Saneamento histórico (PO approval)
        ↓
TREINAMENTO — versão definitiva
```

## Cadeia de Valor Oficial (AUD-004 Resultado)

```text
services.price (tabela)
    ↓ copiado como unit_price
comanda_items.unit_price × quantity
    ↓ somado
comanda.total ← vem do FRONTEND (req.total)
    ↓
comanda.discount ← existe mas quase sempre = 0
    ↓
comanda.subtotal ← SEMPRE 0.00 (campo fantasma)
    ↓
transaction.amount ← finance_settle_comanda RPC
    ↓
commission base = unit_price (resolveCommissionBase) ← BRUTO
```

## BUG-02A — Encerrado

| Campo | Valor |
|-------|-------|
| Branch | `fix/bug-02a-barber-closing-status` |
| Commit | `2e58ad9` |
| Status | ✅ Merge para main |
| Deploy | ⏸️ Pendente |

## BUG-02B — Aberto

| Campo | Valor |
|-------|-------|
| Status | 🟡 Aguardando definição de "participação operacional" |
| Decisão | PO precisa definir quem participa do fechamento |

## H7 — Concluído

| Campo | Valor |
|-------|-------|
| Status | ✅ Remediação implantada e validada |
| Commit | `ad1d7b0` |
