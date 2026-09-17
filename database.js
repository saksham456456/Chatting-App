const Database = require('better-sqlite3');
const path = require('path');

// ── Initialize Database ──

const db = new Database(path.join(__dirname, 'chat.db'));
db.pragma('journal_mode = WAL');

// ── Create Tables ──

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(sender_id, receiver_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages(created_at);
`);

// ── User Functions ──

function createUser(username, passwordHash, displayName) {
  const stmt = db.prepare(
    'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)'
  );
  return stmt.run(username, passwordHash, displayName || username);
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findUserById(id) {
  return db.prepare(
    'SELECT id, username, display_name, created_at FROM users WHERE id = ?'
  ).get(id);
}

function searchUsers(query, currentUserId) {
  return db.prepare(
    'SELECT id, username, display_name FROM users WHERE username LIKE ? AND id != ? LIMIT 20'
  ).all(`%${query}%`, currentUserId);
}

// ── Message Functions ──

function saveMessage(senderId, receiverId, text) {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    'INSERT INTO messages (sender_id, receiver_id, text, created_at) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(senderId, receiverId, text, now);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
}

function getMessages(userId1, userId2, limit = 200) {
  return db.prepare(`
    SELECT m.*,
           s.username   AS sender_username,
           s.display_name AS sender_display_name
    FROM messages m
    JOIN users s ON m.sender_id = s.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
    LIMIT ?
  `).all(userId1, userId2, userId2, userId1, limit);
}

function getConversationList(userId) {
  return db.prepare(`
    WITH partners AS (
      SELECT DISTINCT
        CASE WHEN sender_id = @userId THEN receiver_id ELSE sender_id END AS partner_id
      FROM messages
      WHERE sender_id = @userId OR receiver_id = @userId
    )
    SELECT
      u.id              AS partner_id,
      u.username        AS partner_username,
      u.display_name    AS partner_display_name,
      m.text            AS last_message,
      m.created_at      AS last_message_time,
      m.sender_id       AS last_sender_id,
      (
        SELECT COUNT(*) FROM messages
        WHERE sender_id = u.id AND receiver_id = @userId AND read = 0
      ) AS unread_count
    FROM partners p
    JOIN users    u ON u.id = p.partner_id
    JOIN messages m ON m.id = (
      SELECT id FROM messages
      WHERE (sender_id = @userId AND receiver_id = p.partner_id)
         OR (sender_id = p.partner_id AND receiver_id = @userId)
      ORDER BY created_at DESC
      LIMIT 1
    )
    ORDER BY m.created_at DESC
  `).all({ userId });
}

function markAsRead(currentUserId, partnerId) {
  return db.prepare(
    'UPDATE messages SET read = 1 WHERE sender_id = ? AND receiver_id = ? AND read = 0'
  ).run(partnerId, currentUserId);
}

// ── Exports ──

module.exports = {
  createUser,
  findUserByUsername,
  findUserById,
  searchUsers,
  saveMessage,
  getMessages,
  getConversationList,
  markAsRead,
};
