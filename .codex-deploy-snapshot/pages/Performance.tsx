import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Performance: React.FC = () => {
    const navigate = useNavigate();
    const [timeframe, setTimeframe] = useState<'mes' | '30d' | '90d'>('mes');

    return (
        <div className="space-y-8 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Performance da Unidade</h2>
                <div className="flex bg-slate-100 dark:bg-surface-dark p-1 rounded-lg">
                    <button onClick={() => setTimeframe('mes')} className={`px-3 py-1 text-xs font-medium rounded-md shadow-sm transition-colors ${timeframe === 'mes' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Mês Atual</button>
                    <button onClick={() => setTimeframe('30d')} className={`px-3 py-1 text-xs font-medium rounded-md shadow-sm transition-colors ${timeframe === '30d' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>30 dias</button>
                    <button onClick={() => setTimeframe('90d')} className={`px-3 py-1 text-xs font-medium rounded-md shadow-sm transition-colors ${timeframe === '90d' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>90 dias</button>
                </div>
            </div>

            {/* Quick Actions Banner */}
            <div className="flex items-center justify-between bg-primary/5 border border-primary/10 p-4 rounded-xl">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">bolt</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">Ações Rápidas</h4>
                        <p className="text-xs text-slate-500">Agilize a gestão do seu fluxo de trabalho diário.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/financial')} className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-200">
                        <span className="material-symbols-outlined text-sm">add_circle</span> NOVO LANÇAMENTO
                    </button>
                    <button onClick={() => navigate('/team')} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary/90 transition-all">
                        <span className="material-symbols-outlined text-sm">person_add</span> ADICIONAR BARBEIRO
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <span className="material-symbols-outlined">account_balance_wallet</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">0% <span className="material-symbols-outlined text-xs">horizontal_rule</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Faturamento Mensal</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">R$ 0,00</h3>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <span className="material-symbols-outlined">confirmation_number</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">0% <span className="material-symbols-outlined text-xs">horizontal_rule</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Ticket Médio</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">R$ 0,00</h3>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <span className="material-symbols-outlined">calendar_today</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">0% <span className="material-symbols-outlined text-xs">horizontal_rule</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Agendamentos</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">0</h3>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                            <span className="material-symbols-outlined">loop</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">0% <span className="material-symbols-outlined text-xs">horizontal_rule</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Taxa de Retenção</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">0%</h3>
                </div>
            </div>

            {/* Main Charts & Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Faturamento Evolution */}
                <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Evolução de Receita</h3>
                            <p className="text-xs text-slate-500">Comparativo semanal de desempenho financeiro</p>
                        </div>
                        <button onClick={() => navigate('/reports')} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">VER RELATÓRIO COMPLETO <span className="material-symbols-outlined text-sm">arrow_forward</span></button>
                    </div>
                    <div className="flex-1 min-h-[250px] relative">
                        {/* SVG Chart Simulation */}
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 800 200">
                            <defs>
                                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#3c83f6" stopOpacity={0.3}></stop>
                                    <stop offset="100%" stopColor="#3c83f6" stopOpacity={0}></stop>
                                </linearGradient>
                            </defs>
                            <path d="M0,195 L800,195 V200 H0 Z" fill="url(#chartGradient)"></path>
                            <path d="M0,195 L800,195" fill="none" stroke="#3c83f6" strokeLinecap="round" strokeWidth="3"></path>
                            {/* Tooltip Points */}
                            <circle cx="0" cy="195" fill="#3c83f6" r="4"></circle>
                            <circle cx="800" cy="195" fill="#3c83f6" r="4"></circle>
                        </svg>
                        <div className="flex justify-between mt-4 px-2">
                            <span className="text-[10px] font-bold text-slate-500">SEM 01</span>
                            <span className="text-[10px] font-bold text-slate-500">SEM 02</span>
                            <span className="text-[10px] font-bold text-slate-500">SEM 03</span>
                            <span className="text-[10px] font-bold text-slate-500">SEM 04</span>
                        </div>
                    </div>
                </div>

                {/* Top Barbeiros */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Top Barbeiros</h3>
                        <button onClick={() => navigate('/team')} className="text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined">more_vert</span></button>
                    </div>
                    <div className="space-y-5">
                        <div className="py-8 text-center text-slate-500 flex flex-col items-center">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">group_off</span>
                            <p className="text-sm font-medium">Nenhum dado no período</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/team')} className="w-full mt-8 py-3 bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all">
                        VER TODOS OS COLABORADORES
                    </button>
                </div>
            </div>

            {/* Financeiro Rápido & Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Resumo de Despesas</h3>
                        <button onClick={() => navigate('/expenses')} className="text-xs font-bold text-primary">DETALHAR</button>
                    </div>
                    <div className="space-y-4">
                        <div className="py-6 text-center text-slate-500 flex flex-col items-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                            <span className="material-symbols-outlined text-3xl mb-2 opacity-50">receipt_long</span>
                            <p className="text-sm font-medium">Nenhuma despesa registrada</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-center">
                    <div className="text-center space-y-4 py-4">
                        <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="material-symbols-outlined text-3xl">upgrade</span>
                        </div>
                        <h3 className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">Otimize sua Gestão</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                            Você atingiu o limite de 5 barbeiros no plano atual. Faça o upgrade agora e gerencie equipes ilimitadas.
                        </p>
                        <div className="pt-4">
                            <button className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                                DESBLOQUEAR PLANO PRO
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Performance;