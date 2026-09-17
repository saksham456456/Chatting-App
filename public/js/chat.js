// ────────────────────────────────────────────────
//  State
// ────────────────────────────────────────────────

let currentUser = null;
let activeChat = null;          // { id, username, displayName }
let conversations = [];          // cached conversation list
let socket = null;
let onlineUserIds = new Set();
let isSearching = false;

// ── Auth Token ──
const authToken = sessionStorage.getItem('chatty_active_token');
if (!authToken) {
    window.location.href = '/';
}

// Wrapper for fetch to inject token
async function apiFetch(url, options = {}) {
    const headers = { ...options.headers, 'Authorization': `Bearer ${authToken}` };
    const res = await fetch(url, { ...options, headers });
    
    // Fix: If token is invalid/expired, clear it and go to login to prevent infinite loops
    if (res.status === 401) {
        sessionStorage.removeItem('chatty_active_token');
        window.location.href = '/';
        throw new Error('Unauthorized');
    }
    
    return res;
}

// ────────────────────────────────────────────────
//  DOM Elements
// ────────────────────────────────────────────────

const appEl = document.getElementById('app');
const userAvatarEl = document.getElementById('userAvatar');
const userNameEl = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const accountSwitcherBtn = document.getElementById('accountSwitcherBtn');
const accountDropdown = document.getElementById('accountDropdown');
const accountList = document.getElementById('accountList');
const addAccountBtn = document.getElementById('addAccountBtn');
const searchInput = document.getElementById('searchInput');
const conversationListEl = document.getElementById('conversationList');
const noChatEl = document.getElementById('noChat');
const activeChatEl = document.getElementById('activeChatEl');
const partnerAvatarEl = document.getElementById('partnerAvatar');
const partnerNameEl = document.getElementById('partnerName');
const partnerStatusEl = document.getElementById('partnerStatus');
const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const backBtn = document.getElementById('backBtn');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const settingsForm = document.getElementById('settingsForm');
const settingsUsername = document.getElementById('settingsUsername');
const settingsDisplayName = document.getElementById('settingsDisplayName');
const settingsBio = document.getElementById('settingsBio');
const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
const avatarUpload = document.getElementById('avatarUpload');

// ────────────────────────────────────────────────
//  Initialize
// ────────────────────────────────────────────────

async function init() {
    // Check authentication
    try {
        const res = await apiFetch('/api/me');
        if (!res.ok) {
            window.location.href = '/';
            return;
        }
        const data = await res.json();
        currentUser = data.user;
    } catch (err) {
        window.location.href = '/';
        return;
    }

    // Show current user info in sidebar header
    updateCurrentUserUi();

    // Load conversations
    await loadConversations();

    // Connect socket
    connectSocket();

    // Bind event listeners
    setupEventListeners();
}

function updateCurrentUserUi() {
    const name = currentUser.displayName || currentUser.display_name;
    const avatar = currentUser.avatarUrl || currentUser.avatar_url;
    userAvatarEl.innerHTML = getAvatarHtml(name, avatar);
    userNameEl.textContent = name;
}

// ────────────────────────────────────────────────
//  Socket Connection
// ────────────────────────────────────────────────

