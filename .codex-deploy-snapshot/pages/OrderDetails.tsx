import React from 'react';

const OrderDetails: React.FC = () => {
  return (
    <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col gap-8 animate-fade-in">
        {/* Order Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm font-medium tracking-wider uppercase">Pedido de Reposição</span>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
        <span className="size-2 bg-primary rounded-full animate-pulse"></span>
                                    ENVIADO
                                </div>
        </div>
        <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-tight">Pedido #0822</h1>
        <p className="text-slate-500 dark:text-slate-400 text-base flex items-center gap-2">
        <span className="material-symbols-outlined text-lg">factory</span>
                                TechLogistics Brasil
                            </p>
        </div>
        <div className="flex flex-wrap gap-3">
        <button className="flex items-center gap-2 px-5 h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold rounded-lg border border-slate-200 dark:border-border-dark transition-all">
        <span className="material-symbols-outlined">print</span>
        <span>Imprimir Pedido</span>
        </button>
        <button className="flex items-center gap-2 px-5 h-11 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all">
        <span className="material-symbols-outlined">check_circle</span>
        <span>Confirmar Recebimento</span>
        </button>
        </div>
        </div>
        {/* Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Data de Emissão</p>
        <p className="text-slate-900 dark:text-white text-lg font-semibold">15 de Out, 2023</p>
        </div>
        <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Previsão de Entrega</p>
        <p className="text-slate-900 dark:text-white text-lg font-semibold">22 de Out, 2023</p>
        </div>
        <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Método de Envio</p>
        <p className="text-slate-900 dark:text-white text-lg font-semibold">Transportadora ABC</p>
        </div>
        <div className="bg-white dark:bg-surface-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Responsável</p>
        <p className="text-slate-900 dark:text-white text-lg font-semibold">Carlos Oliveira</p>
        </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content: Items Table */}
        <div className="flex-[2] flex flex-col gap-6">
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center">
        <h2 className="text-slate-900 dark:text-white text-xl font-bold">Itens Solicitados</h2>
        <span className="text-slate-500 dark:text-slate-400 text-sm">4 Produtos</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
        <thead>
        <tr className="bg-slate-50 dark:bg-slate-800/50">
        <th className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Produto</th>
        <th className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">SKU</th>
        <th className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Qtd</th>
        <th className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider text-right">Preço Unit.</th>
        <th className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider text-right">Subtotal</th>
        </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
        <div className="flex items-center gap-3">
        <div className="size-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined">devices</span>
        </div>
        <span className="text-slate-900 dark:text-white font-medium">Processador Intel i7 12th Gen</span>
        </div>
        </td>
        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-sm">PR-INT-12700</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white">50</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white text-right">R$ 1.850,00</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white font-bold text-right">R$ 92.500,00</td>
        </tr>
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
        <div className="flex items-center gap-3">
        <div className="size-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined">memory</span>
        </div>
        <span className="text-slate-900 dark:text-white font-medium">Memória RAM 16GB DDR4</span>
        </div>
        </td>
        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-sm">MEM-KNG-16D4</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white">120</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white text-right">R$ 320,00</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white font-bold text-right">R$ 38.400,00</td>
        </tr>
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
        <div className="flex items-center gap-3">
        <div className="size-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined">storage</span>
        </div>
        <span className="text-slate-900 dark:text-white font-medium">SSD NVMe 1TB Samsung</span>
        </div>
        </td>
        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-sm">STO-SAM-1NVME</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white">80</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white text-right">R$ 450,00</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white font-bold text-right">R$ 36.000,00</td>
        </tr>
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-6 py-4">
        <div className="flex items-center gap-3">
        <div className="size-10 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined">developer_board</span>
        </div>
        <span className="text-slate-900 dark:text-white font-medium">Placa Mãe ASUS Prime B660</span>
        </div>
        </td>
        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-sm">MB-ASU-B660P</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white">45</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white text-right">R$ 890,00</td>
        <td className="px-6 py-4 text-slate-900 dark:text-white font-bold text-right">R$ 40.050,00</td>
        </tr>
        </tbody>
        </table>
        </div>
        </div>
        </div>
        {/* Sidebar: Summary & Timeline */}
        <div className="flex-1 flex flex-col gap-8">
        {/* Financial Summary */}
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
        <h2 className="text-slate-900 dark:text-white text-xl font-bold mb-6">Resumo Financeiro</h2>
        <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
        <span>Subtotal dos Itens</span>
        <span className="text-slate-900 dark:text-white font-medium">R$ 206.950,00</span>
        </div>
        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
        <span>Frete e Logística</span>
        <span className="text-slate-900 dark:text-white font-medium">R$ 1.250,00</span>
        </div>
        <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
        <span>Impostos (ICMS/IPI)</span>
        <span className="text-slate-900 dark:text-white font-medium">R$ 18.450,00</span>
        </div>
        <div className="h-px bg-slate-200 dark:bg-border-dark my-2"></div>
        <div className="flex justify-between items-center">
        <span className="text-slate-500 dark:text-slate-200 font-bold text-lg">VALOR TOTAL</span>
        <span className="text-primary font-black text-2xl">R$ 226.650,00</span>
        </div>
        </div>
        </div>
        {/* Order Timeline */}
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
        <h2 className="text-slate-900 dark:text-white text-xl font-bold mb-6">Histórico do Pedido</h2>
        <div className="flex flex-col gap-8 relative">
        {/* Timeline Line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-border-dark"></div>
        {/* Steps */}
        <div className="flex gap-4 relative z-10">
        <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white ring-4 ring-white dark:ring-background-dark">
        <span className="material-symbols-outlined text-sm">check</span>
        </div>
        <div>
        <p className="text-slate-900 dark:text-white font-bold">Pedido Criado</p>
        <p className="text-slate-500 dark:text-slate-400 text-xs">15/10/2023 - 09:45</p>
        <p className="text-slate-600 dark:text-slate-500 text-sm mt-1">Criado automaticamente pelo sistema de baixo estoque.</p>
        </div>
        </div>
        <div className="flex gap-4 relative z-10">
        <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white ring-4 ring-white dark:ring-background-dark">
        <span className="material-symbols-outlined text-sm">check</span>
        </div>
        <div>
        <p className="text-slate-900 dark:text-white font-bold">Aprovado pelo Gestor</p>
        <p className="text-slate-500 dark:text-slate-400 text-xs">15/10/2023 - 14:20</p>
        <p className="text-slate-600 dark:text-slate-500 text-sm mt-1">Aprovado por: Maria Souza (Diretoria Operacional).</p>
        </div>
        </div>
        <div className="flex gap-4 relative z-10">
        <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white ring-4 ring-white dark:ring-background-dark">
        <span className="material-symbols-outlined text-sm">local_shipping</span>
        </div>
        <div>
        <p className="text-slate-900 dark:text-white font-bold">Enviado pelo Fornecedor</p>
        <p className="text-slate-500 dark:text-slate-400 text-xs">17/10/2023 - 11:30</p>
        <p className="text-slate-600 dark:text-slate-500 text-sm mt-1">Nota Fiscal #5542 emitida. Mercadoria em trânsito.</p>
        </div>
        </div>
        <div className="flex gap-4 relative z-10 opacity-50">
        <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 ring-4 ring-white dark:ring-background-dark">
        <span className="material-symbols-outlined text-sm">inventory_2</span>
        </div>
        <div>
        <p className="text-slate-400 dark:text-slate-300 font-bold">Aguardando Recebimento</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs">Previsão: 22/10/2023</p>
        </div>
        </div>
        </div>
        </div>
        </div>
        </div>
    </div>
  );
};

export default OrderDetails;