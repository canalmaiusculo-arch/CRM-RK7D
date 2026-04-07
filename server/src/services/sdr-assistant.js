/**
 * SDR Assistant Service
 *
 * Generates message suggestions based on the RK Pulse Digital SDR playbook.
 * Takes into account: DISC profile, cadence phase/day, pipeline stage,
 * objection handling, and tonality guidelines.
 */

// ============================================================
// CASE DATABASE - Real cases from the playbook for social proof
// ============================================================
const CASES = [
  { name: 'Claudio', segment: 'Painting', state: 'MA', result: 'Em 6 meses investiu menos de $6k e faturou mais de $80k com homeowner direto', context: 'saiu de subcontrato' },
  { name: 'Grazy', segment: 'Cleaning', state: 'PA', result: 'Em 2 anos saiu de 30 pra mais de 100 clientes, montou estrutura pra gerenciar do Brasil', context: 'escala + liberdade' },
  { name: 'Carlos', segment: 'Flooring', state: 'GA', result: 'Primeiro mes investiu $3k e faturou mais de $100k', context: 'ROI imediato' },
  { name: 'Neto', segment: 'Siding', state: 'NW', result: 'Investiu $200 por 1 lead e fechou um contrato de $15k', context: 'ROI absurdo' },
  { name: 'Lazaro', segment: 'Pavers', state: 'CA', result: 'Investiu $1500 fechou $28k', context: 'ticket alto' },
  { name: 'Leo', segment: 'Remodeling', state: 'SC', result: '6 meses sem contrato, 2 semanas conosco fechou primeiro job', context: 'resultado rapido' },
];

// ============================================================
// CADENCE MESSAGES (MSG-01 to MSG-13) from playbook Section 7.2
// ============================================================
const CADENCE_TEMPLATES = {
  // PHASE 1: URGENCY (Day 0-3)
  'MSG-01': {
    phase: 'urgency', day: 0, type: 'sms_whatsapp',
    template: (lead) => `${lead.name}, vi que você se cadastrou pra saber mais sobre captação de homeowner direto. Acabei de te ligar. Posso retornar em outro horário?`,
  },
  'MSG-02': {
    phase: 'urgency', day: 0, type: 'whatsapp_audio',
    template: (lead) => `${lead.name}, aqui é da RK Pulse. Vi que você se cadastrou. Quero te mostrar como nossos clientes estão captando homeowner direto sem depender de indicação. Me retorna quando puder!`,
  },
  'MSG-03': {
    phase: 'urgency', day: 1, type: 'whatsapp_text',
    template: (lead) => `${lead.name}, tudo bem? Tentei te ligar hoje cedo. A gente tem ajudado companhias de ${lead.segment || 'home services'} aí em ${lead.state || 'sua região'} a captar homeowner direto. Tem 2 minutos pra gente trocar uma ideia?`,
  },
  'MSG-04': {
    phase: 'urgency', day: 1, type: 'whatsapp_case',
    template: (lead, bestCase) => `${lead.name}, olha esse resultado: ${bestCase.name} de ${bestCase.state}, mesmo segmento — ${bestCase.result}. Nosso especialista mostra como funciona em 15 min.`,
  },
  'MSG-05': {
    phase: 'urgency', day: 2, type: 'sms',
    template: (lead) => `${lead.name}, vi que contractors de ${lead.segment || 'home services'} em ${lead.state || 'sua região'} estão captando homeowner direto. Quero te mostrar como. Me liga quando puder.`,
  },
  'MSG-06': {
    phase: 'urgency', day: 3, type: 'whatsapp_audio',
    template: (lead) => `${lead.name}, aqui é da RK Pulse. Sei que você tá no corre da obra o dia todo. Queria te mostrar algo que pode mudar o jogo da sua companhia de ${lead.segment || 'home services'}. Me retorna quando tiver um minuto!`,
  },

  // PHASE 2: PERSISTENCE (Day 4-10)
  'MSG-07': {
    phase: 'persistence', day: 4, type: 'whatsapp_text',
    template: (lead) => `${lead.name}, a gente tá abrindo as últimas vagas pra companhias de ${lead.segment || 'home services'} em ${lead.state || 'sua região'} pro próximo trimestre. Quero te dar prioridade antes de fechar. Bora conversar?`,
  },
  'MSG-08': {
    phase: 'persistence', day: 5, type: 'whatsapp_text',
    template: (lead, bestCase) => `${lead.name}, o ${bestCase.name} que é ${bestCase.segment} lá em ${bestCase.state} — ${bestCase.result}. Mesmo segmento que o seu. Nosso especialista mostra como funciona em 15 min. Qual melhor horário pra você?`,
  },
  'MSG-09': {
    phase: 'persistence', day: 7, type: 'whatsapp_content',
    template: (lead) => `${lead.name}, separei um material que mostra como companhias de ${lead.segment || 'home services'} estão captando homeowner direto nos EUA. Sem compromisso, só pra você ver. Quer que eu envie?`,
  },
  'MSG-10': {
    phase: 'persistence', day: 10, type: 'whatsapp_text',
    template: (lead) => `${lead.name}, muita companhia de ${lead.segment || 'home services'} perde job todo dia porque não atende o lead em inglês a tempo. A gente resolve isso pra você. Já pensou em ter um time que atende em 5 minutos em inglês fluente?`,
  },

  // PHASE 3: RESCUE (Day 11-21)
  'MSG-11': {
    phase: 'rescue', day: 14, type: 'whatsapp_text',
    template: (lead) => `${lead.name}, vi que companhias de ${lead.segment || 'home services'} na sua região estão crescendo rápido com captação direta de homeowner. Queria te mostrar como — será que não tá na hora de dar esse passo?`,
  },
  'MSG-12': {
    phase: 'rescue', day: 17, type: 'whatsapp_text',
    template: (lead) => `${lead.name}, já tentei te contatar algumas vezes. Sei que você é ocupado e tá no trabalho o dia todo. Só queria te dar a chance de ver o que nossos clientes estão fazendo. Se não for o momento, tudo bem — fica aberto pra quando fizer sentido.`,
  },
  'MSG-13': {
    phase: 'rescue', day: 21, type: 'whatsapp_text',
    template: (lead) => `${lead.name}, última mensagem minha. Sei que o timing pode não ser agora e respeito isso. Se no futuro você quiser captar homeowner direto sem depender de indicação, é só me chamar aqui. Desejo sucesso! Abraço!`,
  },
};

