# Oportunidades de Marketing

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. Visão Geral

O mapeamento de oportunidades de marketing identifica ativos de copy, design e posicionamento que podem ser reutilizados na landing institucional e nas páginas de aquisição do SMG Barber, respeitando o roadmap congelado.

---

## 2. Ativos de Marketing por Repositório

### 2.1 `SMG_LADINGPAGE` — Principal Fonte de Marketing

#### 2.1.1 🟢 COPIAR — Ativos Comprovadamente Fortes

**A. PainPoints (`PainPoints.tsx`)**
- 5 dores validadas: "Não sabe exatamente quanto lucra ao final do mês", "Perde dinheiro sem perceber com falhas na operação", "Depende de processos manuais e planilhas desconexas"
- Headline de reificação: "Seu negócio está organizado… ou só funcionando?"
- **Ação:** Reutilizar integralmente. É o vocabulário do cliente-alvo.

**B. Differentiators (`Differentiators.tsx`)**
- Tabela comparativa 4 eixos vs "Sistemas comuns"
- Eixo mais forte: "Aderência: é genérico → é adaptado à operação real do seu segmento"
- **Ação:** Manter 100% da estrutura, ancorar cada linha em prova.

**C. Design Tokens (`index.css:4-55`)**
- 6 tokens `@theme` + 6 classes utilitárias (`glass-card`, `tech-card`, `text-gradient`, `glow-blue`, `stars-bg`, `curved-lines`)
- Paleta consistente `#00D2FF`/`#0181C6` sobre `#02060F`
- **Ação:** Extrair como brand kit reutilizável.

#### 2.1.2 🟡 ADAPTAR — Ativos com Valor Condicionado

**D. Features (`Features.tsx`)**
- 16 features genéricas, mas "Controle de comissões" e "Gestão de recorrência" são o coração do SMG Barber
- **Ação:** Reordenar para priorizar comissões e fechamento de caixa.

**E. Tese de Origem (`Testimonial.tsx:28-30`)**
- "A SMG não foi criada por desenvolvedores que nunca pisaram em uma empresa. Ela nasceu dentro da operação da Sanchez Barber"
- **Ação:** Reclassificar de "Testimonial" → "Nossa Origem", adicionar clientes reais.

**F. Ecosystem (`Ecosystem.tsx`)**
- Layout de 3 cards (Barber, Auto Control, Pop Lounge)
- **Ação:** Corrigir nomenclatura ("Pop Lounge" → nome canônico ou remoção), remover produtos inexistentes.

**G. Catálogo de Produtos (git `1e52bc3`)**
- "Smart Booking", "Split de Pagamento", "Marketing Direto", "Gestão de Estoque"
- **Ação:** Recuperar do histórico como material de venda.

**H. System Prompt do Chatbot (git `1e52bc3`)**
- Voz da marca: "premium, elegante, tecnológico, prestativo"
- **Ação:** Reaproveitar como guia de tom de voz.

#### 2.1.3 🔴 REESCREVER — Ativos com Problemas

**I. Funil de Conversão**
- 5 `#contato` + 2 `#solucoes` sem alvo
- CTA "Agendar demonstração" inoperante em 5 pontos
- WhatsApp `551140000000` fictício
- **Ação:** Reconstruir funil inteiro com backend real.

**J. FinalCTA (`FinalCTA.tsx`)**
- "Pronto para parar de trabalhar no escuro?" + 2 CTAs quebrados
- **Ação:** Reescrever com mecanismo de captura funcional.

**K. Footer (`Footer.tsx`)**
- Dados placeholder, LGPD passivo
- **Ação:** Reescrever com dados reais e links legais.

#### 2.1.4 🔴 REFERÊNCIA — Ativos Decorativos

**L. Hero (`Hero.tsx`)**
- "O cérebro do seu negócio" — genérico demais para Barber
- **Ação:** Guardar como referência institucional, reescrever para Barber.

**M. Promise (`Promise.tsx`)**
- "Dados → Decisões → Resultado" — abstrato demais
- **Ação:** Manter como mood, não como argumento.

**N. Technology (`Technology.tsx`)**
- 6 claims amplos ("Nuvem, Seguro, Escalável")
- **Ação:** Reutilizar apenas como filler de rodapé.

**O. ProductExperience (`ProductExperience.tsx`)**
- 4 adjetivos genéricos + mockups 100% fake
- **Ação:** Substituir por screenshots reais do `sou-manager`.

#### 2.1.5 ⚫ DESCARTAR

| Item | Evidência | Motivo |
|---|---|---|
| Barra de métricas (500+/R$12M/99.9%/24-7) | `OLD_App.tsx:695-715` | Números não verificáveis, risco de propaganda enganosa |
| Formulário de contato | `OLD_App.tsx:790-893` | Nunca teve backend |
| Chatbot IA | `OLD_App.tsx:37-190` | Exporia chave no browser |
| `metadata.json` | Artefato AI Studio | Zero valor |
| `.env.example` | AI Studio/Cloud Run | Nenhum código lê |
| `GEMINI_API_KEY` no Vite | `vite.config.ts:11` | Injeta segredo sem consumidor |
| CSS morto | `index.css:57-62, 84-89` | `.tech-lines`, `.glow-line-vertical` |
| Keywords meta | `index.html:13` | "automotivo", "clube de benefícios" — segmentos inexistentes |

---

### 2.2 `sanchez-barber-iastudio`

