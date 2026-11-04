## Descrição
Resolve #222: elimina a exposição da chave Google Gemini no bundle público do frontend:
- Cria a Edge Function `gemini-assistant` protegida com autenticação GoTrue via Bearer JWT (`getUser`).
- Refatora `services/geminiService.ts` para invocar a Edge Function via Supabase Client (`functions.invoke`).
- Remove a definição estática de `process.env.GEMINI_API_KEY` e o chunk `vendor-gemini` de `vite.config.ts`.
- Adiciona suíte de testes unitários em `tests/security/f4_2_gemini_service.test.ts`.

## Validação
- `git grep -i "GEMINI_API_KEY" dist/` -> 0 correspondências (bundle limpo)
- `npx vitest run tests/security/f4_2_gemini_service.test.ts` -> 7/7 aprovados
- `npm run typecheck` -> exit 0
- `npm run test` -> 120 suítes passaram (2040 testes unitários)
- `npm run build` -> compilado com sucesso sem o chunk `vendor-gemini`

```yaml
authorization_record:
  ticket: "#222"
  authorized_by: "Augusto (PO)"
  date: "2026-11-03"
  target_env: "ci"
  merge_approved: false
  deploy_approved: false
```