// ============================================================
// DISC-ADAPTED OPENERS
// ============================================================
const DISC_OPENERS = {
  D: (lead) => `${lead.name}, sou da RK Pulse. Vi que você se cadastrou. Quero ser direto: a gente agenda homeowner pra você em inglês. 3 minutos te explico.`,
  I: (lead) => `${lead.name}, tudo bem? Aqui é da RK Pulse! Vi que você tem uma companhia forte aí em ${lead.state || 'sua região'}. Cara, deixa eu te contar rapidinho o que a galera do seu segmento tá fazendo pra lotar a agenda...`,
  S: (lead) => `${lead.name}, tudo bem? Aqui é da RK Pulse. Vi que você se cadastrou e quero entender um pouco melhor sua situação antes de qualquer coisa. Sem compromisso nenhum, sem pressão.`,
  C: (lead) => `${lead.name}, aqui é da RK Pulse. Quero te dar uma visão geral do nosso sistema e responder qualquer dúvida. Temos dados específicos da sua região.`,
};

// ============================================================
// ACCUSATION AUDIT - Pre-emptive objection handling
// ============================================================
const ACCUSATION_AUDITS = {
  universal: (lead) => `${lead.name}, antes de mais nada, eu sei que provavelmente você já ouviu promessa de agência que não cumpriu. Talvez até já investiu em algo que não deu o retorno que esperava. Não to aqui pra te vender nada — só quero entender se o que a gente faz tem sentido pro seu momento.`,
  D: (lead) => `${lead.name}, sei que você entende do seu negócio e não tem tempo pra conversa fiada. Me dá 3 minutos pra ver se faz sentido e te mostro os números. Se não fizer, a gente encerra sem problemas.`,
  I: (lead) => `${lead.name}, sei que a galera da nossa comunidade já viu muito golpe de agência por aí. A gente é diferente — não é agência, é um sistema de vendas. Deixa eu te contar rapidinho como funciona porque você vai curtir.`,
  S: (lead) => `${lead.name}, entendo totalmente se você tá com pé atrás. Muita gente que nos procura já passou por experiências frustrantes. A gente não trabalha com fidelidade, tudo que cria é seu, e eu não vou te pressionar a nada. Só quero te mostrar o que entregamos e você decide.`,
  C: (lead) => `${lead.name}, provavelmente você já pesquisou bastante antes de se cadastrar. Tenho todos os dados e números pra te mostrar — CPL, taxa de conversão, ROI por região. Nosso especialista faz uma análise completa da sua área. Sem compromisso, só informação pra você avaliar.`,
};

