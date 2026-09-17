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

        window.location.href = '/chat.html';
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

        window.location.href = '/chat.html';
    } catch (err) {
        showError('Network error. Please try again.');
    }
});

// ── Auto-redirect if already logged in ──

(async () => {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            window.location.href = '/chat.html';
        }
    } catch (e) {
        // Not logged in — stay on this page
    }
})();
