import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, Send, Shield, MessageCircle, Zap } from 'lucide-react';
import { api } from '../../services/api';

const PHASE_LABELS = { urgency: 'Urgência (Dia 0-3)', persistence: 'Persistência (Dia 4-10)', rescue: 'Resgate (Dia 11-21)', refish: 'Repescagem' };
const DISC_LABELS = { D: 'Patrão (D)', I: 'Social (I)', S: 'Cauteloso (S)', C: 'Analítico (C)' };

export default function SuggestionsPanel({ suggestions, lead, onUseSuggestion, isVisitor }) {
  const [expandedSection, setExpandedSection] = useState('cadence');
  const [objectionResponses, setObjectionResponses] = useState(null);

  const toggle = (section) => setExpandedSection(prev => prev === section ? null : section);

  const handleObjection = async (key) => {
    try {
      const responses = await api.getObjectionResponse(lead.id, key);
      setObjectionResponses({ key, responses });
    } catch (err) { console.error(err); }
  };

  return (
    <div className="w-80 border-l border-gray-800 bg-gray-900/30 overflow-y-auto shrink-0">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <Lightbulb size={16} className="text-yellow-400" />
        <h3 className="text-sm font-semibold text-gray-300">SDR Assistant</h3>
      </div>

      {/* Lead context */}
      <div className="px-4 py-2 border-b border-gray-800/50 text-xs text-gray-500">
        <span>Fase: <strong className="text-gray-300">{PHASE_LABELS[suggestions.cadence_phase]}</strong></span>
        {lead.disc_profile && <span className="ml-3">DISC: <strong className="text-gray-300">{DISC_LABELS[lead.disc_profile]}</strong></span>}
        {suggestions.best_case && <span className="block mt-1">Case: {suggestions.best_case.name} ({suggestions.best_case.state})</span>}
      </div>

      {/* Cadence messages */}
      <Section title="Mensagens da Cadência" icon={MessageCircle} expanded={expandedSection === 'cadence'} onToggle={() => toggle('cadence')}>
        {suggestions.cadence?.map((msg, i) => (
          <SuggestionCard key={i} text={msg.text} label={`${msg.code} · ${msg.type}`} onUse={() => onUseSuggestion(msg.text, msg.suggestion_type)} disabled={isVisitor} />
        ))}
        {(!suggestions.cadence || suggestions.cadence.length === 0) && <p className="text-xs text-gray-600 px-3">Nenhuma sugestão para esta fase</p>}
      </Section>

      {/* Opener */}
      {suggestions.opener && (
        <Section title="Abertura DISC" icon={Zap} expanded={expandedSection === 'opener'} onToggle={() => toggle('opener')}>
          <SuggestionCard text={suggestions.opener.text} label={`DISC ${suggestions.opener.disc}`} onUse={() => onUseSuggestion(suggestions.opener.text, 'disc_adapted')} disabled={isVisitor} />
        </Section>
      )}

      {/* Accusation Audit */}
      {suggestions.accusation_audit?.length > 0 && (
        <Section title="Accusation Audit" icon={Shield} expanded={expandedSection === 'audit'} onToggle={() => toggle('audit')}>
          {suggestions.accusation_audit.map((aa, i) => (
            <SuggestionCard key={i} text={aa.text} label={aa.variant} onUse={() => onUseSuggestion(aa.text, aa.suggestion_type)} disabled={isVisitor} />
          ))}
        </Section>
      )}

      {/* CTA */}
      {suggestions.cta && (
        <Section title="CTA (Fechamento)" icon={Send} expanded={expandedSection === 'cta'} onToggle={() => toggle('cta')}>
          <SuggestionCard text={suggestions.cta.text} label={`DISC ${suggestions.cta.disc}`} onUse={() => onUseSuggestion(suggestions.cta.text, 'disc_adapted')} disabled={isVisitor} />
        </Section>
      )}

      {/* Objections */}
      <Section title="Objeções" icon={Shield} expanded={expandedSection === 'objections'} onToggle={() => toggle('objections')}>
        <div className="space-y-1 px-3">
          {suggestions.objections?.map(obj => (
            <button
              key={obj.key}
              onClick={() => handleObjection(obj.key)}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg transition ${
                objectionResponses?.key === obj.key ? 'bg-brand-600/20 text-brand-300' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              "{obj.label}"
            </button>
          ))}
        </div>
        {objectionResponses && (
          <div className="mt-2 space-y-2">
            {objectionResponses.responses.map((r, i) => (
              <SuggestionCard key={i} text={r.text} label={r.variant} onUse={() => onUseSuggestion(r.text, 'objection')} disabled={isVisitor} />
            ))}
          </div>
        )}
      </Section>

      {/* Refish */}
      {suggestions.refish?.length > 0 && (
        <Section title="Repescagem" icon={MessageCircle} expanded={expandedSection === 'refish'} onToggle={() => toggle('refish')}>
          {suggestions.refish.map((msg, i) => (
            <SuggestionCard key={i} text={msg.text} label={`Refish ${i + 1}`} onUse={() => onUseSuggestion(msg.text, msg.suggestion_type)} disabled={isVisitor} />
          ))}
        </Section>
      )}

      {/* No-show */}
      {suggestions.no_show && (
        <Section title="Recuperação No-Show" icon={Zap} expanded={expandedSection === 'noshow'} onToggle={() => toggle('noshow')}>
          <SuggestionCard text={suggestions.no_show.text} label={`Tentativa ${suggestions.no_show.attempt}`} onUse={() => onUseSuggestion(suggestions.no_show.text, 'cadence_msg')} disabled={isVisitor} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, expanded, onToggle, children }) {
  return (
    <div className="border-b border-gray-800/50">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800/30 transition">
        <Icon size={14} className="text-gray-500" />
        <span className="flex-1 text-left">{title}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && <div className="pb-3">{children}</div>}
    </div>
  );
}

function SuggestionCard({ text, label, onUse, disabled }) {
  return (
    <div className="mx-3 mb-2 bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
      <p className="text-xs text-gray-300 whitespace-pre-wrap mb-2">{text}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">{label}</span>
        <button
          onClick={onUse}
          disabled={disabled}
          className="text-[10px] bg-brand-600/20 text-brand-400 px-2 py-1 rounded hover:bg-brand-600/40 transition disabled:opacity-30"
        >
          Usar
        </button>
      </div>
    </div>
  );
}
