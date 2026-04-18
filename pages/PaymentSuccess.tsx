import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PaymentSuccessState {
    client: {
        id: string;
        name: string;
        avatar: string;
    };
    total: number;
    paymentMethod: string;
    paymentStatus: string;
    comandaId: string;
    cart: any[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    credit: 'Crédito',
    debit: 'Débito',
    pix: 'Pix',
    cash: 'Dinheiro',
    other: 'Outros',
};

const PaymentSuccess: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as PaymentSuccessState | null;

    console.log('PaymentSuccess state:', state);

    if (!state || !state.client) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">Nenhuma transação encontrada.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-bold"
                    >
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    const { client, total, paymentMethod, comandaId } = state;
    const methodLabel = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod;

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                        <span className="material-symbols-outlined text-5xl text-white">check</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Pagamento Confirmado
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Transação finalizada com sucesso!
                    </p>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-xl mb-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-border-dark">
                        {client?.avatar ? (
                            <img
                                src={client.avatar}
                                alt={client.name}
                                className="w-14 h-14 rounded-full border-2 border-primary"
                            />
                        ) : (
                            <div className="w-14 h-14 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center">
                                <span className="material-symbols-outlined text-2xl text-slate-400">person</span>
                            </div>
                        )}
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cliente</p>
                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                {client?.name || 'Cliente'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Valor</p>
                            <p className="text-xl font-black text-primary">
                                R$ {Number(total || 0).toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pagamento</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">payments</span>
                                {methodLabel}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Comanda</p>
                            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                                #{comandaId ? comandaId.slice(0, 8).toUpperCase() : 'NOVA'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</p>
                            <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                Pago
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => navigate('/schedule', { state: { clientId: client?.id } })}
                        className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">event</span>
                        Novo Agendamento
                    </button>

                    <button
                        onClick={() => navigate('/comandas')}
                        className="w-full py-4 px-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-border-dark hover:border-primary/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">receipt_long</span>
                        Voltar para Comandas
                    </button>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-3 px-6 bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">home</span>
                        Voltar para Início
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccess;