# Lacunas Funcionais e Sugestões de Melhoria

## Introdução

Este documento identifica lacunas funcionais no sistema SMG (Sou.Manager) — um SaaS para gestão de barbearias — que podem impactar negativamente o treinamento de novos usuários, a adoção por profissionais menos técnicos e a experiência geral do cliente final. As sugestões aqui propostas visam preencher essas lacunas de forma prática, sem modificar o núcleo arquitetural do sistema.

O SMG já possui funcionalidades robustas: agendamento, comandas, checkout, comissões, fechamento de caixa, folha de pagamento, ChefClub, módulos Kiosk e Portal, BI estratégico, controle de acesso granular, modo offline e observabilidade. Ainda assim, gaps de usabilidade, onboarding e integrações podem frear a adoção em larga escala.

## Metodologia

As lacunas foram identificadas por meio de:

- **Análise do código-fonte** — exame dos contextos, componentes, fluxos de navegação e estrutura de rotas.
- **Perspectiva de design instrucional** — avaliação de quão intuitivo o sistema é para um usuário que nunca viu a ferramenta.
- **Mapeamento de dor operacional** — identificação de ações que exigem conhecimento prévio ou causam ansiedade no usuário.
- **Comparação com sistemas concorrentes** — referência indireta a práticas comuns em SaaS de gestão de serviços.

Cada sugestão é classificada por impacto no treinamento e usabilidade, não por dificuldade técnica de implementação.

---

## Categoria 1 — Experiência do Usuário

### Sugestão 1.1 — Tour guiado no primeiro acesso

**Gap:** O sistema não oferece nenhum onboarding interativo. O usuário faz login e se depara com um dashboard cheio de informações sem contexto.

**Impacto:** Novos usuários (especialmente barbeiros e recepcionistas com baixa familiaridade tecnológica) sentem-se perdidos, aumentando o tempo de ramp-up e a dependência de suporte externo.

**Sugestão:** Implementar um tour guiado (walkthrough) em 4–5 etapas na primeira autenticação. O tour deve ser contextual por perfil: um barbeiro vê apenas agendamento e comandas; um gerente vê financeiro e relatórios. Deve ser possível revisitar o tour a qualquer momento pelo menu de ajuda.

---

### Sugestão 1.2 — Modo de demonstração mais rico

**Gap:** O modo demo existente funciona com dados mínimos (2 clientes, 2 serviços, 1 produto, 2 planos). Cenários realistas de treinamento — como reagendamento, checkout com múltiplos serviços, cancelamento e reembolso — não podem ser simulados adequadamente.

**Impacto:** Treinadores precisam criar dados manualmente ou usar produção real para demonstrar fluxos completos, o que é arriscado ou impraticável.

**Sugestão:** Pré-semear o modo demo com um conjunto mais rico de dados: 10+ clientes com histórico de visitas, 5+ serviços com durações e preços variados, produtos com estoque, planos ChefClub ativos e expirados, comandas em diferentes estados (aberta, fechada, cancelada) e agendamentos passados/futuros. Incluir também alguns cenários de exceção (cliente com crédito insuficiente, serviço sem profissional disponível).

---

### Sugestão 1.3 — Feedback visual em ações críticas

**Gap:** Ações como fechar comanda, cancelar agendamento ou excluir cliente nem sempre exibem feedback claro de sucesso ou falha. Em alguns casos, o usuário precisa navegar para outra tela para confirmar que a ação foi concluída.

**Impacto:** Gera insegurança: o usuário não sabe se a operação foi bem-sucedida, levando a duplicidade de ações ou retrabalho.

**Sugestão:** Adotar um sistema de notificações toast consistente em todo o sistema, com posicionamento fixo (canto superior direito), duração configurável e, quando aplicável, ação de desfazer (undo) disponível por 5–10 segundos. Cores padronizadas: verde para sucesso, vermelho para erro, amarelo para aviso, azul para informação.

---

## Categoria 2 — Treinamento e Onboarding

### Sugestão 2.1 — Modo sandbox/treinamento

