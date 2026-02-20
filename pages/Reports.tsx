import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';

const revenueData = [
    { name: 'Sem 1', valor: 4000 },
    { name: 'Sem 2', valor: 3000 },
    { name: 'Sem 3', valor: 5500 },
    { name: 'Sem 4', valor: 4800 },
];

const categoryData = [
    { name: 'Cortes', value: 4500 },
    { name: 'Barba', value: 2300 },
    { name: 'Produtos', value: 1200 },
    { name: 'Outros', value: 500 },
];

const COLORS = ['#3c83f6', '#10b981', '#f59e0b', '#8b5cf6'];

const Reports: React.FC = () => {
    const { theme } = useTheme();

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-amber-400">lock</span>
                            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Área Restrita</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Relatórios Gerenciais</h2>
                        <p className="text-slate-300 mt-1 max-w-xl">Análises profundas de performance, retenção e lucratividade para tomada de decisão estratégica.</p>
                    </div>
                    <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg hover:bg-slate-100 transition-colors">
                        <span className="material-symbols-outlined">download</span>
                        Exportar PDF Completo
                    </button>
                </div>
            </div>

            {/* Strategic KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Custo de Aquisição (CAC)</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ 12,50</h3>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded mb-1">-5%</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Custo médio para atrair um novo cliente.</p>
                </div>
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Lifetime Value (LTV)</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ 1.850</h3>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded mb-1">+8%</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Valor médio gerado por cliente durante a vida útil.</p>
                </div>
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Taxa de Retenção</p>
                    <div className="flex items-end gap-2">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white">78%</h3>
                        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded mb-1">Estável</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Clientes que retornaram nos últimos 90 dias.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Evolution */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-900 dark:text-white">Evolução de Faturamento</h3>
                        <select className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold px-2 py-1 text-slate-700 dark:text-slate-300 outline-none [color-scheme:light] dark:[color-scheme:dark]">
                            <option className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Último Mês</option>
                            <option className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Último Trimestre</option>
                            <option className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Este Ano</option>
                        </select>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3c83f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3c83f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#e2e8f0'} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
                                        borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Area type="monotone" dataKey="valor" stroke="#3c83f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue by Category */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-6">Faturamento por Categoria</h3>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="size-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
                                            borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
                                            borderRadius: '8px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-4">
                            {categoryData.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                                        <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{entry.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">R$ {entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Staff Table */}
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark">
                    <h3 className="font-bold text-slate-900 dark:text-white">Performance da Equipe</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Profissional</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Faturamento</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ticket Médio</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Comissão</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">NPS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">Enzo Gabriel</td>
                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ 8.420</td>
                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ 85,00</td>
                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ 3.368</td>
                                <td className="px-6 py-4"><span className="text-emerald-500 font-bold">98</span></td>
                            </tr>
                            <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">Lucas Ferreira</td>
                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ 7.150</td>
                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ 78,00</td>
                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">R$ 2.860</td>
                                <td className="px-6 py-4"><span className="text-emerald-500 font-bold">95</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Reports;