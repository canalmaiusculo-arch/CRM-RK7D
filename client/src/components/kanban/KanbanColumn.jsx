import React, { useState } from 'react';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ column, onDrop, onOpenLead, isVisitor }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const leadId = parseInt(e.dataTransfer.getData('leadId'));
    if (leadId) onDrop(leadId, column.id);
  };

  return (
    <div
      className={`w-72 flex flex-col bg-gray-900/50 rounded-xl border transition ${
        dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-gray-800'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: column.color }} />
        <h3 className="text-sm font-semibold text-gray-200 flex-1">{column.name}</h3>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
          {column.leads?.length || 0}
        </span>
        {column.meta_event && (
          <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
            {column.meta_event}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {column.leads?.map(lead => (
          <KanbanCard key={lead.id} lead={lead} onClick={() => onOpenLead(lead.id)} isVisitor={isVisitor} />
        ))}
        {(!column.leads || column.leads.length === 0) && (
          <p className="text-center text-xs text-gray-600 py-8">Nenhum lead</p>
        )}
      </div>
    </div>
  );
}