// ============================================================
// OBJECTION RESPONSES (A-C-E framework) adapted per DISC
// ============================================================
const OBJECTIONS = {
  'agency_trauma': {
    label: 'Já gastei com agência e não funcionou',
    universal: 'Entendo totalmente. Muita gente que nos procura passou por isso. Agência faz MKT — gera clique. Nós fazemos VENDA — time inglês liga em 5 min e agenda. São coisas diferentes. O especialista mostra a diferença e você decide.',
    D: 'Agência faz marketing. A gente faz vendas. Nosso especialista te mostra números em 15 min.',
    I: (bestCase) => `O ${bestCase.name} de ${bestCase.state} teve mesma história — gastou e nada. Com a gente: resultado no primeiro mês.`,
    S: 'Totalmente compreensível. Por isso não temos fidelidade. Tudo é seu. Sem risco ouvir o especialista.',
    C: 'Qual era o CPL deles? Quantos leads geraram? Nosso especialista compara os números. Você decide com dados.',
  },
  'no_budget': {
    label: 'Não tenho orçamento agora',
    universal: 'Quanto você PERDE por mês sem o sistema? Um contrato paga o investimento várias vezes.',
    D: 'Um projeto = $5k+. Uma venda paga 4x o investimento. Você sabe que isso é ROI.',
    I: (bestCase) => `${bestCase.name} investiu pouco e o retorno foi absurdo. Imagina você com 10 leads/mês.`,
    S: 'Sem compromisso ouvir. Se não fizer sentido, zero pressão. Mas pelo menos você sabe.',
    C: 'Lead custa ~$36. 10 leads = $360. Fecha 3 projetos a $5k = $15k. ROI 41x. O especialista mostra da SUA região.',
  },
  'need_to_think': {
    label: 'Vou pensar / Preciso de tempo',
    universal: 'O que especificamente ficou na dúvida? A call é justamente pra esclarecer. Marca sem compromisso e pensa DEPOIS com informação completa.',
    D: 'Pensar em quê? Se for preço, especialista resolve em 15 min. Se for resultado, ele mostra números.',
    I: 'Entendo! O que ficou na cabeça? Às vezes conversando já resolve.',
    S: 'Sem pressa. Mas tem algo que te deixou inseguro? Especialista esclarece sem pressão.',
    C: 'Quais pontos quer analisar? Especialista pode te dar exatamente esses dados na call.',
  },
  'talk_to_partner': {
    label: 'Preciso falar com sócio/esposa',
    universal: 'Traz ele(a) pra call! Vocês dois ouvem do especialista e decidem juntos. Que dia funciona pra vocês dois?',
  },
  'referrals_work': {
    label: 'Trabalho com indicação e funciona',
    universal: 'Indicação é ótimo. Mas você controla quantas vai receber mês que vem? Nosso sistema dá PREVISIBILIDADE. E COMPLEMENTA a indicação.',
  },
  'have_thumbtack': {
    label: 'Tenho Thumbtack/Angi',
    universal: 'Lead compartilhado com 5+ contractors vs lead EXCLUSIVO com atendimento em inglês em 5 min. São mundos diferentes. O especialista mostra a comparação.',
  },
  'dont_believe_marketing': {
    label: 'Não acredito em marketing',
    universal: 'Concordo! Por isso NÃO fazemos marketing — fazemos SISTEMA DE VENDAS. Time comercial em inglês que liga em 5 min e agenda o estimate. É vendas, não marketing.',
  },
  'no_time_meeting': {
    label: 'Sem tempo pra reunião',
    universal: '40 minutos. Pode ser no almoço, fim do dia, sábado. Pra nunca mais perder lead por não atender em inglês a tempo.',
  },
  'too_expensive': {
    label: 'É caro',
    universal: 'Quanto custa o tempo perdido fazendo as mesmas coisas sem resultado? Um contrato paga o investimento inteiro.',
  },
  'winter_slow': {
    label: 'Inverno / sem serviço agora',
    universal: 'Quem monta o sistema ANTES da temporada sai na frente com 3x mais resultado. Agora é o momento ideal pra preparar.',
  },
  'already_have_marketing': {
    label: 'Já tenho quem cuida do meu marketing',
    universal: 'Ótimo! Mas ele atende lead em inglês em 5 min e agenda estimate? A gente COMPLEMENTA o marketing dele — a gente faz a parte comercial.',
  },
  'satisfied': {
    label: 'Tô satisfeito com resultados atuais',
    universal: 'Satisfeito ou no MÁXIMO? O especialista mostra o potencial real da sua região. Talvez você esteja deixando muito dinheiro na mesa.',
  },
};

