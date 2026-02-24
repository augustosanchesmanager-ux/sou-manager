# Banco de Dados: SOU MANA.GER

O banco de dados é hospedado no **Supabase** (PostgreSQL), utilizando uma estrutura relacional otimizada para multitenancy (multi-inquilinato).

## Entidades Principais

### Clientes (`clients`)

Armazena informações cadastrais dos clientes.

- `id`: Identificador único.
- `tenant_id`: Referência à barbearia/unidade proprietária do dado.
- `name`, `email`, `phone`: Dados de contato.
- `birthday`: Data de nascimento para lembretes e promoções.

### Agendamentos (`appointments`)

Gerencia a reserva de horários.

- `time`: Data e hora do serviço.
- `client_id`: Referência ao cliente.
- `professional_id`: Referência ao profissional que realizará o serviço.
- `status`: `pending`, `confirmed`, `completed`.

### Transações e Financeiro (`transactions`, `expenses`)

- **Receitas**: Vinculadas a comandas e agendamentos finalizados.
- **Despesas**: Lançamentos manuais de custos operacionais.
- Suporte a múltiplos métodos de pagamento (Dinheiro, PIX, Cartão).

### Produtos e Serviços (`products`, `services`)

- Cadastro de itens para venda direta e serviços executados.
- Controle de estoque para produtos.

## Multi-inquilinato (Multitenancy)

O sistema utiliza isolamento lógico via `tenant_id`. Cada loja ou barbearia possui um identificador único, garantindo que os dados de uma unidade não sejam acessíveis por outra. As políticas de segurança (RLS - Row Level Security) do Supabase garantem esse isolamento a nível de banco de dados.

## Tipos de Dados (TypeScript)

As principais interfaces e enums estão documentadas no arquivo [`types.ts`](../types.ts).

```typescript
export interface Client {
  id: string;
  name: string;
  // ...
}

export enum UserRole {
  ADMIN = 'Super Admin',
  MANAGER = 'Gerente',
  BARBER = 'Barbeiro',
  RECEPTIONIST = 'Recepcionista'
}
```
