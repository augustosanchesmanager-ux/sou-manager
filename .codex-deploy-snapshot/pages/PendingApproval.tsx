import React from 'react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const PendingApproval: React.FC = () => {
    const { user, signOut } = useAuth();

    return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-fade-in">
                {/* Logo */}
                <div className="flex justify-center">
                    <Logo />
                </div>

                {/* Icon */}
                <div className="flex justify-center">
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center animate-pulse">
                        <span className="material-symbols-outlined text-4xl text-amber-500">hourglass_top</span>
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-3">
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        Aguardando Aprovação
                    </h1>
                    <p className="text-slate-400 leading-relaxed">
                        Seu cadastro foi recebido com sucesso! Nossa equipe irá analisar e aprovar seu acesso em breve.
                    </p>
                </div>

                {/* Info card */}
                <div className="bg-black border border-white/10 rounded-2xl p-6 text-left space-y-4">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-emerald-500 text-xl mt-0.5">check_circle</span>
                        <div>
                            <p className="text-sm font-bold text-white">Cadastro recebido</p>
                            <p className="text-xs text-slate-500 mt-0.5">Seus dados foram registrados no sistema.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5 animate-pulse">pending</span>
                        <div>
                            <p className="text-sm font-bold text-white">Análise em andamento</p>
                            <p className="text-xs text-slate-500 mt-0.5">Um administrador irá revisar e liberar seu acesso.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 opacity-40">
                        <span className="material-symbols-outlined text-slate-500 text-xl mt-0.5">rocket_launch</span>
                        <div>
                            <p className="text-sm font-bold text-white">Acesso liberado</p>
                            <p className="text-xs text-slate-500 mt-0.5">Você poderá entrar normalmente após aprovação.</p>
                        </div>
                    </div>
                </div>

                {/* Account info */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-xs text-amber-500/80 font-bold">
                        Conta cadastrada como: <span className="text-amber-500">{user?.email}</span>
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">
                        Cadastro realizado em: {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { dateStyle: 'long' }) : '—'}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-3.5 rounded-xl bg-amber-500 text-black font-black text-sm hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
                    >
                        Verificar Status do Acesso
                    </button>
                    <button
                        onClick={signOut}
                        className="w-full py-3 rounded-xl bg-white/5 text-slate-400 font-bold text-sm hover:bg-white/10 transition-all border border-white/10"
                    >
                        Sair da Conta
                    </button>
                </div>

                <p className="text-xs text-slate-600">
                    Dúvidas? Entre em contato pelo e-mail <span className="text-slate-500">suporte@soumanager.com</span>
                </p>
            </div>
        </div>
    );
};

export default PendingApproval;