| Ativo | Classificação | Ação |
|---|---|---|
| Catálogo de serviços (`scheduling/data.ts`) | 🟡 REFERÊNCIA | Seed de `services` por tenant |
| Design system dark/gold | 🟡 REFERÊNCIA | Tema SMG |
| Wizard de booking | 🟡 ADAPTAR | `src/modules/publicBooking/` |
| 10 componentes de landing | 🟡 REFERÊNCIA (design) / 🔴 DESCARTAR | — |

---

### 2.3 `SMG_LOUGE`

| Ativo | Classificação | Ação |
|---|---|---|
| CommandPalette | 🟡 ADAPTAR | `src/modules/publicBooking/` |
| KpiCard, EventKpiCard | 🟢 COPIAR | Dashboard |
| OperationalAlerts | 🟡 ADAPTAR | Dashboard |
| Rankings | 🟡 ADAPTAR | Dashboard |
| Drawer/Modal de comissões | 🟡 ADAPTAR | Módulo financeiro |

---

### 2.4 `SMG_AUTOCONTROL`

| Ativo | Classificação | Ação |
|---|---|---|
| Domínio automotivo (OS, vehicles, PF/PJ) | 🟡 REFERÊNCIA | Seed do módulo `auto` |
| Grade de 4 KPIs | 🟡 ADAPTAR | Dashboard |
| Funil de OS em 4 cards | 🟡 ADAPTAR | Dashboard |
| 3 cards financeiros | 🟡 ADAPTAR | Financeiro |

---

## 3. Análise de Posicionamento

### 3.1 Tese Central da Landing

O posicionamento em 3 camadas:
1. **Hero** — "O cérebro do seu negócio" / "cresça com previsibilidade" → Categoria: sistema de gestão
2. **Differentiators** — eixo mais forte do projeto
3. **Testimonial** — argumento de diferenciação mais defensável: "nascido dentro da operação"

### 3.2 Tensão Estratégica

A landing fala de "múltiplos negócios" e três verticais, mas o `sou-manager` registra que **existe um único produto comercialmente ativo: SMG Barber**. Isso cria uma tensão:

- A landing é institucional/plataforma (onde "múltiplos negócios" é truthful como visão)
- A aquisição do Barber precisa do argumento de origem

**Oportunidade:** usar a landing como institucional e construir a aquisição do Barber sobre o argumento de origem.

### 3.3 Nomenclatura de Marca

| Produto | `platform.ts` | `Ecosystem.tsx` | `index.html` | Taxonomia oficial |
|---|---|---|---|---|
| Barber | "SMG Barber" | "SMG Barber" | "barbearia" | ✅ SMG Barber |
| Auto | "SMG AutoControl" | "SMG Auto Control" | "automotivo" | ❌ inexistente |
| Clube | "SMG Club" | "SMG Pop Lounge" | "clube de benefícios" | ⚠️ "Club dos Chefes" |

**FATO:** três nomes diferentes para o mesmo produto. "SMG Pop Lounge" não tem lastro em lugar nenhum do ecossistema.

---

## 4. Riscos de Marketing

| # | Risco | Evidência | Impacto |
|---|---|---|---|
| R-1 | Funil de conversão 100% inoperante | 7 âncoras quebradas | Perda direta de receita |
| R-2 | Propaganda enganosa com métricas não verificáveis | "500+ empresas", "R$12M+" | Risco legal (CDC art. 37) |
| R-3 | Inconsistência de marca | "Pop Lounge" vs "Club" vs "AutoControl" | Confusão no prospect |
| R-4 | LGPD — links legais são `<p>` sem href | `Footer.tsx:40-41` | Passivo de conformidade |
| R-5 | Deploy não reprodutível | Sem `vercel.json` | `/acesso` provavelmente 404 |
| R-6 | Repositório órfão | Produção divergente | Sem dono ativo |
| R-7 | Sem analytics | Zero instrumentação | Otimização às cegas |
| R-8 | SEO deficitário | Sem JSON-LD, `og:image` | Loss de rich results |

---

## 5. Recomendações de Marketing

### 5.1 Ações Imediatas (P0)

1. **Reconstruir funil de captura** — 7 âncoras quebradas são o maior defeito
2. **Corrigir nomenclatura de marca** — um nome por produto
3. **Adicionar analytics** — sem tracking, qualquer otimização é às cegas

### 5.2 Ações de Curto Prazo (P1)

4. **Extrair brand kit** — tokens + classes para reuso
5. **Recuperar catálogo de produtos do git** — material de venda substancial
6. **Adicionar `vercel.json`** — deploy reprodutível
7. **Corrigir LGPD** — links legais funcionais

### 5.3 Ações de Médio Prazo (P2)

8. **Adicionar prova social** — clientes reais nomeados, métricas verificáveis
9. **Adicionar pricing** — decisão de PO necessária
10. **Reescrever Hero** — especificidade para Barber

### 5.4 Decisões de PO

| # | Decisão | Motivo |
|---|---|---|
| D-1 | Preço público ou formulário de qualification? | Sem preço, toda conversão depende de WhatsApp fake |
| D-2 | Landing institucional ou produto-specific? | Tensão entre visão multi-produto e realidade de um produto |
| D-3 | Manter "Pop Lounge" ou renomear? | Divergência com taxonomia oficial |
| D-4 | Restaurar barra de métricas? | Risco de propaganda enganosa |
