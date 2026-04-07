import { Router } from 'express';
import { getDb } from '../models/database.js';
import { writeGuard } from '../middleware/auth.js';

export default function leadsRouter(services) {
  const router = Router();
  const { metaCapi, sdrAssistant, io } = services;

  // GET /api/leads — list all leads (with optional filters)
  router.get('/', (req, res) => {
    const db = getDb();
    const { stage, disc, segment, state, search } = req.query;
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (stage) { sql += ' AND stage_id = ?'; params.push(stage); }
    if (disc) { sql += ' AND disc_profile = ?'; params.push(disc); }
    if (segment) { sql += ' AND segment = ?'; params.push(segment); }
    if (state) { sql += ' AND state = ?'; params.push(state); }
    if (search) { sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    sql += ' ORDER BY updated_at DESC';
    const leads = db.prepare(sql).all(...params);
    res.json(leads);
  });

  // GET /api/leads/:id — single lead with messages
  router.get('/:id', (req, res) => {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const messages = db.prepare('SELECT * FROM messages WHERE lead_id = ? ORDER BY sent_at ASC').all(lead.id);
    const history = db.prepare('SELECT * FROM pipeline_history WHERE lead_id = ? ORDER BY moved_at DESC').all(lead.id);
    const tasks = db.prepare('SELECT * FROM tasks WHERE lead_id = ? ORDER BY due_at ASC').all(lead.id);

    res.json({ ...lead, messages, history, tasks });
  });

  // POST /api/leads — create lead
  router.post('/', writeGuard, (req, res) => {
    const db = getDb();
    const fields = req.body;

    // Check for duplicate phone
    const existing = db.prepare('SELECT id FROM leads WHERE phone = ?').get(fields.phone);
    if (existing) return res.status(409).json({ error: 'Lead com esse telefone já existe', lead_id: existing.id });

    const result = db.prepare(`
      INSERT INTO leads (name, phone, email, stage_id, segment, state, city, source,
        disc_profile, interest_level, current_acquisition, main_pain,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        fbclid, fbc, fbp, sck, assigned_sdr, instagram_url, personal_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fields.name, fields.phone, fields.email || null, fields.stage_id || 'new_lead',
      fields.segment || null, fields.state || null, fields.city || null, fields.source || null,
      fields.disc_profile || null, fields.interest_level || 3,
      fields.current_acquisition || null, fields.main_pain || null,
      fields.utm_source || null, fields.utm_medium || null, fields.utm_campaign || null,
      fields.utm_content || null, fields.utm_term || null,
      fields.fbclid || null, fields.fbc || null, fields.fbp || null, fields.sck || null,
      fields.assigned_sdr || null, fields.instagram_url || null, fields.personal_notes || null
    );

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);

    // Record pipeline history
    db.prepare('INSERT INTO pipeline_history (lead_id, to_stage) VALUES (?, ?)').run(lead.id, lead.stage_id);

    // Fire Meta event if applicable
    const stage = db.prepare('SELECT meta_event FROM pipeline_stages WHERE id = ?').get(lead.stage_id);
    if (stage?.meta_event) {
      metaCapi.onStageChange(lead, null, lead.stage_id);
    }

    io.emit('lead:new', lead);
    res.status(201).json(lead);
  });

  // PUT /api/leads/:id — update lead
  router.put('/:id', writeGuard, (req, res) => {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const fields = req.body;
    const updates = [];
    const params = [];

    const allowedFields = [
      'name', 'phone', 'email', 'segment', 'state', 'city', 'source',
      'disc_profile', 'interest_level', 'current_acquisition', 'main_pain',
      'estimated_revenue', 'years_in_usa', 'english_level', 'previous_marketing',
      'has_partner', 'objections_noted', 'personal_notes', 'existing_assets',
      'instagram_url', 'facebook_url', 'assigned_sdr', 'cadence_day', 'cadence_phase',
      'next_action', 'next_action_at', 'no_show_count',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'fbc', 'fbp', 'sck',
    ];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(fields[field]);
      }
    }

    if (updates.length === 0) return res.json(lead);

    updates.push('updated_at = datetime("now")');
    params.push(req.params.id);

    db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    io.emit('lead:updated', updated);
    res.json(updated);
  });

  // PUT /api/leads/:id/stage — move lead through pipeline
  router.put('/:id/stage', writeGuard, (req, res) => {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const { stage_id, deal_value } = req.body;
    const stage = db.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(stage_id);
    if (!stage) return res.status(400).json({ error: 'Stage inválido' });

    const fromStage = lead.stage_id;

    // Update lead stage
    const updateFields = { stage_id };
    if (deal_value !== undefined) updateFields.estimated_revenue = deal_value;

    db.prepare('UPDATE leads SET stage_id = ?, estimated_revenue = COALESCE(?, estimated_revenue), updated_at = datetime("now") WHERE id = ?')
      .run(stage_id, deal_value || null, lead.id);

    // Record pipeline history
    db.prepare('INSERT INTO pipeline_history (lead_id, from_stage, to_stage) VALUES (?, ?, ?)')
      .run(lead.id, fromStage, stage_id);

    // Fire Meta CAPI event if the stage has one configured
    const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id);
    if (stage.meta_event) {
      metaCapi.onStageChange(updatedLead, fromStage, stage_id).then(result => {
        if (result) {
          io.emit('meta:event', { lead_id: lead.id, event: stage.meta_event, result });
        }
      });
    }

    io.emit('lead:stage_changed', { lead: updatedLead, from: fromStage, to: stage_id });
    res.json(updatedLead);
  });

  // GET /api/leads/:id/suggestions — SDR assistant suggestions
  router.get('/:id/suggestions', (req, res) => {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const suggestions = sdrAssistant.getSuggestions(lead);
    res.json(suggestions);
  });

  // POST /api/leads/:id/suggestions/objection — get objection response
  router.post('/:id/suggestions/objection', (req, res) => {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const { objection_key } = req.body;
    const responses = sdrAssistant.getObjectionResponse(lead, objection_key);
    if (!responses) return res.status(404).json({ error: 'Objeção não encontrada' });

    res.json(responses);
  });

  // DELETE /api/leads/:id
  router.delete('/:id', writeGuard, (req, res) => {
    const db = getDb();
    db.prepare('DELETE FROM messages WHERE lead_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pipeline_history WHERE lead_id = ?').run(req.params.id);
    db.prepare('DELETE FROM tasks WHERE lead_id = ?').run(req.params.id);
    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    io.emit('lead:deleted', { id: parseInt(req.params.id) });
    res.json({ ok: true });
  });

  return router;
}
