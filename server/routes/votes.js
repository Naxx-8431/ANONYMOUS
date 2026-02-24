'use strict';

const express = require('express');
const { db } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router({ mergeParams: true });

/* ================================================================
   POST /api/posts/:postId/vote
   Body: { type: 'like' | 'dislike' }
   Toggles: same type again = remove vote; different type = switch
   ================================================================ */
router.post('/', requireAuth, (req, res) => {
    try {
        const { type } = req.body;
        if (type !== 'like' && type !== 'dislike') {
            return res.status(400).json({ ok: false, error: 'Invalid vote type.' });
        }

        const postId = req.params.postId;
        const userId = req.session.userId;

        const post = db.prepare('SELECT id, likes, dislikes FROM posts WHERE id = ?').get(postId);
        if (!post) return res.status(404).json({ ok: false, error: 'Post not found.' });

        const existing = db.prepare('SELECT type FROM votes WHERE user_id = ? AND post_id = ?').get(userId, postId);

        if (existing && existing.type === type) {
            // ── Toggle off (same vote again) ────────────────────────
            db.prepare('DELETE FROM votes WHERE user_id = ? AND post_id = ?').run(userId, postId);
            const col = type === 'like' ? 'likes' : 'dislikes';
            db.prepare(`UPDATE posts SET ${col} = MAX(0, ${col} - 1) WHERE id = ?`).run(postId);
        } else if (existing) {
            // ── Switch vote ─────────────────────────────────────────
            const removeCol = existing.type === 'like' ? 'likes' : 'dislikes';
            const addCol = type === 'like' ? 'likes' : 'dislikes';
            db.prepare(`UPDATE posts SET ${removeCol} = MAX(0, ${removeCol} - 1) WHERE id = ?`).run(postId);
            db.prepare(`UPDATE posts SET ${addCol} = ${addCol} + 1 WHERE id = ?`).run(postId);
            db.prepare('UPDATE votes SET type = ? WHERE user_id = ? AND post_id = ?').run(type, userId, postId);
        } else {
            // ── New vote ────────────────────────────────────────────
            const addCol = type === 'like' ? 'likes' : 'dislikes';
            db.prepare(`UPDATE posts SET ${addCol} = ${addCol} + 1 WHERE id = ?`).run(postId);
            db.prepare('INSERT INTO votes (user_id, post_id, type) VALUES (?, ?, ?)').run(userId, postId, type);
        }

        const updated = db.prepare('SELECT likes, dislikes FROM posts WHERE id = ?').get(postId);

        // Determine current vote state
        const currentVote = db.prepare('SELECT type FROM votes WHERE user_id = ? AND post_id = ?').get(userId, postId);
        const myVote = currentVote ? currentVote.type : null;

        res.json({ ok: true, likes: updated.likes, dislikes: updated.dislikes, myVote });

    } catch (err) {
        console.error('Vote error:', err);
        res.status(500).json({ ok: false, error: 'Server error while voting: ' + err.message });
    }
});

module.exports = router;
