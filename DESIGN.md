---
name: SOU MANA.GER Barber
description: Sistema operacional premium para barbearias de alto padrão. Arquitetura Atelier Tech Sofisticado com densidade operacional cirúrgica, estética dark-first e tokens 100% integrados ao Tailwind v4.
colors:
  primary: "#D99A2B"
  primary-dark: "#A96F14"
  primary-light: "#F3D9A4"
  gold: "#D99A2B"
  night: "#0B0B0C"
  smg-ink: "#14110B"
  smg-deep: "#231A06"
  surface-dark: "#171310"
  card-dark: "#1A1610"
  border-dark: "#2D2618"
  cream: "#FAF6EE"
  card: "#FFFFFF"
  ink: "#191611"
  ink-soft: "#6B6252"
  line: "#E8DFC9"
  gold-soft: "#F7E7C2"
  gold-pale: "#FCF6E7"
  success: "#178A50"
  danger: "#C92A2A"
  warning: "#F59E0B"
  barber-1: "#C98A1F"
  barber-2: "#10B981"
  barber-3: "#F59E0B"
  barber-4: "#EF4444"
  barber-5: "#F97316"
  barber-6: "#14B8A6"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.16em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  panel: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "linear-gradient(to right, #D99A2B, #A96F14)"
    textColor: "{colors.night}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.card-dark}"
    textColor: "#FFFFFF"
    borderColor: "{colors.border-dark}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input-default:
    backgroundColor: "{colors.card-dark}"
    textColor: "#FFFFFF"
    borderColor: "{colors.border-dark}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card-boutique:
    backgroundColor: "{colors.card-dark}"
    borderColor: "{colors.border-dark}"
    rounded: "{rounded.xl}"
    padding: "20px"
---

# Design System: SOU MANA.GER Barber

> **Norma de Design & Frontend (v2.0 — Dark-First Atelier Tech)**
> Este documento é a **Fonte Única da Verdade Visual e Interativa** para o produto SMG Barber.
> Todo componente, tela, grid e token deve seguir estritamente as especificações abaixo.

---

## 1. Creative North Star: "Atelier Tech Sofisticado"

O SOU MANA.GER Barber não é um ERP administrativo comum, nem um template genérico de SaaS. Ele é o **sistema operacional de precisão para barbearias de alto padrão**, combinando a atmosfera imersiva de um atelier clássico com o rigor e a densidade de produtos digitais de referência global como **Linear** e **Stripe**.

### Princípios Fundamentais:
1. **Dark-First por Natureza:** O ambiente de trabalho da barbearia moderna (iluminação cênica, espelhos, bancadas escuras) demanda um sistema nativamente escuro. A base é construída em obsidian profundo (`#0B0B0C`), grafite quente (`#14110B`) e superfícies texturizadas (`#1A1610`), acolhendo a visão do profissional sem cansaço durante jornadas longas.
2. **Sinal Cirúrgico em Ouro/Bronze Fosco:** O ouro fosco (`#D99A2B` / `#B88A44`) é o vetor exclusivo de voz da marca, navegação ativa e ações de alta prioridade. Ele **nunca** é utilizado como decoração vazia, fundos inteiros de cards ou ruído visual.
3. **Densidade Controlada & Sem Ruído:** Telas operacionais de alta complexidade (Agenda, Fila de Cadeiras, Comandas e Caixa) contêm múltiplos fluxos simultâneos. A clareza visual é obtida por meio de hierarquia rígida, microtipografia precisa, espaçamentos matemáticos e ausência de redundâncias. Nenhuma informação deve aparecer duplicada na mesma visão.
4. **Respeito aos Dados Reais & Vocabulário de Barbearia:** Não usamos termos genéricos ("pedidos", "itens", "produtos diversos"). Usamos o linguajar vivo da operação: *Agendamentos, Comandas, Encaixe, Fila de Cadeira, Fechamento de Caixa, Rateio de Comissão e Assinaturas/Club*.