**Gap:** Não existe um ambiente isolado onde o usuário possa explorar funcionalidades sem risco de afetar dados reais. O modo demo existe, mas é global — qualquer ação impacta o estado compartilhado.

**Impacto:** Usuários em treinamento hesitam em testar fluxos como cancelar uma comanda ou excluir um agendamento com medo de consequências reais. Isso reduz a profundidade do aprendizado prático.

**Sugestão:** Adicionar um toggle "Modo Treinamento" no header (visível apenas para gerentes e acima). Quando ativado, todas as operações de escrita são redirecionadas para um banco de dados de treinamento ou para um espaço em memória isolado, com dados copiados do tenant real. Um banner visual proeminente ("MODO TREINAMENTO — Alterações não afetam dados reais") deve ficar sempre visível.

---

### Sugestão 2.2 — Tooltips contextuais

**Gap:** O sistema não oferece ajuda contextual. Campos como "taxa de comissão", "afeta comissão", "percentual de multa" e "créditos do plano" não têm explicação inline.

**Impacto:** O usuário precisa abrir documentação externa ou chamar suporte para entender campos específicos, quebrando o fluxo de trabalho.

**Sugestão:** Adicionar tooltips com ícone de interrogação (?) ao lado de campos não óbvios. O texto do tooltip deve ser curto (< 100 caracteres), em linguagem simples, explicando o impacto do campo. Idealmente, os tooltips devem ser gerenciáveis via um arquivo de configuração ou CMS para permitir atualização sem deploy.

---

### Sugestão 2.3 — Warnings de segurança

**Gap:** Ações destrutivas (cancelar agendamento, excluir cliente, reverter comanda, desativar profissional) não exigem confirmação explícita ou registro do motivo.

**Impacto:** Ações acidentais são possíveis e difíceis de rastrear depois. Em treinamento, instrutores precisam reforçar manualmente que "isso não pode ser desfeito".

**Sugestão:** Implementar diálogos de confirmação com dois estágios: (1) aviso do que será afetado e (2) campo de motivo obrigatório (texto livre). O motivo deve ser registrado no audit log e exibido no histórico da entidade. Para ações verdadeiramente irreversíveis (excluir registro contábil), exigir digitação de uma palavra-chave como "CONFIRMAR".

---

## Categoria 3 — Funcionalidades Financeiras

### Sugestão 3.1 — Conciliação bancária automática

**Gap:** O sistema gerencia fluxo de caixa e fechamento, mas não oferece conciliação bancária. Não é possível importar extratos bancários para comparar com os lançamentos internos.

**Impacto:** O contador ou gerente precisa exportar dados do SMG e importar em outra ferramenta (ou fazer manualmente) para reconciliar. Isso aumenta o risco de erro humano e retrabalho.

**Sugestão:** Implementar importação de arquivos OFX, CSV e PDF de extratos bancários. Cada transação importada deve ser comparada com lançamentos internos por valor, data e descrição, com sugestão automática de matching. Transações não reconciliadas devem aparecer em um dashboard de pendências.

---

### Sugestão 3.2 — Nota fiscal integrada

**Gap:** O SMG não gera notas fiscais (NF-e para produtos, NFS-e para serviços). Barbearias que precisam emitir NF para clientes PJ ou para compliance fiscal precisam usar um sistema separado.

**Impacto:** Perda de eficiência e risco fiscal: o operador precisa lançar a venda no SMG e depois digitar a mesma venda no sistema fiscal.

**Sugestão:** Integração com APIs de emissão de NF-e/NFS-e (ex.: Nuvem Fiscal, Focus NF-e). Permitir configurar dados fiscais do tenant (CNPJ, inscrição municipal, regime tributário) e emitir a nota diretamente do checkout. Idealmente, a emissão deve ser automática para clientes PJ e opcional para clientes PF.

---

### Sugestão 3.3 — Relatórios contábeis

**Gap:** O BI existente foca em indicadores operacionais (faturamento, serviços mais vendidos, professionals ranking). Não há relatórios contábeis formais como Demonstração do Resultado do Exercício (DRE), balanço patrimonial ou fluxo de caixa por período contábil.