// ============================================================
// CTA TEMPLATES per DISC
// ============================================================
const CTA_TEMPLATES = {
  D: (lead) => `Terça ou quinta, qual melhor pra você? 15 minutos com nosso especialista.`,
  I: (lead) => `Cara, vamos juntos? Nosso especialista te mostra tudo. Qual dia funciona?`,
  S: (lead) => `Que tal dar uma olhada sem compromisso? Nosso especialista faz uma análise gratuita. Se não fizer sentido, zero pressão.`,
  C: (lead) => `Nosso especialista faz uma análise completa da sua região — dados de busca, concorrência, potencial. Sem compromisso, só informação pra você avaliar. Quando fica bom?`,
};

// ============================================================
// REFISH TEMPLATES (Repescagem)
// ============================================================
const REFISH_TEMPLATES = [
  (lead) => `${lead.name}, tenho uma novidade que pode te interessar. Posso te ligar rapidinho?`,
  (lead, bestCase) => `${lead.name}, acabou de sair um resultado novo de companhia de ${lead.segment || 'home services'}: ${bestCase.result}. Queria te mostrar.`,
  (lead) => `${lead.name}, vagas limitadas pra ${lead.state || 'sua região'} no próximo ciclo. Quero te dar prioridade.`,
  (lead) => `${lead.name}, última mensagem. Se no futuro fizer sentido, tô aqui. Sucesso!`,
];

// ============================================================
// MAIN SERVICE CLASS
// ============================================================
class SDRAssistant {

  /**
   * Find the best matching case study for a lead
   */
  findBestCase(lead) {
    // Priority: same state + segment > same segment > same state > any
    let best = CASES.find(c =>
      c.state === lead.state && c.segment?.toLowerCase() === lead.segment?.toLowerCase()
    );
    if (!best) best = CASES.find(c => c.segment?.toLowerCase() === lead.segment?.toLowerCase());
    if (!best) best = CASES.find(c => c.state === lead.state);
    if (!best) best = CASES[2]; // Carlos (flooring GA) as default - strongest result
    return best;
  }

  /**
   * Get the current cadence phase based on day count
   */
  getCadencePhase(day) {
    if (day <= 3) return 'urgency';
    if (day <= 10) return 'persistence';
    if (day <= 21) return 'rescue';
    return 'refish';
  }

  /**
   * Get cadence message suggestion for current day
   */
  getCadenceMessage(lead) {
    const day = lead.cadence_day || 0;
    const phase = this.getCadencePhase(day);
    const bestCase = this.findBestCase(lead);

    // Find messages for current day or closest previous day
    const matches = Object.entries(CADENCE_TEMPLATES)
      .filter(([_, msg]) => msg.phase === phase && msg.day <= day)
      .sort(([_, a], [__, b]) => b.day - a.day);

    if (matches.length === 0) return [];

    return matches.slice(0, 3).map(([code, msg]) => ({
      code,
      type: msg.type,
      phase,
      day: msg.day,
      text: msg.template(lead, bestCase),
      suggestion_type: 'cadence_msg',
    }));
  }

  /**
   * Get DISC-adapted opener
   */
  getOpener(lead) {
    const disc = lead.disc_profile || 'S'; // Default to S (most common)
    const opener = DISC_OPENERS[disc];
    if (!opener) return null;

    return {
      type: 'opener',
      disc: disc,
      text: opener(lead),
      suggestion_type: 'disc_adapted',
    };
  }