function connectSocket() {
    socket = io({
        auth: { token: authToken }
    });

    socket.on('connect', () => {
        hideConnectionStatus();
    });

    socket.on('disconnect', () => {
        showConnectionStatus('Reconnecting...');
    });

    socket.on('reconnect_attempt', () => {
        showConnectionStatus('Reconnecting...');
    });

    // Receive a private message
    socket.on('private message', (msg) => {
        const partnerId =
            msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;

        // If this conversation is open, display the message
        if (activeChat && activeChat.id === partnerId) {
            appendMessage(msg);
            scrollToBottom();

            // Mark as read since we're looking at this conversation
            if (msg.sender_id !== currentUser.id) {
                apiFetch(`/api/messages/${partnerId}/read`, { method: 'POST' });
            }
        }

        // Update sidebar conversation list
        updateConversationWithMessage(msg);
    });

    // Full list of who's online (sent once on connect)
    socket.on('online users', (userIds) => {
        onlineUserIds = new Set(userIds);
        updateOnlineIndicators();
    });

    // A user came online
    socket.on('user online', (userId) => {
        onlineUserIds.add(userId);
        updateOnlineIndicators();
    });

    // A user went offline
    socket.on('user offline', (userId) => {
        onlineUserIds.delete(userId);
        updateOnlineIndicators();
    });

    // Typing indicators
    socket.on('typing', (userId) => {
        if (activeChat && activeChat.id === userId) {
            showTypingIndicator();
        }
    });

    socket.on('stop typing', (userId) => {
        if (activeChat && activeChat.id === userId) {
            hideTypingIndicator();
        }
    });

    // Read Receipts
    socket.on('messages read', (readerId) => {
        if (activeChat && activeChat.id === readerId) {
            document.querySelectorAll('.msg-status:not(.read)').forEach(el => {
                el.classList.add('read');
                el.textContent = '✓✓';
            });
        }
    });
}

// ────────────────────────────────────────────────
//  Event Listeners
// ────────────────────────────────────────────────

function setupEventListeners() {
    // Logout (moved inside settings modal in UI, but keep the listener here)
    const handleLogout = async () => {
        await apiFetch('/api/logout', { method: 'POST' });
        
        sessionStorage.removeItem('chatty_active_token');
        
        let accounts = JSON.parse(localStorage.getItem('chatty_accounts') || '[]');
        accounts = accounts.filter(a => a.id !== currentUser.id);
        localStorage.setItem('chatty_accounts', JSON.stringify(accounts));

        window.location.href = '/';
    };

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Settings Modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsUsername.value = currentUser.username;
            const name = currentUser.displayName || currentUser.display_name;
            settingsDisplayName.value = name;
            settingsBio.value = currentUser.bio || '';
            
            const avatarUrl = currentUser.avatarUrl || currentUser.avatar_url;
            settingsAvatarPreview.innerHTML = getAvatarHtml(name, avatarUrl);
            
            settingsModal.style.display = 'flex';
            accountDropdown.style.display = 'none'; // hide if open
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
    }

    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const displayName = settingsDisplayName.value.trim();
            const bio = settingsBio.value.trim();
            
            try {
                await apiFetch('/api/user/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName, bio })
                });
                
                // Update local state
                currentUser.display_name = displayName;
                currentUser.displayName = displayName;
                currentUser.bio = bio;
                updateCurrentUserUi();
                
                settingsModal.style.display = 'none';
            } catch (err) {
                console.error('Failed to update profile:', err);
                alert('Failed to update profile');
            }
        });
    }

    if (avatarUpload) {
        avatarUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('avatar', file);
            
            try {
                // Show loading on avatar preview
                settingsAvatarPreview.innerHTML = `<span style="font-size:14px;">Uploading...</span>`;
                
                const res = await apiFetch('/api/user/avatar', {
                    method: 'POST',
                    body: formData // No Content-Type header needed for FormData
                });
                const data = await res.json();
                
                if (data.avatarUrl) {
                    currentUser.avatar_url = data.avatarUrl;
                    currentUser.avatarUrl = data.avatarUrl;
                    updateCurrentUserUi();
                    
                    const name = currentUser.displayName || currentUser.display_name;
                    settingsAvatarPreview.innerHTML = getAvatarHtml(name, data.avatarUrl);
                }
            } catch (err) {
                console.error('Failed to upload avatar:', err);
                alert('Failed to upload avatar');
            }
        });
    }

    // Account Switcher Dropdown
    accountSwitcherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = accountDropdown.style.display === 'block';
        accountDropdown.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            renderAccountDropdown();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!accountDropdown.contains(e.target) && !accountSwitcherBtn.contains(e.target)) {
            accountDropdown.style.display = 'none';
        }
    });

    // Add Account button
    addAccountBtn.addEventListener('click', () => {
        // Just go to index.html without a token in sessionStorage
        // The vault remains in localStorage
        sessionStorage.removeItem('chatty_active_token');
        window.location.href = '/';
    });

    // Search (debounced)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (!query) {
            isSearching = false;
            renderConversations();
            return;
        }

        searchTimeout = setTimeout(async () => {
            isSearching = true;
            try {
                const res = await apiFetch(
                    `/api/search?q=${encodeURIComponent(query)}`
                );
                const data = await res.json();
                renderSearchResults(data.users);
            } catch (err) {
                console.error('Search error:', err);
            }
        }, 300);
    });

    // Send message
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Typing indicator
    let typingTimeout;
    messageInput.addEventListener('input', () => {
        if (!activeChat || !socket) return;

        socket.emit('typing', activeChat.id);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop typing', activeChat.id);
        }, 1500);
    });

    // Back button (mobile)
    backBtn.addEventListener('click', () => {
        appEl.classList.remove('chat-active');
        activeChat = null;
        activeChatEl.style.display = 'none';
        noChatEl.style.display = 'flex';

        // Deselect active conversation in sidebar
        document.querySelectorAll('.conversation-item').forEach((el) => {
            el.classList.remove('active');
        });
    });
}

