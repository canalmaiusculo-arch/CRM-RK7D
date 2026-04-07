import { Router } from 'express';
import { getDb } from '../models/database.js';
import { writeGuard } from '../middleware/auth.js';

export default function settingsRouter(services) {
  const router = Router();
  const { metaCapi } = services;

  // GET /api/settings — all settings
  router.get('/', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) {
      // Mask sensitive values for visitor
      if (req.user.role === 'visitor' && (r.key.includes('token') || r.key.includes('secret'))) {
        settings[r.key] = '••••••••';
      } else {
        settings[r.key] = r.value;
      }
    }
    // Include Meta CAPI status
    settings.meta_configured = metaCapi.isConfigured();
    res.json(settings);
  });

  // PUT /api/settings/meta — update Meta CAPI config
  router.put('/meta', writeGuard, (req, res) => {
    const { pixelId, accessToken, eventSourceUrl, testEventCode } = req.body;
    metaCapi.updateConfig({ pixelId, accessToken, eventSourceUrl, testEventCode });
    res.json({ ok: true, configured: metaCapi.isConfigured() });
  });

  // POST /api/settings/meta/test — send test event to Meta
  router.post('/meta/test', writeGuard, async (req, res) => {
    if (!metaCapi.isConfigured()) {
      return res.status(400).json({ error: 'Meta CAPI não configurado' });
    }
    const testLead = {
      id: 0, name: 'Test Lead', phone: '11999999999',
      email: 'test@test.com', segment: 'Test', state: 'GA',
    };
    const result = await metaCapi.sendEvent('Lead', testLead, {
      content_name: 'CRM Test Event',
    });
    res.json(result);
  });

  return router;
}
