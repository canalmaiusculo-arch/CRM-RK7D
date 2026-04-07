import crypto from 'crypto';

/**
 * Auth system with visitor read-only user.
 *
 * Users:
 *   - admin (configurable via env) -> full access
 *   - visitante / 123 -> read-only, can view everything but can't interact
 *
 * Uses simple token-based auth (no JWT library needed).
 * Tokens are stored in-memory (reset on server restart = re-login).
 */

const tokens = new Map(); // token -> { username, role, createdAt }

const USERS = {
  admin: {
    password: process.env.ADMIN_PASSWORD || 'admin123',
    role: 'admin',
  },
  visitante: {
    password: '123',
    role: 'visitor', // read-only
    locked: true,    // can't change password
  },
};

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Login endpoint handler
 */
export function login(req, res) {
  const { username, password } = req.body;
  const user = USERS[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = generateToken();
  tokens.set(token, {
    username,
    role: user.role,
    createdAt: Date.now(),
  });

  res.json({
    token,
    user: {
      username,
      role: user.role,
      locked: user.locked || false,
    },
  });
}

/**
 * Get current user info
 */
export function getMe(req, res) {
  res.json({
    username: req.user.username,
    role: req.user.role,
  });
}

/**
 * Auth middleware — validates token from Authorization header
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);
  const session = tokens.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  req.user = session;
  next();
}

/**
 * Middleware that blocks write operations for visitor role
 */
export function writeGuard(req, res, next) {
  if (req.user && req.user.role === 'visitor') {
    return res.status(403).json({
      error: 'Acesso somente leitura',
      message: 'Usuário visitante pode apenas visualizar. Para interagir, entre com uma conta com permissão.',
    });
  }
  next();
}

/**
 * Socket.io auth middleware
 */
export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token não fornecido'));

  const session = tokens.get(token);
  if (!session) return next(new Error('Token inválido'));

  socket.user = session;
  next();
}
