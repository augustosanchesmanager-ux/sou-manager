# DESIGN SYSTEM CANÔNICO — SOU MANA.GER BARBER
## Norma de Design, Tokens e Arquitetura Frontend (v2.0 — Dark-First Atelier Tech)

> **SMG Barber — SOU MANA.GER (SMG Platform)**<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** RATIFICADO E CANÔNICO<br />
> **Responsável Formal:** Augusto (PO)<br />
> **Governança:** Precedência `AGENTS.md` · SMG Change Control Protocol<br />
> **Invariantes:** `MERGE ≠ DEPLOY PROD` (ADR-026) · Purple Ban · Blue Ban · WCAG AA Contrast

---

## 1. Visão Criativa: "Atelier Tech Sofisticado"

O **SMG Barber** é a plataforma operacional de precisão para barbearias de alto padrão. Ele rejeita a estética de SaaS corporativo genérico (azul institucional, excesso de sombras e cards sem hierarquia) e adota a atmosfera de um **atelier clássico com precisão de instrumento cirúrgico**:

1. **Dark-First com Fundo Orgânico:** Ambiente operacional de bancadas escuras e iluminação cênica. A paleta base é ancorada em Obsidian (`#0B0B0C`), Grafite Quente (`#14110B`), Superfícies Texturizadas (`#171310` e `#1A1610`) e Bordas Milimétricas (`#2D2618`).
2. **Sinal Cirúrgico em Ouro/Bronze Fosco:** O ouro fosco (`#D99A2B` / `#B88A44`) é reservado para ênfase de marca, CTAs de alta conversão e estados de foco. Ele nunca é usado como fundo ornamental ou preenchimento decorativo.
3. **Densidade Operacional Controlada:** Telas complexas (Agenda com multi-barbeiros, Balcão PDV, Checkout e Fechamento de Caixa) equilibram grande volume de dados com respiração tipográfica e ausência de ruído redundante.
4. **Vocabulário Real de Barbearia:** O sistema reflete a operação física: *Agendamento, Encaixe, Cadeira Cativa, Comanda, Fechamento de Caixa, Rateio de Comissão e Club dos Chefes*.

---

## 2. Tokens de Design (Tailwind v4 — CSS-First)

Todos os tokens do design system estão declarados na diretiva `@theme` de `index.css`:

### 2.1 Cores Primárias e de Marca

| Token | Valor Hex | Descrição de Uso |
|---|---|---|
| `--color-primary` | `#D99A2B` | Cor mestra de prestígio, botões primários e tabs ativas |
| `--color-primary-dark` | `#A96F14` | Hover de botões dourados e gradientes de profundidade |
| `--color-primary-light` | `#F3D9A4` | Badges suaves, ícones de destaque e contraste em fundos escuros |
| `--color-gold` | `#D99A2B` | Alias canônico para a cor de marca |

> [!CAUTION]
> **REGRA DE NOMENCLATURA:** O token canônico é `primary`. É expressamente proibido o uso de classes inexistentes como `primary-gold`, `bg-primary-gold` ou `text-primary-gold`.

### 2.2 Superfícies e Profundidade (Dark-First)

| Token | Valor Hex | Descrição de Uso |
|---|---|---|
| `--color-night` | `#0B0B0C` | Fundo profundo de modais, banners e texto de alto contraste sobre botões dourados (`text-night`) |
| `--color-smg-ink` | `#14110B` | Background principal da aplicação em modo escuro |
| `--color-surface-dark` | `#171310` | Superfície secundária (sidebars, toolbars e agrupamentos) |
| `--color-card-dark` | `#1A1610` | Cards, timelines, células de tabela e contêineres de conteúdo |
| `--color-border-dark` | `#2D2618` | Bordas sutis de 1px que separam blocos sem poluição visual |

### 2.3 Superfícies e Modo Claro (Suporte Suave)

| Token | Valor Hex | Descrição de Uso |
|---|---|---|
| `--color-cream` | `#FAF6EE` | Fundo acolhedor para o tema claro |
| `--color-card` | `#FFFFFF` | Superfície de cards no modo claro |
| `--color-line` | `#E8DFC9` | Bordas e divisores sutis no modo claro |
| `--color-ink` | `#191611` | Texto principal em superfícies claras |
| `--color-ink-soft` | `#6B6252` | Texto secundário e legendas |

### 2.4 Status Semântico da Barbearia (Vocabulário da Agenda)

