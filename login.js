'use strict';

// Redirect if already logged in
redirectIfLoggedIn('index.html');

/* ---- Brute-force rate limiting (client-side only, complemented by backend) ---- */
const LOCK_KEY = 'anon_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

function getAttemptData() {
    try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || { count: 0, lockedUntil: 0 }; }
    catch { return { count: 0, lockedUntil: 0 }; }
}

function isLocked() {
    const d = getAttemptData();
    return d.lockedUntil > Date.now();
}

function recordFailure() {
    const d = getAttemptData();
    d.count += 1;
    if (d.count >= MAX_ATTEMPTS) {
        d.lockedUntil = Date.now() + LOCK_SECONDS * 1000;
        d.count = 0;
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify(d));
}

function clearAttempts() {
    localStorage.removeItem(LOCK_KEY);
}

/* ---- Lock countdown ---- */
let lockInterval = null;
function startLockCountdown() {
    const lockMsg = document.getElementById('lockMsg');
    const lockTimer = document.getElementById('lockTimer');
    const btn = document.getElementById('loginBtn');
    if (!lockMsg || !lockTimer || !btn) return;

    const data = getAttemptData();
    if (data.lockedUntil <= Date.now()) return;

    lockMsg.style.display = 'block';
    btn.disabled = true;

    lockInterval = setInterval(() => {
        const remaining = Math.ceil((data.lockedUntil - Date.now()) / 1000);
        if (remaining <= 0) {
            clearInterval(lockInterval);
            lockMsg.style.display = 'none';
            btn.disabled = false;
            lockTimer.innerText = LOCK_SECONDS;
        } else {
            lockTimer.innerText = remaining;
        }
    }, 500);
}

// Check on page load
if (isLocked()) startLockCountdown();

/* ---- Helpers ---- */
function showAlert(msg) {
    const box = document.getElementById('alertBox');
    if (!box) return;
    box.className = 'anon-alert';
    box.innerText = msg;
    box.style.display = 'block';
}

function clearAlert() {
    const box = document.getElementById('alertBox');
    if (box) { box.style.display = 'none'; box.innerText = ''; }
}

function markFieldError(id, show = true) {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) el.classList.add('is-invalid');
    else el.classList.remove('is-invalid');
}

/* ---- Submit ---- */
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    clearAlert();

    if (isLocked()) {
        startLockCountdown();
        return;
    }

    const ident = document.getElementById('loginIdent').value.trim();
    const password = document.getElementById('loginPassword').value;

    let hasError = false;

    if (!ident) {
        markFieldError('loginIdent');
        document.getElementById('identErr').innerText = 'This field is required.';
        hasError = true;
    } else {
        markFieldError('loginIdent', false);
        document.getElementById('identErr').innerText = '';
    }

    if (!password) {
        markFieldError('loginPassword');
        document.getElementById('passwordErr').innerText = 'This field is required.';
        hasError = true;
    } else {
        markFieldError('loginPassword', false);
        document.getElementById('passwordErr').innerText = '';
    }

    if (hasError) return;

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerText = '[ verifying... ]';

    setTimeout(() => {
        const result = Auth.login(ident, password);
        if (result.ok) {
            clearAttempts();
            window.location.href = 'index.html';
        } else {
            recordFailure();
            if (isLocked()) {
                startLockCountdown();
                showAlert('Too many failed attempts. Please wait before trying again.');
            } else {
                const data = getAttemptData();
                const remaining = MAX_ATTEMPTS - data.count;
                showAlert(`Invalid credentials. ${remaining} attempt(s) remaining before lockout.`);
                btn.disabled = false;
                btn.innerText = '[ enter ]';
            }
        }
    }, 400);
});
