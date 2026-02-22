import React from 'react';
import { useNavigate } from 'react-router-dom';

const Operations: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Quick Action Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('/clients')} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-primary/50 cursor-pointer transition-all">
                    <div className="space-y-1">
                        <p className="text-slate-500 text-sm font-medium">Novo Cliente</p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Cadastrar</h3>
                    </div>
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                        <span className="material-symbols-outlined text-2xl">person_add</span>
                    </div>
                </div>
                <div onClick={() => navigate('/schedule')} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-primary/50 cursor-pointer transition-all">
                    <div className="space-y-1">
                        <p className="text-slate-500 text-sm font-medium">Agendamento</p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Novo Horário</h3>
                    </div>
                    <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                        <span className="material-symbols-outlined text-2xl">event_available</span>
                    </div>
                </div>
                <div onClick={() => navigate('/orders')} className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-orange-500/50 cursor-pointer transition-all">
                    <div className="space-y-1">
                        <p className="text-slate-500 text-sm font-medium">Itens em Baixa</p>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">04 Alertas</h3>
                    </div>
                    <div className="size-12 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                        <span className="material-symbols-outlined text-2xl">warning</span>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Timeline: Next Appointments */}
                <section className="xl:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white">Próximos Agendamentos</h3>
                        <button onClick={() => navigate('/schedule')} className="text-primary text-sm font-bold hover:underline">Ver Agenda Completa</button>
                    </div>
                    <div className="space-y-4 relative before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                        {/* Appointment 1 */}
                        <div className="relative pl-12">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 size-10 rounded-full border-4 border-background-light dark:border-background-dark bg-primary flex items-center justify-center z-10 shadow-lg">
                                <span className="text-xs font-bold text-white">14:00</span>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                        <img className="w-full h-full object-cover" alt="João Silva" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqk9Ur7nCo1E6KacU74IhxJLp9mIof2O3sIp34IHPVAWwGBNCaeMeET62crlOOZmOG2qA1BNrHHIeWcPheDy41omugdSCCwMwgipv2QpLyuY4-Ud6d_0kYFyOHctiyr-tJ7nUgGNmvxA-OGVA6GTlD7V0Auq743yMj8Kc7Q5BrbAs3I-6NC7ElvUnjxDvf05U0umI0MVtCfmYs7V_4196c2qABhYd2CEBg8KlPI504hONrg7LEed-v7bCL0uxSgSCGgtQtVWPqK2c" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">João Silva</h4>
                                        <p className="text-sm text-slate-500">Corte Degradê + Barba</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Profissional</p>
                                        <p className="font-medium text-slate-900 dark:text-white">Caio</p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase border border-primary/20">Aguardando</span>
                                    <button onClick={() => navigate('/schedule')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                                        <span className="material-symbols-outlined">more_vert</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Appointment 2 */}
                        <div className="relative pl-12">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 size-10 rounded-full border-4 border-background-light dark:border-background-dark bg-slate-500 flex items-center justify-center z-10">
                                <span className="text-xs font-bold text-white">14:45</span>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between opacity-80">
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                        <img className="w-full h-full object-cover" alt="Ricardo Alves" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQKBU9FXkDO-b6_1rRDxcAJnjeiasBkBM3-xaXzReWiXUuRxO-wQCovFCDXJju-aoy82YTaQ3BkfZGqcOiiHhDXXTnWC3PMcLeYcjCwnmxLs2QZucwJoZA5Zh8zm3cgGYn2uVKuGrB55R5ZEPSP5gLc43QammA5uxQJV1Mjw2UB8qT_HLs7rGpfAqI2FFhKrP1wvWxSFshSf32T6YkOpy0pvO6iyVE3Z4WMxLLMEtYLkwHf853IjvMRwdz3JXuoLwJslWF53qnlwk" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Ricardo Alves</h4>
                                        <p className="text-sm text-slate-500">Barba Premium</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Profissional</p>
                                        <p className="font-medium text-slate-900 dark:text-white">Lucas</p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold uppercase border border-slate-200 dark:border-slate-700">Pendente</span>
                                    <button onClick={() => navigate('/schedule')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                                        <span className="material-symbols-outlined">more_vert</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Appointment 3 */}
                        <div className="relative pl-12">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 size-10 rounded-full border-4 border-background-light dark:border-background-dark bg-slate-500 flex items-center justify-center z-10">
                                <span className="text-xs font-bold text-white">15:30</span>
                            </div>
                            <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between opacity-80">
                                <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                        <img className="w-full h-full object-cover" alt="Marcos Souza" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHgy8w8Ewkd1s9YrSk8d4L5al38bmZ8LuK7VLk1gVrIij8bu2lp6JBU_F92p16KZJ0t-nLDBwAP3DP3SVnadc_ZRLd2OQgKNuKSyK8ZVVjNm_5DYPdOHKnHbJqGJ-O5qg9SbPwaRC5SWu3NvKqwe9uvhY0zXPpUH_2z6t2teX0TQYtFzx0Gv0zik-vDnba9g8FFlFX3VVSMaRukNgGgMLsBZVmQtoPRcJi6qgJ_HjtHiD-iqAEm47Udb9vsONO8C60DMdXuAPNMKU" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Marcos Souza</h4>
                                        <p className="text-sm text-slate-500">Combo Completo + Hidratação</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Profissional</p>
                                        <p className="font-medium text-slate-900 dark:text-white">Caio</p>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold uppercase border border-slate-200 dark:border-slate-700">Pendente</span>
                                    <button onClick={() => navigate('/schedule')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                                        <span className="material-symbols-outlined">more_vert</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Inventory Alert Section */}
                <aside className="space-y-6">
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <span className="material-symbols-outlined text-orange-500">inventory_2</span>
                                Estoque Crítico
                            </h3>
                            <button onClick={() => navigate('/orders')} className="text-xs font-bold text-primary hover:underline">Ver Todos</button>
                        </div>
                        <div className="p-2">
                            <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Pomada Matte S.M.</p>
                                    <p className="text-xs text-slate-500">Unidades restantes: 02</p>
                                </div>
                                <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">Reposição</span>
                            </div>
                            <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Lâminas Platinum X</p>
                                    <p className="text-xs text-slate-500">Caixas restantes: 01</p>
                                </div>
                                <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400">Baixo</span>
                            </div>
                            <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg flex items-center justify-between transition-colors">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Shampoo Detox 500ml</p>
                                    <p className="text-xs text-slate-500">Unidades restantes: 03</p>
                                </div>
                                <span className="text-xs font-bold px-2 py-1 rounded bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400">Baixo</span>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/30">
                            <button onClick={() => navigate('/orders')} className="w-full py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-all text-slate-700 dark:text-slate-300">
                                Solicitar Pedido
                            </button>
                        </div>
                    </div>
                    {/* Mini Stats for Operator */}
                    <div className="bg-primary/5 border border-primary/20 p-6 rounded-xl space-y-4">
                        <h4 className="text-sm font-bold text-primary uppercase tracking-widest">Resumo do Turno</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white dark:bg-background-dark p-3 rounded-lg border border-primary/10">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Atendidos</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">12</p>
                            </div>
                            <div className="bg-white dark:bg-background-dark p-3 rounded-lg border border-primary/10">
                                <p className="text-[10px] text-slate-500 font-bold uppercase">Ticket Médio</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">R$ 84</p>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default Operations;