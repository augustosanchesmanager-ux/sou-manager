# PHASE 6.0.6 — ENTRY AUDIT (Compliance & Legal)

> **Data:** 2026-08-07
> **Autorização:** Fase registrada por decisão do PO (2026-08-07) como **gate obrigatório de certificação** da Release v1.5, após a conclusão da 6.0.5.x.
> **Modo:** **EXCLUSIVAMENTE DOCUMENTAL** — **nenhum arquivo de código (`.ts`/`.tsx`/`.sql`) ou migration criado/alterado; nenhum teste executado; nenhum deploy; commit restrito a documentação.**
> **Baseline de referência:** 6.0.5.x (6.0.5.1–6.0.5.4 concluídas; 6.0.5.5 pendente; PCA 6.0.5.6 PLANNED) — release v1.5 em andamento.
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** decisão do PO (2026-08-07) + `ROADMAP.md` (seção 6.0.6) + `RELEASE_CHECKLIST_v1.5.md` + `BUSINESS_DECISIONS.md` (D-6.0.6) + diretriz LGPD (lei 13.709/2018).

---

## STATUS: ✅ REGISTRADA PELO PO (2026-08-07) — FASE DOCUMENTAL CONCLUÍDA (ENTRY AUDIT)

> **Decisão do PO (2026-08-07):** a fase **6.0.6 — Compliance & Legal** passa a integrar oficialmente o roadmap como **gate obrigatório de certificação** da Release v1.5. Esta etapa é **exclusivamente documental**: registra objetivos, escopo, critérios de entrada/saída, modelo de dados proposto (arquitetura) e o gate da release. **Nenhuma implementação é autorizada por este documento** — a implementação futura exigirá nova entrada (entry audit de implementação) após a conclusão da 6.0.5.x e da Release v1.5.
>
> Registro oficial: `docs/BUSINESS_DECISIONS.md` (D-6.0.6) · `ROADMAP.md` (seção 6.0.6) · `RELEASE_CHECKLIST_v1.5.md` (§ gate).

---

## Resumo executivo

A plataforma SMG SaaS precisará operar comercialmente com **documentação jurídica formalizada, versionada e auditável**. A fase 6.0.6 registra o conjunto de capacidades legais que o produto deve possuir antes de ser considerado **certificado para venda**:

- **Gestão de documentos legais** com versionamento rígido (versão, hash, data, obrigatoriedade, histórico — sem substituição de documentos antigos);
- **Aceite eletrônico** auditável (usuário, tenant, data/hora, IP, User-Agent, versão — histórico imutável);
- **Reaceite obrigatório** quando um documento obrigatório muda (nova versão → login → reaceite → acesso);
- **Centro Jurídico** administrativo (histórico de aceites, documentos vigentes, versões anteriores, download, auditoria, situação do tenant);
- **LGPD** (exportação de dados, retenção, exclusão, consentimentos, auditoria);
- **Modelo de dados proposto** (arquitetura): `legal_documents`, `document_versions`, `accepted_documents`.

**Fora do escopo desta etapa:** qualquer código, SQL, migration, tabela, RPC, API, componente React, página ou deploy. O modelo de dados abaixo é **proposta arquitetural** para guiar a implementação futura — **nenhuma migration será criada nesta fase documental**.

---

## 1. Objetivos da Fase

### 1.1 Gestão de documentos legais

Documentos versionados que a plataforma deverá possuir:

- Termos de Uso;
- Política de Privacidade;
- LGPD;
- Contrato SaaS;
- Consentimentos;
- Cookies (caso existam).

### 1.2 Versionamento

Todo documento deve possuir:

- **versão** (identificador semântico/temporal);
- **hash** (integridade do conteúdo);
- **data de publicação**;
- **obrigatório/opcional** (flag de aceite);
- **histórico** (nunca substituir documentos antigos — todas as versões permanecem).

### 1.3 Aceite eletrônico

Registrar, por aceite:

- **usuário**;
- **tenant**;
- **data**;
- **hora**;
- **IP**;
- **User-Agent**;
- **versão aceita**.

Nunca apagar histórico de aceites.

### 1.4 Reaceite obrigatório

Quando um documento **obrigatório** mudar:

```
nova versão
    ↓
login
    ↓
reaceite obrigatório
    ↓
acesso liberado
```

### 1.5 Centro Jurídico

Módulo administrativo contendo:

- histórico de aceites;
- documentos vigentes;
- versões anteriores;
- download;
- auditoria;
- situação do tenant (aceitou/aceitou versão antiga/não aceitou).

### 1.6 LGPD

Registrar como objetivos da fase:

- exportação de dados;
- retenção;
- exclusão;
- consentimentos;
- auditoria.

---

## 2. Modelo de Dados (proposta arquitetural)

> **Apenas arquitetura.** Nenhuma migration, tabela ou SQL é criado nesta fase documental. As entidades abaixo são a proposta para guiar a implementação futura.

```
legal_documents            -- catálogo de documentos jurídicos (slug, tipo, obrigatório)
document_versions          -- versões imutáveis (versão, hash, conteúdo, data de publicação, vigência)
accepted_documents         -- aceites (usuário, tenant, data/hora, IP, User-Agent, versão aceita)
```

