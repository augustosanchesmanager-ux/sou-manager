import React, { useState, useEffect } from 'react';

const DashboardReminders = () => {
    const [reminders, setReminders] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('barber_reminders');
        if (saved) setReminders(saved);
    }, []);

    const handleSave = () => {
        localStorage.setItem('barber_reminders', reminders);
        setIsEditing(false);
    };

    return (
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-6 border border-amber-200 dark:border-amber-900/30 shadow-sm transition-all h-full flex flex-col mb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-amber-900 dark:text-amber-500 flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-lg">push_pin</span>
                    Lembretes Rápidos
                </h3>
                <button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors"
                >
                    {isEditing ? 'Salvar' : 'Editar'}
                </button>
            </div>
            {isEditing ? (
                <textarea
                    className="w-full flex-1 bg-white dark:bg-black/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300 min-h-[160px] outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                    value={reminders}
                    onChange={(e) => setReminders(e.target.value)}
                    placeholder="Digite seus lembretes aqui..."
                    autoFocus
                />
            ) : (
                <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap flex-1 bg-white/50 dark:bg-black/10 rounded-lg p-3 min-h-[160px]">
                    {reminders || <span className="text-slate-400 dark:text-slate-500 italic">Nenhum lembrete salvo. Clique em editar para adicionar.</span>}
                </div>
            )}
        </div>
    );
};

export default DashboardReminders;
