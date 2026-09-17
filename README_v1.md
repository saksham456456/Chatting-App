# Chatty 💬

A lightning-fast, real-time messaging web application inspired by Telegram. Built with a focus on speed, responsive design, and a modern multi-account architecture.

## ✨ Features

- **Real-Time Messaging**: Powered by Socket.IO for instant message delivery without polling.
- **Telegram-Style UI**: A clean, responsive interface that scales perfectly from desktop to mobile browsers.
- **Multi-Account Vault**: Instagram-style login system. Store multiple accounts securely in your browser and switch between them instantly without needing to log out.
- **Profile Customization**: Upload custom avatars, set display names, and write personal bios.
- **Read Receipts**: Real-time message status tracking (✓ sent, ✓✓ read).
- **Live Typing Indicators**: See when your partner is typing in real-time.
- **Online/Offline Status**: Track exactly who is online.
- **Search & Discovery**: Instantly search for other registered users to start new conversations.

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (No heavy frameworks, blazing fast)
- **Backend**: Node.js, Express.js
- **Real-Time**: Socket.IO
- **Database**: SQLite (via `better-sqlite3` in WAL mode for high concurrency)
- **Authentication**: Custom secure Token-based Auth (Multi-device, Multi-tab compatible)
- **File Uploads**: Multer (for handling avatar uploads)

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- npm (Node Package Manager)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/saksham456456/Chatting-App.git
   cd Chatting-App
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open the app:**
   Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

## 🗄️ Architecture & Database

- **Zero-Config Database**: The app uses a local SQLite database (`chat.db`). The database file, along with necessary tables, is automatically created the first time you run the server.
- **Secure Passwords**: All user passwords are cryptographically hashed using `bcryptjs` before being stored.
- **Stateless Tokens**: The app uses randomized 256-bit hex tokens for session management, allowing the same user to be logged in across multiple devices seamlessly.
- **Local Storage Vault**: The frontend uses `localStorage` as a secure vault for multiple account tokens, while `sessionStorage` tracks the active identity of individual browser tabs.

## 📦 Versioning Strategy

This project follows strict branching and versioning:
- `main`: The stable, production-ready codebase (currently v1.0.0).
- `v2-dev`: The active development branch for upcoming features (Group Chats, File Sharing, etc).

---
*Developed for a fast, secure, and seamless messaging experience.*
