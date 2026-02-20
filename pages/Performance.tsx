import React from 'react';
import { useNavigate } from 'react-router-dom';

const Performance: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Performance da Unidade</h2>
                <div className="flex bg-slate-100 dark:bg-surface-dark p-1 rounded-lg">
                    <button className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-md shadow-sm transition-colors">Mês Atual</button>
                    <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">30 dias</button>
                    <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">90 dias</button>
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
                        <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">+12.5% <span className="material-symbols-outlined text-xs">trending_up</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Faturamento Mensal</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">R$ 24.890,00</h3>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <span className="material-symbols-outlined">confirmation_number</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">+3.2% <span className="material-symbols-outlined text-xs">trending_up</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Ticket Médio</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">R$ 82,40</h3>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <span className="material-symbols-outlined">calendar_today</span>
                        </div>
                        <span className="text-xs font-bold text-red-500 flex items-center gap-1">-1.5% <span className="material-symbols-outlined text-xs">trending_down</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Agendamentos</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">412</h3>
                </div>
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                            <span className="material-symbols-outlined">loop</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">+5.0% <span className="material-symbols-outlined text-xs">trending_up</span></span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium mb-1">Taxa de Retenção</p>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">76%</h3>
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
                            <path d="M0,150 Q100,120 200,140 T400,80 T600,100 T800,40 V200 H0 Z" fill="url(#chartGradient)"></path>
                            <path d="M0,150 Q100,120 200,140 T400,80 T600,100 T800,40" fill="none" stroke="#3c83f6" strokeLinecap="round" strokeWidth="3"></path>
                            {/* Tooltip Points */}
                            <circle cx="400" cy="80" fill="#3c83f6" r="5"></circle>
                            <circle cx="800" cy="40" fill="#3c83f6" r="5"></circle>
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
                        {/* Barbeiro 01 */}
                        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/team')}>
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-primary/40">
                                    <img className="w-full h-full object-cover" alt="Enzo" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjANlSFyk7FpYF5oxUkP3aMB7Fk5TuhgR7uFtKehGOh4X-t_Yop58zuJQ5Jz53-sFIHZOwPm666L8yTAUGW1OBWujCo9Kb2SWLoa_o9ibZXZXY3FKkz4w1FO-iVmNG_7-5NMcv6YQovi0MPS2p5MrMcxwYiMpIa4Uw7ixYl8eeISetvSMsCwwH6Pt8OWo7Ig_T06aWSiYVvszq_9tSWp3ogPLnzv2vqgYvfg307YsAiGWCmEjIg6OSNeRjn_-KvqCkoMxj62sf_Kg" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white dark:border-surface-dark">1</div>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold leading-none mb-1 group-hover:text-primary transition-colors text-slate-900 dark:text-white">Enzo Gabriel</h4>
                                <div className="flex items-center gap-2">
                                    <div className="flex text-yellow-500 scale-75 -ml-2">
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">4.9</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold leading-none mb-1 text-slate-900 dark:text-white">R$ 8.420</p>
                                <p className="text-[10px] font-medium text-emerald-500">Meta 105%</p>
                            </div>
                        </div>
                        {/* Barbeiro 02 */}
                        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/team')}>
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-transparent">
                                    <img className="w-full h-full object-cover" alt="Lucas" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMwltTlJwaqdz2pMmqLmJsJWwiYJA6LtwX9xruyDgFs7m_qUPIJ9hSjdJg8ck1Zd9B0KUZtWUo5nBA7XsKXuAqa7LznkOQmd7nYD3aeptAozUJ7z94pH7f2p7U4QGcjTy702EW4XfxLvLybr_aa1Lb17bYxjbsmj3sps3bFq2_L764YA1meVZxL9TCehzkPgc6_uEhMDC2XsJkx8-HvjHDaZ_qGFxsRmUiUDsfJWe4elq5MxcmetGyxjD3zpRCfTkk6PSV7_241YE" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-400 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white dark:border-surface-dark">2</div>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold leading-none mb-1 group-hover:text-primary transition-colors text-slate-900 dark:text-white">Lucas Ferreira</h4>
                                <div className="flex items-center gap-2">
                                    <div className="flex text-yellow-500 scale-75 -ml-2">
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star_half</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">4.7</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold leading-none mb-1 text-slate-900 dark:text-white">R$ 7.150</p>
                                <p className="text-[10px] font-medium text-emerald-500">Meta 92%</p>
                            </div>
                        </div>
                        {/* Barbeiro 03 */}
                        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/team')}>
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-transparent">
                                    <img className="w-full h-full object-cover" alt="Andre" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDzWpFV3pJlS17x9o0_z_slQUINLPOT7k6S2z4u0nJOSPfkU0KwUBRrUrGjST1XYSCKDz7d8DGymO3WSG6i3x-eu0R5QKH3syQgiaRVN-WvzZYlVPtcG84eUk5Hg-u-illziKYpembrO04NbpfEPVgV9CnDAqQAdftZBunlwGGtjt_vlpSsuAEZuno0PIe0rCefx_f0CwkWwsMlO7sEsXkmjb9Wv3u2m5MOGNfom3pVNpy3EX8DkQsDKt4_AaZg8cr5Uzib2gbNB9U" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-700 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white dark:border-surface-dark">3</div>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold leading-none mb-1 group-hover:text-primary transition-colors text-slate-900 dark:text-white">André Costa</h4>
                                <div className="flex items-center gap-2">
                                    <div className="flex text-yellow-500 scale-75 -ml-2">
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                        <span className="material-symbols-outlined">star</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">5.0</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold leading-none mb-1 text-slate-900 dark:text-white">R$ 6.890</p>
                                <p className="text-[10px] font-medium text-yellow-500">Meta 88%</p>
                            </div>
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
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-sm">home</span>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Aluguel e Condomínio</span>
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">R$ 4.200,00</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-sm">inventory</span>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Insumos (Cabelo/Barba)</span>
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">R$ 1.850,00</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-sm">bolt</span>
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Contas de Consumo (Luz/Água)</span>
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">R$ 940,00</span>
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