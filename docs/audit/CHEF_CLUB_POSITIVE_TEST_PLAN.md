# Clube do Chefe — Teste Positivo (Caminho Feliz)

> **Gate:** Validação positiva do fluxo de créditos
> **Data:** 2026-08-20
> **Ambiente:** Preview `smg-barber-8prr7wz19-augustosanchesmanager-uxs-projects.vercel.app`
> **Responsável:** PO (execução) / OpenCode (preparação)

---

## 1. Contexto

Investigação D1-D3 encerrada: os 5 clientes testados tinham ciclos expirados e recebíveis em atraso. Comportamento correto do sistema.

**Falta provar:** um cliente com assinatura ativa + ciclo vigente + pagamento confirmado + crédito disponível consegue aplicar crédito à comanda e ter o crédito consumido corretamente.

---

## 2. Clientes válidos para teste

| Cliente | ID | Plano | Créditos disponíveis | Ciclo vigente |
|---------|-----|-------|---------------------|---------------|
| HUGO CORRIDA | `0be57434` | CHEFE EXECUTIVO R$160 | CORTE:4, HIDRATAÇÃO:1 | 06/08–31/08 |
| DAVID AMIGO | `0fde0cbb` | CHEFE EXECUTIVO R$160 | CORTE:3, HIDRATAÇÃO:1 | 10/08–10/09 |
| RAFAEL - VLX | `ba63deb5` | CHEFE EXECUTIVO R$160 | CORTE:4, HIDRATAÇÃO:1 | 10/08–10/09 |
| YGÃO | `37e5e979` | EXECUTIVO C/ BARBA R$200 | BARBA:2, CORTE:4 | 08/08–07/09 |
| JOÃO TELLES | `37165157` | PLANO DOS CHEFES R$260 | CORTE:4, BOTOX:1, LIMPEZA:1, HIDRATAÇÃO:1 | 10/08–10/09 |

**Recomendado para teste:** HUGO CORRIDA (ciclo termina em 11 dias, 5 créditos disponíveis, 2 serviços distintos)

---

## 3. Procedimento de teste

### Passo 1 — Login
- Acessar o Preview
- Login: `teste@soumanager.local` / `12345678` (ou credenciais do Sanchez)

### Passo 2 — Criar comanda
- Ir para **Checkout** ou criar nova comanda
- Selecionar cliente: **HUGO CORRIDA** (`0be57434`)

### Passo 3 — Verificar banner do Clube
- ✅ **ESPERADO:** Banner "Club dos Chefes" aparece na comanda
- ✅ **ESPERADO:** Badge mostra créditos disponíveis (CORTE: 4, HIDRATAÇÃO: 1)

### Passo 4 — Adicionar serviço com crédito
- Adicionar serviço **CORTE SIMPLES** ao carrinho
- ✅ **ESPERADO:** Modal "Aplicar crédito do Clube?" aparece
- Clicar "Aplicar crédito"
- ✅ **ESPERADO:** Item aparece com preço R$0,00 e tag "Usando Crédito"
- ✅ **ESPERADO:** Toast "Crédito aplicado automaticamente neste item..."

### Passo 5 — Adicionar segundo serviço
- Adicionar **HIDRATAÇÃO** ao carrinho
- ✅ **ESPERADO:** Modal aparece novamente para HIDRATAÇÃO
- Aplicar crédito
- ✅ **ESPERADO:**dois itens com crédito aplicado

### Passo 6 — Finalizar checkout
- Clicar "Finalizar" / "Fechar Comanda"
- ✅ **ESPERADO:** Checkout completa sem erro
- ✅ **ESPERADO:** Comanda fica com status `paid`

### Passo 7 — Verificar消耗o de créditos
- Voltar ao catálogo de clientes
- Abrir perfil de HUGO CORRIDA → seção Clube do Chefe
- ✅ **ESPERADO:** CORTE disponível caiu de 4 para 3
- ✅ **ESPERADO:** HIDRATAÇÃO disponível caiu de 1 para 0
- ✅ **ESPERADO:** Total de crédritos restantes: 3 (era 5)

### Passo 8 — Verificar comanda fechada
- Na lista de comandas, verificar que a comanda de HUGO:
- ✅ **ESPERADO:** Status `paid`
- ✅ **ESPERADO:** `membership_credit_effect: true`
- ✅ **ESPERADO:** `payment_method: "Club dos Chefes"` (ou misto se total > 0)

---

## 4. Cenários alternativos (opcionais)

### 4a. Crédito insuficiente
- Criar comanda para HUGO CORRIDA
- Adicionar CORTE SIMPLES 5 vezes (só tem 4 créditos)
- ✅ **ESPERADO:** 5º item sem opção de crédito ou toast "Sem créditos suficientes"

### 4b. Serviço sem crédito
- Criar comanda para HUGO CORRIDA
- Adicionar serviço que NÃO está no plano (ex: algum serviço não listado)
- ✅ **ESPERADO:** Sem modal de crédito para esse serviço

### 4c. Total zero (todos itens com crédito)
- Criar comanda APENAS com 1 CORTE SIMPLES (usando crédito)
- Total = R$0,00
- Finalizar
- ✅ **ESPERADO:** Fecha como `paid` com `payment_method: "Club dos Chefes"`

---

## 5. Checklist de aprovação

| Item | Status |
|------|--------|
| Banner do Clube aparece para cliente com assinatura ativa | ⬜ |
| Modal de crédito aparece ao adicionar serviço elegível | ⬜ |
| Crédito aplicado reduz preço para R$0,00 | ⬜ |
| Checkout completa sem erro | ⬜ |
| Comanda fica com status `paid` | ⬜ |
| Créditos consumidos no perfil do cliente | ⬜ |
| `membership_credit_effect: true` na comanda | ⬜ |
| Idempotência: segundo fechamento sem efeito | ⬜ |

---

## 6. Aprovação

- [ ] PO executou teste positivo
- [ ] Todos os itens do checklist aprovados
- [ ] Preview liberado para produção
- [ ] B3 desbloqueado para next phase