---

## 2. Token de Cores & CSS-First Architecture (Tailwind v4)

Todas as cores do sistema são declaradas no `@theme` de [index.css](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/index.css).

> [!CAUTION]
> **REGRA CRÍTICA DE NOMENCLATURA:** O token oficial é `primary` (com variantes `primary-dark` e `primary-light`). **O uso de `primary-gold`, `bg-primary-gold` ou qualquer variação não mapeada é terminantemente proibido.**

### 2.1 Paleta Primária (Brand & Navigation)
- **Primary / Gold** (`#D99A2B` / `var(--color-primary)`): Cor principal da marca, botões de ação primária, estados selecionados, tabs ativas e anéis de foco.
- **Primary Dark** (`#A96F14` / `var(--color-primary-dark)`): Hover de botões primários, gradientes e bordas de ênfase no modo escuro.
- **Primary Light** (`#F3D9A4` / `var(--color-primary-light)`): Textos de destaque sobre fundos escuros, ícones ativos e badges de status dourado suave.
- **Gold** (`#D99A2B` / `var(--color-gold)`): Alias de marca alinhado ao core.

### 2.2 Superfícies Dark-First (Canvas & Cards)
- **Night / Obsidian** (`#0B0B0C` / `var(--color-night)`): Base mais profunda da aplicação, contraste para modais, headers de agenda e texto legível sobre botões dourados (`text-night`).
- **SMG Ink** (`#14110B` / `var(--color-smg-ink)`): Background primário do modo escuro.
- **SMG Deep** (`#231A06` / `var(--color-smg-deep)`): Charcoal quente com subtom dourado para containers de apoio.
- **Surface Dark** (`#171310` / `var(--color-surface-dark)`): Superfície secundária (painéis laterais, toolbars e agrupamentos).
- **Card Dark** (`#1A1610` / `var(--color-card-dark)`): Cards, tabelas, containers de timeline e modais.
- **Border Dark** (`#2D2618` / `var(--color-border-dark)`): Bordas milimétricas (1px) que estruturam os blocos sem criar peso visual.

### 2.3 Superfícies Light-Mode (Suporte Secundário)
- **Cream** (`#FAF6EE` / `var(--color-cream)`): Fundo acolhedor para ambientes claros.
- **Card Light** (`#FFFFFF` / `var(--color-card)`): Cards e superfícies no modo claro.
- **Line** (`#E8DFC9` / `var(--color-line)`): Linhas e divisores no modo claro.
- **Ink** (`#191611` / `var(--color-ink)`): Texto principal em superfícies claras.
- **Ink Soft** (`#6B6252` / `var(--color-ink-soft)`): Texto secundário e legendas.

### 2.4 Status Semântico (Restrito a Dados e Gráficos)
- **Success Green** (`#178A50` / `var(--color-success)`): Indicadores positivos, comanda paga, faturamento, horário confirmado.
- **Danger Red** (`#C92A2A` / `var(--color-danger)`): Atrasos graves, cancelamento, faturamento negativo, erros operacionais.
- **Warning Amber** (`#F59E0B` / `var(--color-warning)`): Atenção, encaixes pendentes de confirmação, clientes aguardando na recepção.

### 2.5 Chips de Identidade dos Barbeiros (Paleta Atelier)
Para diferenciar colunas e agendamentos de cada profissional sem recorrer a cores conflitantes:
- **Barber 1:** `#C98A1F` (Bronze Quente)
- **Barber 2:** `#10B981` (Esmeralda)
- **Barber 3:** `#F59E0B` (Âmbar)
- **Barber 4:** `#EF4444` (Rubi Clássico)
- **Barber 5:** `#F97316` (Cobre Vibrante)
- **Barber 6:** `#14B8A6` (Turquesa Atelier)

---

## 3. Leis Rígidas de Cor & Banimentos

