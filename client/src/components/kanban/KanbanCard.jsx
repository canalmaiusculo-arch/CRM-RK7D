import React from 'react';
import { Phone, MapPin, Star } from 'lucide-react';

const DISC_COLORS = { D: 'bg-red-500', I: 'bg-yellow-500', S: 'bg-green-500', C: 'bg-blue-500' };

export default function KanbanCard({ lead, onClick, isVisitor }) {
  return (
    <div
      draggable={!isVisitor}
      onDragStart={e => e.dataTransfer.setData('leadId', lead.id.toString())}
      onClick={onClick}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-gray-600 transition group"
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-sm font-medium text-white truncate flex-1">{lead.name}</h4>
        {lead.disc_profile && (
          <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${DISC_COLORS[lead.disc_profile] || 'bg-gray-600'}`}>
            {lead.disc_profile}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {lead.segment && <p className="text-xs text-gray-400">{lead.segment}</p>}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {lead.state && <span className="flex items-center gap-1"><MapPin size={10} />{lead.state}</span>}
          {lead.phone && <span className="flex items-center gap-1"><Phone size={10} />{lead.phone.slice(-4)}</span>}
        </div>
        {lead.interest_level && (
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={10} className={i <= lead.interest_level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
