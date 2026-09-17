const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ── Setup Uploads ──
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth Middleware ──

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];
  const user = db.getUserFromSession(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = user;
  req.token = token;
  next();
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
    const userId = result.lastInsertRowid;
    
    const token = db.createSession(userId);

    res.json({
      success: true,
      token,
      user: {
        id: userId,
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

    const token = db.createSession(user.id);

    res.json({
      success: true,
      token,
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

app.post('/api/logout', requireAuth, (req, res) => {
  db.deleteSession(req.token);
  res.json({ success: true });
});

// ────────────────────────────────────────────────
//  API Routes
// ────────────────────────────────────────────────

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/user/profile', requireAuth, (req, res) => {
  const { displayName, bio } = req.body;
  if (!displayName || displayName.trim().length < 1) {
    return res.status(400).json({ error: 'Display name is required' });
  }
  db.updateUserProfile(req.user.id, displayName.trim(), bio ? bio.trim() : null);
  res.json({ success: true });
});

app.post('/api/user/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.updateUserAvatar(req.user.id, avatarUrl);
  res.json({ success: true, avatarUrl });
});

app.get('/api/search', requireAuth, (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length < 1) {
    return res.json({ users: [] });
  }
  const users = db.searchUsers(query.trim(), req.user.id);
  res.json({ users });
});

app.get('/api/conversations', requireAuth, (req, res) => {
  const conversations = db.getConversationList(req.user.id);
  res.json({ conversations });
});

app.get('/api/messages/:userId', requireAuth, (req, res) => {
  const partnerId = parseInt(req.params.userId, 10);
  if (isNaN(partnerId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const messages = db.getMessages(req.user.id, partnerId);
  const changes = db.markAsRead(req.user.id, partnerId);
  
  if (changes > 0) {
    const sockets = onlineUsers.get(partnerId);
    if (sockets) {
      sockets.forEach(sid => io.to(sid).emit('messages read', req.user.id));
    }
  }
  
  res.json({ messages });
});

app.post('/api/messages/:userId/read', requireAuth, (req, res) => {
  const partnerId = parseInt(req.params.userId, 10);
  if (isNaN(partnerId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  const changes = db.markAsRead(req.user.id, partnerId);
  if (changes > 0) {
    const sockets = onlineUsers.get(partnerId);
    if (sockets) {
      sockets.forEach(sid => io.to(sid).emit('messages read', req.user.id));
    }
  }
  
  res.json({ success: true });
});

// ────────────────────────────────────────────────
//  Socket.IO
// ────────────────────────────────────────────────

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  const user = db.getUserFromSession(token);
  if (!user) return next(new Error('Authentication error'));
  
  socket.user = user;
  next();
});

// Track online users → userId : Set<socketId>
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.user.id;

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

    // Validate message length
    const trimmed = text.trim();
    if (trimmed.length > 5000) return;

    // Validate that receiver exists
    const sender = db.findUserById(userId);
    const receiver = db.findUserById(receiverId);
    if (!sender || !receiver) return;

    // Save raw text — XSS prevention is handled client-side via textContent
    const message = db.saveMessage(userId, receiverId, trimmed);

    const payload = {
      id: message.id,
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      text: message.text,
      read: message.read,
      created_at: message.created_at,
      sender_username: sender.username,
      sender_display_name: sender.display_name,
      sender_avatar: sender.avatar_url,
      receiver_username: receiver.username,
      receiver_display_name: receiver.display_name,
      receiver_avatar: receiver.avatar_url,
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
