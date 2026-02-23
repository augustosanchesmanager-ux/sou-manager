import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Toast from '../components/Toast';
import { useRef } from 'react';

interface Ticket {
    id: string;
    subject: string;
    description: string;
    status: 'open' | 'responded' | 'closed';
    priority: 'low' | 'medium' | 'high';
    created_at: string;
}

interface TicketMessage {
    id: string;
    ticket_id: string;
    sender_id: string;
    message: string;
    created_at: string;
}

const Support: React.FC = () => {
    const { user, tenantId } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
    const [isTicketDetailModalOpen, setIsTicketDetailModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        subject: '',
        description: '',
        priority: 'medium' as 'low' | 'medium' | 'high'
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchTickets = async () => {
        if (!user) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error) setTickets(data || []);
        setIsLoading(false);
    };

    const fetchMessages = async (ticketId: string) => {
        const { data, error } = await supabase
            .from('ticket_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (!error) setMessages(data || []);
    };

    useEffect(() => {
        fetchTickets();

        // Add Realtime for tickets status updates
        const channel = supabase.channel('support_updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, (payload) => {
                setTickets(prev => prev.map(t => t.id === payload.new.id ? payload.new as Ticket : t));
                if (selectedTicket?.id === payload.new.id) {
                    setSelectedTicket(payload.new as Ticket);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Realtime for messages
    useEffect(() => {
        if (!selectedTicket) return;

        const msgChannel = supabase.channel(`ticket_${selectedTicket.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'ticket_messages',
                filter: `ticket_id=eq.${selectedTicket.id}`
            }, (payload) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === payload.new.id)) return prev;
                    return [...prev, payload.new as TicketMessage];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(msgChannel);
        };
    }, [selectedTicket]);

    const handleOpenTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const { data, error } = await supabase
            .from('support_tickets')
            .insert({
                user_id: user.id,
                subject: formData.subject,
                description: formData.description,
                priority: formData.priority,
                status: 'open',
                tenant_id: tenantId
            })
            .select()
            .single();

        if (!error) {
            setTickets([data, ...tickets]);
            setIsNewTicketModalOpen(false);
            setFormData({ subject: '', description: '', priority: 'medium' });
            setToast({ message: 'Chamado aberto com sucesso!', type: 'success' });
        } else {
            setToast({ message: 'Erro ao abrir chamado.', type: 'error' });
        }
    };

    const viewTicket = async (ticket: Ticket) => {
        setSelectedTicket(ticket);
        await fetchMessages(ticket.id);
        setIsTicketDetailModalOpen(true);
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedTicket || !newMessage.trim()) return;

        const { data, error } = await supabase
            .from('ticket_messages')
            .insert({
                ticket_id: selectedTicket.id,
                sender_id: user.id,
                message: newMessage,
                tenant_id: tenantId
            })
            .select()
            .single();

        if (!error) {
            setMessages([...messages, data]);
            setNewMessage('');

            // Update local ticket status if user is replying to a 'responded' ticket
            if (selectedTicket.status === 'responded') {
                await supabase
                    .from('support_tickets')
                    .update({ status: 'open' })
                    .eq('id', selectedTicket.id);

                setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: 'open' } : t));
            }
        }
    };

    const getStatusBadge = (status: Ticket['status']) => {
        switch (status) {
            case 'open': return <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider border border-amber-500/20">Aberto</span>;
            case 'responded': return <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">Respondido</span>;
            case 'closed': return <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-transparent">Fechado</span>;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-[10px] font-black uppercase text-black tracking-widest">Protocolo SOU-Support</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Central de Atendimento</h2>
                    <p className="text-slate-500 mt-1 font-medium">Como podemos ajudar você hoje?</p>
                </div>
                <button
                    onClick={() => setIsNewTicketModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-4 bg-amber-500 text-black rounded-2xl font-black text-sm hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/10 active:scale-95"
                >
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    Novo Chamado
                </button>
            </div>

            <div className="space-y-4">
                {isLoading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-28 bg-[#0a0a0a] rounded-3xl animate-pulse border border-white/5"></div>)
                ) : tickets.length === 0 ? (
                    <div className="bg-[#0a0a0a] p-16 rounded-3xl border border-white/10 text-center flex flex-col items-center shadow-2xl">
                        <div className="size-20 rounded-2xl bg-amber-500/5 flex items-center justify-center mb-6 border border-amber-500/10">
                            <span className="material-symbols-outlined text-5xl text-amber-500/30">support_agent</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">Nenhum chamado aberto</h3>
                        <p className="text-slate-500 mt-2 max-w-xs font-medium">Você ainda não possui solicitações ativas. Caso precise de assistência, estamos prontos para ajudar.</p>
                    </div>
                ) : (
                    tickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => viewTicket(ticket)}
                            className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/10 shadow-xl hover:border-amber-500/40 transition-all cursor-pointer flex justify-between items-center group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            <div className="flex items-center gap-6 relative z-10">
                                <div className={`size-14 rounded-2xl flex items-center justify-center transition-all ${ticket.status === 'closed' ? 'bg-white/5 text-slate-500' : 'bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/5'}`}>
                                    <span className="material-symbols-outlined text-2xl">{ticket.status === 'closed' ? 'check_circle' : 'chat_bubble'}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-black text-white text-lg tracking-tight group-hover:text-amber-500 transition-colors uppercase">{ticket.subject}</h4>
                                        {ticket.status === 'responded' && <div className="size-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="text-[10px] text-amber-500/50 font-black uppercase tracking-widest">ID: {ticket.id.slice(0, 8)}</p>
                                        <span className="text-white/10">•</span>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(ticket.created_at).toLocaleDateString('pt-BR')}</p>
                                        <span className="text-white/10">•</span>
                                        <div className="scale-75 origin-left">{getStatusBadge(ticket.status)}</div>
                                    </div>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-white/5 group-hover:text-amber-500 group-hover:translate-x-1 transition-all">north_east</span>
                        </div>
                    ))
                )}
            </div>

            {/* NEW TICKET MODAL */}
            <Modal
                isOpen={isNewTicketModalOpen}
                onClose={() => setIsNewTicketModalOpen(false)}
                title="Protocolo de Solicitação"
            >
                <form onSubmit={handleOpenTicket} className="space-y-6">
                    <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/10 space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-widest mb-2">Assunto Principal</label>
                            <input
                                required
                                type="text"
                                placeholder="Descreva brevemente o problema..."
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-sm text-white focus:border-amber-500/30 outline-none transition-all font-medium"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-widest mb-2">Prioridade Requisitada</label>
                            <div className="grid grid-cols-3 gap-3">
                                {(['low', 'medium', 'high'] as const).map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, priority: p })}
                                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${formData.priority === p ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}
                                    >
                                        {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Crítica'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-widest mb-2">Detalhamento Técnico</label>
                            <textarea
                                required
                                rows={4}
                                placeholder="Conte-nos o que está acontecendo da forma mais detalhada possível..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-sm text-white focus:border-amber-500/30 outline-none transition-all font-medium resize-none"
                            ></textarea>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsNewTicketModalOpen(false)}
                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-4 bg-amber-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/10"
                        >
                            Enviar Protocolo
                        </button>
                    </div>
                </form>
            </Modal>

            {/* TICKET DETAIL MODAL */}
            <Modal
                isOpen={isTicketDetailModalOpen}
                onClose={() => setIsTicketDetailModalOpen(false)}
                title={selectedTicket?.subject || 'Gestão de Protocolo'}
                maxWidth="lg"
            >
                <div className="flex flex-col flex-1 min-h-0">
                    <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 mb-6">
                        <div className="flex items-center gap-2 mb-2 text-amber-500/50">
                            <span className="material-symbols-outlined text-sm">description</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Solicitação Original</span>
                        </div>
                        <p className="text-sm text-slate-300 font-medium leading-relaxed">
                            {selectedTicket?.description}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-3 mb-6">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40">
                                <div className="animate-bounce mb-4 text-amber-500">
                                    <span className="material-symbols-outlined text-4xl">hourglass_empty</span>
                                </div>
                                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Aguardando Resposta</p>
                            </div>
                        ) : (
                            messages.map(m => (
                                <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] p-4 rounded-3xl relative ${m.sender_id === user?.id
                                        ? 'bg-amber-600 text-black rounded-tr-none font-bold shadow-lg shadow-amber-600/10'
                                        : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5'}`}>
                                        <p className="text-sm leading-relaxed">{m.message}</p>
                                        <div className="flex items-center justify-end gap-1 mt-2">
                                            <span className={`text-[9px] font-black uppercase tracking-tighter ${m.sender_id === user?.id ? 'text-black/50' : 'text-slate-500'}`}>
                                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {m.sender_id === user?.id && <span className="material-symbols-outlined text-[10px] text-black/40">done_all</span>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="mt-auto pt-4 flex gap-3">
                        <input
                            type="text"
                            placeholder="Digite sua mensagem oficial..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white outline-none focus:border-amber-500/30 transition-all font-medium placeholder:text-slate-600"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || selectedTicket?.status === 'closed'}
                            className="bg-amber-500 text-black size-14 rounded-2xl flex items-center justify-center hover:bg-amber-400 transition-all shadow-xl shadow-amber-500/20 disabled:opacity-30 active:scale-95"
                        >
                            <span className="material-symbols-outlined">send</span>
                        </button>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

export default Support;
