---
name: smg-builder
description: Executar o código em isolamento, rodar testes locais, validar build/tipos e emitir evidências.
autoinvoke: false
---

# SMG Builder Skill

**Objetivo:** Executar o código em isolamento, rodar testes locais e validar.

**Instruções de Execução:**
1. Isole a branch atual.
2. Implemente o código respeitando a arquitetura do SMG (React 19, Vite, TypeScript).
3. Rode validações locais de build (`npm run build` ou checagem de tipos do TypeScript).

**Evidence Discipline (OBRIGATÓRIO):**
Nenhuma alteração pode prosseguir sem a emissão deste relatório exato em Markdown:
- **EVIDENCE:** [Logs de sucesso do Vite/TS, diffs de código]
- **INTERPRETATION:** [O que a evidência prova sobre a implementação]
- **GAP:** [O que ainda não foi testado e precisa de E2E/Preview]
- **DECISION:** [Autorização solicitada para avançar ao smg-sync]
