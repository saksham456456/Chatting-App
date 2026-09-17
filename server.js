const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ── Session Middleware ──

const sessionMiddleware = session({
  secret: 'chatty-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth Middleware ──

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
}

// ────────────────────────────────────────────────
//  Auth Routes
// ────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3–20 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.findUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.createUser(username, passwordHash, displayName || username);

    req.session.userId = result.lastInsertRowid;
    res.json({
      success: true,
      user: {
        id: result.lastInsertRowid,
        username,
        displayName: displayName || username,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.findUserByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.userId = user.id;
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// ────────────────────────────────────────────────
//  API Routes
// ────────────────────────────────────────────────

app.get('/api/me', requireAuth, (req, res) => {
  const user = db.findUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
    },
  });
});

app.get('/api/search', requireAuth, (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length < 1) {
    return res.json({ users: [] });
  }
  const users = db.searchUsers(query.trim(), req.session.userId);
  res.json({ users });
});

app.get('/api/conversations', requireAuth, (req, res) => {
  const conversations = db.getConversationList(req.session.userId);
  res.json({ conversations });
});

app.get('/api/messages/:userId', requireAuth, (req, res) => {
  const partnerId = parseInt(req.params.userId, 10);
  if (isNaN(partnerId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const messages = db.getMessages(req.session.userId, partnerId);
  db.markAsRead(req.session.userId, partnerId);
  res.json({ messages });
});

app.post('/api/messages/:userId/read', requireAuth, (req, res) => {
  const partnerId = parseInt(req.params.userId, 10);
  if (isNaN(partnerId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  db.markAsRead(req.session.userId, partnerId);
  res.json({ success: true });
});

// ────────────────────────────────────────────────
//  Socket.IO
// ────────────────────────────────────────────────

// Share session with Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Track online users → userId : Set<socketId>
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.request.session?.userId;

  if (!userId) {
    socket.disconnect();
    return;
  }

  // Register this socket
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // Broadcast that this user is online
  io.emit('user online', userId);

  // Send the full list of online users to the new client
  socket.emit('online users', Array.from(onlineUsers.keys()));

  console.log(`User ${userId} connected (socket ${socket.id})`);

  // ── Handle Private Messages ──
  socket.on('private message', (data) => {
    const { receiverId, text } = data;
    if (!text || !text.trim() || !receiverId) return;

    // Sanitize to prevent XSS
    const clean = text.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Save to database
    const message = db.saveMessage(userId, receiverId, clean);

    // Include user info so clients can update their conversation lists
    const sender = db.findUserById(userId);
    const receiver = db.findUserById(receiverId);

    const payload = {
      id: message.id,
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      text: message.text,
      created_at: message.created_at,
      sender_username: sender.username,
      sender_display_name: sender.display_name,
      receiver_username: receiver.username,
      receiver_display_name: receiver.display_name,
    };

    // Deliver to all sockets of both sender and receiver
    [userId, receiverId].forEach((uid) => {
      const sockets = onlineUsers.get(uid);
      if (sockets) {
        sockets.forEach((sid) => io.to(sid).emit('private message', payload));
      }
    });
  });

  // ── Handle Typing Indicator ──
  socket.on('typing', (receiverId) => {
    const sockets = onlineUsers.get(receiverId);
    if (sockets) {
      sockets.forEach((sid) => io.to(sid).emit('typing', userId));
    }
  });

  socket.on('stop typing', (receiverId) => {
    const sockets = onlineUsers.get(receiverId);
    if (sockets) {
      sockets.forEach((sid) => io.to(sid).emit('stop typing', userId));
    }
  });

  // ── Handle Disconnect ──
  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit('user offline', userId);
      }
    }
    console.log(`User ${userId} disconnected (socket ${socket.id})`);
  });
});

// ── Start Server ──

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
