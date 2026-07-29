# Release Process — SMG Sou.Manager

> Processo formal de entrega de novas versões. Referência obrigatória para toda release.

---

## Fluxo Padrão

```
Nova Feature / Fix
        ↓
Testes Unitários (vitest)
        ↓
Build (npm run build)
        ↓
Migration Validation (se aplicável)
        ↓
Schema Audit (se aplicável)
        ↓
Homologação
        ↓
Smoke Tests (E2E)
        ↓
Deploy Produção (Vercel)
        ↓
Monitoramento (24-48h)
        ↓
Rollback (se necessário)
        ↓
Release Notes
```

---

## Etapas Detalhadas

### 1. Nova Feature / Fix

- Código implementado seguindo padrões existentes
- Testes unitários escritos (AAA, naming conventions)
- Nenhum erro de tipo (`npm run build` limpo)
- Nenhum teste falhando (`npm run test` verde)

### 2. Testes Unitários

```bash
npm run test
```

- Todos os testes passando
- Cobertura mantida ou aumentada
- Novos cenários documentados

### 3. Build

```bash
npm run build
```

- Build limpo sem erros
- Warnings revisados
- Bundle size verificado

### 4. Migration Validation (se aplicável)

Se a release inclui mudanças de banco:

```bash
# Banco limpo
supabase db reset

# Validar schema
# Rodar testes
# Verificar MANIFEST.md
```

- Todas as migrations executadas sem erro
- Schema consistente com o código
- MANIFEST.md atualizado

### 5. Schema Audit (se aplicável)

Se a release inclui mudanças de schema:

- Tabelas criadas/alteradas conferidas
- Índices verificados
- RLS policies validadas
- Funções RPC testadas
- Triggers funcionando

### 6. Homologação

- Deploy em ambiente de staging
- Dados de teste representativos
- Fluxos principais validados
- Performance verificada

### 7. Smoke Tests (E2E)

```bash
npm run test:e2e:smoke
```

- Todos os testes @smoke passando
- Fluxos críticos validados
- Tempo de execução < 3 min

### 8. Deploy Produção

```bash
# Vercel deploy automático via push para main
git push origin main
```

- Deploy automático via Vercel
- URL de preview disponível
- Rollback disponível em < 5 min

### 9. Monitoramento

- Dashboard de observabilidade verificado
- Logs de erro monitorados
- Performance pós-deploy verificada
- Alertas ativos verificados
- Duração: 24-48h

### 10. Rollback (se necessário)

Se problemas forem detectados:

1. Identificar causa raiz
2. Decidir: fix forward ou rollback
3. Se rollback: reverter via Vercel
4. Comunicar à equipe
5. Documentar incidente

### 11. Release Notes

- Features implementadas
- Bugs corrigidos
- Breaking changes (se houver)
- Migrações necessárias
- Impacto nos usuários

---

## Tipos de Release

### Patch (v1.0.x)

- Bug fixes
- Correções de segurança
- Hotfixes

**Fluxo:** Testes → Build → Deploy → Monitoramento

### Minor (v1.x.0)

- Novas features
- Melhorias de UX
- Otimizações de performance

**Fluxo:** Completo (todas as etapas)

### Major (vx.0.0)

- Breaking changes
- Novas arquiteturas
- Migrações complexas

**Fluxo:** Completo + Comunicação antecipada + Janela de manutenção

---

## Checklist de Release

| # | Item | Responsável | Status |
|---|------|-------------|--------|
| 1 | Código implementado | Dev | ⬜ |
| 2 | Testes passando | Dev | ⬜ |
| 3 | Build limpo | Dev | ⬜ |
| 4 | Migration validada (se aplicável) | Dev | ⬜ |
| 5 | Schema auditado (se aplicável) | Dev | ⬜ |
| 6 | Homologação aprovada | QA | ⬜ |
| 7 | Smoke tests passando | QA | ⬜ |
| 8 | Deploy produzido | Dev | ⬜ |
| 9 | Monitoramento OK | Ops | ⬜ |
| 10 | Release notes publicada | Dev | ⬜ |

---

## Referências

- `ROADMAP.md` — Roadmap do projeto
- `supabase/migrations/MANIFEST.md` — Inventário de migrations
- `PROJECT_STATUS.md` — Status visual do projeto
- `tests/README.md` — Convenções de teste
- `AGENTS.md` — Instruções para sessões de código

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-07-23 | 1.0 | Criação do documento |
