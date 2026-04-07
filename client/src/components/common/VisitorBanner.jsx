import React from 'react';
import { Eye } from 'lucide-react';

export default function VisitorBanner() {
  return (
    <div className="bg-yellow-900/30 border-b border-yellow-700/50 px-4 py-2 flex items-center gap-2 text-yellow-300 text-sm">
      <Eye size={16} />
      <span>Modo visitante — somente visualização. Interações bloqueadas.</span>
    </div>
  );
}
