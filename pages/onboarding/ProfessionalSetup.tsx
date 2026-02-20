import React from 'react';
import { useNavigate } from 'react-router-dom';

const ProfessionalSetup: React.FC = () => {
    const navigate = useNavigate();

    const handleFinish = () => {
        // Logic to create professional profile would go here
        navigate('/dashboard'); // Or a specific dashboard for professionals
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-6 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-lg relative z-10 animate-fade-in">
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-2xl">
                    <button
                        onClick={() => navigate('/onboarding/role')}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-bold mb-6"
                    >
                        <span className="material-symbols-outlined">arrow_back</span> Voltar
                    </button>

                    <div className="mb-8">
                        <div className="size-14 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl">person_edit</span>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Perfil Profissional</h1>
                        <p className="text-slate-500 dark:text-slate-400">Crie sua identidade e conecte-se a uma barbearia.</p>
                    </div>

                    <div className="space-y-5">
                        <div className="flex flex-col items-center mb-6">
                            <div className="size-24 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-purple-500 transition-colors group">
                                <span className="material-symbols-outlined text-slate-400 group-hover:text-purple-500">add_a_photo</span>
                            </div>
                            <span className="text-xs font-bold text-slate-500 mt-2 uppercase">Adicionar Foto</span>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Seu Nome Completo</label>
                            <input type="text" placeholder="Ex: Carlos Silva" className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3.5 px-4 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Especialidade Principal</label>
                            <select className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium appearance-none [color-scheme:light] dark:[color-scheme:dark]">
                                <option className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Corte Masculino</option>
                                <option className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Barba</option>
                                <option className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Colorimetria</option>
                                <option className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Completo (Todos)</option>
                            </select>
                        </div>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200 dark:border-border-dark"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-surface-dark px-2 text-slate-500 font-bold tracking-widest">Vínculo</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Código da Barbearia (Convite)</label>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Ex: SHOP-8821" className="flex-1 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3.5 px-4 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-mono uppercase font-bold tracking-wider" />
                                <button className="px-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-border-dark rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                    Validar
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 ml-1">Se você trabalha de forma independente, deixe em branco.</p>
                        </div>

                        <button
                            onClick={handleFinish}
                            className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl hover:bg-purple-700 shadow-xl shadow-purple-500/20 transition-all flex items-center justify-center gap-2 mt-6"
                        >
                            Acessar Painel
                            <span className="material-symbols-outlined">login</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfessionalSetup;