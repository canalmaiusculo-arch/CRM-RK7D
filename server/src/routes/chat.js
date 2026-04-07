import { Router } from 'express';
import { getDb } from '../models/database.js';
import { writeGuard } from '../middleware/auth.js';

export default function chatRouter(services) {
  const router = Router();
  const { whatsapp, io } = services;

  // GET /api/chat/conversations — list all conversations (leads with messages)
  router.get('/conversations', (req, res) => {
    const db = getDb();
    const conversations = db.prepare(`
      SELECT l.*,
        m.content as last_message,
        m.direction as last_direction,
        m.sent_at as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE lead_id = l.id) as message_count
      FROM leads l
      INNER JOIN messages m ON m.id = (
        SELECT id FROM messages WHERE lead_id = l.id ORDER BY sent_at DESC LIMIT 1
      )
      ORDER BY m.sent_at DESC
    `).all();
    res.json(conversations);
  });

  // GET /api/chat/:leadId/messages — get all messages for a lead
  router.get('/:leadId/messages', (req, res) => {
    const db = getDb();
    const messages = db.prepare(
      'SELECT * FROM messages WHERE lead_id = ? ORDER BY sent_at ASC'
    ).all(req.params.leadId);
    res.json(messages);
  });

  // POST /api/chat/:leadId/send — send a message via WhatsApp
  router.post('/:leadId/send', writeGuard, async (req, res) => {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.leadId);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const { content, suggestion_type } = req.body;
    if (!content) return res.status(400).json({ error: 'Mensagem vazia' });

    try {
      await whatsapp.sendMessage(lead.phone, content);

      // The message is saved by the WhatsApp service on send
      // But we also mark suggestion_type if it came from SDR assistant
      if (suggestion_type) {
        const lastMsg = db.prepare(
          'SELECT id FROM messages WHERE lead_id = ? ORDER BY sent_at DESC LIMIT 1'
        ).get(lead.id);
        if (lastMsg) {
          db.prepare('UPDATE messages SET is_suggestion = 1, suggestion_type = ? WHERE id = ?')
            .run(suggestion_type, lastMsg.id);
        }
      }

      // Update cadence day
      db.prepare('UPDATE leads SET cadence_day = cadence_day + 1, updated_at = datetime("now") WHERE id = ?')
        .run(lead.id);

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/chat/status — WhatsApp connection status
  router.get('/status', (req, res) => {
    res.json(whatsapp.getStatus());
  });

  // POST /api/chat/connect — initiate WhatsApp connection (triggers QR)
  router.post('/connect', writeGuard, async (req, res) => {
    try {
      whatsapp.initialize();
      res.json({ ok: true, message: 'Iniciando conexão. Aguarde o QR code.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/disconnect — disconnect WhatsApp
  router.post('/disconnect', writeGuard, async (req, res) => {
    try {
      await whatsapp.logout();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
