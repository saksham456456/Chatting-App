// ── Random Username Generator ──

const adjectives = [
    'Swift', 'Brave', 'Cool', 'Happy', 'Lucky', 'Clever', 'Wild', 'Calm',
    'Bright', 'Quick', 'Bold', 'Keen', 'Sly', 'Wise', 'Epic', 'Chill',
];

const animals = [
    'Fox', 'Wolf', 'Bear', 'Hawk', 'Panda', 'Tiger', 'Eagle', 'Shark',
    'Lion', 'Falcon', 'Otter', 'Lynx', 'Raven', 'Cobra', 'Bison', 'Owl',
];

function generateUsername() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${adj}${animal}_${num}`;
}

// ── DOM Elements ──

const tabs = document.querySelectorAll('.tab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const errorDiv = document.getElementById('error');
const generateBtn = document.getElementById('generateBtn');

// ── Tab Switching ──

tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        hideError();

        if (tab.dataset.tab === 'login') {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }
    });
});

// ── Generate Random Username ──

generateBtn.addEventListener('click', () => {
    document.getElementById('regUsername').value = generateUsername();
});

// ── Error Helpers ──

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideError() {
    errorDiv.style.display = 'none';
}

// ── Login ──

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Login failed');
            return;
        }

        saveAccountAndRedirect(data.user, data.token);
    } catch (err) {
        showError('Network error. Please try again.');
    }
});

// ── Register ──

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = document.getElementById('regUsername').value.trim();
    const displayName = document.getElementById('regDisplayName').value.trim();
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                displayName: displayName || username,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Registration failed');
            return;
        }

        saveAccountAndRedirect(data.user, data.token);
    } catch (err) {
        showError('Network error. Please try again.');
    }
});

// ── Multi-Account Logic ──

function saveAccountAndRedirect(user, token) {
    // Save to local vault
    const accounts = JSON.parse(localStorage.getItem('chatty_accounts') || '[]');
    // Remove if already exists to update token
    const filtered = accounts.filter(a => a.id !== user.id);
    filtered.push({ ...user, token });
    localStorage.setItem('chatty_accounts', JSON.stringify(filtered));

    // Set active for this tab
    sessionStorage.setItem('chatty_active_token', token);
    
    window.location.href = '/chat.html';
}

// ── Auto-redirect / Account Chooser ──

(async () => {
    // If this tab already has an active session, redirect
    if (sessionStorage.getItem('chatty_active_token')) {
        window.location.href = '/chat.html';
        return;
    }

    // Check if there are saved accounts in the local vault
    const accounts = JSON.parse(localStorage.getItem('chatty_accounts') || '[]');
    if (accounts.length > 0) {
        // Show account chooser
        document.getElementById('accountChooserCard').style.display = 'block';
        document.getElementById('mainTitle').style.display = 'none';
        document.getElementById('mainSubtitle').textContent = 'Or log into another account';
        
        const list = document.getElementById('savedAccountsList');
        list.innerHTML = '';
        
        accounts.forEach(acc => {
            const el = document.createElement('div');
            el.className = 'saved-account-item';
            
            const initial = acc.displayName ? acc.displayName.charAt(0).toUpperCase() : '?';
            
            el.innerHTML = `
                <div class="user-avatar">${initial}</div>
                <div class="user-details">
                    <div class="user-name">${acc.displayName}</div>
                    <div class="user-username">@${acc.username}</div>
                </div>
            `;
            
            el.addEventListener('click', () => {
                sessionStorage.setItem('chatty_active_token', acc.token);
                window.location.href = '/chat.html';
            });
            
            list.appendChild(el);
        });
    }
})();