> [!WARNING]
> **1. O PURPLE BAN ESTRITO (Invariante Global):**
> Nenhuma tela, componente, gradiente ou indicador pode conter tons de violeta, roxo, lilás ou índigo (`#8B5CF6`, `#7C3AED`, `#6366F1`, etc.). Violações impedem a aprovação de PRs.
>
> **2. O BANIMENTO DE AZUL CORPORATIVO (No Corporate Blue):**
> Azuis genéricos de templates SaaS (`#007BFF`, `#3B82F6`, `#0284C7`, `#EAF7FF`) são completamente banidos do produto. Toda ênfase é dourada, bronze ou âmbar.
>
> **3. REGRA DO CONTRASTE DE CTA:**
> Botões dourados (`bg-primary` ou `bg-gradient-to-r from-primary to-primary-dark`) **devem ter texto escuro** (`text-night font-bold`). É proibido texto branco sobre botões dourados, pois viola a acessibilidade (WCAG AA).
>
> **4. REGRA DA BORDA ANTES DA SOMBRA:**
> No modo escuro, a profundidade é dada por contraste de superfície (`bg-card-dark`) e contorno de 1px (`border-border-dark`). Sombras são sutis e reservadas para modais flutuantes ou estados de hover interativos (`hover:border-primary/40`).

---

## 4. Tipografia & Microtipografia Cirúrgica

O sistema utiliza duas famílias tipográficas importadas via Google Fonts:
- **Display & Headings:** `Outfit, sans-serif` (`--font-display`).
- **Body & Interface:** `Plus Jakarta Sans, sans-serif` (`--font-sans`).

### 4.1 Escala Tipográfica

| Função | Família | Tamanho / Leading | Tracking | Peso | Classes Tailwind |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title** | Outfit | `1.875rem` (30px) / `1.15` | `-0.02em` | 800 | `font-display text-2xl md:text-3xl font-extrabold tracking-tight` |
| **Section Header**| Outfit | `1.5rem` (24px) / `1.2` | `-0.02em` | 700 | `font-display text-xl md:text-2xl font-bold tracking-tight` |
| **Card / Modal Title**| Outfit | `1.125rem` (18px) / `1.25` | `-0.02em` | 700 | `font-display text-base md:text-lg font-bold tracking-tight` |
| **Body (Padrão)** | Plus Jakarta Sans | `0.875rem` (14px) / `1.5` | `normal` | 500 | `font-sans text-sm font-medium text-ink-soft` |
| **Body Bold** | Plus Jakarta Sans | `0.875rem` (14px) / `1.5` | `normal` | 600/700 | `font-sans text-sm font-semibold text-white` |
| **Micro Caption** | Plus Jakarta Sans | `0.75rem` (12px) / `1.4` | `0.02em` | 500 | `font-sans text-xs text-ink-soft` |
| **Overline Label** | Plus Jakarta Sans | `0.6875rem` (11px) / `1.2` | `0.16em` | 700 | `font-sans text-[11px] font-bold uppercase tracking-wider` |

### 4.2 Mandato dos Números Tabulares & Proteção contra Quebra
Todo valor monetário (`R$ 150,00`), horário (`14:30 - 15:15`), percentual (`85%`) e contador numérico (`4 atendimentos`) deve obrigatoriamente aplicar:
- `tabular-nums` — Garante alinhamento numérico vertical sem saltos.
- `whitespace-nowrap` — Impede que valores quebrem entre linhas (ex: "R$" em uma linha e "150,00" na outra).

---

## 5. Arquitetura de Layout & Grids de Alta Densidade