**Impacto:** O contador da barbearia não consegue extrair informações contábeis diretamente do SMG, precisando de planilhas paralelas.

**Sugestão:** Adicionar relatórios contábeis padrão: DRE com agrupamento por centro de custo, balancete analítico por conta contábil e demonstrativo de fluxo de caixa (método direto). Os dados devem ser exportáveis no formato Sped contábil (ECD) quando aplicável.

---

## Categoria 4 — Comunicação e Marketing

### Sugestão 4.1 — CRM integrado (envio automático)

**Estado atual:** O sistema já possui o módulo **SmartReturn** (`/#/smart-return`) que identifica e categoriza clientes como "Retornando", "Em Risco" ou "Inativo" com base no tempo desde a última visita. A funcionalidade atual é **analítica** — ela segmenta e exibe os dados, mas **não dispara campanhas automaticamente**.

**Gap:** Não há disparo automatizado de campanhas de marketing. O sistema sabe quais clientes não visitam há 30, 60, 90 dias, mas não envia mensagens de reativação automaticamente.

**Impacto:** Clientes inativos permanecem inativos até que um funcionário lembre de contactá-los manualmente. Oportunidade de receita perdida.

**Sugestão:** Expandir o SmartReturn com envio automatizado via WhatsApp (Business API) e e-mail: (a) aniversariantes do mês; (b) clientes sem visita há X dias; (c) clientes com créditos ChefClub expirando; (d) pós-visita (agradecimento). Permitir templates customizáveis e agendamento de disparos.

---

### Sugestão 4.2 — Pesquisa de satisfação (NPS) via totem → Expandir para canais digitais

**~~Gap:~~** ~~Não existe coleta sistematizada de feedback pós-atendimento. Não há NPS, pesquisa de satisfação nem coleta de review.~~

**Estado atual:** ✅ O módulo **Kiosk** já implementa pesquisa NPS completa:
- `KioskShopFeedback.tsx` — questionário NPS (0–10) com classificação Detractor/Neutro/Promotor, comentários e 3 etapas de fluxo
- `KioskBarberFeedback.tsx` — feedback por profissional
- `KioskAdmin.tsx` — exibe `avg_nps`, `feedback_shop_count` e métricas derivadas
- `feedback_shop` e `feedback_barber` — tabelas no Supabase com campo `nps`

**Gap real:** A pesquisa NPS está restrita ao **Kiosk físico (totem)**. Não há disparo remoto (WhatsApp) para clientes que não usam o totem.

**Impacto:** Clientes que fazem checkout direto no PDV sem passar pelo totem não têm canal de feedback.

**Sugestão:** Expandir a pesquisa NPS já existente para canais digitais: disparo automático via WhatsApp após cada checkout concluído. As respostas devem alimentar o dashboard existente, consolidando feedback do totem + remoto. Alertar o gerente quando a média do dia cair abaixo de um threshold configurável.

---

### Sugestão 4.3 — Programa de fidelidade

**Gap:** O ChefClub é um plano de assinatura (mensalidade por benefícios). Não existe um programa de pontos progressivo baseado em consumo.

**Impacto:** Clientes de alto valor que não assinam o ChefClub não têm incentivo de fidelidade. Clientes assinantes também não acumulam pontos extras por consumo adicional.

**Sugestão:** Implementar um sistema de pontos: R$ 1 = 1 ponto. Pontos podem ser trocados por serviços, produtos ou descontos. O programa deve ser configurável por tenant (taxa de acúmulo, produtos/serviços elegíveis, validade dos pontos). Os pontos devem ser visíveis para o cliente no Portal e no resumo do checkout.

---

## Categoria 5 — Operacionais

### Sugestão 5.1 — Gestão de fila de espera avançada

**Gap:** O sistema trata walk-ins com uma lista básica. Não há display público de fila, estimativa de tempo de espera ou notificação ao cliente quando o profissional está disponível.