// ────────────────────────────────────────────────
//  Multi-Account Switcher
// ────────────────────────────────────────────────

function renderAccountDropdown() {
    accountList.innerHTML = '';
    const accounts = JSON.parse(localStorage.getItem('chatty_accounts') || '[]');
    
    accounts.forEach(acc => {
        const el = document.createElement('div');
        el.className = `account-item ${acc.id === currentUser.id ? 'active' : ''}`;
        
        el.innerHTML = `
            <div class="user-avatar">${getAvatarHtml(acc.displayName, acc.avatar_url || acc.avatarUrl)}</div>
            <div class="user-name">${escapeHtml(acc.displayName)} <span style="color:#999;font-size:12px;">@${escapeHtml(acc.username)}</span></div>
        `;

        el.addEventListener('click', () => {
            if (acc.id === currentUser.id) {
                accountDropdown.style.display = 'none';
                return;
            }
            // Switch active token and reload
            sessionStorage.setItem('chatty_active_token', acc.token);
            window.location.reload();
        });

        accountList.appendChild(el);
    });
}

// ────────────────────────────────────────────────
//  Conversations
// ────────────────────────────────────────────────

async function loadConversations() {
    try {
        showLoading(conversationListEl);
        const res = await apiFetch('/api/conversations');
        const data = await res.json();
        conversations = data.conversations;
        renderConversations();
    } catch (err) {
        console.error('Failed to load conversations:', err);
    }
}

function renderConversations() {
    conversationListEl.innerHTML = '';

    if (conversations.length === 0) {
        conversationListEl.innerHTML = `
            <div class="empty-state">
                <p>No conversations yet.</p>
                <p class="hint">Search for a user to start chatting!</p>
            </div>`;
        return;
    }

    conversations.forEach((conv) => {
        conversationListEl.appendChild(createConversationElement(conv));
    });
}

function createConversationElement(conv) {
    const el = document.createElement('div');
    el.className = 'conversation-item';
    if (activeChat && activeChat.id === conv.partner_id) {
        el.classList.add('active');
    }

    const isOnline = onlineUserIds.has(conv.partner_id);
    const initial = getInitial(conv.partner_display_name);
    const time = conv.last_message_time ? formatTime(conv.last_message_time) : '';
    const prefix = conv.last_sender_id === currentUser.id ? 'You: ' : '';

    el.innerHTML = `
        <div class="conv-avatar ${isOnline ? 'online' : ''}">${initial}</div>
        <div class="conv-details">
            <div class="conv-top-row">
                <span class="conv-name">${escapeHtml(conv.partner_display_name)}</span>
                <span class="conv-time">${time}</span>
            </div>
            <div class="conv-bottom-row">
                <span class="conv-last-msg">${prefix}${escapeHtml(conv.last_message || '')}</span>
                ${conv.unread_count > 0
                    ? `<span class="conv-unread">${conv.unread_count}</span>`
                    : ''}
            </div>
        </div>`;

    el.addEventListener('click', () => {
        openChat({
            id: conv.partner_id,
            username: conv.partner_username,
            displayName: conv.partner_display_name,
        });
    });

    return el;
}

