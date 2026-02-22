import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';

interface ChecklistStep {
    id: string;
    title: string;
    description: string;
    path: string;
    completed: boolean;
}

interface OnboardingChecklistProps {
    onComplete: () => void;
}

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ onComplete }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [steps, setSteps] = useState<ChecklistStep[]>([
        { id: 'services', title: 'Cadastrar Serviços', description: 'Adicione os serviços que você oferece.', path: '/services', completed: false },
        { id: 'staff', title: 'Cadastrar Colaboradores', description: 'Adicione sua equipe ao sistema.', path: '/team', completed: false },
        { id: 'products', title: 'Cadastrar Produtos', description: 'Adicione produtos para venda ou uso interno.', path: '/products', completed: false },
        { id: 'schedules', title: 'Configurar Horários', description: 'Defina o horário de funcionamento e da equipe.', path: '/settings', completed: false },
        { id: 'appointment', title: 'Primeiro Agendamento', description: 'Crie um agendamento para testar o sistema.', path: '/schedule', completed: false },
    ]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        checkProgress();
    }, [user]);

    const checkProgress = async () => {
        setLoading(true);
        try {
            // Check if user has services
            const { count: servicesCount } = await supabase.from('services').select('*', { count: 'exact', head: true });
            const { count: staffCount } = await supabase.from('staff').select('*', { count: 'exact', head: true });
            const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
            const { count: aptsCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true });

            setSteps(prev => prev.map(step => {
                if (step.id === 'services') return { ...step, completed: (servicesCount || 0) > 0 };
                if (step.id === 'staff') return { ...step, completed: (staffCount || 0) > 0 };
                if (step.id === 'products') return { ...step, completed: (productsCount || 0) > 0 };
                if (step.id === 'appointment') return { ...step, completed: (aptsCount || 0) > 0 };
                return step;
            }));
        } catch (error) {
            console.error('Error checking onboarding progress', error);
        }
        setLoading(false);
    };

    const handleCompleteOnboarding = async () => {
        if (!user) return;
        await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
        onComplete();
    };

    const progress = Math.round((steps.filter(s => s.completed).length / steps.length) * 100);

    return (
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6 mb-8 shadow-sm relative overflow-hidden animate-fade-in group">
            {/* Background decoration */}
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-primary/10 transition-colors"></div>

            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-2xl">rocket_launch</span>
                        Bem-vindo(a)! Vamos configurar seu sistema.
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Siga os passos abaixo para deixar tudo pronto para sua barbearia.
                    </p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <span className="text-2xl font-black text-primary">{progress}%</span>
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Concluído</span>
                </div>
            </div>

            <div className="relative z-10 w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mb-8 overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                {steps.map((step, idx) => (
                    <div 
                        key={step.id} 
                        className={`p-4 rounded-xl border relative transition-all cursor-pointer ${step.completed ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-white dark:bg-card-dark border-slate-200 dark:border-border-dark hover:border-primary/50 hover:shadow-md'}`}
                        onClick={() => !step.completed && navigate(step.path)}
                    >
                        {step.completed && (
                            <div className="absolute -top-2 -right-2 size-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-sm font-bold">check</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`size-8 rounded-full flex items-center justify-center font-bold text-xs ${step.completed ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-800/50 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'}`}>
                                {idx + 1}
                            </div>
                            <h4 className={`text-sm font-bold ${step.completed ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{step.title}</h4>
                        </div>
                        <p className={`text-xs ${step.completed ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-slate-500 dark:text-slate-400'}`}>
                            {step.description}
                        </p>
                    </div>
                ))}
            </div>

            <div className="relative z-10 flex justify-end">
                <button 
                    onClick={handleCompleteOnboarding}
                    className="text-xs font-bold uppercase text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
                >
                    Pular ou Ocultar Checklist
                    <span className="material-symbols-outlined text-sm">visibility_off</span>
                </button>
            </div>
        </div>
    );
};

export default OnboardingChecklist;
