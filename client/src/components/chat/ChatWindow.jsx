import React, { useState, useRef, useEffect } from 'react';
import { Send, User, ExternalLink } from 'lucide-react';

export default function ChatWindow({ lead, messages, onSend, onOpenLead, isVisitor }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isVisitor) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900/50">
        <div>
          <h3 className="text-sm font-semibold text-white">{lead.name}</h3>
          <p className="text-xs text-gray-500">{lead.phone} {lead.segment && `· ${lead.segment}`} {lead.state && `· ${lead.state}`}</p>
        </div>
        <button onClick={onOpenLead} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition">
          <ExternalLink size={14} /> Detalhes
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
              msg.direction === 'outbound'
                ? 'bg-brand-600 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-200 rounded-bl-sm'
            }`}>
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-brand-200' : 'text-gray-500'}`}>
                {new Date(msg.sent_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {msg.is_suggestion ? ' · via SDR Assistant' : ''}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-gray-800 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isVisitor ? 'Modo visitante - somente leitura' : 'Digite uma mensagem...'}
          disabled={isVisitor}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isVisitor || !input.trim()}
          className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-lg transition disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </>
  );
}
