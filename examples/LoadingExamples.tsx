/**
 * EXEMPLOS DE USO DO SISTEMA DE LOADING
 * 
 * Este arquivo demonstra como usar os componentes de loading em diferentes cenários.
 * Nao incluir no build - apenas para referencia.
 */

import React, { useState, useEffect } from 'react';
import { LoadingSpinner, LoadingOverlay, LoadingBlock } from './components/ui/Loading';
import { useLoading } from './context/LoadingContext';
import { LOADING_MESSAGES } from './lib/loadingMessages';
import Button from './components/ui/Button';

// ============================================================================
// EXEMPLO 1: LoadingSpinner Básico
// ============================================================================

const SpinnerExamples: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">LoadingSpinner Examples</h2>

      {/* Tamanhos */}
      <div className="flex gap-4 items-center">
        <LoadingSpinner size="sm" />
        <LoadingSpinner size="md" />
        <LoadingSpinner size="lg" />
        <LoadingSpinner size="xl" />
      </div>

      {/* Cores */}
      <div className="flex gap-4 items-center">
        <LoadingSpinner color="primary" />
        <LoadingSpinner color="white" className="bg-slate-800 p-2 rounded" />
        <LoadingSpinner color="amber" />
        <LoadingSpinner color="emerald" />
        <LoadingSpinner color="red" />
      </div>

      {/* Com label */}
      <div className="space-y-4">
        <LoadingSpinner showLabel label="Carregando..." />
        <LoadingSpinner size="lg" showLabel label="Processando dados..." />
        <LoadingSpinner 
          size="xl" 
          color="emerald" 
          showLabel 
          label={LOADING_MESSAGES.SYNC} 
        />
      </div>
    </div>
  );
};

// ============================================================================
// EXEMPLO 2: LoadingOverlay (Tela Cheia)
// ============================================================================

const OverlayExamples: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">LoadingOverlay Examples</h2>

      {/* Básico */}
      <LoadingOverlay message="Carregando sistema..." />

      {/* Sem backdrop */}
      <LoadingOverlay 
        message="Processando..." 
        showBackdrop={false} 
      />

      {/* Customizado */}
      <LoadingOverlay 
        message="Sincronizando dados..."
        spinnerProps={{ size: 'xl', color: 'emerald', showLabel: true }}
        minHeight="min-h-[400px]"
      />
    </div>
  );
};

// ============================================================================
// EXEMPLO 3: LoadingBlock (Área Específica)
// ============================================================================

const BlockExamples: React.FC = () => {
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">LoadingBlock Examples</h2>

      {/* Card com loading */}
      <LoadingBlock 
        loading={loading1} 
        message="Carregando dados..."
        minHeight="min-h-[300px]"
      >
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Conteúdo do Card</h3>
          <p>Este conteúdo fica visível quando loading=false</p>
          <Button 
            onClick={() => setLoading1(!loading1)}
            className="mt-4"
          >
            Toggle Loading
          </Button>
        </div>
      </LoadingBlock>

      {/* Tabela com loading */}
      <LoadingBlock 
        loading={loading2} 
        message="Buscando clientes..."
        spinnerProps={{ size: 'lg', color: 'amber' }}
      >
        <div className="bg-white dark:bg-surface-dark rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Lista de Clientes</h3>
          <ul>
            <li>Cliente 1</li>
            <li>Cliente 2</li>
            <li>Cliente 3</li>
          </ul>
          <Button 
            onClick={() => setLoading2(!loading2)}
            variant="secondary"
            className="mt-4"
          >
            Toggle Loading
          </Button>
        </div>
      </LoadingBlock>

      {/* Full height */}
      <LoadingBlock 
        loading={loading1 && loading2} 
        message="Processando tudo..."
        fullHeight
      >
        <div>Conteúdo que ocupa tela cheia quando loading</div>
      </LoadingBlock>
    </div>
  );
};

// ============================================================================
// EXEMPLO 4: LoadingContext (Global)
// ============================================================================

