<!-- impeccable:product-schema 1 -->
# Product

## Register

product

## Platform

web

## Users

SOU MANA.GER atende todos os papéis da operação de uma barbearia ou negócio de estética: dono, gerente, recepcionista, profissional/barbeiro e administração. A experiência prioriza dono e gerente no dia a dia, que precisam enxergar agenda, comandas, financeiro (caixa e rateio de fechamento), equipe, recorrência, clube, portal, kiosk e indicadores reais com velocidade e precisão para tomar decisões durante a rotina do balcão e da cadeira.

## Product Purpose

O produto centraliza a gestão operacional e estratégica de barbearias em uma plataforma SaaS multi-tenant, com foco prioritário na operação e gestão diária (Agenda, Comandas, Caixa e Métricas em tempo real). Ele elimina atrito no atendimento, organiza vendas e agendamentos com sincronização imediata, assegura controle financeiro auditável e confiável, apoia a fidelização e transforma dados reais em decisões assertivas. Sucesso significa uma operação previsível, lucrativa e profissional, sem dados fake, sem planilhas paralelas e sem telas genéricas de ERP.

## Constraints

- **Produto Comercial Único:** O produto comercial ativo é exclusivamente o **SMG Barber**. O "Club dos Chefes" é um módulo interno de recorrência e fidelização do Barber, nunca um SaaS ou produto autônomo.
- **Isolamento Multi-tenant e RLS:** Isolamento estrito por `tenant_id` via RLS no Supabase (`current_tenant_id_from_auth_uid()`). Toda query e mutação no front e back respeita o escopo do tenant ativo. Proibido afrouxar RLS ou criar RPCs sem validação explícita de autorização.
- **Separação Financeira Estrita (ADR-001):** Comissão teórica (`domain/commission/`) e rateio efetivo de fechamento de caixa (`application/cashClosing/`) são domínios distintos e nunca devem ser misturados ou substituídos entre si.
- **Stack & Runtime:** React 19 · Vite 6 · TypeScript 5.8 · Tailwind CSS v4 (configuração CSS-first — não existe `tailwind.config`) · Supabase (Postgres, Auth, Realtime) · deploy Vercel.
- **Roteamento:** Exclusivamente `HashRouter` (nunca `BrowserRouter`), exigido pelo rewrite SPA do `vercel.json`.
- **Gerenciamento de Estado:** Apenas React Context (`AuthContext` → `TenantProvider` → `AppProvider` → `ThemeProvider`). Sem Redux ou Zustand.
- **Purple Ban & Anti-Clichês Visuais:** Proibição estrita de paletas genéricas com roxo/violeta, gradientes artificiais azul-arroxeados ou cartões repetitivos sem função.
- **Dados Reais e Honestidade de Estado:** Proibido o uso de dados mockados, inventados ou fictícios em produção. Quando não houver dados, exibir empty states honestos, calmos e com ações claras.
- **Roadmap Congelado e Governança:** Roadmap congelado desde 2026-07-24 (D1–D9); qualquer alteração estrutural exige ADR formal aprovado pelo PO e segue o SMG Change Control Protocol.

## Brand Personality

Premium, inteligente e acolhedora ("The Smart Barber Atelier"). A marca SMG transmite tecnologia, precisão, autoridade e percepção refinada, preservando o calor e a agilidade necessários para a rotina de uma barbearia real. A interface é especializada no universo barber: profissional, confiante, altamente organizada, próxima do balcão e da cadeira, e não uma casca SaaS genérica aplicada a qualquer mercado.

## Anti-references

Não parecer um ERP genérico, burocrático ou frio. Não parecer um SaaS genérico com dashboard indiferenciado, excesso de roxo/azul padrão, cards repetidos e métricas decorativas. Não usar dados fake quando já houver dados reais ou caminhos reais de consulta. Não diluir o Club dos Chefes em um produto separado: dentro deste app, ele é um módulo recorrente do Barber. Não sacrificar clareza operacional por pirotecnia visual de marketing.

## Design Principles

1. **Produto antes de vitrine:** Cada tela deve ajudar uma tarefa real da barbearia a acontecer com menos atrito e maior velocidade.
2. **Autoridade por precisão:** Hierarquia, alinhamento, espaçamento e estados devem ser rigorosos para sustentar a percepção premium da SMG.
3. **Barber de verdade:** A experiência deve carregar sinais específicos de agenda, cadeira, equipe, cliente, comanda, assinatura e recorrência.
4. **Dados reais primeiro:** Quando existe fonte real, a interface deve mostrar dado real, estado vazio honesto ou erro acionável, nunca maquiar com números falsos.
5. **Acolhimento operacional:** Mesmo em telas densas, a UI deve ser clara, calma e humana para quem está trabalhando sob pressão.

## Accessibility & Inclusion

Mirar WCAG AA para contraste, foco visível e legibilidade em modo claro e escuro. Estados importantes de agenda, financeiro, pagamento, bloqueio, sucesso e erro não devem depender apenas de cor. A interface deve funcionar perfeitamente em desktop, tablet e celular, com redução de movimento respeitada quando aplicável e textos essenciais em português claro para usuários operacionais.