| Status | Token Base | Token Texto Forte (`-strong`) | Semântica Operacional |
|---|---|---|---|
| **Agendado** | `--color-sched-scheduled` (`#8A8378`) | `--color-sched-scheduled-strong` (`#6F675C`) | Horário reservado futuro |
| **Pendente** | `--color-sched-pending` (`#F59E0B`) | `--color-sched-pending-strong` (`#92400E`) | Aguardando confirmação do cliente |
| **Confirmado** | `--color-sched-confirmed` (`#B88A44`) | `--color-sched-confirmed-strong` (`#8A6119`) | Confirmado via WhatsApp ou balcão |
| **Em Andamento** | `--color-sched-in-progress` (`#14B8A6`) | `--color-sched-in-progress-strong` (`#0F766E`) | Cliente na cadeira sendo atendido |
| **Concluído** | `--color-sched-completed` (`#178A50`) | `--color-sched-completed-strong` (`#146C3E`) | Serviço finalizado, pronto p/ cobrança |
| **Cancelado** | `--color-sched-cancelled` (`#C92A2A`) | `--color-sched-cancelled-strong` (`#C92A2A`) | Desmarcado previamente |
| **Não Compareceu** | `--color-sched-no-show` (`#8A8378`) | `--color-sched-no-show-strong` (`#6F675C`) | Falta do cliente |

### 2.5 Chips de Identidade dos Barbeiros (Paleta Atelier)

Para identificar visualmente a coluna e fila de cada profissional sem colidir com os status da operação:
- **Barber 1:** `#C98A1F` (Bronze Quente)
- **Barber 2:** `#10B981` (Esmeralda)
- **Barber 3:** `#F59E0B` (Âmbar)
- **Barber 4:** `#EF4444` (Rubi Clássico)
- **Barber 5:** `#F97316` (Cobre Vibrante)
- **Barber 6:** `#14B8A6` (Turquesa Atelier)

---

## 3. Leis Rígidas de UI & Banimentos Globais

1. **O PURPLE BAN (Invariante Global):**
   - É terminantemente proibido o uso de tons de violeta, roxo, lilás ou índigo (`purple-*`, `violet-*`, `indigo-*`). Violações quebram o gate de arquitetura e CI.
2. **O BANIMENTO DE AZUL CORPORATIVO (No Corporate Blue):**
   - Azuis genéricos de SaaS (`#007BFF`, `#3B82F6`, `#0284C7`) são banidos. Ênfases são douradas (`primary`), cobres ou turquesas da paleta Atelier.
3. **REGRA DE CONTRASTE DE CTA (WCAG AA):**
   - Botões dourados (`bg-primary` ou `bg-gradient-to-r from-primary to-primary-dark`) **devem ter texto escuro** (`text-night font-bold`). Texto branco sobre dourado é expressamente proibido por violar a acessibilidade visual.

---

## 4. Tipografia & Escala Hierárquica

| Nível | Família | Tamanho / Peso | Aplicação |
|---|---|---|---|
| **Display** | Satoshi / Outfit | `text-2xl` a `text-3xl`, 800 (Extra Bold) | Cabeçalhos de dashboards, hero e títulos principais |
| **Headline** | Satoshi / Outfit | `text-lg` a `text-xl`, 700 (Bold) | Títulos de seções, cabeçalhos de modais e tabelas |
| **Interface / Body** | Plus Jakarta Sans | `text-sm`, 500 (Medium) / 600 (Semi-bold) | Textos de apoio, formulários, botões e labels |
| **Micro / Data** | Plus Jakarta Sans | `text-xs`, 600 / 700 com `tabular-nums` | Horários da agenda, valores monetários e badges |

---

## 5. Biblioteca Central de Componentes (`components/ui/`)

### 5.1 `Button` (`components/ui/Button.tsx`)
- **Variantes:**
  - `primary`: `bg-gradient-to-r from-primary to-primary-dark text-night font-bold` (Prestígio e CTA principal)
  - `secondary`: Superfície neutra dark-first com borda sutil
  - `outline`: Borda dourada com texto dourado e preenchimento suave no hover
  - `danger`: Ações destrutivas com vermelho de segurança
  - `success`: Ações afirmativas com esmeralda
  - `ghost`: Ações secundárias integradas
- **Acessibilidade:** Suporte completo a `disabled`, indicador de loading sem desalinhamento, anel de foco `focus-visible:ring-primary/40`.

### 5.2 `Modal` (`components/ui/Modal.tsx`)
- **Comportamento:** Portal React montado no `document.body` com trava de scroll (`modal-open`).
- **Acessibilidade:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`, fechamento por tecla Escape e clique no backdrop.
- **Visual:** Backdrop com blur suave (`backdrop-blur-sm`), card centralizado em `card-dark` com borda `border-dark` e sombra profunda.

### 5.3 `StatusBadge` (`components/ui/StatusBadge.tsx`)
- **Objetivo:** Componente padronizado para renderização universal de status operacionais do SMG Barber.
- **Acessibilidade:** Contraste estrito em modo claro e escuro, ponto visual opcional (`showDot`), labels padronizados em pt-BR e fallback resiliente para neutro.

### 5.4 `MetricCard` (`components/ui/MetricCard.tsx`)
- **Aplicação:** Apresentação de métricas operacionais e financeiras de alta densidade (Faturamento, Atendimentos, Ticket Médio).
- **Tons Canônicos:** `brass`, `positive`, `negative`, `info`, `warning`, `neutral`.
