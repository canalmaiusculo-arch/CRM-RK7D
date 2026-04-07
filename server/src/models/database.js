import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'crm.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- Pipeline stages matching the SDR playbook
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      color TEXT DEFAULT '#6B7280',
      meta_event TEXT,           -- Meta CAPI event to fire on entry (Lead, Schedule, QualifiedLead, Purchase)
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Leads (contacts/prospects)
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,  -- WhatsApp number (international format)
      email TEXT,
      stage_id TEXT NOT NULL DEFAULT 'new_lead',

      -- Qualification data (Checklist 7/7 from playbook)
      segment TEXT,               -- Painting, Flooring, GC/Remodeling, etc.
      state TEXT,                 -- MA, PA, NJ, GA, FL, etc.
      city TEXT,
      current_acquisition TEXT,   -- How they get clients today
      main_pain TEXT,             -- In THEIR words
      disc_profile TEXT,          -- D, I, S, C
      interest_level INTEGER DEFAULT 3, -- 1-5

      -- Optional but valuable fields
      estimated_revenue TEXT,
      years_in_usa TEXT,
      english_level TEXT,
      previous_marketing TEXT,    -- Past agency experience
      has_partner TEXT,           -- Co-decision maker
      objections_noted TEXT,
      personal_notes TEXT,        -- Connection points (city in Brazil, church, etc.)
      existing_assets TEXT,       -- Site, Google Business, ads already running
      instagram_url TEXT,
      facebook_url TEXT,

      -- Tracking/attribution
      source TEXT,                -- Trafego Google, Meta, Indicacao, Outbound, etc.
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,
      fbclid TEXT,
      fbc TEXT,
      fbp TEXT,
      sck TEXT,                   -- Server Container Key for tracking

      -- SDR management
      assigned_sdr TEXT,
      cadence_day INTEGER DEFAULT 0,
      cadence_phase TEXT DEFAULT 'urgency', -- urgency (0-3), persistence (4-10), rescue (11-21), refish (22-42)
      last_contact_at TEXT,
      next_action TEXT,
      next_action_at TEXT,
      no_show_count INTEGER DEFAULT 0,

      -- Meta
      whatsapp_chat_id TEXT,      -- whatsapp-web.js chat ID
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),

      FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id)
    );

    -- Messages (WhatsApp conversation history)
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      direction TEXT NOT NULL,      -- 'inbound' or 'outbound'
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text', -- text, audio, image, document
      whatsapp_msg_id TEXT,
      is_suggestion INTEGER DEFAULT 0, -- 1 if this was an SDR suggestion
      suggestion_type TEXT,            -- cadence_msg, objection, disc_adapted
      sent_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    -- Pipeline move history (for tracking and Meta CAPI events)
    CREATE TABLE IF NOT EXISTS pipeline_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      meta_event_sent TEXT,        -- Which Meta event was fired
      meta_event_id TEXT,          -- Event ID for deduplication
      moved_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    -- Scheduled reminders/tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      type TEXT NOT NULL,           -- reminder_d1, reminder_d0, follow_up, callback
      description TEXT,
      due_at TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    -- Settings (key-value store for config)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
    CREATE INDEX IF NOT EXISTS idx_leads_disc ON leads(disc_profile);
    CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_history_lead ON pipeline_history(lead_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at, completed);
  `);

  // Seed default pipeline stages (from the SDR playbook Section 16.1)
  const existingStages = db.prepare('SELECT COUNT(*) as count FROM pipeline_stages').get();
  if (existingStages.count === 0) {
    const insertStage = db.prepare(
      'INSERT INTO pipeline_stages (id, name, position, color, meta_event) VALUES (?, ?, ?, ?, ?)'
    );
    const stages = [
      ['new_lead', 'Lead Novo', 1, '#3B82F6', null],
      ['contacting', 'Em Contato', 2, '#8B5CF6', null],
      ['talked', 'Conversou', 3, '#F59E0B', null],
      ['scheduled', 'Agendado', 4, '#10B981', null],
      ['show', 'Lead Qualificado', 5, '#06B6D4', 'Lead'],
      ['proposal', 'Proposta', 6, '#EC4899', null],
      ['won', 'Fechado (Won)', 7, '#22C55E', 'Purchase'],
      ['lost', 'Perdido (Lost)', 8, '#EF4444', null],
      ['refish', 'Repescagem', 9, '#F97316', null],
      ['archive', 'Arquivo', 10, '#6B7280', null],
    ];
    const insertMany = db.transaction(() => {
      for (const s of stages) {
        insertStage.run(...s);
      }
    });
    insertMany();
  }
}

export default { getDb };
