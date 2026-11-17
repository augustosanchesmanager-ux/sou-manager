---
name: smg-sync
description: Agrupar operações de versionamento (git add, commit, push e criação de PR) em lote único após evidências de sucesso.
autoinvoke: false
---

# SMG Sync Skill

**Objetivo:** Agrupar operações de versionamento em lote único.

**Instruções de Execução Sequencial:**
Esta skill só deve ser invocada se o `smg-builder` emitiu evidências de sucesso. Execute em cadeia sem pausas:
1. `git add <arquivos-do-escopo>` (Adicione apenas os arquivos pertencentes à frente atual, garantindo diff isolado).
2. `git commit -m "tipo(escopo): descrição concisa"` (Gere a mensagem automaticamente baseada no diff).
3. `git push origin <branch>`
4. `gh pr create --title "..." --body "..." --label "risk:{{risk_track}}"` (Gere o PR detalhando as mudanças, marcando o PO para review e substituindo `{{risk_track}}` em minúsculas — `risk:green`, `risk:yellow` ou `risk:red` — conforme o `risk_track` emitido pelo `smg-discovery`).

**Output:** Link do Pull Request criado.
