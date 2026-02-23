import React, { useState, useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const QUICK_REPLIES = [
    'Como cadastrar um cliente?',
    'Como fechar o caixa?',
    'Como agendar um horário?',
    'Como adicionar um profissional?',
    'Como gerar relatórios?',
];

const BOT_RESPONSES: Record<string, string> = {
    'como cadastrar um cliente?':
        '📋 Para cadastrar um cliente:\n\n1. Vá em **Operacional → Cadastros → Clientes**\n2. Clique em **+ Novo Cliente**\n3. Preencha nome, telefone e e-mail\n4. Clique em **Salvar**\n\nPronto! O cliente estará disponível na agenda e no checkout.',

    'como fechar o caixa?':
        '💰 Para fechar o caixa:\n\n1. Vá em **Operacional → Vendas → Checkout / PDV**\n2. Veja o resumo de vendas do dia\n3. Confira os valores por método de pagamento\n4. Vá em **Gestão → Operações do Dia** para o fechamento completo',

    'como agendar um horário?':
        '📅 Para agendar:\n\n1. Vá em **Operacional → Vendas → Agendamentos**\n2. Clique no horário desejado ou em **+ Novo Agendamento**\n3. Selecione o profissional, cliente e serviço\n4. Confirme o agendamento',

    'como adicionar um profissional?':
        '👤 Para adicionar um profissional:\n\n1. Vá em **Operacional → Cadastros → Equipe / Profissionais**\n2. Clique em **+ Novo Profissional**\n3. Preencha os dados e defina a comissão\n4. Salve e ele aparecerá na agenda',

    'como gerar relatórios?':
        '📊 Para gerar relatórios:\n\n1. Vá em **Gestão → Relatórios**\n2. Selecione o tipo de relatório desejado\n3. Defina o período de análise\n4. Visualize os dados ou exporte em PDF',
};

function getBotReply(userMsg: string): string {
    const lower = userMsg.toLowerCase().trim();
    for (const [key, val] of Object.entries(BOT_RESPONSES)) {
        if (lower.includes(key) || key.includes(lower)) return val;
    }
    return '🤖 Desculpe, ainda não tenho uma resposta específica para essa pergunta. Tente usar uma das sugestões rápidas ou acesse a página de **Suporte** no menu lateral para abrir um chamado.';
}

const SupportWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '👋 Olá! Sou o assistente do **SOU MANA.GER**. Como posso te ajudar hoje?\n\nEscolha uma das opções rápidas abaixo ou digite sua dúvida.',
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
        scrollToBottom();
    }, [messages, isTyping]);

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

        // Simulate AI thinking delay
        setTimeout(() => {
            const botReply: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: getBotReply(text),
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

    // Render markdown-like bold
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
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-50 size-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen
                        ? 'bg-slate-700 hover:bg-slate-600 rotate-0'
                        : 'bg-primary hover:bg-primary-light shadow-primary/40'
                    }`}
            >
                <span className="material-symbols-outlined text-white text-2xl transition-transform duration-300">
                    {isOpen ? 'close' : 'support_agent'}
                </span>
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-green-500 border-2 border-[#12100E] animate-pulse" />
                )}
            </button>

            {/* Chat Panel */}
            <div className={`fixed bottom-24 right-6 z-50 w-[380px] max-h-[520px] rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/40 border border-[#2E2720] transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'
                }`}>
                {/* Header */}
                <div className="bg-slate-900 px-5 py-4 flex items-center gap-3 border-b border-slate-800">
                    <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-white text-sm font-bold">Assistente SOU MANA.GER</p>
                        <p className="text-green-400 text-[10px] font-medium flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-green-400 inline-block" />
                            Online agora
                        </p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-lg">remove</span>
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto bg-[#12100E] px-4 py-4 space-y-3 custom-scrollbar" style={{ maxHeight: '320px' }}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-primary text-white rounded-br-md'
                                    : 'bg-[#1C1814] text-slate-300 border border-[#2E2720] rounded-bl-md'
                                }`}>
                                {renderContent(msg.content)}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-[#1C1814] border border-[#2E2720] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1">
                                <span className="size-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="size-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="size-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                {messages.length <= 2 && (
                    <div className="bg-[#12100E] px-4 pb-2 flex flex-wrap gap-1.5">
                        {QUICK_REPLIES.map(q => (
                            <button
                                key={q}
                                onClick={() => sendMessage(q)}
                                className="text-[11px] px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/15 transition-colors"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="bg-slate-900 border-t border-slate-800 px-4 py-3 flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Digite sua dúvida..."
                        className="flex-1 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl border border-slate-700 focus:border-primary focus:outline-none placeholder:text-slate-500 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="size-10 rounded-xl bg-primary hover:bg-primary-light disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                    >
                        <span className="material-symbols-outlined text-white text-lg">send</span>
                    </button>
                </form>
            </div>
        </>
    );
};

export default SupportWidget;