function updateConversationWithMessage(msg) {
    const partnerId =
        msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
    const partnerUsername =
        msg.sender_id === currentUser.id
            ? msg.receiver_username
            : msg.sender_username;
    const partnerDisplayName =
        msg.sender_id === currentUser.id
            ? msg.receiver_display_name
            : msg.sender_display_name;

    const existingIndex = conversations.findIndex(
        (c) => c.partner_id === partnerId
    );

    if (existingIndex >= 0) {
        // Update existing conversation
        conversations[existingIndex].last_message = msg.text;
        conversations[existingIndex].last_message_time = msg.created_at;
        conversations[existingIndex].last_sender_id = msg.sender_id;

        // Increment unread if it's from the partner and not the active chat
        if (
            msg.sender_id !== currentUser.id &&
            (!activeChat || activeChat.id !== partnerId)
        ) {
            conversations[existingIndex].unread_count =
                (conversations[existingIndex].unread_count || 0) + 1;
        }

        // Move to top of list
        const [conv] = conversations.splice(existingIndex, 1);
        conversations.unshift(conv);
    } else {
        // Brand new conversation
        conversations.unshift({
            partner_id: partnerId,
            partner_username: partnerUsername,
            partner_display_name: partnerDisplayName,
            last_message: msg.text,
            last_message_time: msg.created_at,
            last_sender_id: msg.sender_id,
            unread_count: msg.sender_id !== currentUser.id ? 1 : 0,
        });
    }

    if (!isSearching) {
        renderConversations();
    }
}

// ────────────────────────────────────────────────
//  Search Results
// ────────────────────────────────────────────────

function renderSearchResults(users) {
    conversationListEl.innerHTML = '';
    
    if (users.length === 0) {
        conversationListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No users found</div>';
        return;
    }

    users.forEach((user) => {
        const el = document.createElement('div');
        el.className = 'search-result-item';

        el.innerHTML = `
            <div class="search-avatar">${getAvatarHtml(user.display_name, user.avatar_url)}</div>
            <div class="search-info">
                <span class="search-name">${escapeHtml(
                    user.display_name
                )}</span>
                <span class="search-username">@${escapeHtml(
                    user.username
                )}</span>
            </div>
        `;

        el.addEventListener('click', () => {
            searchInput.value = '';
            isSearching = false;

            openChat({
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                avatarUrl: user.avatar_url
            });

            renderConversations();
        });
        
        conversationListEl.appendChild(el);
    });
}

// ────────────────────────────────────────────────
//  Chat
// ────────────────────────────────────────────────

async function openChat(partner) {
    activeChat = partner;

    // Update chat header
    partnerAvatarEl.innerHTML = getAvatarHtml(partner.displayName, partner.avatar_url || partner.avatarUrl);
    partnerNameEl.textContent = partner.displayName;
    updatePartnerStatus();

    // Show the chat panel, hide the empty state
    noChatEl.style.display = 'none';
    activeChatEl.style.display = 'flex';
    appEl.classList.add('chat-active');

    // Load message history
    showLoading(messagesEl);
    try {
        const res = await apiFetch(`/api/messages/${partner.id}`);
        const data = await res.json();
        renderMessages(data.messages);
    } catch (err) {
        console.error('Failed to load messages:', err);
    }

    // Clear unread in sidebar
    const conv = conversations.find((c) => c.partner_id === partner.id);
    if (conv) {
        conv.unread_count = 0;
    }
    renderConversations();

    // Focus the input
    messageInput.focus();
}

function renderMessages(messages) {
    messagesEl.innerHTML = '';
    let lastDate = '';

    messages.forEach((msg) => {
        const msgDate = parseDate(msg.created_at).toLocaleDateString();

        // Insert a date separator when the day changes
        if (msgDate !== lastDate) {
            const sep = document.createElement('div');
            sep.className = 'date-separator';
            sep.innerHTML = `<span>${formatDate(msg.created_at)}</span>`;
            messagesEl.appendChild(sep);
            lastDate = msgDate;
        }

        appendMessage(msg);
    });

    scrollToBottom();
}

