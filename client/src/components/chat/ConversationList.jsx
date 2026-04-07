import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function ConversationList({ conversations, selected, onSelect }) {
  return (
    <div className="w-72 border-r border-gray-800 flex flex-col bg-gray-900/30 shrink-0">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">Conversas</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-center text-xs text-gray-600 py-8">Nenhuma conversa</p>
        )}
        {conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full text-left px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/50 transition ${
              selected?.id === conv.id ? 'bg-gray-800' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-white truncate">{conv.name}</span>
              <span className="text-[10px] text-gray-500">
                {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString('pt-BR') : ''}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
              {conv.last_direction === 'outbound' && <MessageSquare size={10} className="text-brand-400 shrink-0" />}
              {conv.last_message}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
