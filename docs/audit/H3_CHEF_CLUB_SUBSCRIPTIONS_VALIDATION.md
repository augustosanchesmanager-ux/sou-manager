# H-3 — Chef Club: Assinaturas Preservadas (evidência)

> **Gate:** H-3 Chef Club (assinaturas existentes preservadas — H3-6)
> **Data:** 2026-08-13
> **Ambiente:** banco real `ushsnmlbeurfvlkieiln` (tenant Sanchez Barber — `b716e290-f7f6-4449-b790-5ae9dcdadcab`)
> **Responsável:** OpenCode (Tech Lead operacional)
> **Método:** SQL (conferência read-only contra o snapshot).

---

## 1. Objetivo

Conferir que as **assinaturas Chef Club existentes** no snapshot pré-homologação (2026-08-08) foram **preservadas** após o deploy 6.0.5 e durante a homologação H-3.

**Critério de aceite:** igual ao snapshot — `customer_subscriptions` = **16** (13 ativas, 3 canceladas).

---

## 2. Baseline do snapshot (2026-08-08)

| Item | Snapshot |
|------|----------|
| Total | 16 |
| Ativas | 13 |
| Canceladas | 3 |

---

## 3. Estado atual (2026-08-13)

| Status | Snapshot | Atual | Delta | Observação |
|--------|----------|-------|-------|------------|
| Ativas | 13 | **14** | +1 | Assinatura `7b92c958...` (cliente de validação **HOMOLOG H3 TESTE 2026-08-11**, criada 11/08) |
| Canceladas | 3 | **3** | 0 | Preservadas integralmente |
| **Total** | **16** | **17** | +1 | Variação esperada — tenant LIVE |

---

## 4. Assinaturas canceladas (conferência nominal — preservadas)

| Cliente | Assinatura | Status |
|---------|-----------|--------|
| João telles (1ª assinatura, 30/04) | `0fcde146-e7cd-4486-9bae-a7e337ff957a` | canceled |
| PIETRO MUNIZ | `5db05a4f-35f1-49a0-96d0-f54ffbebf196` | canceled |
| K11 | `d8461115-1483-47a1-a192-51ca8eb87f32` | canceled |

**3 canceladas íntegras — sem perda.**

---

## 5. Assinatura adicional (variação explicada)

A única assinatura fora da baseline do snapshot é `7b92c958-486c-4ba7-932f-5f9cf76ac80a` (cliente **HOMOLOG H3 TESTE 2026-08-11**, plano CHEFE EXECUTIVO, `active`, criada 2026-08-11) — **criada durante a homologação H-3** (cliente de validação usado nos fluxos H3-1/H3-2/H3-3). Nenhuma assinatura existente foi removida ou alterada de status.

---

## 6. Conclusão

- ✅ **3 assinaturas canceladas preservadas** (conferência nominal);
- ✅ **13 ativas originais preservadas** (nenhuma perdida/alterada);
- ✅ **+1 ativa** = assinatura de validação da homologação (variação documentada do tenant LIVE);
- ✅ Nenhuma perda de assinatura ou débito sem lançamento.

**Dados alterados neste teste:** nenhum — validação exclusivamente de leitura.