Para telas de alta demanda operacional (ex: [pages/Schedule.tsx](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/Schedule.tsx)), adota-se o padrão estrito de **Hero em 3 Níveis**.

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: Título & Contexto  |  Navegador de Data Unificado  |  Ações CTAs │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: Toolbar Operacional:                                           │
│ [ Fila Cadeiras | Calendário | Lista ] [ Dia | Semana ]  ───  [ Utils ]│
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: Grid 4-KPI Atelier (Atendimentos | Pendentes | Comandas | Meta) │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 O Padrão Hero em 3 Níveis (The 3-Tier Hero Pattern)
1. **Tier 1 — Identidade, Data Única & CTAs:**
   - **Título da Tela:** Ex: "Agenda do Atelier" com ícone de marca.
   - **Navegador de Data Unificado:** Controles `Hoje`, `< Data Formatada >` e trigger de calendário. A data só aparece **uma única vez** (proibido ter datepicker e chips repetindo o mesmo dia da semana).
   - **Ações Primárias:** Agrupamento de botões de conversão imediata (`+ Encaixe Rápido` em estilo secundário, `+ Novo Agendamento` em estilo primário dourado).
2. **Tier 2 — Toolbar de Modos de Visão e Ferramentas:**
   - **Seletor de Visão Principal:** Segmented Control (`Fila de Cadeiras`, `Calendário / Grade`, `Lista de Atendimentos`).
   - **Seletor de Granularidade:** Alternância contextual (`Dia`, `Semana`).
   - **Ações Utilitárias:** Ações secundárias agrupadas à direita (`Exportar CSV`, `Bloqueios`, `Fechar Agenda`, `Operações`).
3. **Tier 3 — Painel Resumo 4-KPI:**
   - Exatamente 4 cards sintetizando o dia/período:
     1. *Total de Atendimentos*
     2. *Agendamentos Pendentes / Aguardando*
     3. *Comandas Abertas / Em Atendimento*
     4. *Faturamento Previsto (R$)*
   - Tipografia de valor: `font-display text-2xl font-bold tabular-nums whitespace-nowrap`.

### 5.2 Lei do Filtro de Fonte Única (Single-Source Filter Law)
- Em nenhuma tela do sistema é permitido duplicar filtros ou seletores de status.
- Se a barra superior já possui filtro de barbeiro ou data, a grade ou lista inferior **não pode** exibir uma segunda barra repetindo os mesmos filtros.

### 5.3 Regras Rígidas para a Grade Horária (Timeline & Grid Rules)
- **Travamento de Janela Operacional:** A grade horária opera estritamente entre `SCHEDULE_START_HOUR` (07:00) e `SCHEDULE_END_HOUR` (22:00).
- **Proibição de Deslocamento Negativo:** A função de cálculo percentual de topo deve ser protegida contra valores menores que o horário inicial:
  ```ts
  const safeStart = Math.max(SCHEDULE_START_HOUR, startDecimal);
  const topPercent = ((safeStart - SCHEDULE_START_HOUR) / TOTAL_HOURS) * 100;
  ```
- **Altura Mínima de Agendamento:** Qualquer agendamento (mesmo de 10 ou 15 minutos, ou com horários truncados) deve ter altura renderizada mínima de `4%` (`min-h-[28px]`), impedindo que o card colapse visualmente para uma linha invisível.
- **Isolamento de Coluna:** Cada coluna de profissional na visão diária e semanal deve possuir `overflow-hidden` relativo, garantindo que nenhum card de agendamento transborde para fora da sua raia ou cubra o cabeçalho.

---

## 6. Especificação dos Componentes Primitivos

### 6.1 Botões (Buttons)

```tsx
// 1. Botão Primário (Gold CTA)
<button className="h-10 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-primary to-primary-dark text-night shadow-sm hover:brightness-105 active:scale-[0.98] transition-all flex items-center gap-2">
  <CalendarPlus className="w-4 h-4" />
  Novo Agendamento
</button>

// 2. Botão Secundário / Outline
<button className="h-10 px-3.5 rounded-xl font-semibold text-sm bg-card-dark text-ink-soft border border-border-dark hover:border-primary/40 hover:text-white transition-all flex items-center gap-2">
  <Zap className="w-4 h-4 text-primary" />
  Encaixe Rápido
</button>

// 3. Botão Utilitário / Ghost
<button className="h-9 px-3 rounded-lg text-xs font-medium text-ink-soft hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5">
  <Download className="w-3.5 h-3.5" />
  Exportar
</button>
```