**Impacto:** Em dias movimentados, clientes sem agendamento ficam aguardando sem previsão, gerando insatisfação. A recepcionista precisa gerenciar a fila verbalmente.

**Sugestão:** Implementar uma fila de espera com (a) tempo estimado de espera baseado na duração dos agendamentos à frente; (b) notificação via WhatsApp quando o profissional estiver disponível (com tolerância de 5 min); (c) painel visual para TV na recepção mostrando a fila em tempo real. O cliente deve poder entrar na fila pelo Portal ou Kiosk.

---

### Sugestão 5.2 — Múltiplas filiais integradas

**Gap:** O sistema suporta múltiplas unidades, mas a gestão é basicamente isolada por tenant. Não há uma visão consolidada para redes nem funcionalidades como transferência de cliente entre unidades ou estoque centralizado.

**Impacto:** Redes de barbearia (2+ lojas) precisam usar relatórios paralelos ou planilhas para comparar performance entre unidades. Clientes não podem agendar em unidades diferentes com o mesmo cadastro.

**Sugestão:** Criar um conceito de "grupo empresarial" (enterprise group) que agrega múltiplos tenants/filiais. O dashboard corporativo deve mostrar indicadores consolidados com drill-down por filial. Clientes devem poder agendar em qualquer filial do grupo. Estoque e produtos devem ser sincronizáveis entre filiais.

---

### Sugestão 5.3 — App mobile dedicado

**Gap:** A experiência mobile é responsiva via navegador, mas não há um aplicativo nativo (Android/iOS). Funcionalidades como notificações push, câmera para foto do cliente e geolocalização não são plenamente exploráveis.

**Impacto:** Barbeiros e recepcionistas que usam o celular como ferramenta de trabalho têm experiência inferior. Notificações de agendamento podem não chegar em tempo hábil.

**Sugestão:** Desenvolver um app mobile nativo (ou PWA com recursos nativos) para os perfis barbeiro e recepcionista. Funcionalidades essenciais: (a) notificações push de agendamentos; (b) abertura/fechamento de comanda rápido; (c) foto do cliente no cadastro; (d) acesso offline completo (já existe no webapp, mas pode ser otimizado). O app do gerente pode incluir aprovação rápida de solicitações e alertas financeiros.

---

## Categoria 6 — Administrativo

### Sugestão 6.1 — Histórico completo de alterações

**Gap:** O sistema possui audit log, mas a visualização é limitada. Não é possível ver o "antes e depois" de uma alteração específica nem filtrar por entidade, usuário ou período de forma intuitiva.

**Impacto:** Em treinamento, é difícil demonstrar rastreabilidade. Na operação, investigar "quem alterou o preço do serviço X" requer consulta técnica ao banco.

**Sugestão:** Implementar um visualizador de diff/histórico com: (a) filtros por entidade, tipo de ação (criar, alterar, excluir), usuário e data; (b) exibição lado a lado do valor anterior e novo; (c) link direto do histórico para a entidade afetada. Para ações financeiras, exigir que o diff seja sempre visível.

---

### Sugestão 6.2 — Templates de permissão customizáveis

**Gap:** O sistema oferece perfis fixos: Admin, Manager, Barber, Receptionist, Cashier, SuperAdmin. Não é possível criar perfis customizados combinando permissões individuais.

**Impacto:** Barbearias com estruturas organizacionais únicas (ex.: um "gerente financeiro" que não pode ver relatórios de profissionais) precisam adaptar seus processos aos perfis existentes.

**Sugestão:** Permitir que o SuperAdmin ou Admin crie templates de permissão personalizados selecionando permissões individuais (agrupar por módulo) e salvando com um nome. Os templates devem ser aplicáveis a múltiplos usuários. Alterações no template devem ser propagáveis para todos os usuários vinculados.

---

### Sugestão 6.3 — Backup automático com restore

**Gap:** O SMG depende exclusivamente dos backups gerenciados pela infraestrutura Supabase. Não há interface no sistema para iniciar um backup manual, agendar backups ou restaurar dados de um ponto específico.

