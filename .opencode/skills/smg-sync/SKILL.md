---
name: smg-sync
description: Agrupar operações de versionamento (git add, commit, push e criação de PR) em lote único após evidências de sucesso.
autoinvoke: false
---

# SMG Sync Skill

**Objetivo:** Agrupar operações de versionamento em lote único.

**Instruções de Execução Sequencial:**
Esta skill só deve ser invocada se o `smg-builder` emitiu evidências de sucesso. Execute em cadeia sem pausas:
1. `git add .`
2. `git commit -m "tipo(escopo): descrição concisa"` (Gere a mensagem automaticamente baseada no diff).
3. `git push origin <branch>`
4. `gh pr create --title "..." --body "..."` (Gere o PR detalhando as mudanças e marcando o PO para review).

**Output:** Link do Pull Request criado.
