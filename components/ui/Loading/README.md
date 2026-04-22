# Sistema de Loading - SOU MANA.GER

## Visão Geral

Sistema unificado de indicadores de loading com 3 níveis de granularidade e contexto global para operações assíncronas.

---

## Componentes

### 1. **LoadingSpinner**

Spinner básico reutilizável para qualquer situação.

```tsx
import { LoadingSpinner } from '@/components/ui/Loading';

// Uso básico
<LoadingSpinner />

// Com tamanho personalizado
<LoadingSpinner size="lg" />

// Com cor personalizada
<LoadingSpinner color="amber" />

// Com label
<LoadingSpinner showLabel label="Buscando dados..." />
```

**Props:**
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Tamanho do spinner (padrão: 'md')
- `color?: 'primary' | 'white' | 'amber' | 'emerald' | 'red'` - Cor (padrão: 'primary')
- `className?: string` - Classes CSS adicionais
- `showLabel?: boolean` - Mostrar label (padrão: false)
- `label?: string` - Texto do label

---

### 2. **LoadingOverlay**

Overlay de tela cheia com backdrop semi-transparente.

```tsx
import { LoadingOverlay } from '@/components/ui/Loading';

// Uso básico
<LoadingOverlay message="Carregando..." />

// Sem backdrop
<LoadingOverlay message="Processando..." showBackdrop={false} />

// Customizando spinner
<LoadingOverlay 
  message="Sincronizando dados..." 
  spinnerProps={{ size: 'xl', color: 'emerald' }}
/>
```

**Props:**
- `message?: string` - Mensagem abaixo do spinner (padrão: 'Carregando...')
- `showBackdrop?: boolean` - Mostrar backdrop (padrão: true)
- `spinnerProps?: Partial<LoadingSpinnerProps>` - Props do spinner
- `className?: string` - Classes CSS adicionais
- `minHeight?: string` - Altura mínima (padrão: 'min-h-screen')

---

### 3. **LoadingBlock**

Bloqueia uma área específica com overlay enquanto carrega.

```tsx
import { LoadingBlock } from '@/components/ui/Loading';

// Uso básico
<LoadingBlock loading={isLoading} message="Carregando tabela...">
  <TableComponent data={data} />
</LoadingBlock>

// Com altura mínima customizada
<LoadingBlock 
  loading={isFetching} 
  minHeight="min-h-[400px]"
  message="Buscando clientes..."
>
  <ClientList clients={clients} />
</LoadingBlock>

// Tela cheia
<LoadingBlock loading={isProcessing} fullHeight message="Processando...">
  <DashboardContent />
</LoadingBlock>
```

**Props:**
- `loading: boolean` - Controla estado de loading (obrigatório)
- `children: React.ReactNode` - Conteúdo a ser envolvido (obrigatório)
- `message?: string` - Mensagem do overlay
- `minHeight?: string` - Altura mínima (padrão: 'min-h-[200px]')
- `overlayClassName?: string` - Classes CSS do overlay
- `spinnerProps?: Partial<LoadingSpinnerProps>` - Props do spinner
- `fullHeight?: boolean` - Ocupar tela cheia (padrão: false)

---

## Contexto Global

### **LoadingContext**

Gerencia operações assíncronas em todo o aplicativo com fila de operações.

```tsx
import { useLoading } from '@/context/LoadingContext';

function MyComponent() {
  const { showLoading, hideLoading, hideAll, isLoading, message } = useLoading();

  const handleSave = async () => {
    showLoading('SAVE'); // Usa mensagem pré-definida
    try {
      await saveData();
    } finally {
      hideLoading();
    }
  };

  const handleComplexOperation = async () => {
    showLoading('Sincronizando dados...', 5000); // Auto-hide em 5s
    await syncData();
    // Loading some automaticamente após 5 segundos
  };

  return <div>...</div>;
}
```

**Métodos:**
- `showLoading(message, duration?)` - Mostra loading (duration em ms para auto-hide)
- `hideLoading()` - Remove último loading da fila
- `hideAll()` - Remove todos os loadings da fila

**Estado:**
- `isLoading: boolean` - Se há loading ativo
- `message: string | null` - Mensagem atual
- `queue: Array<{id, message}>` - Fila de operações

---

## Mensagens Pré-definidas

```ts
import { LOADING_MESSAGES, getLoadingMessage } from '@/lib/loadingMessages';

// Chaves disponíveis
LOADING_MESSAGES.AUTH          // 'Verificando credenciais...'
LOADING_MESSAGES.TENANT        // 'Carregando dados da empresa...'
LOADING_MESSAGES.SCHEDULE      // 'Atualizando agenda...'
LOADING_MESSAGES.FINANCIAL     // 'Processando dados financeiros...'
LOADING_MESSAGES.SAVE          // 'Salvando alterações...'
LOADING_MESSAGES.DELETE        // 'Removendo registro...'
LOADING_MESSAGES.FETCH         // 'Buscando informações...'
LOADING_MESSAGES.SYNC          // 'Sincronizando dados...'
LOADING_MESSAGES.PAYMENT       // 'Processando pagamento...'
LOADING_MESSAGES.CLIENTS       // 'Carregando clientes...'
LOADING_MESSAGES.SERVICES      // 'Carregando serviços...'
LOADING_MESSAGES.PRODUCTS      // 'Carregando produtos...'
LOADING_MESSAGES.REPORTS       // 'Gerando relatório...'
LOADING_MESSAGES.EXPORT        // 'Exportando dados...'
LOADING_MESSAGES.IMPORT        // 'Importando dados...'
LOADING_MESSAGES.SEND          // 'Enviando informações...'
LOADING_MESSAGES.CALCULATE     // 'Calculando valores...'
LOADING_MESSAGES.GENERATE      // 'Gerando informações...'
LOADING_MESSAGES.UPDATE        // 'Atualizando informações...'
LOADING_MESSAGES.CREATE        // 'Criando registro...'
LOADING_MESSAGES.PROCESS       // 'Processando informações...'
```