**Impacto:** Em caso de erro operacional (ex.: exclusão em massa acidental), o usuário não tem autonomia para restaurar — precisa acionar o suporte técnico, que depende de backup externo.

**Sugestão:** Adicionar uma interface administrativa de backup com: (a) backup manual com um clique (exporta JSON comprimido de todas as tabelas do tenant); (b) agendamento de backup (diário/semanal); (c) restore seletivo (escolher quais entidades restaurar); (d) lista de backups disponíveis com data e tamanho. Importante: o backup deve respeitar a segregação por tenant.

---

## Categoria 7 — Relatórios e Analytics

### Sugestão 7.1 — Relatórios customizáveis

**Gap:** Os relatórios existentes são fixos: faturamento por período, serviços por profissional, etc. Não é possível que o usuário crie seu próprio relatório combinando filtros e colunas arbitrárias.

**Impacto:** Gerentes precisam de visões específicas (ex.: "clientes que gastaram mais de R$ 500 em cortes masculinos nos últimos 3 meses") que não estão disponíveis como relatório pronto.

**Sugestão:** Criar um construtor de relatórios drag-and-drop: (a) selecionar entidades base (vendas, clientes, comissões, agendamentos); (b) adicionar colunas; (c) aplicar filtros condicionais; (d) escolher agrupamento e ordenação; (e) salvar como relatório personalizado com nome e visibilidade (privado ou compartilhado).

---

### Sugestão 7.2 — Exportação avançada

**Gap:** A exportação atual suporta apenas PDF e CSV. O CSV não inclui formatação (células mescladas, cores, fórmulas) e quebras de encoding com caracteres especiais.

**Impacto:** Usuários que precisam tratar dados no Excel reclamam de inconsistências de formatação e precisam ajustar manualmente.

**Sugestão:** Adicionar exportação para Excel (.xlsx) com formatação condicional, cabeçalhos estilizados e tipos de dados corretos (número, data, moeda). Implementar detecção automática de encoding (UTF-8 BOM). Para uso avançado, oferecer exportação via API REST com suporte a JSON, XML e Parquet.

---

### Sugestão 7.3 — Previsões e tendências

**Gap:** O BI mostra apenas dados históricos. Não há projeções de receita, previsão de demanda por horário/profissional ou identificação de tendências sazonais.

**Impacto:** Decisões de escalonamento (contratar mais profissionais, estender horário) são baseadas em intuição, não em dados projetados.

**Sugestão:** Utilizar modelos de séries temporais leves (ARIMA, Prophet) ou serviços de ML gerenciados (Gemini, Vertex AI) para gerar: (a) previsão de faturamento para os próximos 30/60/90 dias; (b) previsão de demanda por horário (quais dias/horários terão maior procura); (c) detecção de sazonalidade (meses de pico e vale). As previsões devem ser apresentadas como overlays nos gráficos existentes, com intervalo de confiança.

---

## Categoria 8 — Integrações

### Sugestão 8.1 — API pública

**Gap:** O SMG não possui uma API REST pública documentada. Toda comunicação com o backend ocorre via cliente Supabase diretamente, sem camada de abstração externa.

**Impacto:** Desenvolvedores terceiros ou equipes internas não conseguem integrar o SMG com ERPs, PDVs, sites, aplicativos ou ferramentas de automação.

**Sugestão:** Publicar uma API RESTful com: (a) autenticação via API keys (geradas pelo admin no painel); (b) rate limiting por key (ex.: 1000 req/h); (c) documentação interativa (OpenAPI/Swagger); (d) webhooks para eventos (checkout, agendamento, cancelamento); (e) escopos de permissão por recurso (leitura/escrita em clientes, agendamentos, financeiro).

---

### Sugestão 8.2 — Integração com agendamento online

**Gap:** O Portal existe e permite que o cliente agende online, mas não há integração com plataformas externas de agendamento como Google Calendar, Instagram (agendamento via botão) ou Facebook.

**Impacto:** Clientes que usam Google Calendar para organizar compromissos precisam inserir manualmente o agendamento. O potencial de captura de clientes via redes sociais não é explorado.

