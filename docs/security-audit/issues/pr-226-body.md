## Descrição
Resolve #226: refatora os fluxos de impressão eliminando o método legado `document.write` em favor de manipulação nativa e segura do DOM:
- Em `pages/CashClosingPage.tsx`, substitui `printWindow.document.write` pela criação de container com `textContent = previewText`, garantindo que o texto seja tratado estritamente como nós de texto e prevenindo qualquer parsing ou injeção de HTML.
- Em `pages/Comandas.tsx`, refatora a montagem da comanda para criação direta de elementos via `createElement`, `textContent` e `appendChild`.
- Adiciona suíte de testes de integridade em `tests/security/f5_3_no_document_write.test.ts`.

## Validação
- `git grep -n "document\.write" src/ components/ pages/` -> 0 ocorrências em todo o código da aplicação
- `npx vitest run tests/security/f5_3_no_document_write.test.ts` -> 2/2 aprovados
- `npm run typecheck` -> exit 0
- `npm run test` -> 120 suítes passaram (2036 testes unitários)
- `npm run build` -> compilado com sucesso em 12.38s

```yaml
authorization_record:
  ticket: "#226"
  authorized_by: "Augusto (PO)"
  date: "2026-11-03"
  target_env: "ci"
  merge_approved: false
  deploy_approved: false
```