---

## Exemplos de Uso

### 1. **Login Page**

```tsx
const Login: React.FC = () => {
  const { showLoading, hideLoading } = useLoading();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (credentials) => {
    setLoading(true);
    showLoading('AUTH');
    try {
      await signIn(credentials);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      hideLoading();
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <Button type="submit" isLoading={loading}>
        Entrar
      </Button>
    </form>
  );
};
```

### 2. **Data Table com Loading**

```tsx
const ClientsTable: React.FC = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await fetchClients();
      setClients(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoadingBlock loading={loading} message="Carregando clientes...">
      <Table>
        <TableBody>
          {clients.map(client => (
            <TableRow key={client.id}>
              <TableCell>{client.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </LoadingBlock>
  );
};
```

### 3. **Operação Complexa com Múltiplos Steps**

```tsx
const Checkout: React.FC = () => {
  const { showLoading, hideLoading } = useLoading();

  const handleCheckout = async () => {
    showLoading('Criando registro...');
    const order = await createOrder();
    
    showLoading('Processando pagamento...');
    await processPayment(order);
    
    showLoading('Enviando confirmação...');
    await sendConfirmation(order);
    
    hideAll();
    navigate('/success');
  };

  return <Button onClick={handleCheckout}>Finalizar Compra</Button>;
};
```

### 4. **Refresh de Dados**

```tsx
const Dashboard: React.FC = () => {
  const { showLoading, hideLoading } = useLoading();
  const [metrics, setMetrics] = useState(null);

  const refreshData = async () => {
    showLoading('SYNC', 3000); // Auto-hide após 3s
    const data = await fetchMetrics();
    setMetrics(data);
    hideLoading();
  };

  return (
    <div>
      <Button onClick={refreshData}>
        <LoadingSpinner size="sm" color="white" />
        Atualizar
      </Button>
      <MetricsGrid data={metrics} />
    </div>
  );
};
```

---

## Hierarquia no App.tsx

```tsx
<ThemeProvider>
  <LoadingProvider>  ← Contexto global de loading
    <AppProvider>
      <AuthProvider>
        <TenantProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </TenantProvider>
      </AuthProvider>
    </AppProvider>
  </LoadingProvider>
</ThemeProvider>
```

---

## Boas Práticas

### ✅ **Faça**
- Use mensagens específicas e informativas
- Use `LoadingBlock` para seções específicas da página
- Use `showLoading` do contexto para operações rápidas
- Sempre chame `hideLoading()` em blocos `finally`
- Use auto-hide para operações com tempo conhecido

### ❌ **Não Faça**
- Deixe loading ativo indefinidamente sem feedback
- Use múltiplos overlays de tela cheia simultâneos
- Esqueça de chamar `hideLoading()` após operações
- Use mensagens genéricas como "Carregando..." para tudo

---

## Integração com Componentes Existentes

### Button Component

O componente `Button` já possui prop `isLoading`:

```tsx
import Button from '@/components/ui/Button';

<Button isLoading={isSaving} onClick={handleSave}>
  Salvar
</Button>
```

### Pages com Loading Interno

Substitua spinners manuais:

```tsx
// Antes
{loading && (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
)}

// Depois
{loading && <LoadingSpinner />}
// ou
<LoadingBlock loading={loading} message="Carregando...">
  ...
</LoadingBlock>
```

---

## Troubleshooting

### Loading não some após operação
- Verifique se `hideLoading()` está sendo chamado em `finally`
- Confira se não há múltiplos `showLoading()` sem `hideLoading()` correspondentes
- Use `hideAll()` para resetar o estado em caso de erro

### Múltiplos overlays aparecendo
- Use a fila do LoadingContext (showLoading/hideLoading)
- Evite criar overlays manualmente quando possível
- Prefira `LoadingBlock` para seções específicas

### Loading travado
- Chame `hideAll()` no mount do componente
- Implemente timeouts de segurança
- Use duration no showLoading para auto-hide

---

## Arquivos

```
components/ui/Loading/
  ├── LoadingSpinner.tsx      - Spinner básico
  ├── LoadingOverlay.tsx      - Overlay de tela cheia
  ├── LoadingBlock.tsx        - Bloqueio de área
  └── index.ts                - Barrel export

context/
  └── LoadingContext.tsx      - Contexto global

lib/
  └── loadingMessages.ts      - Mensagens pré-definidas
```

---

## Próximos Passos

1. ✅ Componentes criados e integrados no App.tsx
2. ✅ LoadingContext configurado
3. ✅ Mensagens pré-definidas criadas
4. 🔄 Atualizar páginas existentes para usar novo sistema
5. 🔄 Adicionar loading em operações assíncronas críticas
6. 🔄 Refatorar spinners manuais para componentes

---

## Suporte

Para dúvidas ou sugestões, consulte a documentação ou a equipe de desenvolvimento.