**Sugestão:** Implementar: (a) sincronização bidirecional com Google Calendar (evento criado no SMG aparece no calendário do cliente e vice-versa); (b) botão "Agende no Instagram" com link deep para o Portal; (c) widget de agendamento embedável para sites parceiros.

---

### Sugestão 8.3 — Integração com marketplaces

**Gap:** O SMG gerencia vendas de produtos (shampoo, condicionador, pomadas), mas não há integração com plataformas de delivery como iFood, Uber Eats ou Rappi.

**Impacto:** Barbearias que vendem produtos perdem um canal de receita relevante. Clientes que querem comprar produtos sem ir até a loja não têm opção.

**Sugestão:** Integrar com APIs de marketplaces de delivery para catálogo de produtos, gestão de estoque (sincronização bidirecional) e recebimento de pedidos. O pedido recebido no marketplace deve criar automaticamente uma comanda de produtos no SMG.

---

## Categoria 9 — Segurança e Compliance

### Sugestão 9.1 — Autenticação em dois fatores

**Gap:** O login é feito apenas com e-mail + senha (via Supabase Auth). Não há suporte a 2FA.

**Impacto:** Senhas fracas ou reutilizadas expõem dados financeiros e de clientes a risco de acesso não autorizado. Em treinamento, não é possível demonstrar boas práticas de segurança.

**Sugestão:** Implementar TOTP (Time-based One-Time Password) via aplicativos como Google Authenticator ou Authy. O 2FA deve ser opcional por usuário, mas recomendado (com badge "ativo/inativo" na listagem de usuários). Para SuperAdmin, o 2FA deve ser obrigatório. Incluir códigos de recuperação (10 códigos descartáveis) para evitar lockout.

---

### Sugestão 9.2 — Logs de acesso

**Gap:** Não há uma visualização do histórico de logins do usuário. Não é possível saber quando, de onde ou em qual dispositivo cada usuário acessou o sistema.

**Impacto:** Se uma conta for comprometida, o gerente não consegue identificar acessos suspeitos. Em treinamento, não é possível demonstrar monitoramento de segurança.

**Sugestão:** Adicionar uma página "Histórico de Login" (visível para o próprio usuário e para admins) com: (a) data/hora do login; (b) endereço IP e geolocalização aproximada (cidade/país a partir do IP); (c) user-agent (navegador/OS); (d) dispositivo (mobile/desktop); (e) status (sucesso/falha com motivo). Alertar o usuário por e-mail sobre login de novo dispositivo ou localização desconhecida.

---

### Sugestão 9.3 — LGPD compliance tools

**Gap:** O SMG coleta e armazena dados pessoais (nome, telefone, e-mail, foto) sem oferecer ferramentas de compliance com a LGPD. Não há funcionalidades de exportação de dados do titular, exclusão lógica, gestão de consentimento ou política de privacidade visível.

**Impacto:** Risco legal e regulatório. Clientes que solicitam seus dados ou pedem exclusão não podem ser atendidos prontamente. Penalidades LGPD podem chegar a 2% do faturamento.

**Sugestão:** Implementar: (a) página "Meus Dados" no Portal do cliente com opção de exportar dados completos (JSON) e solicitar exclusão; (b) painel administrativo para gerenciar solicitações de titulares (exclusão, retificação, portabilidade); (c) registro de consentimento explícito para coleta de dados no cadastro (checkbox com link para política de privacidade); (d) política de retenção configurável (ex.: excluir automaticamente dados de clientes inativos há 5 anos).

---

## Priorização

