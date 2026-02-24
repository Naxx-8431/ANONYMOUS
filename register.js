(async () => {
    'use strict';

    /* ================================================================
       EMAILJS CONFIGURATION
       ================================================================ */
    const EMAILJS_SERVICE_ID = 'service_8ys8klb';
    const EMAILJS_TEMPLATE_ID = 'template_n9jufeh';
    const EMAILJS_PUBLIC_KEY = 'uPNxjyjvXRoiveIUv';

    // Initialise EmailJS
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

    // Redirect if already logged in
    redirectIfLoggedIn('index.html');

    /* ================================================================
       OTP STATE (in-memory only, never persisted to localStorage)
       ================================================================ */
    let otpState = {
        code: null,           // generated 6-digit string
        expiresAt: null,      // timestamp ms
        email: null,          // target email
        sendCount: 0,         // send attempts this session
        resendCooldown: null, // interval reference
    };

    const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
    const OTP_EXPIRY_MINUTES = 10;
    const MAX_SEND_ATTEMPTS = 3;
    const RESEND_COOLDOWN_S = 60;

    /* ================================================================
       UTILITIES
       ================================================================ */
    function generateOTP() {
        const arr = new Uint32Array(1);
        crypto.getRandomValues(arr);
        return String(arr[0] % 1000000).padStart(6, '0');
    }

    function maskEmail(email) {
        const [local, domain] = email.split('@');
        if (local.length <= 2) return `${local[0]}***@${domain}`;
        return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
    }

    function clearErrors() {
        ['regUsername', 'regEmail', 'regPassword', 'regConfirm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('is-invalid');
        });
        ['usernameErr', 'emailErr', 'passwordErr', 'confirmErr'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = '';
        });
        const alert = document.getElementById('alertBox');
        if (alert) { alert.style.display = 'none'; alert.innerText = ''; }
    }

    function showAlert(msg, isSuccess = false) {
        const box = document.getElementById('alertBox');
        if (!box) return;
        box.className = 'anon-alert' + (isSuccess ? ' anon-alert-success' : '');
        box.innerText = msg;
        box.style.display = 'block';
    }

    function showOtpAlert(msg, isSuccess = false) {
        const box = document.getElementById('otpAlertBox');
        if (!box) return;
        box.className = 'anon-alert' + (isSuccess ? ' anon-alert-success' : '');
        box.innerText = msg;
        box.style.display = 'block';
    }

    function clearOtpAlert() {
        const box = document.getElementById('otpAlertBox');
        if (box) { box.style.display = 'none'; box.innerText = ''; }
    }

    function showFieldError(fieldId, errId, msg) {
        const field = document.getElementById(fieldId);
        const err = document.getElementById(errId);
        if (field) field.classList.add('is-invalid');
        if (err) err.innerText = msg;
    }

    /* ================================================================
       PASSWORD STRENGTH
       ================================================================ */
    function calcStrength(pw) {
        let score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[a-z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        return score;
    }

    document.getElementById('regPassword').addEventListener('input', function () {
        const score = calcStrength(this.value);
        const pct = Math.round((score / 6) * 100);
        const fill = document.getElementById('strengthFill');
        const label = document.getElementById('strengthLabel');
        if (!fill || !label) return;
        fill.style.width = pct + '%';
        const levels = [
            [1, '#ff0000', 'VERY WEAK'],
            [2, '#cc3300', 'WEAK'],
            [3, '#cc6600', 'FAIR'],
            [4, '#999900', 'GOOD'],
            [6, '#009900', 'STRONG'],
        ];
        for (const [threshold, color, text] of levels) {
            if (score <= threshold) {
                fill.style.background = color;
                label.innerText = 'STRENGTH: ' + text;
                break;
            }
        }
    });

    /* ================================================================
       FORM VALIDATION
       ================================================================ */
    function validateUsername(u) {
        if (!u) return 'Username is required.';
        if (u.length < 3) return 'At least 3 characters required.';
        if (u.length > 30) return 'Cannot exceed 30 characters.';
        if (!/^[a-zA-Z0-9_]+$/.test(u)) return 'Only letters, numbers and underscores allowed.';
        if (/^[A-Z][a-z]+$/.test(u)) return 'Avoid using your real name. Use a random alias.';
        return null;
    }
    function validateEmail(e) {
        if (!e) return 'Email is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Enter a valid email address.';
        return null;
    }
    function validatePassword(p) {
        if (!p) return 'Password is required.';
        if (p.length < 8) return 'Minimum 8 characters required.';
        if (!/[A-Z]/.test(p)) return 'Include at least one uppercase letter.';
        if (!/[a-z]/.test(p)) return 'Include at least one lowercase letter.';
        if (!/[0-9]/.test(p)) return 'Include at least one number.';
        if (!/[^A-Za-z0-9]/.test(p)) return 'Include at least one special character (!@#$% etc).';
        return null;
    }

    /* ================================================================
       RESEND COUNTDOWN
       ================================================================ */
    function startResendCountdown() {
        const btn = document.getElementById('resendBtn');
        const timer = document.getElementById('resendTimer');
        let secs = RESEND_COOLDOWN_S;

        btn.disabled = true;
        timer.innerText = secs;

        if (otpState.resendCooldown) clearInterval(otpState.resendCooldown);

        otpState.resendCooldown = setInterval(() => {
            secs--;
            timer.innerText = secs;
            if (secs <= 0) {
                clearInterval(otpState.resendCooldown);
                otpState.resendCooldown = null;
                const attemptsLeft = MAX_SEND_ATTEMPTS - otpState.sendCount;
                if (attemptsLeft > 0) {
                    btn.disabled = false;
                    btn.innerHTML = `[ resend ] (${attemptsLeft} left)`;
                } else {
                    btn.disabled = true;
                    btn.innerHTML = `[ limit reached ]`;
                }
            }
        }, 1000);
    }

    /* ================================================================
       SEND OTP VIA EMAILJS
       ================================================================ */
    async function sendOTP(email) {
        if (otpState.sendCount >= MAX_SEND_ATTEMPTS) {
            showOtpAlert('Maximum OTP send attempts reached. Please restart registration.');
            return false;
        }

        // Generate a fresh OTP
        otpState.code = generateOTP();
        otpState.expiresAt = Date.now() + OTP_EXPIRY_MS;
        otpState.email = email;
        otpState.sendCount++;

        try {
            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                email: email,               // {{email}}  – recipient
                passcode: otpState.code,       // {{passcode}}
                time: `${OTP_EXPIRY_MINUTES} minutes`,  // {{time}}
            });
            return true;
        } catch (err) {
            console.error('EmailJS error:', err);
            otpState.sendCount--; // Don't count a failed send
            return false;
        }
    }

    /* ================================================================
       STEP 1 – SUBMIT (Validate + Send OTP)
       ================================================================ */
    document.getElementById('registerForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        clearErrors();

        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirm').value;

        let hasError = false;

        const uErr = validateUsername(username);
        if (uErr) { showFieldError('regUsername', 'usernameErr', uErr); hasError = true; }

        const eErr = validateEmail(email);
        if (eErr) { showFieldError('regEmail', 'emailErr', eErr); hasError = true; }

        const pErr = validatePassword(password);
        if (pErr) { showFieldError('regPassword', 'passwordErr', pErr); hasError = true; }

        if (!confirm) {
            showFieldError('regConfirm', 'confirmErr', 'Please confirm your password.');
            hasError = true;
        } else if (password !== confirm) {
            showFieldError('regConfirm', 'confirmErr', 'Passwords do not match.');
            hasError = true;
        }

        if (hasError) return;

        // Check username/email uniqueness before sending OTP (no account created yet)
        const preCheck = await Auth.preCheck(username, email);
        if (!preCheck.ok) {
            if (preCheck.field === 'username') {
                showFieldError('regUsername', 'usernameErr', preCheck.error);
            } else {
                showFieldError('regEmail', 'emailErr', preCheck.error);
            }
            return;
        }

        const btn = document.getElementById('sendOtpBtn');
        btn.disabled = true;
        btn.innerText = '[ sending code... ]';

        const sent = await sendOTP(email);

        if (!sent) {
            showAlert('Failed to send verification email. Check your email address and try again.');
            btn.disabled = false;
            btn.innerText = '[ send verification code ]';
            return;
        }

        // Store form values temporarily for step 2 completion
        sessionStorage.setItem('_reg_u', username);
        sessionStorage.setItem('_reg_e', email);
        sessionStorage.setItem('_reg_p', password);

        // Show Step 2
        document.getElementById('maskedEmail').innerText = maskEmail(email);
        document.getElementById('step1').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
        document.getElementById('otpInput').focus();

        startResendCountdown();
    });

    /* ================================================================
       STEP 2 – RESEND
       ================================================================ */
    document.getElementById('resendBtn').addEventListener('click', async function () {
        clearOtpAlert();
        this.disabled = true;

        const email = sessionStorage.getItem('_reg_e');
        const sent = await sendOTP(email);

        if (sent) {
            showOtpAlert('A new code has been sent. Check your inbox.', true);
            startResendCountdown();
        } else {
            showOtpAlert('Could not resend. Please try again later.');
            this.disabled = false;
        }
    });

    /* ================================================================
       STEP 2 – VERIFY OTP & CREATE ACCOUNT
       ================================================================ */
    document.getElementById('verifyOtpBtn').addEventListener('click', async function () {
        clearOtpAlert();

        const input = document.getElementById('otpInput');
        const entered = input.value.trim();

        // Basic input check
        if (!entered || !/^\d{6}$/.test(entered)) {
            input.classList.add('is-invalid');
            document.getElementById('otpErr').innerText = 'Enter the 6-digit code from your email.';
            return;
        }
        input.classList.remove('is-invalid');
        document.getElementById('otpErr').innerText = '';

        // Expiry check
        if (!otpState.code || !otpState.expiresAt) {
            showOtpAlert('No code found. Please go back and request a new one.');
            return;
        }
        if (Date.now() > otpState.expiresAt) {
            showOtpAlert('Your code has expired. Click resend to get a new one.');
            otpState.code = null;
            return;
        }

        // Match check
        if (entered !== otpState.code) {
            showOtpAlert('Incorrect code. Please try again.');
            input.value = '';
            input.focus();
            return;
        }

        // Verified – create account
        const username = sessionStorage.getItem('_reg_u');
        const email = sessionStorage.getItem('_reg_e');
        const password = sessionStorage.getItem('_reg_p');

        const btn = this;
        btn.disabled = true;
        btn.innerText = '[ creating account... ]';

        // Clear sensitive session data first
        sessionStorage.removeItem('_reg_u');
        sessionStorage.removeItem('_reg_e');
        sessionStorage.removeItem('_reg_p');
        otpState = { code: null, expiresAt: null, email: null, sendCount: 0, resendCooldown: null };

        const result = await Auth.register(username, email, password);

        if (result.ok) {
            showOtpAlert('Account created! Redirecting to login...', true);
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        } else {
            showOtpAlert(result.error || 'Registration failed. Please try again.');
            btn.disabled = false;
            btn.innerText = '[ verify & create account ]';
        }
    });

    /* ================================================================
       STEP 2 – GO BACK
       ================================================================ */
    document.getElementById('backToStep1').addEventListener('click', function () {
        // Clear OTP state
        otpState.code = null;
        otpState.expiresAt = null;
        if (otpState.resendCooldown) clearInterval(otpState.resendCooldown);

        sessionStorage.removeItem('_reg_u');
        sessionStorage.removeItem('_reg_e');
        sessionStorage.removeItem('_reg_p');

        document.getElementById('step2').style.display = 'none';
        document.getElementById('step1').style.display = 'block';
        document.getElementById('sendOtpBtn').disabled = false;
        document.getElementById('sendOtpBtn').innerText = '[ send verification code ]';
        clearErrors();
    });

    /* ================================================================
       OTP INPUT – only allow digits
       ================================================================ */
    document.getElementById('otpInput').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });

})();
