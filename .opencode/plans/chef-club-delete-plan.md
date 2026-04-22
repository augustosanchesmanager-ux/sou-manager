# Plano: Excluir Planos no Clube dos Chefes

## Implementação Realizada

### 1. Adicionar função `handleDelete`

**Local:** `pages/ChefClubPlans.tsx` (após a função `toggleStatus`, linha ~295)

```typescript
const handleDelete = async (plan: Plan) => {
    if (!confirm(`Tem certeza que deseja excluir o plano "${plan.name}"? Esta ação não pode ser desfeita.`)) return;
    if (!tenantId) return;

    const { error } = await barberSupabase
        .from('customer_plans')
        .delete()
        .eq('id', plan.id)
        .eq('tenant_id', tenantId);

    if (error) {
        setToast({ message: `Erro ao excluir plano: ${error.message}`, type: 'error' });
    } else {
        setToast({ message: 'Plano excluído com sucesso.', type: 'info' });
        setPlans((current) => current.filter((p) => p.id !== plan.id));
    }
};
```

### 2. Adicionar botão de excluir no card do plano

**Local:** `pages/ChefClubPlans.tsx` (dentro do div com className="flex gap-1", linha ~330-337)

**Código atual:**
```tsx
<div className="flex gap-1">
    <button onClick={() => handleEdit(plan)} className="p-2 text-slate-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-lg">edit</span>
    </button>
    <button onClick={() => toggleStatus(plan)} className={`p-2 transition-colors ${plan.active ? 'text-red-400 hover:text-red-600' : 'text-emerald-400 hover:text-emerald-600'}`}>
        <span className="material-symbols-outlined text-lg">{plan.active ? 'visibility_off' : 'visibility'}</span>
    </button>
</div>
```

**Código atualizado:**
```tsx
<div className="flex gap-1">
    <button onClick={() => handleEdit(plan)} className="p-2 text-slate-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-lg">edit</span>
    </button>
    <button onClick={() => toggleStatus(plan)} className={`p-2 transition-colors ${plan.active ? 'text-red-400 hover:text-red-600' : 'text-emerald-400 hover:text-emerald-600'}`}>
        <span className="material-symbols-outlined text-lg">{plan.active ? 'visibility_off' : 'visibility'}</span>
    </button>
    <button onClick={() => handleDelete(plan)} className="p-2 text-rose-500 hover:text-rose-600 transition-colors" title="Excluir plano">
        <span className="material-symbols-outlined text-lg">delete</span>
    </button>
</div>
```

## Resumo das Mudanças

1. **Nova função `handleDelete`**: 
   - Confirmação nativa do browser antes de excluir
   - Delete no Supabase com filtro por `id` e `tenant_id` (segurança multi-tenant)
   - Feedback visual via Toast (sucesso/erro)
   - Atualização otimista do estado removendo o plano da lista

2. **Novo botão na UI**:
   - Ícone `delete` do Material Symbols
   - Cor vermelha (rose-500) para indicar ação destrutiva
   - Tooltip "Excluir plano"
   - Mesma altura e alinhamento dos botões existentes

## Padrão de Segurança

- ✅ Filtro `tenant_id` para garantir isolamento multi-tenant
- ✅ Confirmação do usuário antes de excluir
- ✅ Feedback claro de sucesso/erro
- ✅ Atualização de estado sem necessidade de reload

## Melhorias Futuras (Opcional)

- Verificar se o plano tem assinaturas ativas antes de permitir exclusão
- Adicionar modal de confirmação customizado ao invés de `confirm()` nativo
- Soft delete (apenas desativar) ao invés de exclusão permanente