- **`legal_documents`** — identidade do documento (ex.: `terms_of_use`, `privacy_policy`, `lgpd`, `saas_contract`, `consents`, `cookies`); flag obrigatório/opcional.
- **`document_versions`** — append-only: cada mudança gera uma **nova versão** (versão + hash + conteúdo + data de publicação); nunca edita/exclui versões anteriores.
- **`accepted_documents`** — append-only: um registro por aceite (usuário + tenant + data/hora + IP + User-Agent + versão aceita); histórico imutável.

Invariantes arquiteturais propostas:

1. **Imutabilidade:** nenhuma UPDATE/DELETE em `document_versions` e `accepted_documents` (append-only, padrão do projeto — cf. `event_store`/`processed_operations`).
2. **Hash de integridade:** o hash de cada versão é calculado no momento da publicação e verificado no reaceite.
3. **Reaceite derivado:** o aceite vigente de um usuário é a **última versão aceita** de cada documento obrigatório; a comparação com a versão vigente determina o reaceite pendente.
4. **Multi-tenant:** isolamento por `tenant_id` (RLS) com bypass de superadmin — alinhado à Fase 3.3 (Security Audit).
5. **Auditoria:** `accepted_documents` alimenta o Centro Jurídico e a auditoria de compliance (LGPD art. 37/38 — registro de consentimento).

> Decisões de negócio (redação dos documentos, fornecedores, política de cookies, controlador/operador) são **itens comerciais do PO** — fora da alçada automática do OpenCode.

---

## 3. Fluxo Oficial

O aceite jurídico integra oficialmente o fluxo de criação de tenant:

```
Cadastro
    ↓
Provisionamento
    ↓
Onboarding
    ↓
Aceite Jurídico
    ↓
Criação do Tenant
    ↓
Dashboard
```

---

## 4. Gate da Release v1.5

Registrar que a **Release v1.5 somente poderá ser considerada concluída** quando **todos** os itens abaixo estiverem atendidos:

- [ ] todos os documentos jurídicos existirem (Termos de Uso, Política de Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies);
- [ ] aceite eletrônico implementado;
- [ ] versionamento funcionando;
- [ ] auditoria de aceite funcionando;
- [ ] centro jurídico disponível;
- [ ] checklist de compliance aprovado.

---

## 5. Critérios de Entrada

A fase (implementação futura) só pode iniciar quando:

- [ ] arquitetura 6.0.5 concluída (6.0.5.1–6.0.5.6);
- [ ] PCA concluída (`PRODUCTION_COMPATIBILITY_AUDIT.md = READY`);
- [ ] schema final da release congelado;
- [ ] deploy da janela única aprovado e executado;
- [ ] release candidata pronta.

## 6. Critérios de Saída (desta etapa documental)

- [ ] documentação completa;
- [ ] auditoria aprovada;
- [ ] roadmap atualizado;
- [ ] checklist atualizado;
- [ ] fase pronta para implementação futura.

---

## 7. Restrições

**NÃO criar nesta fase:**

- migrations;
- tabelas;
- SQL;
- componentes React;
- páginas;
- RPCs;
- APIs;
- código.

Somente documentação.

---

## 8. Riscos

| Risco | Prob./Impacto | Mitigação |
|-------|---------------|-----------|
| R1 — Redação jurídica atrasar o fechamento da v1.5 (itens comerciais) | Média/Alta | Itens de redação/fornecedores são do PO; a fase registra a **arquitetura** e o gate, desacoplando-a do texto legal |
| R2 — Alterar ADRs/arquitetura 6.0.5 | Baixa/Alta | Fase documental isolada; nenhum ADR é alterado (apenas referências); restrições §7 |
| R3 — Entender o modelo de dados como autorização de migration | Média/Média | §2 explícito: **apenas arquitetura**; nova entry audit será exigida para implementar |
| R4 — Fluxo oficial conflitar com o onboarding (6.0.2) | Baixa/Média | Aceite Jurídico é etapa adicional no fluxo; alinhamento futuro com 6.0.2/6.0.1 na implementação |
| R5 — Escopo crescer para além de compliance legal (banner, dunning) | Média/Baixa | Escopo congelado §1; itens fora (ex.: banner de estado) permanecem na 6.0.5.5 |

---

## 9. Relatório final

A **6.0.6 — Compliance & Legal** foi **registrada oficialmente** no roadmap (decisão do PO 2026-08-07) como **gate obrigatório de certificação** da Release v1.5. Esta entry audit é o documento de planejamento: objetivos (gestão de documentos, versionamento, aceite eletrônico, reaceite, Centro Jurídico, LGPD), modelo de dados proposto (arquitetura), fluxo oficial e gate da release. **Nenhum código, migration, tabela, SQL, RPC, API ou componente React foi alterado.**

**Próximos passos:**
1. Aprovação desta entry audit pelo PO (registro D-6.0.6);
2. Integração do gate 6.0.6 no `RELEASE_CHECKLIST_v1.5.md` (feito);
3. Implementação futura exigirá nova entry audit, **após** a conclusão da 6.0.5.x e da Release v1.5.