  /**
   * Get accusation audit suggestion
   */
  getAccusationAudit(lead) {
    const disc = lead.disc_profile;
    const suggestions = [
      { type: 'accusation_audit', variant: 'universal', text: ACCUSATION_AUDITS.universal(lead), suggestion_type: 'accusation_audit' },
    ];

    if (disc && ACCUSATION_AUDITS[disc]) {
      suggestions.unshift({
        type: 'accusation_audit',
        variant: `disc_${disc}`,
        text: ACCUSATION_AUDITS[disc](lead),
        suggestion_type: 'disc_adapted',
      });
    }

    return suggestions;
  }

  /**
   * Get objection response suggestions
   */
  getObjectionResponse(lead, objectionKey) {
    const objection = OBJECTIONS[objectionKey];
    if (!objection) return null;

    const disc = lead.disc_profile;
    const bestCase = this.findBestCase(lead);
    const suggestions = [
      { label: objection.label, variant: 'universal', text: objection.universal, suggestion_type: 'objection' },
    ];

    if (disc && objection[disc]) {
      const discResponse = typeof objection[disc] === 'function'
        ? objection[disc](bestCase)
        : objection[disc];
      suggestions.unshift({
        label: objection.label,
        variant: `disc_${disc}`,
        text: discResponse,
        suggestion_type: 'objection',
      });
    }

    return suggestions;
  }

  /**
   * Get all available objection keys
   */
  getObjectionsList() {
    return Object.entries(OBJECTIONS).map(([key, obj]) => ({
      key,
      label: obj.label,
    }));
  }

  /**
   * Get CTA suggestion based on DISC
   */
  getCTA(lead) {
    const disc = lead.disc_profile || 'S';
    return {
      type: 'cta',
      disc,
      text: CTA_TEMPLATES[disc](lead),
      suggestion_type: 'disc_adapted',
    };
  }

  /**
   * Get refish (repescagem) suggestions
   */
  getRefishMessages(lead) {
    const bestCase = this.findBestCase(lead);
    return REFISH_TEMPLATES.map((tmpl, i) => ({
      type: 'refish',
      index: i,
      text: tmpl(lead, bestCase),
      suggestion_type: 'cadence_msg',
    }));
  }

  /**
   * Get no-show recovery message
   */
  getNoShowRecovery(lead) {
    const count = lead.no_show_count || 0;
    const messages = [
      `${lead.name}, percebi que não conseguiu entrar na call. Tudo bem? Aconteceu alguma coisa? Posso remarcar pra outro horário.`,
      `${lead.name}, nosso especialista tá com a agenda aberta amanhã. Quer garantir um horário?`,
      `${lead.name}, entendo que o dia a dia é corrido. Nosso especialista tem um horário amanhã mas depois só na próxima semana. Quer remarcar?`,
    ];

    return {
      type: 'no_show_recovery',
      attempt: count + 1,
      text: messages[Math.min(count, messages.length - 1)],
      suggestion_type: 'cadence_msg',
    };
  }

  /**
   * Get comprehensive suggestions for a lead based on their current state
   */
  getSuggestions(lead) {
    const suggestions = {
      cadence: [],
      opener: null,
      accusation_audit: [],
      cta: null,
      objections: this.getObjectionsList(),
      no_show: null,
      refish: [],
      best_case: this.findBestCase(lead),
      cadence_phase: this.getCadencePhase(lead.cadence_day || 0),
    };

    const stage = lead.stage_id;

    // Cadence messages for active leads
    if (['new_lead', 'contacting', 'talked'].includes(stage)) {
      suggestions.cadence = this.getCadenceMessage(lead);
      suggestions.opener = this.getOpener(lead);
      suggestions.accusation_audit = this.getAccusationAudit(lead);
      suggestions.cta = this.getCTA(lead);
    }

    // No-show recovery for scheduled leads
    if (stage === 'scheduled' && lead.no_show_count > 0) {
      suggestions.no_show = this.getNoShowRecovery(lead);
    }

    // Refish messages
    if (stage === 'refish') {
      suggestions.refish = this.getRefishMessages(lead);
    }

    return suggestions;
  }
}

export default SDRAssistant;