const ContextExamples: React.FC = () => {
  const { showLoading, hideLoading, hideAll, isLoading, message } = useLoading();

  // Operação simples
  const handleSave = async () => {
    showLoading(LOADING_MESSAGES.SAVE);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Simula operação de save
      console.log('Dados salvos!');
    } catch (error) {
      console.error(error);
    } finally {
      hideLoading();
    }
  };

  // Operação com auto-hide
  const handleSync = async () => {
    showLoading(LOADING_MESSAGES.SYNC, 3000); // Auto-hide após 3s
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Dados sincronizados!');
    hideLoading();
  };

  // Múltiplas operações em sequência
  const handleComplexOperation = async () => {
    showLoading(LOADING_MESSAGES.CREATE);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showLoading(LOADING_MESSAGES.PROCESS);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    showLoading(LOADING_MESSAGES.SEND);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    hideAll();
    console.log('Operação completa!');
  };

  // Reset de emergência
  const handleReset = () => {
    hideAll();
    console.log('Todos os loadings foram removidos!');
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">LoadingContext Examples</h2>
      
      {isLoading && (
        <div className="bg-primary/10 text-primary p-4 rounded-lg">
          <p className="font-bold">Loading Ativo:</p>
          <p>{message}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <Button onClick={handleSave}>
          Salvar (2s)
        </Button>

        <Button onClick={handleSync} variant="secondary">
          Sincronizar (Auto 3s)
        </Button>

        <Button onClick={handleComplexOperation} variant="success">
          Operação Complexa
        </Button>

        <Button onClick={handleReset} variant="danger">
          Resetar Loading
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// EXEMPLO 5: Integração com Fetch de Dados
// ============================================================================

const DataFetchingExample: React.FC = () => {
  const { showLoading, hideLoading } = useLoading();
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    showLoading(LOADING_MESSAGES.FETCH);
    
    try {
      // Simula fetch de dados
      await new Promise(resolve => setTimeout(resolve, 2000));
      setData(['Item 1', 'Item 2', 'Item 3']);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
      hideLoading();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <LoadingBlock 
      loading={loading} 
      message={LOADING_MESSAGES.CLIENTS}
      minHeight="min-h-[200px]"
    >
      <div className="bg-white dark:bg-surface-dark rounded-lg p-6">
        <h3 className="text-lg font-bold mb-4">Lista de Itens</h3>
        <ul className="space-y-2">
          {data.map((item, index) => (
            <li key={index} className="p-2 bg-slate-100 dark:bg-slate-800 rounded">
              {item}
            </li>
          ))}
        </ul>
        <Button 
          onClick={fetchData} 
          variant="secondary"
          className="mt-4"
        >
          Atualizar
        </Button>
      </div>
    </LoadingBlock>
  );
};

// ============================================================================
// EXEMPLO 6: Formulário com Save
// ============================================================================

const FormExample: React.FC = () => {
  const { showLoading, hideLoading } = useLoading();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    showLoading(LOADING_MESSAGES.CREATE);
    
    try {
      // Simula save
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Formulário salvo:', formData);
      setFormData({ name: '', email: '' });
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
      hideLoading();
    }
  };

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg p-6 max-w-md">
      <h3 className="text-lg font-bold mb-4">Formulário de Cadastro</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            required
          />
        </div>

        <Button 
          type="submit" 
          isLoading={saving}
          className="w-full"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </form>
    </div>
  );
};

// ============================================================================
// EXEMPLO 7: Dashboard com Múltiplos Widgets
// ============================================================================

const DashboardExample: React.FC = () => {
  const { showLoading, hideLoading } = useLoading();
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [metrics, setMetrics] = useState({ revenue: 0, clients: 0 });

  const loadMetrics = async () => {
    setMetricsLoading(true);
    showLoading(LOADING_MESSAGES.CALCULATE);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setMetrics({ revenue: 15000, clients: 120 });
    } finally {
      setMetricsLoading(false);
      hideLoading();
    }
  };

  const loadChart = async () => {
    setChartLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Simula carregamento de gráfico
    } finally {
      setChartLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">Dashboard Example</h2>

      {/* Métricas */}
      <LoadingBlock 
        loading={metricsLoading} 
        message={LOADING_MESSAGES.CALCULATE}
        minHeight="min-h-[150px]"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-surface-dark p-6 rounded-lg">
            <p className="text-sm text-slate-500">Receita</p>
            <p className="text-2xl font-bold text-emerald-500">
              R$ {metrics.revenue.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-surface-dark p-6 rounded-lg">
            <p className="text-sm text-slate-500">Clientes</p>
            <p className="text-2xl font-bold text-primary">{metrics.clients}</p>
          </div>
        </div>
      </LoadingBlock>

      {/* Gráfico */}
      <LoadingBlock 
        loading={chartLoading} 
        message={LOADING_MESSAGES.GENERATE}
        minHeight="min-h-[300px]"
        spinnerProps={{ size: 'lg', color: 'amber' }}
      >
        <div className="bg-white dark:bg-surface-dark p-6 rounded-lg">
          <p className="text-slate-500">Área do Gráfico</p>
        </div>
      </LoadingBlock>

      {/* Controles */}
      <div className="flex gap-4">
        <Button onClick={loadMetrics}>
          Carregar Métricas
        </Button>
        <Button onClick={loadChart} variant="secondary">
          Carregar Gráfico
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// EXEMPLO 8: Upload de Arquivos
// ============================================================================

const UploadExample: React.FC = () => {
  const { showLoading, hideLoading } = useLoading();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async () => {
    setUploading(true);
    showLoading(LOADING_MESSAGES.UPLOAD || 'Fazendo upload...');
    
    try {
      // Simula upload com progresso
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      console.log('Upload completo!');
    } finally {
      setUploading(false);
      setProgress(0);
      hideLoading();
    }
  };

  return (
    <div className="bg-white dark:bg-surface-dark rounded-lg p-6 max-w-md">
      <h3 className="text-lg font-bold mb-4">Upload de Arquivo</h3>
      
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
        <p className="text-slate-500 mb-4">Arraste um arquivo ou clique para selecionar</p>
        
        {uploading && (
          <div className="space-y-2">
            <LoadingSpinner size="sm" className="mx-auto" />
            <p className="text-sm text-slate-600">Enviando: {progress}%</p>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <Button 
          onClick={handleUpload} 
          isLoading={uploading}
          className="mt-4"
        >
          {uploading ? 'Enviando...' : 'Enviar Arquivo'}
        </Button>
      </div>
    </div>
  );
};

export {
  SpinnerExamples,
  OverlayExamples,
  BlockExamples,
  ContextExamples,
  DataFetchingExample,
  FormExample,
  DashboardExample,
  UploadExample,
};
