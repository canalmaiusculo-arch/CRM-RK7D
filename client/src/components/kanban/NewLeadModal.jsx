import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';

const SEGMENTS = ['Painting', 'Flooring', 'GC/Remodeling', 'Power Washing', 'Landscaping', 'Roofing', 'HVAC', 'Cleaning', 'Concrete/Masonry', 'Drywall', 'Christmas Lights', 'Fencing', 'Kitchen & Bath', 'Siding'];
const STATES = ['MA', 'PA', 'NJ', 'GA', 'FL', 'CT', 'VA', 'UT', 'OH', 'MD', 'CA', 'SC', 'NC'];
const SOURCES = ['Trafego Google', 'Trafego Meta', 'Indicacao', 'Outbound Instagram', 'Outbound FB Group', 'WhatsApp Inbound'];

export default function NewLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', segment: '', state: '', source: '', disc_profile: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { setError('Nome e telefone obrigatórios'); return; }
    setLoading(true);
    try {
      await api.createLead(form);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold">Novo Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nome *</label>
            <input value={form.name} onChange={set('name')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Telefone (internacional) *</label>
            <input value={form.phone} onChange={set('phone')} placeholder="15551234567" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input value={form.email} onChange={set('email')} type="email" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Segmento</label>
              <select value={form.segment} onChange={set('segment')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Selecione</option>
                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Estado</label>
              <select value={form.state} onChange={set('state')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Selecione</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Origem</label>
              <select value={form.source} onChange={set('source')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Selecione</option>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Perfil DISC</label>
              <select value={form.disc_profile} onChange={set('disc_profile')} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">Identificar depois</option>
                <option value="D">D - Dominante (Patrão)</option>
                <option value="I">I - Influente (Social)</option>
                <option value="S">S - Estável (Cauteloso)</option>
                <option value="C">C - Conformidade (Analítico)</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 rounded-lg transition disabled:opacity-50">
            {loading ? 'Criando...' : 'Criar Lead'}
          </button>
        </form>
      </div>
    </div>
  );
}
