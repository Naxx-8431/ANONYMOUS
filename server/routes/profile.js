'use strict';

const express = require('express');
const { db } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

/* ================================================================
   GET /api/profile/posts
   Current user's posts
   ================================================================ */
router.get('/posts', requireAuth, (req, res) => {
    const posts = db.prepare(
        `SELECT id, title, body, likes, dislikes, created_at
     FROM posts WHERE author_id = ?
     ORDER BY created_at DESC`
    ).all(req.session.userId);

    // Add myVote for each post
    const enriched = posts.map(post => {
        const vote = db.prepare(
            'SELECT type FROM votes WHERE user_id = ? AND post_id = ?'
        ).get(req.session.userId, post.id);
        const commentCount = db.prepare('SELECT COUNT(*) as cnt FROM comments WHERE post_id = ?').get(post.id).cnt;
        return { ...post, myVote: vote ? vote.type : null, commentCount };
    });

    res.json({ ok: true, posts: enriched });
});

/* ================================================================
   GET /api/profile/comments
   Current user's comments with parent post title
   ================================================================ */
router.get('/comments', requireAuth, (req, res) => {
    const comments = db.prepare(
        `SELECT c.id, c.post_id, c.body, c.created_at, p.title AS post_title
     FROM comments c
     LEFT JOIN posts p ON c.post_id = p.id
     WHERE c.author_id = ?
     ORDER BY c.created_at DESC`
    ).all(req.session.userId);
    // author_id excluded
    res.json({ ok: true, comments });
});

module.exports = router;
