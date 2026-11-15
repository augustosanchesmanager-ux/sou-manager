---
name: smg-gate
description: Interromper o orquestrador para solicitar autorização manual do PO baseada na trilha de risco.
autoinvoke: false
---

# SMG Gate Skill

**Objetivo:** Interromper o orquestrador para solicitar autorização manual do PO baseada no risco.

**Lógica de Parada:**
- Se `risk_track == GREEN`: Não pare. Retorne autorização automática para `SYNC` e pare apenas no PR Review.
- Se `risk_track == YELLOW`: Pare APÓS o `BUILDER` e ANTES do `SYNC`. Solicite "Sync Auth".
- Se `risk_track == RED`: Pare ANTES do `BUILDER` (Plan Auth), ANTES do `SYNC` (Sync Auth) e ANTES do `MERGE` (Merge Auth).

**Ação:** Apresente os dados, peça a palavra-chave de autorização do PO e só libere o orquestrador mediante confirmação afirmativa.
