import React from 'react';
import { LayoutDashboard, MessageSquare, Settings, LogOut, User } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'kanban', label: 'Pipeline', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'settings', label: 'Config', icon: Settings },
];

export default function Sidebar({ active, onChange, onLogout, user }) {
  return (
    <aside className="w-16 lg:w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      <div className="p-3 lg:p-4 border-b border-gray-800">
        <h2 className="hidden lg:block text-lg font-bold text-white">RK CRM</h2>
        <span className="lg:hidden text-lg font-bold text-white block text-center">RK</span>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
              active === item.id
                ? 'bg-brand-600/20 text-brand-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            <item.icon size={20} />
            <span className="hidden lg:inline">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-2">
        <div className="flex items-center gap-2 px-2">
          <User size={16} className="text-gray-500" />
          <span className="hidden lg:inline text-xs text-gray-400 truncate">
            {user?.username}
            {user?.role === 'visitor' && <span className="ml-1 text-yellow-500">(visitante)</span>}
          </span>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition"
        >
          <LogOut size={18} />
          <span className="hidden lg:inline">Sair</span>
        </button>
      </div>
    </aside>
  );
}
