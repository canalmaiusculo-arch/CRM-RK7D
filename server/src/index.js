import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './models/database.js';
import WhatsAppService from './services/whatsapp.js';
import MetaCAPIService from './services/meta-capi.js';
import SDRAssistant from './services/sdr-assistant.js';
import { login, getMe, authMiddleware, writeGuard, socketAuthMiddleware } from './middleware/auth.js';
import leadsRouter from './routes/leads.js';
import pipelineRouter from './routes/pipeline.js';
import chatRouter from './routes/chat.js';
import settingsRouter from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001');

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Socket.io
  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:5173'],
      credentials: true,
    },
  });
  io.use(socketAuthMiddleware);

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:5173'],
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

  // Init database
  getDb();

  // Init services
  const metaCapi = new MetaCAPIService();
  metaCapi.loadConfig();

  const sdrAssistant = new SDRAssistant();
  const whatsapp = new WhatsAppService(io);

  const services = { whatsapp, metaCapi, sdrAssistant, io };

  // ---- Public routes (no auth) ----
  app.post('/api/auth/login', login);
  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  // ---- Protected routes ----
  app.use('/api', authMiddleware);
  app.get('/api/auth/me', getMe);
  app.use('/api/leads', leadsRouter(services));
  app.use('/api/pipeline', pipelineRouter());
  app.use('/api/chat', chatRouter(services));
  app.use('/api/settings', settingsRouter(services));

  // Serve static frontend in production
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });

  // Socket.io events
  io.on('connection', (socket) => {
    console.log(`[Socket] ${socket.user.username} connected (${socket.user.role})`);

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.username} disconnected`);
    });
  });

  // Start WhatsApp (auto-connect if previously authenticated)
  whatsapp.initialize().catch(err => {
    console.log('[WhatsApp] Will connect when QR is scanned:', err.message);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Meta CAPI] ${metaCapi.isConfigured() ? 'Configured' : 'Not configured - set META_PIXEL_ID and META_ACCESS_TOKEN'}`);
  });
}

startServer().catch(console.error);
