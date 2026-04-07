import { Router } from 'express';
import { getDb } from '../models/database.js';

export default function pipelineRouter() {
  const router = Router();

  // GET /api/pipeline — all stages with lead counts
  router.get('/', (req, res) => {
    const db = getDb();
    const stages = db.prepare(`
      SELECT ps.*, COUNT(l.id) as lead_count
      FROM pipeline_stages ps
      LEFT JOIN leads l ON l.stage_id = ps.id
      GROUP BY ps.id
      ORDER BY ps.position
    `).all();
    res.json(stages);
  });

  // GET /api/pipeline/board — full Kanban board (stages + leads)
  router.get('/board', (req, res) => {
    const db = getDb();
    const stages = db.prepare('SELECT * FROM pipeline_stages ORDER BY position').all();
    const leads = db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all();

    const board = stages.map(stage => ({
      ...stage,
      leads: leads.filter(l => l.stage_id === stage.id),
    }));
    res.json(board);
  });

  // GET /api/pipeline/stats — dashboard metrics
  router.get('/stats', (req, res) => {
    const db = getDb();

    const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
    const byStage = db.prepare(`
      SELECT stage_id, COUNT(*) as count FROM leads GROUP BY stage_id
    `).all();
    const byDisc = db.prepare(`
      SELECT disc_profile, COUNT(*) as count FROM leads WHERE disc_profile IS NOT NULL GROUP BY disc_profile
    `).all();
    const bySegment = db.prepare(`
      SELECT segment, COUNT(*) as count FROM leads WHERE segment IS NOT NULL GROUP BY segment ORDER BY count DESC LIMIT 10
    `).all();
    const recentLeads = db.prepare(`
      SELECT * FROM leads ORDER BY created_at DESC LIMIT 5
    `).all();
    const metaEvents = db.prepare(`
      SELECT meta_event_sent, COUNT(*) as count FROM pipeline_history WHERE meta_event_sent IS NOT NULL GROUP BY meta_event_sent
    `).all();
    const todayLeads = db.prepare(`
      SELECT COUNT(*) as count FROM leads WHERE date(created_at) = date('now')
    `).get().count;
    const wonThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM pipeline_history WHERE to_stage = 'won' AND strftime('%Y-%m', moved_at) = strftime('%Y-%m', 'now')
    `).get().count;

    res.json({
      totalLeads,
      todayLeads,
      wonThisMonth,
      byStage,
      byDisc,
      bySegment,
      recentLeads,
      metaEvents,
    });
  });

  return router;
}
