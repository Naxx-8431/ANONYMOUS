'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const router = express.Router();

const SALT_ROUNDS = 12;

/* ── Helpers ──────────────────────────────────────────────────── */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Rate limiter: login (5 attempts per 30 s per IP) ──────────── */
const loginLimiter = rateLimit({
    windowMs: 30 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many login attempts. Wait 30 seconds.' },
});

/* ── Rate limiter: register (10 per hour per IP) ───────────────── */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { ok: false, error: 'Too many registration attempts. Try again later.' },
});

/* ================================================================
   POST /api/auth/precheck
   Check username + email uniqueness (used before sending OTP)
   ================================================================ */
router.post('/precheck', (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) {
        return res.json({ ok: false, field: 'username', error: 'Missing fields.' });
    }

    const byUsername = db.prepare(
        'SELECT id FROM users WHERE username = ? COLLATE NOCASE'
    ).get(username.trim());
    if (byUsername) {
        return res.json({ ok: false, field: 'username', error: 'Username already taken.' });
    }

    const byEmail = db.prepare(
        'SELECT id FROM users WHERE email = ?'
    ).get(email.trim().toLowerCase());
    if (byEmail) {
        return res.json({ ok: false, field: 'email', error: 'Email already registered.' });
    }

    res.json({ ok: true });
});

/* ================================================================
   POST /api/auth/register
   ================================================================ */
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ ok: false, error: 'All fields required.' });
        }

        // Server-side validation
        const u = username.trim();
        const e = email.trim().toLowerCase();
        const p = password;

        if (u.length < 3 || u.length > 30 || !/^[a-zA-Z0-9_]+$/.test(u)) {
            return res.status(400).json({ ok: false, error: 'Invalid username format.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
            return res.status(400).json({ ok: false, error: 'Invalid email address.' });
        }
        if (p.length < 8 || !/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p)) {
            return res.status(400).json({ ok: false, error: 'Password does not meet requirements.' });
        }

        // Uniqueness check
        const existUser = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(u);
        const existEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(e);
        if (existUser) return res.status(409).json({ ok: false, field: 'username', error: 'Username already taken.' });
        if (existEmail) return res.status(409).json({ ok: false, field: 'email', error: 'Email already registered.' });

        const pwHash = await bcrypt.hash(p, SALT_ROUNDS);
        const id = uid();
        const joined = new Date().toISOString();

        db.prepare(
            'INSERT INTO users (id, username, email, pw_hash, joined) VALUES (?, ?, ?, ?, ?)'
        ).run(id, u, e, pwHash, joined);

        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

/* ================================================================
   POST /api/auth/login
   ================================================================ */
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { ident, password } = req.body;
        if (!ident || !password) {
            return res.status(400).json({ ok: false, error: 'All fields required.' });
        }

        const val = ident.trim().toLowerCase();
        const user = db.prepare(
            'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ?'
        ).get(val, val);

        if (!user) {
            // Constant-time fake compare to prevent timing attacks
            await bcrypt.compare(password, '$2b$12$invalidhashthatisnevervalid00000000000000000000000');
            return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
        }

        const match = await bcrypt.compare(password, user.pw_hash);
        if (!match) return res.status(401).json({ ok: false, error: 'Invalid credentials.' });

        // Set session data directly (no regenerate — avoids new-cookie delivery issues)
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.joined = user.joined;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ ok: false, error: 'Session save error.' });
            }
            res.json({ ok: true, username: user.username });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ ok: false, error: 'Server error.' });
    }
});

/* ================================================================
   POST /api/auth/logout
   ================================================================ */
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('anon.sid');
        res.json({ ok: true });
    });
});

/* ================================================================
   GET /api/auth/me
   ================================================================ */
router.get('/me', (req, res) => {
    console.log('[/me] sessionID:', req.sessionID, '| userId:', req.session?.userId);
    if (!req.session || !req.session.userId) {
        return res.json({ ok: false, user: null });
    }
    res.json({
        ok: true,
        user: {
            userId: req.session.userId,
            username: req.session.username,
            joined: req.session.joined,
        },
    });
});

module.exports = router;
