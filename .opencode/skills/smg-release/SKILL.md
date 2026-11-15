---
name: smg-release
description: Efetuar o merge final pós-validação de CI/CD e monitorar o deploy de produção.
autoinvoke: false
---

# SMG Release Skill

**Objetivo:** Efetuar o merge final pós-validação de CI/CD e verificar produção.

**Instruções de Execução:**
1. Verifique os status checks do PR (Vercel Preview, GitHub Actions).
2. Se houver falha, ABORTE e notifique o PO.
3. Se o CI/CD passou e há aprovação explícita do PO (Merge Auth), execute `gh pr merge --squash`.
4. Monitore os logs de deploy da Vercel para a branch principal.
