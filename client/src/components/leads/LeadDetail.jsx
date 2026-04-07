import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ArrowLeft, Save, Phone, Mail, MapPin, Star, Clock, TrendingUp } from 'lucide-react';

const SEGMENTS = ['Painting', 'Flooring', 'GC/Remodeling', 'Power Washing', 'Landscaping', 'Roofing', 'HVAC', 'Cleaning', 'Concrete/Masonry', 'Drywall', 'Christmas Lights', 'Fencing', 'Kitchen & Bath', 'Siding'];
const STATES = ['MA', 'PA', 'NJ', 'GA', 'FL', 'CT', 'VA', 'UT', 'OH', 'MD', 'CA', 'SC', 'NC'];
const DISC_INFO = {
  D: { label: 'Dominante (Patrão)', color: 'bg-red-500', tips: 'Seja direto, foque em resultados e números. Call curta (3-5 min). CTA direto.' },
  I: { label: 'Influente (Social)', color: 'bg-yellow-500', tips: 'Conexão calorosa, prova social. Deixe ele falar. CTA emocional.' },
  S: { label: 'Estável (Cauteloso)', color: 'bg-green-500', tips: 'Tom calmo, sem pressão. Garantias e segurança. "Sem fidelidade, tudo seu".' },
  C: { label: 'Conformidade (Analítico)', color: 'bg-blue-500', tips: 'Dados e números. Tom informativo. "Análise completa da sua região".' },
};

