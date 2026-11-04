# Sistema Oficial de Certificação & Avaliação — SMG Academy

> **SMG Barber — The Barbershop Intelligence**<br />
> **Entidade Emissora:** SMG Intelligence (Masterbrand Tech)<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** CANÔNICO E OBRIGATÓRIO<br />
> **Público-Alvo:** Gestores, Barbeiros e Profissionais de Atendimento

---

## 1. Princípios da Certificação Oficial

A certificação da **SMG Academy** não é um certificado de participação meramente burocrático. Ela atesta formalmente a capacidade operacional e o domínio técnico dos profissionais no uso da plataforma **SMG Barber**.

### Critérios Oficiais de Aprovação:
- **Nota de Corte:** Mínimo de **80% de aproveitamento** (4 de 5 acertos na prova conceitual e 100% dos exercícios práticos simulados concluídos).
- **Validade da Credencial:** 12 meses a partir da data de homologação.
- **Ambiente de Teste Prático:** Todos os exercícios devem ser executados no ambiente Demo Local (`teste@soumanager.local` / `12345678`) ou na conta de homologação da barbearia.

---

## 2. Gabarito Comentado das Avaliações Teóricas

### 2.1 Trilha 1 — Especialista em Recepção & Caixa Ágil
| Questão | Resposta Correta | Fundamentação Técnica |
|:---:|:---:|---|
| **Q1** | **b) Tecla N** | O atalho global `N` abre instantaneamente o modal de comanda a partir de qualquer tela do balcão. |
| **Q2** | **c) Libera apenas a semana atual** | A Cadeira Cativa preserva a recorrência futura de até 12 semanas, liberando apenas o horário pontual. |
| **Q3** | **a) Conferência Cega da gaveta** | O operador não vê o valor esperado pelo sistema, impedindo fraudes ou fechamentos viciados. |
| **Q4** | **b) R$ 20,00** | Total R$ 80,00 - R$ 50,00 PIX = R$ 30,00 restante. Nota entregue R$ 50,00 - R$ 30,00 = Troco R$ 20,00. |
| **Q5** | **b) Comissão integral garantida** | O abatimento com crédito do Club preserva a comissão cadastrada do barbeiro com base no valor acordado no plano. |

### 2.2 Trilha 2 — Barbeiro Digital & Bancada Lucrativa
| Questão | Resposta Correta | Fundamentação Técnica |
|:---:|:---:|---|
| **Q1** | **b) Apenas a própria agenda e extrato** | O perfil de Barbeiro possui visibilidade restrita por RLS (`current_tenant_id_from_auth_uid()`), garantindo privacidade. |
| **Q2** | **b) Notifica a recepção e atualiza Cockpit** | O status "Em Andamento" ajusta o tempo de cadeira e a taxa de ocupação da barbearia em tempo real. |
| **Q3** | **b) Clica em + Adicionar Item na comanda** | O barbeiro lança itens de bancada sem precisar se deslocar até o balcão. |
| **Q4** | **b) Dedução proporcional justa da taxa** | A barbearia desconta apenas a alíquota da maquininha de cartão sobre a parcela do profissional. |
| **Q5** | **a) No menu "Meu Extrato"** | O profissional visualiza sua comissão líquida acumulada instantaneamente. |

### 2.3 Trilha 3 — Gestão Executiva & Dono da Barbearia
| Questão | Resposta Correta | Fundamentação Técnica |
|:---:|:---:|---|
| **Q1** | **a) Pagamentos já liquidados** | O Cockpit reflete caixa real sem distorções de comandas abertas ou previsões teóricas. |
| **Q2** | **b) Recuperação a CAC quase zero** | Reengajar clientes inativos via WhatsApp aumenta o LTV e ocupa cadeiras ociosas com baixo custo. |
| **Q3** | **b) Separação Canônica (ADR-001)** | Comissão teórica é direito contratual do barbeiro; rateio de fechamento de caixa liquida os valores do turno. |
| **Q4** | **b) Receita previsível e recorrente** | O modelo de assinaturas Club dos Chefes cobre custos fixos nos primeiros dias do mês. |
| **Q5** | **c) Justificativa obrigatória com auditoria** | Diferenças de caixa não são maquiadas; elas são registradas com trilha formal de auditoria (`audit_logs`). |

---

## 3. Template Oficial do Certificado de Conclusão

Após a validação prática e teórica pelo gestor ou administrador da barbearia, emite-se o seguinte certificado oficial:

```markdown
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               SMG INTELLIGENCE                                ║
║                    THE BARBERSHOP INTELLIGENCE PLATFORM                       ║
║                                                                               ║
║                    CERTIFICADO DE EXCELÊNCIA OPERACIONAL                      ║
║                                                                               ║
║   Certificamos que o profissional:                                            ║
║   [ NOME COMPLETO DO PROFISSIONAL ]                                           ║
║                                                                               ║
║   concluiu com êxito e aproveitamento superior a 80% o treinamento oficial:  ║
║                                                                               ║
║   TRILHA: [ NOME DA TRILHA CONCLUÍDA ]                                        ║
║   UNIDADE CREDENCIADA: [ NOME DA BARBEARIA ]                                  ║
║   CARGA HORÁRIA: [ 30 / 45 / 60 ] MINUTOS                                     ║
║   DATA DE HOMOLOGAÇÃO: [ AAAA-MM-DD ]                                         ║
║                                                                               ║
║   Aptidão comprovada em:                                                      ║
|   • Operação de Cockpit & Agenda Inteligente                                  ║
║   • Governança Financeira & Fechamento de Caixa Cego                          ║
║   • Fidelidade Ativa com Club dos Chefes & Cadeira Cativa                     ║
║   • Recuperação Preditiva de Clientes via WhatsApp                            ║
║                                                                               ║
║   Código de Autenticidade Digital:                                            ║
║   SMG-ACAD-[TENANT_ID]-[USER_ID]-[SHA256_HASH]                                ║
║                                                                               ║
║   _____________________________               _____________________________   ║
║     Diretoria de Tecnologia SMG                  Gestor Responsável Unidade   ║
║          SMG Intelligence                               SMG Barber            ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Selo de Unidade Certificada SMG Barber

Barbearias que possuem **100% da equipe ativa certificada** (Recepção, Barbeiros e Gestores) recebem a chancela:

> 🏅 **UNIDADE CERTIFICADA SMG BARBER — EXCELÊNCIA EM GESTÃO & ATENDIMENTO**
> - Selo digital em alta resolução para inclusão no Instagram, site oficial e Google Meu Negócio.
> - Placa de bancada para recepção física comprovando idoneidade operacional e controle de qualidade.