### 6.2 Segmented Control (Seletor de Abas / Visão)

```tsx
<div className="inline-flex items-center gap-1 p-1 bg-night/80 border border-border-dark/60 rounded-xl">
  <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/20 text-primary-light border border-primary/30 shadow-xs flex items-center gap-1.5">
    <Calendar className="w-3.5 h-3.5" />
    Calendário
  </button>
  <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-soft hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5">
    <List className="w-3.5 h-3.5" />
    Lista
  </button>
</div>
```

### 6.3 MetricCard (Signature KPI Component)
Implementado centralizadamente em `components/ui/MetricCard.tsx` (ADR-031):
- **Superfície:** `bg-card-dark border border-border-dark rounded-2xl p-4 transition-all hover:border-primary/40`.
- **Cabeçalho:** Título em `text-xs uppercase tracking-wider font-bold text-ink-soft` com ícone em container sutil (`p-2 rounded-xl bg-white/5 text-primary-light`).
- **Valor:** `font-display text-2xl font-bold text-white tabular-nums tracking-tight whitespace-nowrap`.
- **Metadado/Subtítulo:** `text-xs text-ink-soft flex items-center gap-1 mt-1`.

### 6.4 Inputs & Seletores de Formulário
- Altura padrão: `h-10` (40px).
- Superfície: `bg-card-dark border border-border-dark text-white text-sm rounded-xl px-3 placeholder-ink-soft`.
- Estado de Foco: `focus:outline-hidden focus:border-primary focus:ring-1 focus:ring-primary/30`.
- Ícones em inputs: sempre alinhados centralizados na cor `text-ink-soft`.

---

## 7. Matriz de Do's e Don'ts

| Prática Recomendada (DO) | Violação Proibida (DON'T) |
| :--- | :--- |
| **Usar `primary`, `primary-dark`, `primary-light`** | Usar classes inexistentes como `bg-primary-gold` |
| **Usar texto escuro `text-night` em botões dourados** | Usar texto branco sobre botões ou badges dourados |
| **Garantir Dark-First nativo com fundos `#0B0B0C` e `#14110B`** | Reintroduzir fundo azul marinho ou cinza ardósia corporativo |
| **Aplicar `tabular-nums` e `whitespace-nowrap` em valores** | Deixar moedas quebrarem linha ou números desalinhados |
| **Seguir a arquitetura Hero em 3 Níveis** | Misturar seletores de data, filtros e CTAs desordenados |
| **Garantir que a data apareça em um único lugar na tela** | Duplicar o dia da semana ou a data em vários cards |
| **Limitar a timeline entre 07:00 e 22:00 com proteção de topo** | Gerar topo negativo (`top: -46%`) e cobrir cabeçalhos |
| **Garantir altura mínima de 4% para agendamentos** | Deixar agendamentos curtos renderizarem com altura 0px |
| **Usar a paleta Barber 1-6 para raias de profissionais** | Usar azul royal, roxo ou cores fora da identidade |
| **Usar `MetricCard.tsx` para exibição de KPIs** | Criar cards de métrica customizados sem padrão de token |

---

## 8. Verificação de Integridade e Conformidade

Antes de qualquer entrega ou encerramento de tarefa envolvendo interface:
1. `npm run typecheck` deve retornar 0 erros.
2. `npm run architecture:ci` deve passar sem aumento de violações na baseline.
3. Não deve existir nenhum uso de `primary-gold` no código novo.
4. `git diff --check` não deve acusar espaços vazios ou quebras de linha errôneas.
