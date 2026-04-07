import { getDb } from '../models/database.js';
import crypto from 'crypto';

/**
 * Meta Conversions API (CAPI) Service
 *
 * Sends conversion events to Meta when leads move through pipeline stages.
 * Based on the tracking document's architecture:
 *   Lead Novo       -> Lead event
 *   Agendado        -> Schedule event
 *   Show            -> QualifiedLead event (custom)
 *   Fechado (Won)   -> Purchase event
 *
 * Uses server-side CAPI (no pixel needed on this CRM - events come from pipeline moves).
 */
class MetaCAPIService {
  constructor() {
    this.pixelId = process.env.META_PIXEL_ID || '';
    this.accessToken = process.env.META_ACCESS_TOKEN || '';
    this.eventSourceUrl = process.env.META_EVENT_SOURCE_URL || 'https://rkpulsedigital.com';
    this.apiVersion = 'v21.0';
    this.testEventCode = process.env.META_TEST_EVENT_CODE || ''; // For testing
  }

  isConfigured() {
    return !!(this.pixelId && this.accessToken);
  }

  updateConfig({ pixelId, accessToken, eventSourceUrl, testEventCode }) {
    if (pixelId) this.pixelId = pixelId;
    if (accessToken) this.accessToken = accessToken;
    if (eventSourceUrl) this.eventSourceUrl = eventSourceUrl;
    if (testEventCode !== undefined) this.testEventCode = testEventCode;

    // Persist to settings
    const db = getDb();
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now")) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime("now")'
    );
    if (pixelId) upsert.run('meta_pixel_id', pixelId, pixelId);
    if (accessToken) upsert.run('meta_access_token', accessToken, accessToken);
    if (eventSourceUrl) upsert.run('meta_event_source_url', eventSourceUrl, eventSourceUrl);
    if (testEventCode !== undefined) upsert.run('meta_test_event_code', testEventCode, testEventCode);
  }

  loadConfig() {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'meta_%'").all();
    for (const row of rows) {
      switch (row.key) {
        case 'meta_pixel_id': this.pixelId = row.value; break;
        case 'meta_access_token': this.accessToken = row.value; break;
        case 'meta_event_source_url': this.eventSourceUrl = row.value; break;
        case 'meta_test_event_code': this.testEventCode = row.value; break;
      }
    }
  }

  /**
   * Hash user data for Meta (SHA-256, lowercase, trimmed)
   */
  hashData(value) {
    if (!value) return undefined;
    return crypto.createHash('sha256').update(value.toString().toLowerCase().trim()).digest('hex');
  }

  /**
   * Generate unique event ID for deduplication
   */
  generateEventId() {
    return `crm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Build user_data object from lead info
   * Following the tracking doc's User Data structure for CAPI
   */
  buildUserData(lead) {
    const userData = {};

    if (lead.email) userData.em = [this.hashData(lead.email)];
    if (lead.phone) userData.ph = [this.hashData(lead.phone)];
    if (lead.name) {
      const parts = lead.name.trim().split(/\s+/);
      userData.fn = [this.hashData(parts[0])];
      if (parts.length > 1) userData.ln = [this.hashData(parts[parts.length - 1])];
    }
    if (lead.state) userData.st = [this.hashData(lead.state)];
    userData.country = [this.hashData('us')]; // All leads are in the US

    // Include fbc/fbp if available (from original tracking)
    if (lead.fbc) userData.fbc = lead.fbc;
    if (lead.fbp) userData.fbp = lead.fbp;

    return userData;
  }

  /**
   * Build event source URL with UTMs for proper attribution
   * Mirrors the JS - Event Source URL from the tracking document
   */
  buildEventSourceUrl(lead) {
    const base = this.eventSourceUrl;
    const params = [];
    if (lead.utm_source) params.push(`utm_source=${encodeURIComponent(lead.utm_source)}`);
    if (lead.utm_medium) params.push(`utm_medium=${encodeURIComponent(lead.utm_medium)}`);
    if (lead.utm_campaign) params.push(`utm_campaign=${encodeURIComponent(lead.utm_campaign)}`);
    if (lead.utm_content) params.push(`utm_content=${encodeURIComponent(lead.utm_content)}`);
    if (lead.utm_term) params.push(`utm_term=${encodeURIComponent(lead.utm_term)}`);
    return params.length > 0 ? `${base}?${params.join('&')}` : base;
  }

  /**
   * Send event to Meta Conversions API
   */
  async sendEvent(eventName, lead, customData = {}) {
    if (!this.isConfigured()) {
      console.warn('[Meta CAPI] Not configured - skipping event:', eventName);
      return null;
    }

    const eventId = this.generateEventId();
    const eventTime = Math.floor(Date.now() / 1000);

    const event = {
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: 'system_generated',
      event_source_url: this.buildEventSourceUrl(lead),
      user_data: this.buildUserData(lead),
      custom_data: {
        ...customData,
        // Always include UTMs in custom_data for attribution
        utm_source: lead.utm_source || undefined,
        utm_medium: lead.utm_medium || undefined,
        utm_campaign: lead.utm_campaign || undefined,
      },
    };

    // Remove undefined values from custom_data
    Object.keys(event.custom_data).forEach(k => {
      if (event.custom_data[k] === undefined) delete event.custom_data[k];
    });

    const payload = { data: [event] };
    if (this.testEventCode) {
      payload.test_event_code = this.testEventCode;
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events?access_token=${this.accessToken}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[Meta CAPI] Error:', result);
        return { success: false, error: result, eventId };
      }

      console.log(`[Meta CAPI] ${eventName} sent for lead ${lead.id} - events_received: ${result.events_received}`);

      // Record in pipeline history
      const db = getDb();
      db.prepare(
        'UPDATE pipeline_history SET meta_event_sent = ?, meta_event_id = ? WHERE lead_id = ? AND meta_event_sent IS NULL ORDER BY moved_at DESC LIMIT 1'
      ).run(eventName, eventId, lead.id);

      return { success: true, result, eventId };
    } catch (err) {
      console.error('[Meta CAPI] Network error:', err.message);
      return { success: false, error: err.message, eventId };
    }
  }

  // ====================================
  // Pipeline stage event handlers
  // Only 2 events fire to Meta:
  //   Lead     -> when SDR confirms qualification (stage: "show" / Lead Qualificado)
  //   Purchase -> when deal is closed with confirmed value (stage: "won")
  // This keeps the signal clean for Meta's algorithm.
  // ====================================

  /**
   * Lead event — fired ONLY when SDR confirms the contact is qualified.
   * NOT on first message. This ensures the algorithm learns from real prospects.
   */
  async onQualifiedLead(lead) {
    return this.sendEvent('Lead', lead, {
      content_name: `Qualified - ${lead.segment || 'Unknown'} - ${lead.state || 'Unknown'}`,
      lead_event_source: lead.source || 'whatsapp',
      interest_level: lead.interest_level,
      disc_profile: lead.disc_profile,
    });
  }

  /**
   * Purchase event — fired ONLY when sale is confirmed (payment approved / contract signed).
   * MUST include monetary value so Meta can optimize for value, not just volume.
   */
  async onPurchase(lead, dealValue) {
    if (!dealValue || dealValue <= 0) {
      console.warn(`[Meta CAPI] Purchase event for lead ${lead.id} skipped: no deal value provided. Add the value before moving to Won.`);
      return null;
    }
    return this.sendEvent('Purchase', lead, {
      currency: 'USD',
      value: parseFloat(dealValue),
      content_name: `Deal Won - ${lead.segment || 'Unknown'}`,
    });
  }

  /**
   * Handle pipeline stage change - automatically sends the right Meta event
   */
  async onStageChange(lead, fromStage, toStage) {
    const db = getDb();
    const stage = db.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(toStage);

    if (!stage || !stage.meta_event) return null;

    switch (stage.meta_event) {
      case 'Lead': return this.onQualifiedLead(lead);
      case 'Purchase': return this.onPurchase(lead, lead.estimated_revenue);
      default: return null;
    }
  }
}

export default MetaCAPIService;
