---
name: smg-change-control
description: Orquestrar a máquina de estados do protocolo SMG de forma dinâmica e baseada em risco.
autoinvoke: false
---

# SMG Change Control Skill

**Objetivo:** Orquestrar a máquina de estados do protocolo SMG de forma dinâmica e baseada em risco.

**Workflow de Orquestração:**
1. Inicie chamando `smg-discovery`. Armazene a variável `risk_track`.
2. Invoque `smg-gate(Plan Auth)` se for RED.
3. Invoque `smg-builder`.
4. Invoque `smg-gate(Sync Auth)` se for YELLOW ou RED.
5. Invoque `smg-sync`.
6. OBRIGATÓRIO: Pare a execução. A responsabilidade agora é do Vercel CI e do code review do PO no PR.
7. Após aprovação externa do PR, o PO invocará explicitamente o `smg-release`.

**Regra de Ouro:**
Você não pode pular etapas. Confie no `smg-gate` para decidir se a execução para ou avança automaticamente.
