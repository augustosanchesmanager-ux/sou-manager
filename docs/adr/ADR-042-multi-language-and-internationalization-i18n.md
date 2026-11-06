# ADR-042 — Arquitetura de Internacionalização e Multi-Idioma (i18n & L10n) da SMG Platform

> **Status:** `DEFERRED` (Congelado por decisão estratégica do PO Augusto em 2026-11-06 — postergado até segunda ordem / versão futura)  
> **Data:** 2026-11-06  
> **Decisores:** Augusto (PO) · Antigravity (Platform Architect)  
> **Fase do Roadmap:** Fase 8 (Commercial Scalability) — Subfase 8.7 (Multi Idioma — CONGELADA)  
> **Contexto Técnico:** SMG Platform (SMG Barber) · React 19 Context · TypeScript 5.8 · Intl API nativa · Zero dependências externas pesadas  

---

> **Deliberação do PO Augusto (2026-11-06):** "Podemos deixar essa fase congelada até segunda ordem ou para a próxima versão."  
> Foco estratégico concentrado no fortalecimento e expansão comercial do **SMG Barber** no mercado nacional brasileiro (pt-BR), preservando o roadmap contra dispersão de escopo internacional neste momento.

---

## 1. Contexto

Com a consolidação da maturidade do SMG Barber (Fase 7) e a abertura comercial da Fase 8 (Public API, Webhooks, Marketplace, Integrações Core e Platform Billing), a **Subfase 8.7 (Multi Idioma)** introduz o suporte nativo a múltiplos idiomas e internacionalização (i18n) na interface do usuário.

A barbearia moderna brasileira e estabelecimentos no exterior (América Latina, EUA e Europa) demandam uma experiência fluida no idioma nativo do gestor e dos barbeiros, sem comprometer a estabilidade do sistema, o isolamento multi-tenant ou o padrão de código existente.

---

## 2. Problema

1. **Restrição Arquitetural do Repositório (AGENTS.md):**
   - A SMG Platform veda Redux, Zustand ou gerenciadores de estado externos pesados; o estado é gerido exclusivamente via React Context (`AuthContext` $\rightarrow$ `TenantProvider` $\rightarrow$ `AppProvider` $\rightarrow$ `ThemeProvider`).
   - Adicionar bibliotecas externas volumosas como `i18next` ou `react-intl` aumentaria o bundle e introduziria complexidade desnecessária para um SPA com rotas sob demanda.
2. **Resiliência a Chaves Faltantes (Fallback Determinístico):**
   - Caso uma tradução secundária (`en-US` ou `es-ES`) não possua determinada chave, o sistema não pode falhar nem renderizar texto vazio; deve recorrer de forma transparente ao texto canônico em `pt-BR`.
3. **Formatação Localizada de Valores e Datas:**
   - Moedas, horários e datas devem seguir as convenções culturais do locale selecionado (ex: `R$ 50,00` no Brasil vs `$50.00` nos EUA vs `50,00 € / $50.00` em países hispânicos) sem alterar os valores base em centavos armazenados no banco de dados PostgreSQL.
4. **Persistência de Preferência do Usuário:**
   - A escolha de idioma deve persistir entre sessões e recargas de página via `localStorage`, com detecção automática do idioma do navegador na primeira visita.

---

## 3. Decisão Arquitetural

Fica estabelecida a arquitetura de **Internacionalização e Multi-Idioma (i18n)** baseada em 4 pilares:

### 3.1 Provedor Nativo de Contexto React (`src/context/I18nContext.tsx`)
- Implementado em React Context puro (`I18nProvider` e hook `useI18n()`);
- Zero dependências de terceiros;
- Provê a função de tradução tipada `t(key, params?)` com suporte a interpolação dinâmica (ex: `t('dashboard.welcome', { name: 'Carlos' })`);
- Provê helpers de formatação: `formatCurrency(cents)`, `formatDate(date, options?)` e `formatNumber(value)`.

### 3.2 Catálogo Oficial de Idiomas Suportados
- **`pt-BR` (Português do Brasil):** Idioma oficial canônico e fonte da verdade;
- **`en-US` (English - US):** Inglês internacional;
- **`es-ES` (Español):** Espanhol para expansão na América Latina e Península Ibérica.

### 3.3 Estrutura Modular de Dicionários de Tradução (`src/locales/`)
Organização em arquivos JSON/TypeScript estáticos tipados por namespaces:
- `common`: Ações universais (Salvar, Cancelar, Confirmar, Voltar, Entrar, Sair, Carregando);
- `navigation`: Menus, rotas e títulos de navegação (Agenda, Comandas, Caixa, Clientes, Clube, etc.);
- `dashboard`: Indicadores de cockpit, métricas de faturamento e resumos operacionais;
- `schedule`: Termos de bancada, cadeiras, status de agendamento e duração;
- `billing`: Planos, faturas corporativas, assinaturas e Clube dos Chefes;
- `errors`: Mensagens de validação e alertas funcionais.

### 3.4 Componente de Alternância Visual (`components/LanguageSelector.tsx`)
- Componente minimalista no padrão *Atelier Tech Sofisticado*;
- Posicionado no header de navegação e nas configurações do usuário;
- Exibe o idioma ativo com indicador discreto e menu suspenso acessível via teclado.

---

## 4. Garantias e Invariantes

1. **Paridade de Chaves Garantida por Testes:**
   - Suíte de testes unitários automatizada (`tests/unit/i18n-service.test.ts`) verifica que 100% das chaves presentes em `pt-BR` existem de forma idêntica em `en-US` e `es-ES`.
2. **Preservação de Regras Contábeis e Banco de Dados:**
   - A camada i18n atua **exclusivamente na apresentação do frontend**.
   - Identificadores no código, colunas de banco de dados, nomes de RPCs e logs operacionais permanecem estritamente em inglês.
   - Documentação técnica e de negócio permanece em português brasileiro (pt-BR), conforme regra do `AGENTS.md`.
3. **Imutabilidade de Valores Monetários:**
   - O banco continua armazenando valores exclusivamente como inteiros em centavos (`amount_cents`, `price_cents`), sem qualquer formatação salva em disco.

---

## 5. Consequências & Trade-offs

### Positivas:
- **Preparação Global:** Interface pronta para internacionalização e expansão comercial sem retrabalho estrutural;
- **Zero Overhead:** Sem bibliotecas pesadas de terceiros; performance máxima de renderização;
- **Alta Resiliência:** Fallback determinístico para `pt-BR` impede qualquer crash ou texto nulo por omissão de tradução;
- **Acessibilidade:** Suporte a formatação culturalmente adaptada para números e datas via `Intl` API.

### Mitigações:
- **Novas Telas:** Ao criar novos módulos nas fases subsequentes, novas strings devem ser registradas nos três dicionários para manter a paridade validada pelos testes unitários.

---

## 6. Próximos Passos (Aguardando Aprovação do PO)

1. Aprovação formal do ADR-042 pelo PO Augusto (`PROPOSED` $\rightarrow$ `ACCEPTED`);
2. Criação dos dicionários canônicos em `src/locales/` (`pt-BR.ts`, `en-US.ts`, `es-ES.ts`);
3. Implementação do `src/context/I18nContext.tsx` e hook `useI18n`;
4. Implementação do componente `components/LanguageSelector.tsx`;
5. Integração do `I18nProvider` na esteira de providers do `App.tsx`;
6. Criação da suíte de testes unitários `tests/unit/i18n-service.test.ts`;
7. Execução da validação master `npm run smg:verify` e atualização da governança.
