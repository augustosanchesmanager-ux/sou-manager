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
        '💰 Temos 3 planos pensados para o seu momento:\n\n1. **Gratuito**: Ideal para começar (agendamentos e clientes).\n2. **Profissional**: Gestão completa de vendas, financeiro e equipe.\n3. **Elite**: Para quem quer escala. Inclui BI Avançado, Automações e Suporte VIP.\n\nRole a página até a seção de **Preços** para ver os detalhes!',

    'o sistema tem bi?':
        '📊 Sim! No plano **Elite**, você tem acesso ao nosso Dashboard de **Business Intelligence**. Ele analisa seu faturamento, retenção de clientes e performance da equipe sozinho, te dando insights prontos para agir.',

    'como funciona o suporte?':
        '🛠️ Nosso suporte é humanizado! No plano Profissional e Elite, você tem canal direto via WhatsApp e e-mail. No plano Elite, o suporte é prioritário.',

    'posso testar grátis?':
        '✨ Com certeza! Você pode começar agora mesmo no plano **Gratuito** para conhecer a interface. Não pedimos cartão de crédito para começar.',

    'tem controle de estoque?':
        '📦 Sim! Temos gestão completa de produtos e estoque. No plano Elite, o sistema até gera pedidos de compra automáticos quando o produto está acabando.',
};

function getSaleReply(userMsg: string): string {
    const lower = userMsg.toLowerCase().trim();
    for (const [key, val] of Object.entries(SALE_RESPONSES)) {
        if (lower.includes(key) || key.includes(lower)) return val;
    }
    return '🤖 Sou seu assistente virtual do **SOU MANA.GER**. Para dúvidas técnicas ou personalizadas, você também pode nos chamar no WhatsApp ou e-mail na seção de contato abaixo!';
}

const LandingSupportWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '👋 Bem-vindo ao **SOU MANA.GER**! Estou aqui para te ajudar a entender como podemos transformar sua barbearia.\n\nO que você gostaria de saber?',
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
                className={`fixed bottom-6 right-6 z-50 size-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : 'bg-primary hover:bg-primary-light shadow-primary/40'
                    }`}
            >
                <span className="material-symbols-outlined text-white text-2xl transition-transform duration-300">
                    {isOpen ? 'close' : 'chat'}
                </span>
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-green-500 border-2 border-[#0E0C0A] animate-pulse" />
                )}
            </button>

            <div className={`fixed bottom-24 right-6 z-50 w-[350px] max-h-[500px] rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/60 border border-[#2E2720] transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'
                }`}>
                <div className="bg-[#1C1814] px-5 py-4 flex items-center gap-3 border-b border-[#2E2720]">
                    <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-white text-sm font-bold">Assistente Sou Manager</p>
                        <p className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                            Dúvidas e Vendas
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#0E0C0A] px-4 py-4 space-y-3 custom-scrollbar" style={{ maxHeight: '350px' }}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-primary text-white rounded-br-none'
                                : 'bg-[#1C1814] text-slate-300 border border-[#2E2720] rounded-bl-none'
                                }`}>
                                {renderContent(msg.content)}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-[#1C1814] border border-[#2E2720] px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {messages.length <= 2 && (
                    <div className="bg-[#0E0C0A] px-4 pb-3 flex flex-wrap gap-1.5">
                        {QUICK_REPLIES.map(q => (
                            <button
                                key={q}
                                onClick={() => sendMessage(q)}
                                className="text-[10px] px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/15 transition-all"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="bg-[#1C1814] border-t border-[#2E2720] px-3 py-3 flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Pergunte sobre os planos..."
                        className="flex-1 bg-white/5 text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 focus:border-primary focus:outline-none placeholder:text-slate-500 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="size-10 rounded-xl bg-primary hover:bg-primary-light disabled:opacity-30 flex items-center justify-center transition-all"
                    >
                        <span className="material-symbols-outlined text-white text-lg">send</span>
                    </button>
                </form>
            </div>
        </>
    );
};

export default LandingSupportWidget;
