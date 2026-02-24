'use strict';

(async () => {
    /* Redirect if already logged in */
    await redirectIfLoggedIn('index.html');

    /* ── Brute-force rate limiting (client-side display only) ──── */
    const LOCK_KEY = 'anon_login_attempts';
    const MAX_ATTEMPTS = 5;
    const LOCK_SECS = 30;

    function getAttempts() {
        try { return JSON.parse(sessionStorage.getItem(LOCK_KEY)) || { count: 0, lockedAt: null }; }
        catch { return { count: 0, lockedAt: null }; }
    }
    function setAttempts(obj) { sessionStorage.setItem(LOCK_KEY, JSON.stringify(obj)); }

    const form = document.getElementById('loginForm');
    const msgEl = document.getElementById('alertBox');   // matches login.html
    const lockEl = document.getElementById('lockMsg');
    const submitBtn = document.getElementById('loginBtn');

    function showMsg(msg, isErr = true) {
        msgEl.innerText = msg;
        msgEl.className = 'anon-alert' + (isErr ? '' : ' anon-alert-success');
        msgEl.style.display = 'block';
    }

    /* Check if already locked */
    (function checkLock() {
        const a = getAttempts();
        if (!a.lockedAt) return;
        const elapsed = (Date.now() - a.lockedAt) / 1000;
        if (elapsed < LOCK_SECS) {
            const left = Math.ceil(LOCK_SECS - elapsed);
            form.style.pointerEvents = 'none';
            lockEl.style.display = 'block';
            const interval = setInterval(() => {
                const now = Math.ceil(LOCK_SECS - (Date.now() - a.lockedAt) / 1000);
                lockEl.innerText = `Too many failed attempts. Wait ${Math.max(0, now)}s.`;
                if (now <= 0) { clearInterval(interval); unlockForm(); }
            }, 1000);
        } else {
            setAttempts({ count: 0, lockedAt: null });
        }
    })();

    function unlockForm() {
        form.style.pointerEvents = '';
        lockEl.style.display = 'none';
        lockEl.innerText = '';
        setAttempts({ count: 0, lockedAt: null });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msgEl.style.display = 'none';

        const a = getAttempts();
        if (a.lockedAt && (Date.now() - a.lockedAt) / 1000 < LOCK_SECS) return;

        const ident = document.getElementById('loginIdent').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!ident || !password) { showMsg('All fields required.'); return; }

        submitBtn.disabled = true;
        submitBtn.innerText = '[ checking... ]';

        const result = await Auth.login(ident, password);

        submitBtn.disabled = false;
        submitBtn.innerText = '[ enter ]';

        if (!result.ok) {
            const updated = { count: a.count + 1, lockedAt: a.lockedAt };
            if (updated.count >= MAX_ATTEMPTS) { updated.lockedAt = Date.now(); }
            setAttempts(updated);

            if (updated.count >= MAX_ATTEMPTS) {
                form.style.pointerEvents = 'none';
                lockEl.innerText = `Too many failed attempts. Wait ${LOCK_SECS}s.`;
                lockEl.style.display = 'block';
                setTimeout(unlockForm, LOCK_SECS * 1000);
            } else {
                showMsg(result.error || 'Invalid credentials.');
            }
            return;
        }

        // Success
        setAttempts({ count: 0, lockedAt: null });
        showMsg('Login successful. Redirecting…', false);
        setTimeout(() => { window.location.href = 'index.html'; }, 600);
    });

})();
