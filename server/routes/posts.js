'use strict';

const express = require('express');
const { db } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Helper: enrich posts with the current user's vote */
function enrichPosts(posts, userId) {
    return posts.map(post => {
        const vote = db.prepare(
            'SELECT type FROM votes WHERE user_id = ? AND post_id = ?'
        ).get(userId, post.id);
        return { ...post, myVote: vote ? vote.type : null };
    });
}

/* ================================================================
   GET /api/posts
   All posts, newest first
   ================================================================ */
router.get('/', requireAuth, (req, res) => {
    const posts = db.prepare(
        `SELECT id, title, body, likes, dislikes, created_at
     FROM posts ORDER BY created_at DESC`
    ).all();
    res.json({ ok: true, posts: enrichPosts(posts, req.session.userId) });
});

/* ================================================================
   GET /api/posts/search?q=...
   ================================================================ */
router.get('/search', requireAuth, (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) {
        const posts = db.prepare(
            'SELECT id, title, body, likes, dislikes, created_at FROM posts ORDER BY created_at DESC'
        ).all();
        return res.json({ ok: true, posts: enrichPosts(posts, req.session.userId) });
    }
    const like = `%${q}%`;
    const posts = db.prepare(
        `SELECT id, title, body, likes, dislikes, created_at
     FROM posts WHERE title LIKE ? OR body LIKE ?
     ORDER BY created_at DESC`
    ).all(like, like);
    res.json({ ok: true, posts: enrichPosts(posts, req.session.userId) });
});

/* ================================================================
   GET /api/posts/:id
   Single post
   ================================================================ */
router.get('/:id', requireAuth, (req, res) => {
    const post = db.prepare(
        'SELECT id, title, body, likes, dislikes, created_at FROM posts WHERE id = ?'
    ).get(req.params.id);
    if (!post) return res.status(404).json({ ok: false, error: 'Post not found.' });
    const [enriched] = enrichPosts([post], req.session.userId);
    res.json({ ok: true, post: enriched });
});

/* ================================================================
   POST /api/posts
   Create post
   ================================================================ */
router.post('/', requireAuth, (req, res) => {
    const { title, body } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ ok: false, error: 'Title is required.' });
    if (!body || !body.trim()) return res.status(400).json({ ok: false, error: 'Body is required.' });
    if (title.trim().length > 120) return res.status(400).json({ ok: false, error: 'Title too long.' });
    if (body.trim().length > 4000) return res.status(400).json({ ok: false, error: 'Body too long.' });

    const id = uid();
    const now = new Date().toISOString();
    db.prepare(
        'INSERT INTO posts (id, author_id, title, body, likes, dislikes, created_at) VALUES (?, ?, ?, ?, 0, 0, ?)'
    ).run(id, req.session.userId, title.trim(), body.trim(), now);

    const post = db.prepare('SELECT id, title, body, likes, dislikes, created_at FROM posts WHERE id = ?').get(id);
    res.status(201).json({ ok: true, post: { ...post, myVote: null } });
});

/* ================================================================
   DELETE /api/posts/:id
   Delete own post (cascades to comments + votes via FK)
   ================================================================ */
router.delete('/:id', requireAuth, (req, res) => {
    const post = db.prepare('SELECT id, author_id FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).json({ ok: false, error: 'Post not found.' });
    if (post.author_id !== req.session.userId) return res.status(403).json({ ok: false, error: 'Not your post.' });

    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
