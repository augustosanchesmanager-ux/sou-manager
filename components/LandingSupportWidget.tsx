import React, { useState, useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const QUICK_REPLIES = [
    'Quais são os planos?',
    'O sistema tem BI?',
    'Como funciona o suporte?',
    'Posso testar grátis?',
    'Tem controle de estoque?',
];

const SALE_RESPONSES: Record<string, string> = {
    'quais são os planos?':
        '💰 Nossa arquitetura é estruturada por **Maturidade Operacional**:\n\n1. **Operação Essencial**: Agenda multi-profissional, PDV rápido e comandas digitais integradas.\n2. **Gestão & Clube Pro**: Adiciona o motor de recorrência do Clube dos Chefes, fechamento de caixa auditável e portal do cliente.\n3. **Atelier Multi-Unidade & Enterprise**: Inclui Totem Kiosk de autoatendimento, BI preditivo com IA Gemini e suporte de implantação sob medida.\n\nRole até a seção de **Planos** ou agende uma demonstração guiada!',

    'o sistema tem bi?':
        '📊 Sim! O **SMG Barber Intelligence** conta com camada de **Business Intelligence Preditivo** alimentada por **IA Gemini**. Ele audita o faturamento em tempo real, monitora o índice de retenção da bancada e identifica clientes com ciclo de retorno atrasado.',

    'como funciona o suporte?':
        '🛠️ Nosso suporte é técnico e especializado no dia a dia da barbearia. Oferecemos implantação guiada, migração de dados e acompanhamento direto via WhatsApp com especialistas.',

    'posso testar grátis?':
        '✨ Oferecemos **demonstrações guiadas personalizadas** com a estrutura da sua barbearia para que você experimente a densidade do cockpit operacional, a agenda e o Clube dos Chefes antes de tomar sua decisão.',

    'tem controle de estoque?':
        '📦 Sim! O controle de produtos e insumos de bancada é sincronizado diretamente ao PDV e às Comandas, com rastreabilidade de custos e comissões automáticas no fechamento.',
};

function getSaleReply(userMsg: string): string {
    const lower = userMsg.toLowerCase().trim();
    for (const [key, val] of Object.entries(SALE_RESPONSES)) {
        if (lower.includes(key) || key.includes(lower)) return val;
    }
    return '🤖 Sou o assistente de admissão do **SMG Barber Intelligence**. Para agendar uma demonstração guiada ou tirar dúvidas sobre sua operação, use o botão de WhatsApp ou acesse os canais de contato abaixo!';
}

const LandingSupportWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '👋 Bem-vindo ao **SMG Barber Intelligence**! Sou o assistente operacional da plataforma.\n\nComo posso ajudar a estruturar a gestão da sua barbearia hoje?',
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isTyping, isOpen]);

    const sendMessage = (text: string) => {
        if (!text.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsTyping(true);

        setTimeout(() => {
            const botReply: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: getSaleReply(text),
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botReply]);
            setIsTyping(false);
        }, 800 + Math.random() * 600);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const renderContent = (text: string) => {
        return text.split('\n').map((line, i) => {
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            return (
                <span key={i}>
                    {i > 0 && <br />}
                    {parts.map((part, j) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="font-bold text-white">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={j}>{part}</span>;
                    })}
                </span>
            );
        });
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 size-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen
                    ? 'bg-surface-dark border border-border-dark text-white hover:bg-card-dark'
                    : 'bg-primary hover:bg-primary-light text-night font-bold shadow-primary/40'
                    }`}
                aria-label="Atendimento comercial"
            >
                <span className="material-symbols-outlined text-2xl transition-transform duration-300">
                    {isOpen ? 'close' : 'chat'}
                </span>
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-emerald-500 border-2 border-night animate-pulse" />
                )}
            </button>

            <div className={`fixed bottom-20 inset-x-3 sm:bottom-24 sm:inset-x-auto sm:right-6 z-50 w-auto sm:w-[360px] max-h-[520px] rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/80 border border-border-dark transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'
                }`}>
                <div className="bg-card-dark px-5 py-4 flex items-center gap-3 border-b border-border-dark">
                    <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-xl">memory</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold truncate">SMG Barber Intelligence</p>
                        <p className="text-emerald-400 text-[10px] font-semibold flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                            Assistente Operacional & Vendas
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-night px-4 py-4 space-y-3 custom-scrollbar" style={{ maxHeight: '350px' }}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-primary text-night font-medium rounded-br-none'
                                : 'bg-card-dark text-slate-200 border border-border-dark rounded-bl-none'
                                }`}>
                                {renderContent(msg.content)}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-card-dark border border-border-dark px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="size-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="size-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {messages.length <= 2 && (
                    <div className="bg-night px-4 pb-3 flex flex-wrap gap-1.5">
                        {QUICK_REPLIES.map(q => (
                            <button
                                key={q}
                                onClick={() => sendMessage(q)}
                                className="text-[10px] px-3 py-1.5 rounded-full border border-primary/30 text-primary-light bg-primary/10 hover:bg-primary/20 transition-all font-semibold"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="bg-card-dark border-t border-border-dark px-3 py-3 flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Tire suas dúvidas operacionais..."
                        className="flex-1 bg-surface-dark text-white text-sm px-4 py-2.5 rounded-xl border border-border-dark focus:border-primary focus:outline-none placeholder:text-slate-500 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="size-10 rounded-xl bg-primary hover:bg-primary-light text-night disabled:opacity-30 flex items-center justify-center transition-all font-bold"
                    >
                        <span className="material-symbols-outlined text-night text-lg">send</span>
                    </button>
                </form>
            </div>
        </>
    );
};

export default LandingSupportWidget;
