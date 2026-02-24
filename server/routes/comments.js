'use strict';

const express = require('express');
const { db } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router({ mergeParams: true });

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ================================================================
   GET /api/posts/:postId/comments
   ================================================================ */
router.get('/', requireAuth, (req, res) => {
    const comments = db.prepare(
        `SELECT id, post_id, body, created_at
     FROM comments WHERE post_id = ?
     ORDER BY created_at ASC`
    ).all(req.params.postId);
    // author_id intentionally excluded from response
    res.json({ ok: true, comments });
});

/* ================================================================
   POST /api/posts/:postId/comments
   ================================================================ */
router.post('/', requireAuth, (req, res) => {
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ ok: false, error: 'Comment cannot be empty.' });
    if (body.trim().length > 1000) return res.status(400).json({ ok: false, error: 'Comment too long.' });

    // Verify post exists
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.postId);
    if (!post) return res.status(404).json({ ok: false, error: 'Post not found.' });

    const id = uid();
    const now = new Date().toISOString();
    db.prepare(
        'INSERT INTO comments (id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.params.postId, req.session.userId, body.trim(), now);

    const comment = db.prepare(
        'SELECT id, post_id, body, created_at FROM comments WHERE id = ?'
    ).get(id);
    res.status(201).json({ ok: true, comment });
});

/* ================================================================
   DELETE /api/comments/:id
   Mounted separately on /api/comments
   ================================================================ */
const deleteRouter = express.Router();
deleteRouter.delete('/:id', requireAuth, (req, res) => {
    const comment = db.prepare('SELECT id, author_id FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return res.status(404).json({ ok: false, error: 'Comment not found.' });
    if (comment.author_id !== req.session.userId) return res.status(403).json({ ok: false, error: 'Not your comment.' });

    db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = { commentsRouter: router, deleteRouter };