export default function LeadDetail({ leadId, onBack, isVisitor }) {
  const [lead, setLead] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getLead(leadId).then(data => { setLead(data); setForm(data); });
  }, [leadId]);

  const handleSave = async () => {
    if (isVisitor) return;
    setSaving(true);
    try {
      await api.updateLead(leadId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (!lead) return <div className="flex items-center justify-center h-full text-gray-500">Carregando...</div>;

  const disc = DISC_INFO[form.disc_profile];
  const qualScore = [form.name, form.segment, form.state, form.current_acquisition, form.main_pain, form.disc_profile, form.interest_level].filter(Boolean).length;

  return (
    <div className="h-full overflow-y-auto">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{lead.name}</h1>
          <p className="text-xs text-gray-500">{lead.phone} · Cadência dia {lead.cadence_day || 0}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${qualScore >= 7 ? 'bg-green-900/50 text-green-300' : qualScore >= 4 ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300'}`}>
            Qualificação: {qualScore}/7
          </span>
          {!isVisitor && (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50">
              <Save size={14} /> {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </header>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Lead data */}
        <div className="space-y-6">
          {/* Contact info */}
          <Section title="Contato">
            <Field label="Nome" value={form.name} onChange={set('name')} disabled={isVisitor} icon={<span className="text-gray-500">N</span>} />
            <Field label="Telefone" value={form.phone} onChange={set('phone')} disabled={isVisitor} icon={<Phone size={14} className="text-gray-500" />} />
            <Field label="Email" value={form.email} onChange={set('email')} disabled={isVisitor} icon={<Mail size={14} className="text-gray-500" />} />
            <Field label="Instagram" value={form.instagram_url} onChange={set('instagram_url')} disabled={isVisitor} />
          </Section>

          {/* Qualification (7 mandatory fields from playbook) */}
          <Section title="Qualificação (Checklist 7/7)">
            <SelectField label="1. Segmento" value={form.segment} onChange={set('segment')} disabled={isVisitor} options={SEGMENTS} />
            <SelectField label="2. Estado" value={form.state} onChange={set('state')} disabled={isVisitor} options={STATES} />
            <Field label="3. Cidade" value={form.city} onChange={set('city')} disabled={isVisitor} icon={<MapPin size={14} className="text-gray-500" />} />
            <TextArea label="4. Como capta clientes hoje" value={form.current_acquisition} onChange={set('current_acquisition')} disabled={isVisitor} placeholder="Indicação, Thumbtack, etc." />
            <TextArea label="5. Dor principal (nas palavras dele)" value={form.main_pain} onChange={set('main_pain')} disabled={isVisitor} placeholder="Ex: 'Não consigo manter os meninos ocupados'" />
            <SelectField label="6. Perfil DISC" value={form.disc_profile} onChange={set('disc_profile')} disabled={isVisitor}
              options={[{ v: 'D', l: 'D - Dominante' }, { v: 'I', l: 'I - Influente' }, { v: 'S', l: 'S - Estável' }, { v: 'C', l: 'C - Conformidade' }]}
              valueKey="v" labelKey="l"
            />
            <div>
              <label className="block text-xs text-gray-400 mb-1">7. Nível de interesse (1-5)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <button key={i} onClick={() => !isVisitor && setForm(prev => ({ ...prev, interest_level: i }))}
                    className={`p-1 transition ${isVisitor ? 'cursor-default' : 'cursor-pointer'}`}>
                    <Star size={20} className={i <= (form.interest_level || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'} />
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Optional fields */}
          <Section title="Dados Opcionais (Bônus)">
            <Field label="Faturamento estimado" value={form.estimated_revenue} onChange={set('estimated_revenue')} disabled={isVisitor} icon={<TrendingUp size={14} className="text-gray-500" />} placeholder="$25k-$30k/mês" />
            <Field label="Tempo nos EUA" value={form.years_in_usa} onChange={set('years_in_usa')} disabled={isVisitor} icon={<Clock size={14} className="text-gray-500" />} />
            <Field label="Nível de inglês" value={form.english_level} onChange={set('english_level')} disabled={isVisitor} placeholder="Básico, intermediário..." />
            <TextArea label="Já investiu em marketing?" value={form.previous_marketing} onChange={set('previous_marketing')} disabled={isVisitor} placeholder="Sim, gastou $2k com agência..." />
            <Field label="Tem sócio/esposa que decide?" value={form.has_partner} onChange={set('has_partner')} disabled={isVisitor} placeholder="Sócio: William" />
            <TextArea label="Objeções notadas" value={form.objections_noted} onChange={set('objections_noted')} disabled={isVisitor} />
            <TextArea label="Pontos de conexão pessoal" value={form.personal_notes} onChange={set('personal_notes')} disabled={isVisitor} placeholder="Mineiro de GV, Cruzeiro..." />
            <Field label="O que já tem (site, Google, ads)" value={form.existing_assets} onChange={set('existing_assets')} disabled={isVisitor} />
          </Section>
        </div>

        {/* Right column - DISC tips + history */}
        <div className="space-y-6">
          {/* DISC Guide */}
          {disc && (
            <div className={`rounded-xl border border-gray-800 overflow-hidden`}>
              <div className={`px-4 py-3 ${disc.color} bg-opacity-20 flex items-center gap-2`}>
                <span className={`w-6 h-6 rounded-full ${disc.color} flex items-center justify-center text-white text-xs font-bold`}>{form.disc_profile}</span>
                <h3 className="text-sm font-semibold text-white">{disc.label}</h3>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-300">{disc.tips}</p>
              </div>
            </div>
          )}

          {/* Pipeline history */}
          <Section title="Histórico Pipeline">
            {lead.history?.length > 0 ? (
              <div className="space-y-2">
                {lead.history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500 w-28 shrink-0">{new Date(h.moved_at).toLocaleString('pt-BR')}</span>
                    <span className="text-gray-400">{h.from_stage || '—'}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-200 font-medium">{h.to_stage}</span>
                    {h.meta_event_sent && <span className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">{h.meta_event_sent}</span>}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-600">Nenhum histórico</p>}
          </Section>

          {/* Recent messages */}
          <Section title="Últimas Mensagens">
            {lead.messages?.slice(-5).map(msg => (
              <div key={msg.id} className={`text-xs p-2 rounded mb-1 ${msg.direction === 'outbound' ? 'bg-brand-900/20 text-brand-200' : 'bg-gray-800/50 text-gray-300'}`}>
                <p className="truncate">{msg.content}</p>
                <span className="text-[10px] text-gray-500">{new Date(msg.sent_at).toLocaleString('pt-BR')}</span>
              </div>
            ))}
            {(!lead.messages || lead.messages.length === 0) && <p className="text-xs text-gray-600">Nenhuma mensagem</p>}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl">
      <h3 className="text-sm font-semibold text-gray-300 px-4 py-3 border-b border-gray-800">{title}</h3>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, disabled, icon, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {icon}
        <input value={value || ''} onChange={onChange} disabled={disabled} placeholder={placeholder}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60" />
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, disabled, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <textarea value={value || ''} onChange={onChange} disabled={disabled} placeholder={placeholder} rows={2}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 resize-none" />
    </div>
  );
}

function SelectField({ label, value, onChange, disabled, options, valueKey, labelKey }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select value={value || ''} onChange={onChange} disabled={disabled}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60">
        <option value="">Selecione</option>
        {options.map(opt => typeof opt === 'string'
          ? <option key={opt} value={opt}>{opt}</option>
          : <option key={opt[valueKey]} value={opt[valueKey]}>{opt[labelKey]}</option>
        )}
      </select>
    </div>
  );
}
