# BRAND_ARCHITECTURE.md — Arquitetura de Marca & Estratégia de Posicionamento

> **SMG Intelligence (Holding Tech) · SMG Barber & Verticais**<br />
> **Data de Formalização:** 2026-11-04<br />
> **Autoridade:** Augusto (Product Owner)<br />
> **Modelo:** Híbrido Endossado (Hybrid Endorsed Brand Architecture)<br />
> **Status:** CANÔNICO E OBRIGATÓRIO

---

## 1. Estratégia: Arquitetura de Marca (Brand Architecture)

O uso do nome por extenso (*SMG Barber Intelligence*) no dia a dia traz atrito de fala e desgaste cognitivo. O operador da barbearia ou o gestor de estética automotiva no Brasil não diz: *"Acesse aí o SMG Barber Intelligence"*; ele encurta o vocabulário para a rotina ágil.

A arquitetura oficial de portfólio adota o modelo **Híbrido Endossado (Hybrid Endorsed)**:

```
                  ┌────────────────────────────────────────┐
                  │            SMG Intelligence            │
                  │   (Holding / Masterbrand Tecnológica)   │
                  │  Algoritmos · Dados · Core · Segurança │
                  └───────────────────┬────────────────────┘
                                      │ (Endossa e alimenta)
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────┐                           ┌───────────────────────┐
│      SMG Barber       │                           │       SMG Auto        │
│   (Vertical Ativa)    │                           │ (Vertical Planejada)  │
│      The Barbershop   │                           │  Automotive Business  │
│       Intelligence    │                           │     Intelligence      │
└───────────────────────┘                           └───────────────────────┘
```

### 1.1 Camadas da Arquitetura
1. **Holding / Masterbrand Tech (`SMG Intelligence`):** A entidade central que detém a propriedade intelectual, os algoritmos preditivos, o banco de dados unificado, o barramento de eventos, o isolamento multi-tenant e a infraestrutura de integrações.
2. **Produtos de Linha de Frente (Front-end Comercial):**
   - **`SMG Barber`** — Tagline / Assinatura: *The Barbershop Intelligence*. O produto comercial em escala ativa.
   - **`SMG Auto`** — Tagline / Assinatura: *Automotive Business Intelligence*. A vertical de gestão de pátio e estética automotiva.
3. **Gestão do Legado ("Sou Manager"):**
   - O termo *"Sou Manager"* fica restrito exclusivamente à razão social institucional ou à menção de transição discreta: *"SMG Intelligence (antigo Sou Manager)"*, com janela delimitada de até 60 dias para clientes históricos da base.

---

## 2. Execução: Naming, Assinatura e Pitch Comercial

### 2.1 Estrutura Canônica dos Ativos

| Camada | Nome Comercial | Assinatura / Tagline | Posicionamento & Promessa de Valor |
|---|---|---|---|
| **Ecossistema (Masterbrand)** | **SMG Intelligence** | *Business Intelligence & Service Operations* | Inteligência de dados, automação operacional e crescimento preditivo para negócios de serviços. |
| **Vertical 01 (Ativa)** | **SMG Barber** | *The Barbershop Intelligence* | O primeiro sistema com inteligência preditiva para barbearias: retenção de clientes, controle financeiro estrito e lucro real por cadeira. |
| **Vertical 02 (Planejada)** | **SMG Auto** | *Automotive Business Intelligence* | Gestão de pátio, ticket médio e fidelização inteligente para estéticas automotivas e oficinas especializadas. |

---

### 2.2 Pitch de Transição (Para a Base e Novos Leads)

> *"Gerenciar virou o básico. O mercado agora exige inteligência. O Sou Manager evoluiu e se tornou **SMG Intelligence** — a plataforma que não apenas anota seus agendamentos, mas analisa seus dados, prevê o churn de clientes e automatiza o crescimento da sua empresa."*

---

## 3. Escala: Playbook de Expansão por Verticais

Para tracionar aquisição de clientes com CAC reduzido e alto engajamento:

1. **Hiper-segmentação de Criativos:**
   - O criativo de anúncio e o topo de funil abordam a dor cirúrgica do operador (o barbeiro que perde cliente para o concorrente, ou o dono de oficina com gargalo no pátio), **sem jamais misturar segmentos na mesma comunicação**.
2. **Entrega da Promessa "Intelligence" no Software:**
   - A promessa de inteligência não é marketing vazio; ela é materializada em funcionalidades nativas já homologadas na plataforma:
     - Relatórios preditivos de ticket médio e faturamento real.
     - Alertas inteligentes de clientes inativos e reengajamento automático via WhatsApp.
     - Conciliação bancária automatizada sem erro manual.
     - Previsibilidade de fluxo de caixa e rateio de fechamento de caixa por cadeira.
3. **Replicação Modular (Arquitetura 85/15):**
   - A cada novo nicho deliberado pelo PO (ex: Clínicas, Studios, Pet), a esteira de produto reaproveita **85% do SMG Core** (multi-tenant, RLS, outbox worker, faturamento, auth, RBAC) e veste apenas **15% de linguagem e fluxos específicos** daquela vertical.
