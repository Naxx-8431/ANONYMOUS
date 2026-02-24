'use strict';

const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const helmet = require('helmet');
const path = require('path');
const { init } = require('./db');

const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const { commentsRouter, deleteRouter } = require('./routes/comments');
const votesRoutes = require('./routes/votes');
const profileRoutes = require('./routes/profile');

const app = express();
const PORT = process.env.PORT || 3000;

/* ── Security headers ─────────────────────────────────────────── */
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
            styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', "'unsafe-inline'"],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            connectSrc: ["'self'", 'https://api.emailjs.com'],
            imgSrc: ["'self'", 'data:'],
        },
    },
}));

/* ── Body parsing ─────────────────────────────────────────────── */
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

/* ── Sessions ────────────────────────────────────────────────────── */
app.use(session({
    store: new MemoryStore({
        checkPeriod: 60 * 60 * 1000,  // prune expired sessions every 1h
    }),
    secret: process.env.SESSION_SECRET || 'anon__change_this_secret_in_production',
    resave: false,
    saveUninitialized: false,
    name: 'anon.sid',
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    },
}));

/* ── Static files (serve the frontend folder) ─────────────────── */
app.use(express.static(path.join(__dirname, '..')));

/* ── API Routes ───────────────────────────────────────────────── */
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/posts/:postId/comments', commentsRouter);
app.use('/api/comments', deleteRouter);
app.use('/api/posts/:postId/vote', votesRoutes);
app.use('/api/profile', profileRoutes);

/* ── 404 for unknown API routes ───────────────────────────────── */
app.use('/api', (req, res) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found.' });
});

/* ── SPA fallback – send welcome page ────────────────────────── */
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'welcome.html'));
});

/* ── Start ────────────────────────────────────────────────────── */
init().then(() => {
    app.listen(PORT, () => {
        console.log(`\n  ANONYMOUS server running → http://localhost:${PORT}\n`);
    });
}).catch(err => {
    console.error('Failed to init DB:', err);
    process.exit(1);
});
