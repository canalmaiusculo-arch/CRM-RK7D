import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { connectSocket, disconnectSocket } from './services/socket';
import Login from './components/common/Login';
import Sidebar from './components/common/Sidebar';
import KanbanBoard from './components/kanban/KanbanBoard';
import ChatPanel from './components/chat/ChatPanel';
import LeadDetail from './components/leads/LeadDetail';
import Settings from './components/settings/Settings';
import VisitorBanner from './components/common/VisitorBanner';

export default function App() {
  const { user, token, isLoggedIn, isVisitor, loginUser, logout } = useAuth();
  const [activeView, setActiveView] = useState('kanban');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (token) {
      const s = connectSocket(token);
      setSocket(s);
      return () => disconnectSocket();
    }
  }, [token]);

  if (!isLoggedIn) {
    return <Login onLogin={loginUser} />;
  }

  const openLead = (id) => {
    setSelectedLeadId(id);
    setActiveView('lead_detail');
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Sidebar active={activeView} onChange={setActiveView} onLogout={logout} user={user} />
      <main className="flex-1 overflow-hidden">
        {isVisitor && <VisitorBanner />}
        {activeView === 'kanban' && <KanbanBoard onOpenLead={openLead} isVisitor={isVisitor} />}
        {activeView === 'chat' && <ChatPanel onOpenLead={openLead} isVisitor={isVisitor} socket={socket} />}
        {activeView === 'lead_detail' && selectedLeadId && (
          <LeadDetail leadId={selectedLeadId} onBack={() => setActiveView('kanban')} isVisitor={isVisitor} />
        )}
        {activeView === 'settings' && <Settings isVisitor={isVisitor} />}
      </main>
    </div>
  );
}
