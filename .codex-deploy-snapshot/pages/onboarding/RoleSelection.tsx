import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';

const RoleSelection: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="max-w-4xl w-full z-10 animate-fade-in">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 mb-6 bg-white dark:bg-white/5 px-4 py-2 rounded-full shadow-sm border border-slate-200 dark:border-border-dark">
                        <Logo size="sm" />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                        Como você vai usar o sistema?
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                        Personalizamos a experiência com base no seu perfil. Selecione abaixo para continuar.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Card: Owner */}
                    <div
                        onClick={() => navigate('/onboarding/shop-setup')}
                        className="group relative bg-white dark:bg-surface-dark p-8 rounded-3xl border-2 border-slate-200 dark:border-border-dark hover:border-primary dark:hover:border-primary cursor-pointer transition-all hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1"
                    >
                        <div className="size-16 rounded-2xl bg-blue-500/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <span className="material-symbols-outlined text-4xl">storefront</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sou Dono / Gestor</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                            Quero gerenciar minha barbearia, controlar financeiro, estoque e equipe.
                        </p>
                        <ul className="space-y-2 mb-8">
                            <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                Gestão completa do negócio
                            </li>
                            <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                Relatórios avançados
                            </li>
                        </ul>
                        <div className="flex items-center text-primary font-bold text-sm group-hover:gap-2 transition-all">
                            Configurar Barbearia <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </div>
                    </div>

                    {/* Card: Professional */}
                    <div
                        onClick={() => navigate('/onboarding/professional-setup')}
                        className="group relative bg-white dark:bg-surface-dark p-8 rounded-3xl border-2 border-slate-200 dark:border-border-dark hover:border-purple-500 dark:hover:border-purple-500 cursor-pointer transition-all hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1"
                    >
                        <div className="size-16 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <span className="material-symbols-outlined text-4xl">content_cut</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sou Profissional</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                            Sou barbeiro e quero gerenciar minha agenda, comissões e carteira de clientes.
                        </p>
                        <ul className="space-y-2 mb-8">
                            <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                Agenda pessoal inteligente
                            </li>
                            <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                                Acompanhamento de comissões
                            </li>
                        </ul>
                        <div className="flex items-center text-purple-500 font-bold text-sm group-hover:gap-2 transition-all">
                            Criar Perfil Profissional <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-slate-500 text-sm">
                        Já possui uma conta? <button onClick={() => navigate('/login')} className="text-slate-900 dark:text-white font-bold hover:underline">Fazer Login</button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RoleSelection;