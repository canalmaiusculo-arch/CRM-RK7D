import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import { getDb } from '../models/database.js';

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.client = null;
    this.status = 'disconnected'; // disconnected, qr_pending, connecting, ready
    this.qrCode = null;
  }

  async initialize() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
        ],
      },
    });

    this.client.on('qr', async (qr) => {
      this.status = 'qr_pending';
      this.qrCode = await qrcode.toDataURL(qr);
      this.io.emit('whatsapp:qr', { qr: this.qrCode });
      this.io.emit('whatsapp:status', { status: this.status });
    });

    this.client.on('ready', () => {
      this.status = 'ready';
      this.qrCode = null;
      this.io.emit('whatsapp:status', { status: this.status });
      console.log('[WhatsApp] Client ready');
    });

    this.client.on('authenticated', () => {
      this.status = 'connecting';
      this.io.emit('whatsapp:status', { status: this.status });
    });

    this.client.on('auth_failure', () => {
      this.status = 'disconnected';
      this.io.emit('whatsapp:status', { status: this.status });
    });

    this.client.on('disconnected', () => {
      this.status = 'disconnected';
      this.qrCode = null;
      this.io.emit('whatsapp:status', { status: this.status });
    });

    // Handle incoming messages
    this.client.on('message', async (msg) => {
      await this.handleIncomingMessage(msg);
    });

    try {
      await this.client.initialize();
    } catch (err) {
      console.error('[WhatsApp] Init error:', err.message);
      this.status = 'disconnected';
    }
  }

  async handleIncomingMessage(msg) {
    const db = getDb();
    const contact = await msg.getContact();
    const phone = msg.from.replace('@c.us', '');

    // Find or create lead
    let lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(phone);

    if (!lead) {
      const name = contact.pushname || contact.name || phone;
      db.prepare(
        'INSERT INTO leads (name, phone, whatsapp_chat_id, source) VALUES (?, ?, ?, ?)'
      ).run(name, phone, msg.from, 'whatsapp_inbound');

      lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(phone);

      // Emit new lead event
      this.io.emit('lead:new', lead);
    }

    // Save message
    const messageType = msg.hasMedia ? (msg.type || 'media') : 'text';
    const content = msg.body || `[${messageType}]`;

    db.prepare(
      'INSERT INTO messages (lead_id, direction, content, message_type, whatsapp_msg_id) VALUES (?, ?, ?, ?, ?)'
    ).run(lead.id, 'inbound', content, messageType, msg.id._serialized);

    // Update lead's last contact and chat id
    db.prepare(
      'UPDATE leads SET last_contact_at = datetime("now"), whatsapp_chat_id = ?, updated_at = datetime("now") WHERE id = ?'
    ).run(msg.from, lead.id);

    // Emit message to frontend
    const savedMsg = db.prepare(
      'SELECT * FROM messages WHERE whatsapp_msg_id = ?'
    ).get(msg.id._serialized);

    this.io.emit('message:new', {
      ...savedMsg,
      lead_id: lead.id,
      lead_name: lead.name,
      lead_phone: lead.phone,
    });
  }

  async sendMessage(phone, content) {
    if (this.status !== 'ready') {
      throw new Error('WhatsApp not connected');
    }

    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;

    try {
      const sent = await this.client.sendMessage(chatId, content);

      // Save to database
      const db = getDb();
      const lead = db.prepare('SELECT * FROM leads WHERE phone = ? OR whatsapp_chat_id = ?')
        .get(phone.replace('@c.us', ''), chatId);

      if (lead) {
        db.prepare(
          'INSERT INTO messages (lead_id, direction, content, message_type, whatsapp_msg_id) VALUES (?, ?, ?, ?, ?)'
        ).run(lead.id, 'outbound', content, 'text', sent.id._serialized);

        db.prepare(
          'UPDATE leads SET last_contact_at = datetime("now"), updated_at = datetime("now") WHERE id = ?'
        ).run(lead.id);
      }

      return sent;
    } catch (err) {
      console.error('[WhatsApp] Send error:', err.message);
      throw err;
    }
  }

  async sendAudio(phone, audioBase64) {
    if (this.status !== 'ready') throw new Error('WhatsApp not connected');
    const chatId = phone.includes('@c.us') ? phone : `${phone}@c.us`;
    const media = new MessageMedia('audio/ogg; codecs=opus', audioBase64);
    return this.client.sendMessage(chatId, media, { sendAudioAsVoice: true });
  }

  getStatus() {
    return { status: this.status, qr: this.qrCode };
  }

  async logout() {
    if (this.client) {
      await this.client.logout();
      this.status = 'disconnected';
      this.qrCode = null;
    }
  }
}

export default WhatsAppService;