| ID | Sugestão | Prioridade | Justificativa |
|---|---|---|---|
| 1.1 | Tour guiado no primeiro acesso | **P0** | Elimina barreira inicial para novos usuários |
| 1.3 | Feedback visual em ações críticas | **P0** | Reduz erros operacionais e insegurança |
| 2.1 | Modo sandbox/treinamento | **P0** | Viabiliza treinamento prático sem risco |
| 2.3 | Warnings de segurança | **P0** | Previne ações acidentais irreversíveis |
| 4.2 | Pesquisa de satisfação automática | **P0** | Métrica direta de qualidade do serviço |
| 9.1 | Autenticação em dois fatores | **P0** | Segurança crítica para dados financeiros |
| 9.3 | LGPD compliance tools | **P0** | Risco legal e regulatório |
| 1.2 | Modo de demonstração mais rico | **P1** | Melhora qualidade do treinamento |
| 2.2 | Tooltips contextuais | **P1** | Reduz necessidade de suporte |
| 3.1 | Conciliação bancária automática | **P1** | Eficiência financeira direta |
| 4.1 | CRM integrado | **P1** | Aumenta receita com reativação |
| 5.1 | Gestão de fila de espera avançada | **P1** | Melhora experiência de walk-ins |
| 6.1 | Histórico completo de alterações | **P1** | Rastreabilidade e auditoria |
| 6.2 | Templates de permissão customizáveis | **P1** | Flexibilidade organizacional |
| 8.1 | API pública | **P1** | Habilita ecossistema de integrações |
| 9.2 | Logs de acesso | **P1** | Monitoramento de segurança |
| 3.2 | Nota fiscal integrada | **P2** | Compliance fiscal relevante |
| 3.3 | Relatórios contábeis | **P2** | Demanda de contadores |
| 4.3 | Programa de fidelidade | **P2** | Retenção de clientes |
| 5.2 | Múltiplas filiais integradas | **P2** | Suporte a redes |
| 7.1 | Relatórios customizáveis | **P2** | Flexibilidade analítica |
| 7.2 | Exportação avançada | **P2** | Produtividade do usuário |
| 8.2 | Integração com agendamento online | **P2** | Captura de clientes |
| 5.3 | App mobile dedicado | **P3** | Experiência mobile melhorada |
| 6.3 | Backup automático com restore | **P3** | Autonomia operacional |
| 7.3 | Previsões e tendências | **P3** | Análise preditiva |
| 8.3 | Integração com marketplaces | **P3** | Canal de receita adicional |

**Critérios de priorização:**

- **P0 (Crítico):** Impacta diretamente segurança, compliance ou a capacidade de treinar/operar o sistema sem risco imediato.
- **P1 (Alto):** Melhora significativamente a experiência do usuário, eficiência operacional ou receita.
- **P2 (Médio):** Funcionalidade desejável com ROI positivo, mas não bloqueante para adoção.
- **P3 (Desejável):** Valor adicional que diferencia o produto, porém com implementação mais complexa ou impacto incremental.

## Conclusão

O SMG é um sistema maduro com uma base funcional sólida. As lacunas identificadas concentram-se em três áreas principais que afetam diretamente treinamento e adoção:

1. **Onboarding e segurança psicológica do usuário** — A ausência de tour guiado (1.1), modo sandbox (2.1) e feedback visual (1.3) faz com que novos usuários demorem mais para ganhar confiança no sistema. Esses três itens são P0 e relativamente leves de implementar.

2. **Automação de comunicação e marketing** — O SMG gerencia dados ricos de clientes, mas não os utiliza ativamente. O SmartReturn (segmentação) e o NPS do Kiosk (feedback) já existem, mas precisam de expansão para disparo remoto via WhatsApp. Fidelidade (4.3) permanece como lacuna.

3. **Compliance e segurança** — LGPD (9.3) e 2FA (9.1) são obrigações legais e de segurança que não podem ser postergadas. A ausência dessas funcionalidades expõe o sistema e seus clientes a riscos reais.

**Recomendação:** Implementar os itens P0 no curto prazo (priorizando tour guiado, modo sandbox, feedback visual e LGPD/2FA), seguidos pelos P1 no médio prazo (CRM, conciliação bancária e API pública). Os itens P2 e P3 podem compor um roadmap de diferenciação competitiva.

A adoção bem-sucedida do SMG depende menos de novas funcionalidades complexas e mais de tornar as funcionalidades existentes acessíveis, seguras e autônomas para o usuário final.