import React, { useState, useRef, useEffect } from 'react';
import { generateSupportResponse } from '../services/geminiService';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

// O assistente agora utiliza a função generateSupportResponse via IA Gemini para respostas dinâmicas.
const QUICK_REPLIES = [
    'Como cadastrar um cliente?',
    'Como fechar o caixa?',
    'Como agendar um horário?',
    'Como adicionar um profissional?',
    'Como gerar relatórios?',
];


const SupportWidget: React.FC<{ avoidBottomNav?: boolean }> = ({ avoidBottomNav = false }) => {
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

    const sendMessage = async (text: string) => {
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

        const aiResponse = await generateSupportResponse(text);

        const botReply: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, botReply]);
        setIsTyping(false);
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
                className={`fixed right-4 sm:right-6 z-50 size-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${avoidBottomNav ? 'bottom-24 sm:bottom-6' : 'bottom-4 sm:bottom-6'} ${isOpen
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
            <div className={`fixed inset-x-3 sm:inset-x-auto sm:right-6 z-50 w-auto sm:w-[380px] max-h-[520px] rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/40 border border-[#2E2720] transition-all duration-300 origin-bottom-right ${avoidBottomNav ? 'bottom-40 sm:bottom-24' : 'bottom-20 sm:bottom-24'} ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-90 opacity-0 pointer-events-none'
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
