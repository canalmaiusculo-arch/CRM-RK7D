import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import SuggestionsPanel from './SuggestionsPanel';

export default function ChatPanel({ onOpenLead, isVisitor, socket }) {
  const [conversations, setConversations] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState(null);

  const fetchConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchConversations(); }, []);

  useEffect(() => {
    if (!socket) return;
    const handleNewMsg = (msg) => {
      if (selectedLead && msg.lead_id === selectedLead.id) {
        setMessages(prev => [...prev, msg]);
      }
      fetchConversations();
    };
    socket.on('message:new', handleNewMsg);
    return () => socket.off('message:new', handleNewMsg);
  }, [socket, selectedLead]);

  const selectConversation = async (lead) => {
    setSelectedLead(lead);
    try {
      const [msgs, sugg] = await Promise.all([
        api.getMessages(lead.id),
        api.getSuggestions(lead.id),
      ]);
      setMessages(msgs);
      setSuggestions(sugg);
    } catch (err) { console.error(err); }
  };

  const handleSend = async (content, suggestion_type) => {
    if (!selectedLead || isVisitor) return;
    try {
      await api.sendMessage(selectedLead.id, content, suggestion_type);
      const msgs = await api.getMessages(selectedLead.id);
      setMessages(msgs);
      fetchConversations();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="h-full flex">
      <ConversationList
        conversations={conversations}
        selected={selectedLead}
        onSelect={selectConversation}
      />
      <div className="flex-1 flex flex-col">
        {selectedLead ? (
          <ChatWindow
            lead={selectedLead}
            messages={messages}
            onSend={handleSend}
            onOpenLead={() => onOpenLead(selectedLead.id)}
            isVisitor={isVisitor}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            Selecione uma conversa
          </div>
        )}
      </div>
      {selectedLead && suggestions && (
        <SuggestionsPanel
          suggestions={suggestions}
          lead={selectedLead}
          onUseSuggestion={(text, type) => handleSend(text, type)}
          isVisitor={isVisitor}
        />
      )}
    </div>
  );
}
