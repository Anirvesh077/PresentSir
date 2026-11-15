import crypto from 'node:crypto';

export function hashPassword(password, salt = crypto.randomBytes(8).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const attempt = crypto.scryptSync(password, salt, 32);
  return crypto.timingSafeEqual(attempt, Buffer.from(hash, 'hex'));
}

// Sessions live in memory. Restarting the server logs everyone out, which is fine for a demo.
const sessions = new Map();

export function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId: user.id });
  return token;
}

export function requireAuth(db) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const session = token && sessions.get(token);
    const user = session && db().users.find((u) => u.id === session.userId);
    if (!user) return res.status(401).json({ error: 'Please log in again.' });
    req.user = user;
    next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this.' });
    }
    next();
  };
}
