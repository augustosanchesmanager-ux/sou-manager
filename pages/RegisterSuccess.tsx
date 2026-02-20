import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

const RegisterSuccess: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-background-dark flex flex-col items-center justify-center p-6 transition-colors duration-300">
            <div className="mb-8">
                <Logo size="sm" />
            </div>

            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-10 shadow-xl w-full max-w-md text-center animate-fade-in">

                {/* Icon */}
                <div className="size-16 bg-amber-100 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-3xl">schedule</span>
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Cadastro Recebido!
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                    Sua solicitação está em análise.
                </p>

                {/* Body */}
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-4 mb-8">
                    <p>
                        Para garantir a segurança e qualidade da plataforma, todas as novas barbearias passam por uma rápida análise da nossa equipe administrativa.
                    </p>
                    <p>
                        Você receberá um e-mail assim que seu acesso for liberado. Isso geralmente acontece em menos de 24 horas.
                    </p>
                </div>

                {/* Button */}
                <Link
                    to="/login"
                    className="inline-block w-full border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all text-sm"
                >
                    Voltar para o Login
                </Link>
            </div>
        </div>
    );
};

export default RegisterSuccess;