function appendMessage(msg) {
    // Remove typing indicator if present
    hideTypingIndicator();

    const isSent = msg.sender_id === currentUser.id;
    const el = document.createElement('div');
    el.className = `message ${isSent ? 'sent' : 'received'}`;

    const time = parseDate(msg.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });

    // Build structure with textContent for user text (prevents XSS safely)
    const textDiv = document.createElement('div');
    textDiv.className = 'msg-text';
    textDiv.textContent = msg.text;

    let statusHtml = '';
    if (isSent) {
        statusHtml = `<span class="msg-status ${msg.read ? 'read' : ''}">${msg.read ? '✓✓' : '✓'}</span>`;
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'msg-time';
    timeDiv.innerHTML = `<span>${time}</span> ${statusHtml}`;

    el.appendChild(textDiv);
    el.appendChild(timeDiv);
    messagesEl.appendChild(el);
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeChat) return;

    socket.emit('private message', {
        receiverId: activeChat.id,
        text: text,
    });

    // Stop typing indicator
    socket.emit('stop typing', activeChat.id);

    messageInput.value = '';
    messageInput.focus();
}

// ────────────────────────────────────────────────
//  Typing Indicator
// ────────────────────────────────────────────────

function showTypingIndicator() {
    // Only add one indicator at a time
    if (document.getElementById('typingIndicator')) return;

    const el = document.createElement('div');
    el.id = 'typingIndicator';
    el.className = 'typing-indicator';
    el.textContent = 'typing...';
    messagesEl.appendChild(el);
    scrollToBottom();
}

function hideTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

// ────────────────────────────────────────────────
//  Online Status
// ────────────────────────────────────────────────

function updateOnlineIndicators() {
    // Re-render the conversation list to update green dots
    if (!isSearching) {
        renderConversations();
    }

    // Update the active chat header
    updatePartnerStatus();
}

function updatePartnerStatus() {
    if (!activeChat) return;

    const isOnline = onlineUserIds.has(activeChat.id);
    partnerStatusEl.textContent = isOnline ? 'online' : 'offline';
    partnerStatusEl.className = `partner-status ${isOnline ? 'online' : ''}`;
}

// ────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────

function getInitial(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getAvatarHtml(name, url) {
    if (url) return `<img src="${url}" class="avatar-img" alt="avatar">`;
    return getInitial(name);
}

function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Format a timestamp for the conversation list sidebar.
 * Shows "now", "3m", clock time, day name, or date.
 */
function formatTime(dateString) {
    const date = parseDate(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Format a timestamp for date separators inside the chat.
 */
function formatDate(dateString) {
    const date = parseDate(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today - msgDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString([], {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

/**
 * Parse a date string, handling both ISO 8601 and SQLite formats.
 */
function parseDate(dateString) {
    // ISO strings (with "T" and/or "Z") parse correctly as-is
    if (dateString.includes('T')) {
        return new Date(dateString);
    }
    // SQLite format "YYYY-MM-DD HH:MM:SS" — treat as UTC
    return new Date(dateString.replace(' ', 'T') + 'Z');
}

// ────────────────────────────────────────────────
//  Connection Status
// ────────────────────────────────────────────────

function showConnectionStatus(text) {
    let bar = document.getElementById('connectionStatus');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'connectionStatus';
        bar.className = 'connection-status';
        document.body.prepend(bar);
    }
    bar.textContent = text;
    bar.style.display = 'flex';
}

function hideConnectionStatus() {
    const bar = document.getElementById('connectionStatus');
    if (bar) bar.style.display = 'none';
}

// ────────────────────────────────────────────────
//  Loading Indicator
// ────────────────────────────────────────────────

function showLoading(container) {
    container.innerHTML = '<div class="loading">Loading...</div>';
}

// ── Start ──

init();
