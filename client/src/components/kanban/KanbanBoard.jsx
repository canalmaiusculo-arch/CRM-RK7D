import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import KanbanColumn from './KanbanColumn';
import NewLeadModal from './NewLeadModal';
import { Plus, RefreshCw } from 'lucide-react';

export default function KanbanBoard({ onOpenLead, isVisitor }) {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewLead, setShowNewLead] = useState(false);

  const fetchBoard = async () => {
    try {
      const data = await api.getBoard();
      setBoard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoard(); }, []);

  const handleDrop = async (leadId, newStageId) => {
    if (isVisitor) return;
    // Optimistic update
    setBoard(prev => prev.map(col => ({
      ...col,
      leads: col.id === newStageId
        ? [...col.leads, prev.flatMap(c => c.leads).find(l => l.id === leadId)].filter(Boolean)
        : col.leads.filter(l => l.id !== leadId),
    })));
    try {
      await api.moveLeadStage(leadId, newStageId);
    } catch {
      fetchBoard(); // revert on error
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-500">Carregando pipeline...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Pipeline</h1>
        <div className="flex gap-2">
          <button onClick={fetchBoard} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition">
            <RefreshCw size={18} />
          </button>
          {!isVisitor && (
            <button
              onClick={() => setShowNewLead(true)}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm transition"
            >
              <Plus size={16} /> Novo Lead
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {board.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              onDrop={handleDrop}
              onOpenLead={onOpenLead}
              isVisitor={isVisitor}
            />
          ))}
        </div>
      </div>

      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onCreated={() => { setShowNewLead(false); fetchBoard(); }}
        />
      )}
    </div>
  );
}
